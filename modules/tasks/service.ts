import { db } from "@core/db"
import type { Prisma } from "@/generated/prisma/client"

import {
  WORKSPACE_TASK_VALID_ASSIGNEE_TYPES,
  WORKSPACE_TASK_VALID_EXECUTION_MODES,
  WORKSPACE_TASK_VALID_PRIORITIES,
  WORKSPACE_TASK_VALID_STATUSES,
  WORKSPACE_TASK_VALID_SUGGESTED_BY,
  type WorkspaceTaskAssigneeType,
  type WorkspaceTaskExecutionMode,
  type WorkspaceTaskPriority,
  type WorkspaceTaskRecord,
  type WorkspaceTaskStatus,
  type WorkspaceTaskSuggestedBy,
} from "./types"

/**
 * WorkspaceTask service — global work-item foundation.
 *
 * PR 2 ships only the smallest safe surface:
 *   - `createWorkspaceTask` — used by future writers (New, Inbox dual-
 *     write, Fanny). No callers exist yet; this exists so PR 3 can
 *     start dual-writing without re-engineering the validation path.
 *   - `listWorkspaceTasks` — used by future readers (`/today`, the
 *     Tasks page). No callers exist yet; existing aggregators are
 *     unchanged.
 *
 * All status transitions, dismissal helpers, field updates, and
 * Today-shaped projections are intentionally OUT OF SCOPE. They will
 * arrive in PR 3 / PR 4 alongside the dual-write and the read swap.
 *
 * Multi-tenant safety: every public function takes `workspaceId` as
 * a non-optional parameter and the underlying queries filter on it
 * exactly. There is no path that infers the tenant from a related
 * row — callers must pass the workspaceId from `requireReadAccess` /
 * `requireWriteAccess`.
 *
 * Source link safety: cross-tenant references (conversation, message,
 * project, etc.) are NOT validated here yet because no writer uses
 * them in this PR. When the dual-write lands we will add the same
 * `assertSourcesBelongToWorkspace` pattern that `todo-service.ts`
 * uses, so a task can never silently reference another tenant's row.
 */

function parseTaskMetadata(raw: string | null | undefined): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>
    }
    return null
  } catch {
    return null
  }
}

/**
 * Format a raw Prisma row into the public `WorkspaceTaskRecord`
 * shape. Mirrors the formatter in `todo-service.ts` — narrows free
 * `String` columns into the typed unions and replaces the JSON
 * `metadata` blob with a parsed object (or `null`).
 */
function formatTask(task: {
  id: string
  workspaceId: string
  title: string
  description: string | null
  status: string
  priority: string
  assigneeType: string
  assigneeId: string | null
  dueAt: Date | null
  remindAt: Date | null
  completedAt: Date | null
  completedBy: string | null
  dismissedAt: Date | null
  dismissedReason: string | null
  sourceType: string | null
  sourceId: string | null
  sourceLabel: string | null
  conversationId: string | null
  messageId: string | null
  conversationActionId: string | null
  clienteId: string | null
  proyectoId: string | null
  eventoId: string | null
  tareaId: string | null
  createdBy: string
  suggestedBy: string | null
  executionMode: string | null
  metadata: string | null
  createdAt: Date
  updatedAt: Date
}): WorkspaceTaskRecord {
  return {
    ...task,
    status: task.status as WorkspaceTaskStatus,
    priority: task.priority as WorkspaceTaskPriority,
    assigneeType: task.assigneeType as WorkspaceTaskAssigneeType,
    suggestedBy: task.suggestedBy as WorkspaceTaskSuggestedBy | null,
    executionMode: task.executionMode as WorkspaceTaskExecutionMode | null,
    metadata: parseTaskMetadata(task.metadata),
  }
}

// ─── Create ─────────────────────────────────────────────────────────────────

