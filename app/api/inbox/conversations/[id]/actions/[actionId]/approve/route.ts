import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { approveConversationAction, parseConversationJsonFields } from "@modules/inbox/service"

type Params = { params: Promise<{ id: string; actionId: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, session } = await requireWriteAccess(_request)
    const { id, actionId } = await params
    const action = await approveConversationAction({
      workspaceId,
      conversationId: id,
      actionId,
      approvedBy: session.userId,
    })

    if (!action) return errorResponse("NOT_FOUND", "Acción no encontrada", 404)

    return successResponse(parseConversationJsonFields({ actions: [action] }).actions?.[0] ?? action)
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse("VALIDATION_ERROR", error.message)
    }
    return handleError(error, "ConversationAction")
  }
}
