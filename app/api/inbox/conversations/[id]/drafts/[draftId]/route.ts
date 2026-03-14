import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { parseConversationJsonFields, updateConversationDraft } from "@/lib/modules/inbox/service"

type Params = { params: Promise<{ id: string; draftId: string }> }

const EDITABLE_DRAFT_STATUSES = new Set(["draft", "edited", "approved", "discarded"])

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, session } = await requireWriteAccess()
    const { id, draftId } = await params
    const body = await request.json()

    const updated = await updateConversationDraft({
      workspaceId,
      conversationId: id,
      draftId,
      reviewedBy: session.userId,
      data: {
        status:
          typeof body.status === "string" && EDITABLE_DRAFT_STATUSES.has(body.status)
            ? body.status
            : undefined,
        title: typeof body.title === "string" ? body.title : undefined,
        content: typeof body.content === "string" ? body.content : undefined,
        tone: typeof body.tone === "string" ? body.tone : undefined,
        targetChannel: typeof body.targetChannel === "string" ? body.targetChannel : undefined,
      },
    })

    if (!updated) {
      return errorResponse("NOT_FOUND", "Draft no encontrado", 404)
    }

    return successResponse(parseConversationJsonFields({ drafts: [updated] }).drafts?.[0] ?? updated)
  } catch (error) {
    return handleError(error, "ConversationDraft")
  }
}
