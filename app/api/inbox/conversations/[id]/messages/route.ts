import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { addMessage } from "@/lib/modules/inbox/service"
import { runConversationIntelligence } from "@/lib/modules/inbox/intelligence"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess()
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
