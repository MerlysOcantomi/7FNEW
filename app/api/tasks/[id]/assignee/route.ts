import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import {
  WorkspaceTaskNotFoundError,
  updateWorkspaceTaskAssignment,
  type WorkspaceTaskAssignmentTarget,
} from "@modules/tasks/service"

type Params = { params: Promise<{ id: string }> }

/**
 * PATCH /api/tasks/[id]/assignee
 *
 * Move a `WorkspaceTask` between the user lane and the AI lane.
 *
 * Body shape (strict):
 *   {
 *     "to": "user" | "ai"
 *   }
 *
 * Behaviour:
 *   - `to: "user"` (Take over) → assigneeType="user", assigneeId=session.userId
 *   - `to: "ai"`  (Send to AI) → assigneeType="ai",   assigneeId=null
 *
 * Nothing else on the row is mutated — `status`, `executionMode`,
 * `suggestedBy`, and `sourceType` keep their meaning. In particular,
 * an AI-proposed row stays `status="proposed"` after a Take-over
 * attempt; this endpoint exists for lane moves only, NOT for
 * Approve / Dismiss (those live in the Inbox / Smart Hub).
 *
 * Auth:
 *   - `requireWriteAccess` enforces MEMBER+ role in the active workspace.
 *   - `session.userId` is the only source of truth for the new assignee
 *     when promoting to "user"; clients cannot pass an arbitrary id.
 *
 * Responses:
 *   - 200 `{ success: true, data: WorkspaceTaskRecord }` on success
 *   - 400 `VALIDATION_ERROR` when `to` is missing / not in the union
 *   - 404 `NOT_FOUND` when the task does not exist in this workspace
 *   - 401 / 403 via `requireWriteAccess` (auth / RBAC)
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, session } = await requireWriteAccess(request)
    const { id } = await params
    const body = (await request.json().catch(() => ({}))) as { to?: unknown }

    const to = body?.to
    if (to !== "user" && to !== "ai") {
      return errorResponse(
        "VALIDATION_ERROR",
        'Field "to" must be either "user" or "ai"',
      )
    }

    const updated = await updateWorkspaceTaskAssignment({
      workspaceId,
      taskId: id,
      to: to as WorkspaceTaskAssignmentTarget,
      actorId: session.userId,
    })

    return successResponse(updated)
  } catch (error) {
    if (error instanceof WorkspaceTaskNotFoundError) {
      return errorResponse("NOT_FOUND", "Task not found", 404)
    }
    if (error instanceof Error) {
      return errorResponse("VALIDATION_ERROR", error.message)
    }
    return handleError(error, "WorkspaceTask")
  }
}
