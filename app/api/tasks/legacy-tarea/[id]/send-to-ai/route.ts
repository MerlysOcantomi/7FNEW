import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { TareaNotFoundError, handoffLegacyTareaToAI } from "@modules/tasks/service"

type Params = { params: Promise<{ id: string }> }

/**
 * POST /api/tasks/legacy-tarea/[id]/send-to-ai
 *
 * Hand a legacy `Tarea` off to the AI lane from the Today surface.
 *
 * Legacy `Tarea` rows have no `WorkspaceTask` mirror, so the lane-move
 * endpoint (`PATCH /api/tasks/[id]/assignee`) can't touch them. This
 * route mirrors the Tarea into a `WorkspaceTask` (linked via `tareaId`)
 * assigned to AI, so the operator can hand visible Today work off to AI
 * without a dead-end. The aggregator dedups the original Tarea once the
 * mirror exists, so after a refetch the `tarea:` row becomes a `task:`
 * row in the AI lane.
 *
 * Behaviour:
 *   - Idempotent: reuses an existing mirror (same workspace + tareaId)
 *     instead of creating duplicates.
 *   - Does NOT mutate the underlying `Tarea` or the Prisma schema.
 *
 * Auth:
 *   - `requireWriteAccess` enforces MEMBER+ role in the active workspace.
 *   - `workspaceId` + `session.userId` come from auth — never from the
 *     request body / query.
 *
 * Responses:
 *   - 200 `{ success: true, data: { id } }` — the WorkspaceTask id.
 *   - 404 `NOT_FOUND` — the Tarea does not exist in this workspace.
 *   - 401 / 403 via `requireWriteAccess` (auth / RBAC).
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, session } = await requireWriteAccess(request)
    const { id } = await params

    const task = await handoffLegacyTareaToAI({
      workspaceId,
      tareaId: id,
      actorId: session.userId,
    })

    return successResponse({ id: task.id })
  } catch (error) {
    if (error instanceof TareaNotFoundError) {
      return errorResponse("NOT_FOUND", "Task not found", 404)
    }
    if (error instanceof Error) {
      return errorResponse("VALIDATION_ERROR", error.message)
    }
    return handleError(error, "WorkspaceTask")
  }
}
