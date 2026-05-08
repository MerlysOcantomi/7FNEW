import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import type {
  InboxTodoAssigneeType,
  InboxTodoPriority,
  InboxTodoStatus,
} from "@modules/inbox/todo-service"
import {
  updateInboxScopedTaskFields,
  updateInboxScopedTaskStatus,
} from "@modules/inbox/inbox-tasks-write"

type Params = { params: Promise<{ id: string }> }

/**
 * PATCH /api/inbox/todos/[id]
 *
 * Two distinct operations on the same endpoint:
 *
 *   1. Status change — body `{ status: "open" | "done" | "dismissed" | "waiting", reason? }`.
 *      Routed to `updateInboxScopedTaskStatus`, which keeps audit fields
 *      (completedAt/By, dismissedAt/Reason) consistent and handles
 *      reversibility (re-opening a "done" item clears its completion
 *      stamp, etc.). `reason` is only honoured for `status: "dismissed"`.
 *
 *   2. Field patch — any subset of { title, description, priority, assigneeType, assigneeId,
 *      dueAt, remindAt, metadata }. Routed to `updateInboxScopedTaskFields`. Status changes
 *      are NOT allowed via this path even if `status` is in the body — must use the dedicated
 *      branch.
 *
 * If the body contains BOTH a `status` and other patchable fields, we apply the field patch
 * first, then the status change. This lets a single request do "rename + mark done"
 * atomically from the operator's perspective. (Two writes, but the user-visible state is
 * consistent.)
 *
 * Storage (PR 8): every write goes against `WorkspaceTask`. The legacy `InboxTodo` table is
 * never mutated. The service layer accepts the wire `id` as either a `WorkspaceTask.id`
 * (canonical) or a stale `InboxTodo.id` (resolved via the `InboxTodo.workspaceTaskId`
 * forward link the legacy dual-write populated), so any UI session with cached old ids
 * keeps working through the deprecation window.
 *
 * No DELETE endpoint by design — this phase has no hard delete. Use status=dismissed instead.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, session } = await requireWriteAccess(request)
    const { id } = await params
    const body = await request.json().catch(() => ({}))

    const parseDate = (raw: unknown): Date | null | undefined => {
      if (raw === undefined) return undefined
      if (raw === null || raw === "") return null
      if (typeof raw !== "string") return undefined
      const d = new Date(raw)
      return Number.isNaN(d.getTime()) ? null : d
    }

    /** Field-level patch — only emit when at least one whitelisted key is present. */
    const fieldPatch: Parameters<typeof updateInboxScopedTaskFields>[0]["patch"] = {}
    let hasFieldPatch = false

    if (typeof body?.title === "string") {
      fieldPatch.title = body.title
      hasFieldPatch = true
    }
    if (body?.description !== undefined) {
      fieldPatch.description =
        typeof body.description === "string" ? body.description : null
      hasFieldPatch = true
    }
    if (typeof body?.priority === "string") {
      fieldPatch.priority = body.priority as InboxTodoPriority
      hasFieldPatch = true
    }
    if (typeof body?.assigneeType === "string") {
      fieldPatch.assigneeType = body.assigneeType as InboxTodoAssigneeType
      hasFieldPatch = true
    }
    if (body?.assigneeId !== undefined) {
      fieldPatch.assigneeId =
        typeof body.assigneeId === "string" ? body.assigneeId : null
      hasFieldPatch = true
    }
    const dueAt = parseDate(body?.dueAt)
    if (dueAt !== undefined) {
      fieldPatch.dueAt = dueAt
      hasFieldPatch = true
    }
    const remindAt = parseDate(body?.remindAt)
    if (remindAt !== undefined) {
      fieldPatch.remindAt = remindAt
      hasFieldPatch = true
    }
    if (body?.metadata !== undefined) {
      fieldPatch.metadata =
        body.metadata && typeof body.metadata === "object" && !Array.isArray(body.metadata)
          ? (body.metadata as Record<string, unknown>)
          : null
      hasFieldPatch = true
    }

    let result: Awaited<ReturnType<typeof updateInboxScopedTaskFields>> = null

    if (hasFieldPatch) {
      result = await updateInboxScopedTaskFields({ id, workspaceId, patch: fieldPatch })
      if (!result) return errorResponse("NOT_FOUND", "To-do not found", 404)
    }

    if (typeof body?.status === "string") {
      const status = body.status as InboxTodoStatus
      const reason = typeof body?.reason === "string" ? body.reason : null
      result = await updateInboxScopedTaskStatus({
        id,
        workspaceId,
        status,
        actorId: session.userId,
        reason,
      })
      if (!result) return errorResponse("NOT_FOUND", "To-do not found", 404)
    }

    if (!result) {
      return errorResponse("VALIDATION_ERROR", "no patchable fields provided")
    }

    return successResponse(result)
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse("VALIDATION_ERROR", error.message)
    }
    return handleError(error, "InboxTodo")
  }
}