export interface CreateWorkspaceTaskInput {
  workspaceId: string
  title: string
  description?: string | null
  status?: WorkspaceTaskStatus
  priority?: WorkspaceTaskPriority
  assigneeType?: WorkspaceTaskAssigneeType
  assigneeId?: string | null
  dueAt?: Date | null
  remindAt?: Date | null
  /** Origin of the task. `sourceType` is a free string so future
   *  callers (Fanny, client portal, etc.) can add new origins without
   *  a migration. Validation against an allow-list lives at the
   *  caller boundary, not here. */
  sourceType?: string | null
  sourceId?: string | null
  sourceLabel?: string | null
  conversationId?: string | null
  messageId?: string | null
  conversationActionId?: string | null
  clienteId?: string | null
  proyectoId?: string | null
  eventoId?: string | null
  tareaId?: string | null
  /** Required at the service boundary so the audit trail never lies
   *  about who created the row. Routes always derive this from the
   *  authenticated session, never from request bodies. */
  createdBy: string
  suggestedBy?: WorkspaceTaskSuggestedBy | null
  executionMode?: WorkspaceTaskExecutionMode | null
  metadata?: Record<string, unknown> | null
}

export async function createWorkspaceTask(
  input: CreateWorkspaceTaskInput,
): Promise<WorkspaceTaskRecord> {
  if (!input.workspaceId?.trim()) {
    throw new Error("workspaceId is required")
  }
  const title = input.title?.trim()
  if (!title) {
    throw new Error("title is required")
  }
  if (title.length > 500) {
    throw new Error("title is too long (max 500 chars)")
  }
  if (!input.createdBy?.trim()) {
    throw new Error("createdBy is required")
  }

  const status = input.status && WORKSPACE_TASK_VALID_STATUSES.has(input.status)
    ? input.status
    : "open"
  const priority = input.priority && WORKSPACE_TASK_VALID_PRIORITIES.has(input.priority)
    ? input.priority
    : "normal"
  const assigneeType =
    input.assigneeType && WORKSPACE_TASK_VALID_ASSIGNEE_TYPES.has(input.assigneeType)
      ? input.assigneeType
      : "unassigned"

  const suggestedBy =
    input.suggestedBy && WORKSPACE_TASK_VALID_SUGGESTED_BY.has(input.suggestedBy)
      ? input.suggestedBy
      : null
  const executionMode =
    input.executionMode && WORKSPACE_TASK_VALID_EXECUTION_MODES.has(input.executionMode)
      ? input.executionMode
      : null

  /**
   * Mirror of `todo-service.createTodo`: the optional source / link
   * IDs are stored verbatim as nullable scalars. We do NOT validate
   * cross-tenant ownership here yet because no writer uses these
   * fields in PR 2 — that validation arrives in PR 3 alongside the
   * dual-write path.
   */
  const task = await db.workspaceTask.create({
    data: {
      workspaceId: input.workspaceId.trim(),
      title,
      description: input.description?.trim() ? input.description.trim() : null,
      status,
      priority,
      assigneeType,
      assigneeId: input.assigneeId?.trim() ? input.assigneeId.trim() : null,
      dueAt: input.dueAt ?? null,
      remindAt: input.remindAt ?? null,
      sourceType: input.sourceType?.trim() ? input.sourceType.trim() : null,
      sourceId: input.sourceId?.trim() ? input.sourceId.trim() : null,
      sourceLabel: input.sourceLabel?.trim() ? input.sourceLabel.trim() : null,
      conversationId: input.conversationId?.trim() ? input.conversationId.trim() : null,
      messageId: input.messageId?.trim() ? input.messageId.trim() : null,
      conversationActionId: input.conversationActionId?.trim()
        ? input.conversationActionId.trim()
        : null,
      clienteId: input.clienteId?.trim() ? input.clienteId.trim() : null,
      proyectoId: input.proyectoId?.trim() ? input.proyectoId.trim() : null,
      eventoId: input.eventoId?.trim() ? input.eventoId.trim() : null,
      tareaId: input.tareaId?.trim() ? input.tareaId.trim() : null,
      createdBy: input.createdBy.trim(),
      suggestedBy,
      executionMode,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  })

  return formatTask(task)
}

// ─── List ───────────────────────────────────────────────────────────────────

export interface ListWorkspaceTasksParams {
  workspaceId: string
  /** Comma-separated subset of `WorkspaceTaskStatus` values, or a
   *  ready-made array. Unknown values are silently dropped — callers
   *  shouldn't 400 on a typo, they should just see fewer rows. */
  status?: string | string[] | null
  /** Filter by `assigneeId` (exact match). `null` and empty string
   *  are treated as "no filter". */
  assigneeId?: string | null
  /** Restrict to a single conversation. */
  conversationId?: string | null
  /** Restrict to a single project. Mirrors the Spanish-named scalar. */
  proyectoId?: string | null
  /** Restrict to a single client. Mirrors the Spanish-named scalar. */
  clienteId?: string | null
  /** Pagination — keep tight by default; the global Today/Tasks read
   *  paths will tune this in PR 4. Hard cap at 500 to protect the DB. */
  skip?: number
  take?: number
}

export async function listWorkspaceTasks(
  params: ListWorkspaceTasksParams,
): Promise<WorkspaceTaskRecord[]> {
  const { workspaceId, skip = 0, take = 200 } = params
  if (!workspaceId?.trim()) {
    throw new Error("workspaceId is required")
  }

  const where: Prisma.WorkspaceTaskWhereInput = { workspaceId: workspaceId.trim() }

  /**
   * Status filter — accepts either a comma-separated string (matches
   * the URL-friendly shape `todo-service.listTodos` uses) or a raw
   * array (handier for server-side callers). Empty results after
   * normalisation mean "no filter applied".
   */
  if (params.status) {
    const raw = Array.isArray(params.status)
      ? params.status
      : params.status.split(",")
    const statuses = raw
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is WorkspaceTaskStatus =>
        WORKSPACE_TASK_VALID_STATUSES.has(s as WorkspaceTaskStatus),
      )
    if (statuses.length === 1) {
      where.status = statuses[0]
    } else if (statuses.length > 1) {
      where.status = { in: statuses }
    }
  }

  if (params.assigneeId && params.assigneeId.trim()) {
    where.assigneeId = params.assigneeId.trim()
  }
  if (params.conversationId && params.conversationId.trim()) {
    where.conversationId = params.conversationId.trim()
  }
  if (params.proyectoId && params.proyectoId.trim()) {
    where.proyectoId = params.proyectoId.trim()
  }
  if (params.clienteId && params.clienteId.trim()) {
    where.clienteId = params.clienteId.trim()
  }

  const tasks = await db.workspaceTask.findMany({
    where,
    orderBy: [
      { status: "asc" },
      { dueAt: "asc" },
      { createdAt: "desc" },
    ],
    skip: Math.max(0, skip),
    take: Math.max(1, Math.min(500, take)),
  })

  return tasks.map(formatTask)
}

