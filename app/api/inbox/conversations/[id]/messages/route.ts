import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"
import { addMessage } from "@modules/inbox/service"
import { runConversationIntelligence } from "@modules/inbox/intelligence"
import { sendOutboundEmail } from "@modules/inbox/email-outbound"

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

    if (direction === "outbound" && !isInternal) {
      void db.conversation
        .findFirst({
          where: { id, workspaceId },
          select: {
            channel: true,
            subject: true,
            contact: { select: { email: true } },
            workspace: { select: { nombre: true, config: true } },
          },
        })
        .then((conv) => {
          if (!conv || conv.channel !== "email") return
          const contactEmail = conv.contact?.email?.trim()
          if (!contactEmail) return
          return sendOutboundEmail({
            workspaceName: conv.workspace.nombre,
            contactEmail,
            subject: conv.subject ?? "",
            messageContent: message.content,
            workspaceConfig: conv.workspace.config,
          })
        })
        .catch(() => null)
    }

    await runConversationIntelligence({
      workspaceId,
      conversationId: id,
      trigger: "message_post",
    }).catch(() => null)

    return successResponse(message)
  } catch (error) {
    return handleError(error, "ConversationMessage")
  }
}
