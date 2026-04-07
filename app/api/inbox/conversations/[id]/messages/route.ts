import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"
import { addMessage } from "@modules/inbox/service"
import { runConversationIntelligence } from "@modules/inbox/intelligence"
import { sendOutboundEmail } from "@modules/inbox/email-outbound"
import { notifyInboundMessage } from "@core/notifications/inbox"

type Params = { params: Promise<{ id: string }> }

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
    } = body

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "content es requerido")
    }

    const message = await addMessage({
      workspaceId,
      conversationId: id,
      role,
      content,
      direction,
      contentType,
      isInternal,
      metadata,
      sourceMessageId,
    })

    if (!message) {
      return errorResponse("NOT_FOUND", "Conversación no encontrada", 404)
    }

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

    let emailMeta: { emailSent?: boolean; emailError?: string } | undefined

    if (direction === "outbound" && !isInternal) {
      const conv = await db.conversation.findFirst({
        where: { id, workspaceId },
        select: {
          channel: true,
          subject: true,
          contact: { select: { email: true } },
          workspace: { select: { nombre: true, config: true } },
        },
      })

      if (conv?.channel === "email") {
        const contactEmail = conv.contact?.email?.trim()
        if (contactEmail) {
          try {
            const result = await sendOutboundEmail({
              workspaceName: conv.workspace.nombre,
              contactEmail,
              subject: conv.subject ?? "",
              messageContent: message.content,
              workspaceConfig: conv.workspace.config,
            })
            emailMeta = result.ok
              ? { emailSent: true }
              : { emailSent: false, emailError: result.error || "Email delivery failed" }
          } catch {
            emailMeta = { emailSent: false, emailError: "Email service unavailable" }
          }
        }
      }
    }

    await runConversationIntelligence({
      workspaceId,
      conversationId: id,
      trigger: "message_post",
    }).catch(() => null)

    return successResponse(message, emailMeta)
  } catch (error) {
    return handleError(error, "ConversationMessage")
  }
}