// ─── Assignment moves (Send to AI / Take over) ──────────────────────────────

/**
 * High-level "move work between owners" targets for the Today surface.
 *
 *   - `"user"` — the operator is taking the task over. We pin the assignee
 *                to the requesting `actorId` so the row appears in
 *                "My work" with `assigneeType="user"`.
 *   - `"ai"`   — the operator is handing the task off to the AI lane. We
 *                set `assigneeType="ai"` and clear `assigneeId` because
 *                "the AI" is not a single account id; the runtime will
 *                later attach a concrete agent identifier if needed. A
 *                deliberately conservative move: we do NOT also flip
 *                `executionMode`, `status`, `suggestedBy`, or `sourceType`
 *                — those carry independent semantics that the route can
 *                evolve in later PRs without re-shipping this one.
 */
export type WorkspaceTaskAssignmentTarget = "user" | "ai"

export interface UpdateWorkspaceTaskAssignmentInput {
  workspaceId: string
  taskId: string
  /** Where to move the task to. */
  to: WorkspaceTaskAssignmentTarget
  /** Authenticated session userId. When `to === "user"` becomes the new `assigneeId`. */
  actorId: string
}

/**
 * Move a task between the user and AI lanes by updating ONLY
 * `assigneeType` + `assigneeId`. Everything else on the row stays
 * untouched (status, executionMode, suggestedBy, sourceType, etc.).
 *
 * Returns the updated `WorkspaceTaskRecord`. Throws when:
 *   - any required arg is missing/blank
 *   - `to` is not `"user"` or `"ai"`
 *   - the task does not exist in the supplied workspace (the workspaceId
 *     predicate in the `where` clause prevents cross-tenant writes; we
 *     re-check the affected row count by catching Prisma's RecordNotFound)
 *
 * The route layer is responsible for translating thrown errors into HTTP
 * responses; the service only cares about the data shape.
 */
