import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { parseConversationJsonFields, updateConversationHandoff } from "@modules/inbox/service"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, session } = await requireWriteAccess(request)
    const { id } = await params
    const body = await request.json()

    const updated = await updateConversationHandoff({
      workspaceId,
      conversationId: id,
      reviewedBy: session.userId,
      data: {
        status: typeof body.status === "string" ? body.status : undefined,
        headline: typeof body.headline === "string" ? body.headline : undefined,
        summary: typeof body.summary === "string" ? body.summary : undefined,
        facts: Array.isArray(body.facts) ? body.facts : undefined,
        decisions: Array.isArray(body.decisions) ? body.decisions : undefined,
        pendingItems: Array.isArray(body.pendingItems) ? body.pendingItems : undefined,
        risks: Array.isArray(body.risks) ? body.risks : undefined,
        nextRecommendedAction:
          typeof body.nextRecommendedAction === "string" ? body.nextRecommendedAction : undefined,
      },
    })

    if (!updated) {
      return errorResponse("NOT_FOUND", "Handoff no encontrado", 404)
    }

    return successResponse(parseConversationJsonFields({ handoff: updated }).handoff)
  } catch (error) {
    return handleError(error, "ConversationHandoff")
  }
}
