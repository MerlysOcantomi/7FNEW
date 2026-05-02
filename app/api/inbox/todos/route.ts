import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"
import {
  createTodo,
  listTodos,
  type InboxTodoAssigneeType,
  type InboxTodoPriority,
  type InboxTodoStatus,
} from "@modules/inbox/todo-service"

/**
 * GET /api/inbox/todos
 *
 * List To-do items scoped to the caller's workspace. Filters are read from query string and
 * intentionally narrow — listing is paginated server-side via `take` (max 500). The endpoint
 * returns an empty array (not 404) when there are no matches; the front-end can render an empty
 * state without branching on HTTP code.
 *
 * Query params:
 *   - status        comma-separated subset of: open | done | dismissed | waiting
 *   - assigneeId    user id (exact match). Future: special token "unassigned".
 *   - conversationId restrict to a single conversation thread.
 *   - skip / take   pagination (defaults: 0 / 200).
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess(request)
    const url = new URL(request.url)

    const skipRaw = url.searchParams.get("skip")
    const takeRaw = url.searchParams.get("take")
    const skip = skipRaw ? Math.max(0, parseInt(skipRaw, 10) || 0) : 0
    const take = takeRaw ? Math.max(1, parseInt(takeRaw, 10) || 200) : 200

    const todos = await listTodos({
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
 * Create a To-do. `title` is the only strictly-required body field; everything else has sensible
 * defaults (status=open, priority=normal, assigneeType=me, createdSource=operator). `createdBy`
 * is always taken from the authenticated session — body cannot override it (audit safety).
 *
 * Cross-tenant references (conversationId, sourceMessageId, sourceActionId) are validated in the
 * service layer; mismatches return a VALIDATION_ERROR rather than silently dropping the link.
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
     * Optional ISO date strings → Date. Accept null and undefined transparently. We deliberately
     * fail soft here: if the operator sends a bad date string we coerce to null rather than 400 —
     * the worst outcome is "no due date" which is recoverable, not data loss.
     */
    const parseDate = (raw: unknown): Date | null => {
      if (raw === null || raw === undefined || raw === "") return null
      if (typeof raw !== "string") return null
      const d = new Date(raw)
      return Number.isNaN(d.getTime()) ? null : d
    }

    const todo = await createTodo({
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
