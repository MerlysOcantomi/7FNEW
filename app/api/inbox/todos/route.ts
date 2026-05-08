import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"
import type {
  InboxTodoAssigneeType,
  InboxTodoPriority,
  InboxTodoStatus,
} from "@modules/inbox/todo-service"
import { listInboxScopedTasks } from "@modules/inbox/inbox-tasks-read"
import { createInboxScopedTask } from "@modules/inbox/inbox-tasks-write"

/**
 * Inbox To-do HTTP surface (legacy contract, WorkspaceTask backend).
 *
 * As of PR 8 the wire shape is unchanged but the storage is exclusively
 * `WorkspaceTask`:
 *
 *   - GET reads inbox-scoped WorkspaceTasks via `listInboxScopedTasks`
 *     and projects them into `InboxTodoRecord`.
 *   - POST creates a WorkspaceTask via `createInboxScopedTask` (no
 *     `InboxTodo` row is written) and returns the projected response.
 *
 * Why we kept the route mounted: the existing UI calls these paths
 * from a dozen places and every Phase-3 capture surface (smart-hub
 * pending items, internal-note TODO, message actions, NewTaskDialog).
 * Re-pointing every consumer would be a large-blast-radius change for
 * no end-user benefit; routing through `inbox-tasks-write` keeps the
 * API stable while the storage migrates underneath.
 */

/**
 * GET /api/inbox/todos
 *
 * Read path (PR 5 → PR 8):
 *   `listInboxScopedTasks` filters `WorkspaceTask` by
 *   `sourceType IN ("inbox_todo", "manual")` and projects each row
 *   into the same `InboxTodoRecord` wire shape `listTodos` used to
 *   return. The projector keys off `WorkspaceTask.id` for the wire
 *   `id` (PR 8 change — see `projectWorkspaceTaskAsInboxTodo` doc).
 *
 * Query params:
 *   - status        comma-separated subset of: open | done | dismissed | waiting
 *   - assigneeId    user id (exact match). Future: special token "unassigned".
 *   - conversationId restrict to a single conversation thread.
 *   - skip / take   pagination (defaults: 0 / 200, hard cap 500).
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess(request)
    const url = new URL(request.url)

    const skipRaw = url.searchParams.get("skip")
    const takeRaw = url.searchParams.get("take")
    const skip = skipRaw ? Math.max(0, parseInt(skipRaw, 10) || 0) : 0
    const take = takeRaw ? Math.max(1, parseInt(takeRaw, 10) || 200) : 200

    const todos = await listInboxScopedTasks({
      workspaceId,
      status: url.searchParams.get("status"),
      assigneeId: url.searchParams.get("assigneeId"),
      conversationId: url.searchParams.get("conversationId"),
      skip,
      take,
    })

    return successResponse(todos)
  } catch (error) {
    return handleError(error, "InboxTodo")
  }
}

/**
 * POST /api/inbox/todos
 *
 * Create a To-do. `title` is the only strictly-required body field;
 * everything else has sensible defaults (status=open, priority=normal,
 * assigneeType=me, createdSource=operator). `createdBy` is always
 * derived from the authenticated session — the body cannot override it
 * (audit safety).
 *
 * Storage (PR 8): `createInboxScopedTask` writes a single
 * `WorkspaceTask` row with `sourceType` resolved from `createdSource`
 * (`manual` for the New-task dialog, `inbox_todo` for everything else).
 * No `InboxTodo` row is created. Cross-tenant references
 * (conversationId, sourceMessageId, sourceActionId, sourceNoteId) are
 * validated in the service layer; mismatches return a VALIDATION_ERROR
 * rather than silently dropping the link.
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId, session } = await requireWriteAccess(request)
    const body = await request.json().catch(() => ({}))

    const title = typeof body?.title === "string" ? body.title.trim() : ""
    if (!title) {
      return errorResponse("VALIDATION_ERROR", "title is required")
    }

    /**
     * Optional ISO date strings → Date. Same forgiving behaviour as
     * the legacy `createTodo` route: a malformed string degrades to
     * `null` rather than 400, because "no due date" is recoverable
     * while "data lost on a typo" is not.
     */
    const parseDate = (raw: unknown): Date | null => {
      if (raw === null || raw === undefined || raw === "") return null
      if (typeof raw !== "string") return null
      const d = new Date(raw)
      return Number.isNaN(d.getTime()) ? null : d
    }

    const todo = await createInboxScopedTask({
      workspaceId,
      title,
      description: typeof body?.description === "string" ? body.description : null,
      conversationId: typeof body?.conversationId === "string" ? body.conversationId : null,
      sourceMessageId: typeof body?.sourceMessageId === "string" ? body.sourceMessageId : null,
      sourceActionId: typeof body?.sourceActionId === "string" ? body.sourceActionId : null,
      sourceNoteId: typeof body?.sourceNoteId === "string" ? body.sourceNoteId : null,
      status: typeof body?.status === "string" ? (body.status as InboxTodoStatus) : undefined,
      priority: typeof body?.priority === "string" ? (body.priority as InboxTodoPriority) : undefined,
      assigneeType:
        typeof body?.assigneeType === "string" ? (body.assigneeType as InboxTodoAssigneeType) : undefined,
      assigneeId: typeof body?.assigneeId === "string" ? body.assigneeId : null,
      dueAt: parseDate(body?.dueAt),
      remindAt: parseDate(body?.remindAt),
      createdBy: session.userId,
      createdSource: typeof body?.createdSource === "string" ? body.createdSource : "operator",
      metadata:
        body?.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
          ? (body.metadata as Record<string, unknown>)
          : null,
    })

    return successResponse(todo)
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse("VALIDATION_ERROR", error.message)
    }
    return handleError(error, "InboxTodo")
  }
}
