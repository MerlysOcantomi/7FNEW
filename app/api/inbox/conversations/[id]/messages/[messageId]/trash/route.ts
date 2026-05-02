import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { setMessageTrashState } from "@modules/inbox/service"

type Params = { params: Promise<{ id: string; messageId: string }> }

/**
 * POST /api/inbox/conversations/[id]/messages/[messageId]/trash
 *
 * Toggles the soft-trash state of a single message. State lives in
 * `Message.metadata.trashedAt | trashedBy | trashReason` so this endpoint requires no schema
 * change. Distinct from conversation-level Trash (`Conversation.trashedAt`): this only hides
 * one bubble inside a thread; the conversation remains visible in the inbox list.
 *
 * Body: { trashed: boolean, reason?: string }
 *  - `trashed: true`  → set `trashedAt` (now), `trashedBy` (session.userId), optional `trashReason`.
 *  - `trashed: false` → restore: clear all three keys.
 *
 * Idempotent: if the message is already in the requested state we return the existing metadata
 * without writing.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, session } = await requireWriteAccess(request)
    const { id, messageId } = await params

    const body = await request.json().catch(() => ({}))
    const rawTrashed = (body as { trashed?: unknown }).trashed
    const rawReason = (body as { reason?: unknown }).reason

    if (typeof rawTrashed !== "boolean") {
      return errorResponse("VALIDATION_ERROR", "trashed must be a boolean")
    }

    const reason = typeof rawReason === "string" && rawReason.trim().length > 0 ? rawReason : null

    const result = await setMessageTrashState({
      workspaceId,
      conversationId: id,
      messageId,
      trashed: rawTrashed,
      reason,
      actorUserId: session?.userId ?? null,
    })

    if (!result) return errorResponse("NOT_FOUND", "Message not found", 404)

    return successResponse({
      messageId: result.id,
      trashed: rawTrashed,
      metadata: result.metadata,
    })
  } catch (error) {
    return handleError(error, "MessageTrash")
  }
}
