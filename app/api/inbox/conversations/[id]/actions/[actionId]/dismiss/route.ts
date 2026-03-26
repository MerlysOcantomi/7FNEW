import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { dismissConversationAction, parseConversationJsonFields } from "@modules/inbox/service"

type Params = { params: Promise<{ id: string; actionId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, session } = await requireWriteAccess(request)
    const { id, actionId } = await params
    const body = await request.json().catch(() => ({}))

    const action = await dismissConversationAction({
      workspaceId,
      conversationId: id,
      actionId,
      dismissedBy: session.userId,
      executionNotes: typeof body.executionNotes === "string" ? body.executionNotes : null,
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
