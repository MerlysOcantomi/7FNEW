import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"
import { addMessage } from "@modules/inbox/service"
import { runConversationIntelligence } from "@modules/inbox/intelligence"
import { sendOutboundEmail, type ConnectionSender } from "@modules/inbox/email-outbound"
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
}

async function sendOutboundAsync(input: OutboundAsyncInput) {
  const { workspaceId, conversationId, messageId, messageContent, sendMode } = input

  const conv = await db.conversation.findFirst({
    where: { id: conversationId, workspaceId },
    select: {
      channel: true,
      subject: true,
      connectionId: true,
      contact: { select: { email: true } },
      workspace: { select: { nombre: true, config: true } },
    },
  })

  if (conv?.channel !== "email") return
  const contactEmail = conv.contact?.email?.trim()
  if (!contactEmail) {
    console.warn(`[email-outbound] No contact email for conv=${conversationId}, skipping send`)
    return
  }

  let connectionSender: ConnectionSender | null = null
  if (conv.connectionId) {
    const conn = await db.channelConnection.findUnique({
      where: { id: conv.connectionId },
      select: { provider: true, config: true, credentials: true, externalAccountId: true },
    })
    if (conn) {
      const cfg = conn.config ? JSON.parse(conn.config) as Record<string, string> : null
      const fromEmail = cfg?.fromEmail || conn.externalAccountId || ""
      if (fromEmail) {
        connectionSender = {
          fromEmail,
          fromName: cfg?.fromName || null,
          provider: conn.provider as "resend" | "imap_smtp",
        }
        if (conn.provider === "imap_smtp" && conn.credentials && cfg) {
          connectionSender.smtpConfig = {
            smtpHost: cfg.smtpHost || "",
            smtpPort: Number(cfg.smtpPort) || 465,
            smtpSecure: cfg.smtpSecure !== "false",
            fromEmail,
            fromName: cfg.fromName || null,
          }
          connectionSender.encryptedCredentials = conn.credentials
        }
      }
    }
  }

  const fromAddress = connectionSender?.fromEmail
    || process.env.INBOX_FROM_EMAIL
    || process.env.RESEND_FROM_EMAIL
    || undefined

  let emailStatus = "pending"
  let emailError: string | undefined
  let resendId: string | undefined

  try {
    const result = await sendOutboundEmail({
      workspaceName: conv.workspace.nombre,
      contactEmail,
      subject: conv.subject ?? "",
      messageContent,
      workspaceConfig: conv.workspace.config,
      mode: sendMode,
      connectionSender,
      ...(input.parsedAttachments.length > 0 ? { attachments: input.parsedAttachments } : {}),
      ...(input.parsedCc.length > 0 ? { cc: input.parsedCc } : {}),
      ...(input.parsedBcc.length > 0 ? { bcc: input.parsedBcc } : {}),
      ...(input.parsedTo.length > 0 ? { to: input.parsedTo } : {}),
    })

    if (result.ok) {
      emailStatus = "sent"
      resendId = result.id
      console.log(`[email-outbound] OK conv=${conversationId} msg=${messageId} to=${contactEmail} from=${fromAddress} resendId=${result.id}`)
    } else {
      emailStatus = "failed"
      emailError = result.error || "Email delivery failed"
      console.error(`[email-outbound] FAILED conv=${conversationId} msg=${messageId} to=${contactEmail}: ${emailError}`)
    }
  } catch (err) {
    emailStatus = "failed"
    emailError = err instanceof Error ? err.message : "Email service unavailable"
    console.error(`[email-outbound] EXCEPTION conv=${conversationId} msg=${messageId} to=${contactEmail}: ${emailError}`)
  }

  try {
    const currentMeta = input.enrichedMetadata && typeof input.enrichedMetadata === "object" ? input.enrichedMetadata : {}
    await db.message.update({
      where: { id: messageId },
      data: {
        metadata: JSON.stringify({
          ...(currentMeta as Record<string, unknown>),
          emailStatus,
          ...(resendId ? { resendId } : {}),
          ...(emailError ? { emailError } : {}),
          ...(fromAddress ? { fromAddress } : {}),
          emailAttemptedAt: new Date().toISOString(),
        }),
      },
    })
  } catch (metaErr) {
    console.error(`[email-outbound] Could not update message metadata msg=${messageId}:`, metaErr)
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
    } = body

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
