import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { listConversationActions, parseConversationJsonFields } from "@/lib/modules/inbox/service"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { id } = await params
    const actions = await listConversationActions(id, workspaceId)
    if (!actions) return errorResponse("NOT_FOUND", "Conversación no encontrada", 404)
    return successResponse(parseConversationJsonFields({ actions }).actions ?? [])
  } catch (error) {
    return handleError(error, "ConversationAction")
  }
}