export async function updateWorkspaceTaskAssignment(
  input: UpdateWorkspaceTaskAssignmentInput,
): Promise<WorkspaceTaskRecord> {
  const workspaceId = input.workspaceId?.trim()
  const taskId = input.taskId?.trim()
  const actorId = input.actorId?.trim()

  if (!workspaceId) throw new Error("workspaceId is required")
  if (!taskId) throw new Error("taskId is required")
  if (!actorId) throw new Error("actorId is required")
  if (input.to !== "user" && input.to !== "ai") {
    throw new Error('to must be "user" or "ai"')
  }

  const data: Prisma.WorkspaceTaskUpdateInput =
    input.to === "user"
      ? { assigneeType: "user", assigneeId: actorId }
      : { assigneeType: "ai", assigneeId: null }

  /**
   * `updateMany` lets us scope the write by both `id` AND `workspaceId`
   * in a single query — Prisma's standard `update` would 404 before we
   * could verify the tenant. If `count === 0` the task either doesn't
   * exist or belongs to another workspace; either way the route should
   * return 404 without leaking which.
   */
  const result = await db.workspaceTask.updateMany({
    where: { id: taskId, workspaceId },
    data,
  })

  if (result.count === 0) {
    throw new WorkspaceTaskNotFoundError(taskId)
  }

  const updated = await db.workspaceTask.findFirst({
    where: { id: taskId, workspaceId },
  })

  if (!updated) {
    /** Defence-in-depth: a concurrent delete between update and re-read. */
    throw new WorkspaceTaskNotFoundError(taskId)
  }

  return formatTask(updated)
}

/**
 * Sentinel error thrown by `updateWorkspaceTaskAssignment` when the row
 * cannot be found or belongs to another workspace. Routes use `instanceof`
 * to choose 404 over the default 500.
 */
export class WorkspaceTaskNotFoundError extends Error {
  constructor(taskId: string) {
    super(`WorkspaceTask not found: ${taskId}`)
    this.name = "WorkspaceTaskNotFoundError"
  }
}

// ─── Legacy Tarea → WorkspaceTask handoff (Send to AI) ──────────────────────

/**
 * Sentinel error thrown by `handoffLegacyTareaToAI` when the legacy
 * `Tarea` cannot be found or belongs to another workspace. Routes use
 * `instanceof` to choose 404 over the default 500.
 */
export class TareaNotFoundError extends Error {
  constructor(tareaId: string) {
    super(`Tarea not found: ${tareaId}`)
    this.name = "TareaNotFoundError"
  }
}

/**
 * Map the legacy `Tarea.prioridad` vocabulary (Spanish) onto the
 * `WorkspaceTask.priority` storage vocabulary. Mirrors the read-side
 * mapping in `modules/today/aggregator.ts` (`normaliseTareaPrioridad`)
 * but targets the RAW storage label (`urgent`, not the UI `critical`).
 */
function mapTareaPrioridadToWorkspacePriority(
  raw: string | null | undefined,
): WorkspaceTaskPriority {
  switch ((raw ?? "").toLowerCase()) {
    case "baja":
      return "low"
    case "alta":
      return "high"
    case "urgente":
      return "urgent"
    case "media":
    default:
      return "normal"
  }
}

export interface HandoffLegacyTareaInput {
  workspaceId: string
  /** The legacy `Tarea.id` the operator clicked "Send to AI" on. */
  tareaId: string
  /** Authenticated session userId — recorded as `createdBy` on the new row. */
  actorId: string
}

