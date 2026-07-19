import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"
import { addMessage } from "@modules/inbox/service"
import { runConversationIntelligence } from "@modules/inbox/intelligence"
import { sendConversationMessage } from "@modules/inbox/outbound-service"
import { notifyInboundMessage } from "@core/notifications/inbox"

type Params = { params: Promise<{ id: string }> }

interface OutboundAsyncInput {
  workspaceId: string
  conversationId: string
  messageId: string
  messageContent: string
  sendMode: "reply" | "reply_all" | "forward"
  parsedAttachments: Array<{ filename: string; url: string; contentType: string; size?: number }>
  parsedCc: string[]
  parsedBcc: string[]
  parsedTo: string[]
  enrichedMetadata: unknown
  /** Phase 3: per-message receipt confirmation toggle. */
  requestConfirmation: boolean
}

async function sendOutboundAsync(input: OutboundAsyncInput) {
  /**
   * INBOX-TRANSPORT-05C: the common outbound service owns the flow
   * (channel capability gate, transport resolution, send, delivery
   * projection, legacy metadata dual-write). The old inline email logic
   * lives in modules/inbox/transport/email-transport.ts. `enrichedMetadata`
   * is already persisted on the message row; the service merges over it.
   */
  void input.enrichedMetadata
  const outcome = await sendConversationMessage({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId,
    messageId: input.messageId,
    content: input.messageContent,
    mode: input.sendMode,
    cc: input.parsedCc,
    bcc: input.parsedBcc,
    to: input.parsedTo,
    attachments: input.parsedAttachments,
    requestConfirmation: input.requestConfirmation,
  })
  if (outcome.status === "skipped") {
    console.warn(
      `[email-outbound] Send skipped conv=${input.conversationId} msg=${input.messageId}: ${outcome.errorCode}`,
    )
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess(request)
    const { id } = await params
    const body = await request.json()
    const {
      role = "operator",
      content,
      direction = "outbound",
      contentType = "text",
      isInternal = false,
      metadata = null,
      sourceMessageId = null,
      attachments = null,
      cc = null,
      bcc = null,
      to = null,
      mode = "reply",
      requestConfirmation = false,
    } = body
    /**
     * Receipt confirmation is opt-in per outbound email message. Internal notes never trigger
     * outbound delivery, so the flag is meaningless there; we still strip it defensively.
     */
    const askConfirmRequest = direction === "outbound" && !isInternal && requestConfirmation === true

    const parsedAttachments: Array<{ filename: string; url: string; contentType: string; size?: number }> =
      Array.isArray(attachments) ? attachments.filter((a: unknown) => a && typeof a === "object" && "url" in (a as Record<string, unknown>)) : []

    const parsedCc: string[] = Array.isArray(cc) ? cc.filter((v: unknown) => typeof v === "string" && v.includes("@")) : []
    const parsedBcc: string[] = Array.isArray(bcc) ? bcc.filter((v: unknown) => typeof v === "string" && v.includes("@")) : []
    const parsedTo: string[] = Array.isArray(to) ? to.filter((v: unknown) => typeof v === "string" && v.includes("@")) : []
    const sendMode: "reply" | "reply_all" | "forward" = ["reply", "reply_all", "forward"].includes(mode) ? mode : "reply"

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "content es requerido")
    }

    const metaBase = metadata && typeof metadata === "object" ? metadata : {}
    const emailFields: Record<string, unknown> = {}
    if (parsedAttachments.length > 0) emailFields.attachments = parsedAttachments
    if (parsedCc.length > 0) emailFields.cc = parsedCc
    if (parsedBcc.length > 0) emailFields.bcc = parsedBcc
    if (parsedTo.length > 0) emailFields.to = parsedTo
    if (sendMode !== "reply") emailFields.mode = sendMode
    if (askConfirmRequest) emailFields.confirmRequested = true
    const enrichedMetadata = Object.keys(emailFields).length > 0
      ? { ...metaBase, ...emailFields }
      : metadata

    // Resolve connectionId from conversation for outbound messages
    let convConnectionId: string | null = null
    if (direction === "outbound" && !isInternal) {
      const convForConn = await db.conversation.findFirst({
        where: { id, workspaceId },
        select: { connectionId: true },
      })
      convConnectionId = convForConn?.connectionId ?? null
    }

    const message = await addMessage({
      workspaceId,
      conversationId: id,
      role,
      content,
      direction,
      contentType,
      isInternal,
      metadata: enrichedMetadata,
      sourceMessageId,
      connectionId: convConnectionId,
    })

    if (!message) {
      return errorResponse("NOT_FOUND", "Conversación no encontrada", 404)
    }

    // ── Return response immediately; all remaining work is fire-and-forget ──

    if (direction === "inbound" && !isInternal) {
      void db.conversation
        .findFirst({
          where: { id, workspaceId },
          select: { assignedTo: true, subject: true, channel: true, contact: { select: { nombre: true } } },
        })
        .then((conv) => {
          if (!conv) return
          return notifyInboundMessage({
            workspaceId,
            conversationId: id,
            subject: conv.subject,
            contactName: conv.contact?.nombre,
            channel: conv.channel,
            assignedTo: conv.assignedTo,
          })
        })
        .catch(() => null)
    }

    if (direction === "outbound" && !isInternal) {
      void sendOutboundAsync({
        workspaceId,
        conversationId: id,
        messageId: message.id,
        messageContent: message.content,
        sendMode,
        parsedAttachments,
        parsedCc,
        parsedBcc,
        parsedTo,
        enrichedMetadata,
        requestConfirmation: askConfirmRequest,
      }).catch((err) => {
        console.error(`[email-outbound] Background send failed conv=${id} msg=${message.id}:`, err)
      })
    }

    void runConversationIntelligence({
      workspaceId,
      conversationId: id,
      trigger: "message_post",
    }).catch((err) => {
      console.error(`[inbox] Intelligence failed conv=${id}:`, err)
    })

    return successResponse(message, { emailStatus: "pending" })
  } catch (error) {
    return handleError(error, "ConversationMessage")
  }
}
