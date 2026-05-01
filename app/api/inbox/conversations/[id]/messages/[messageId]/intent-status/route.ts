import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { setMessageIntentStatus } from "@modules/inbox/service"

type Params = { params: Promise<{ id: string; messageId: string }> }

/**
 * POST /api/inbox/conversations/[id]/messages/[messageId]/intent-status
 *
 * Marks the actionable intent of a single message as "done" or "open" (toggle). State lives
 * in `Message.metadata.intentStatus` so this endpoint requires no schema changes. It is the
 * minimal counterpart of the More menu's "Mark latest/selected as done" action.
 *
 * Body: { status: "done" | "open" }
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess(request)
    const { id, messageId } = await params

    const body = await request.json().catch(() => ({}))
    const rawStatus = (body as { status?: unknown }).status
    if (rawStatus !== "done" && rawStatus !== "open") {
      return errorResponse("VALIDATION_ERROR", "status must be 'done' or 'open'")
    }

    const result = await setMessageIntentStatus({
      workspaceId,
      conversationId: id,
      messageId,
      status: rawStatus,
    })

    if (!result) return errorResponse("NOT_FOUND", "Message not found", 404)

    return successResponse({
      messageId: result.id,
      intentStatus: rawStatus,
      metadata: result.metadata,
    })
  } catch (error) {
    return handleError(error, "MessageIntentStatus")
  }
}