/**
 * Hand a legacy `Tarea` off to the AI lane from the Today surface.
 *
 * Legacy `Tarea` rows have no `WorkspaceTask` mirror, so the lane-move
 * endpoint (`updateWorkspaceTaskAssignment`) can't touch them. This
 * helper bridges the gap by mirroring the Tarea into a `WorkspaceTask`
 * linked via `tareaId`, assigned to AI. The Today aggregator already
 * deduplicates a `Tarea` once a `WorkspaceTask` claims it via `tareaId`,
 * so after this runs the original `tarea:` row disappears and the new
 * `task:` row appears in the AI lane.
 *
 * Behaviour:
 *   - Loads the `Tarea` scoped to `workspaceId` (exact match → no
 *     cross-tenant leak); throws `TareaNotFoundError` when missing.
 *   - IDEMPOTENT: if a `WorkspaceTask` already links this `tareaId` in
 *     the same workspace it is REUSED — we only flip the assignment
 *     plane (`assigneeType="ai"`, `assigneeId=null`) and deliberately
 *     leave the operator-managed `status` (and everything else) intact.
 *   - Otherwise creates a new `WorkspaceTask` mirroring the Tarea's
 *     title / description / due / priority / client / project, with
 *     `status="open"`, `assigneeType="ai"`, `assigneeId=null`, and a
 *     `metadata.convertedFrom = "tarea"` breadcrumb.
 *
 * Nothing on the underlying `Tarea` is mutated — the schema is left
 * untouched and the legacy row keeps its own lifecycle. We only ADD a
 * WorkspaceTask mirror.
 */
export async function handoffLegacyTareaToAI(
  input: HandoffLegacyTareaInput,
): Promise<WorkspaceTaskRecord> {
  const workspaceId = input.workspaceId?.trim()
  const tareaId = input.tareaId?.trim()
  const actorId = input.actorId?.trim()

  if (!workspaceId) throw new Error("workspaceId is required")
  if (!tareaId) throw new Error("tareaId is required")
  if (!actorId) throw new Error("actorId is required")

  /**
   * Exact `id + workspaceId` match is the only tenant boundary that
   * matters here: a Tarea from another workspace (or a null-tenant
   * legacy row) must never be mirrored into this workspace.
   */
  const tarea = await db.tarea.findFirst({
    where: { id: tareaId, workspaceId },
    include: {
      proyecto: { select: { id: true, nombre: true } },
      cliente: { select: { id: true, nombre: true } },
    },
  })

  if (!tarea) throw new TareaNotFoundError(tareaId)

  /**
   * Idempotency: reuse any existing mirror so a double-click (or a
   * Tarea that was already handed off and later re-surfaced) never
   * spawns a duplicate WorkspaceTask. In practice the aggregator would
   * have already deduped a `tarea:` row that has a mirror, so this
   * branch mostly guards races; we keep it conservative and only touch
   * the assignment plane.
   */
  const existing = await db.workspaceTask.findFirst({
    where: { workspaceId, tareaId },
  })

  if (existing) {
    await db.workspaceTask.updateMany({
      where: { id: existing.id, workspaceId },
      data: { assigneeType: "ai", assigneeId: null },
    })
    const updated = await db.workspaceTask.findFirst({
      where: { id: existing.id, workspaceId },
    })
    if (!updated) throw new WorkspaceTaskNotFoundError(existing.id)
    return formatTask(updated)
  }

  const projectLabel = tarea.proyecto?.nombre ?? tarea.cliente?.nombre ?? null

  return createWorkspaceTask({
    workspaceId,
    tareaId,
    title: tarea.titulo,
    description: tarea.descripcion,
    status: "open",
    priority: mapTareaPrioridadToWorkspacePriority(tarea.prioridad),
    dueAt: tarea.fechaLimite,
    clienteId: tarea.clienteId,
    proyectoId: tarea.proyectoId,
    assigneeType: "ai",
    assigneeId: null,
    sourceType: "legacy_tarea",
    sourceLabel: projectLabel ? `From ${projectLabel}` : "From Project",
    createdBy: actorId,
    metadata: { convertedFrom: "tarea", tareaId },
  })
}
