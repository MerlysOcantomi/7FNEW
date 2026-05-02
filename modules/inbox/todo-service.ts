import { db } from "@core/db"
import type { Prisma } from "@/generated/prisma/client"

/**
 * InboxTodo service — operator-facing work queue.
 *
 * This module is intentionally small and provider-agnostic: no AI calls, no OpenAI/DeepSeek imports,
 * no auto-extraction. All write paths preserve the audit trail (createdBy, completedBy, etc.) and
 * keep `metadata` as a free JSON string parsed only via `parseTodoMetadata` so a corrupted blob
 * never crashes the API.
 *
 * Status flow (all reversible):
 *   open ↔ done       — operator marks complete; reopening clears completedAt/completedBy.
 *   open ↔ dismissed  — operator decides this never needed action; reopening clears dismissedAt.
 *   open ↔ waiting    — blocked by external party but still active. No completion fields touched.
 *
 * Source linkage (`conversationId`, `sourceMessageId`, `sourceActionId`, `sourceNoteId`) is
 * **validated against workspaceId** at create time so a To-do can never silently reference data
 * from another tenant. We do NOT FK-cascade these in the schema — keeping audit trail intact when
 * the source record is deleted/restored is a feature, not a bug.
 */

const VALID_STATUSES = new Set(["open", "done", "dismissed", "waiting"] as const)
const VALID_PRIORITIES = new Set(["low", "normal", "high", "urgent"] as const)
const VALID_ASSIGNEE_TYPES = new Set(["me", "fanny", "automation", "client", "team"] as const)

export type InboxTodoStatus = "open" | "done" | "dismissed" | "waiting"
export type InboxTodoPriority = "low" | "normal" | "high" | "urgent"
export type InboxTodoAssigneeType = "me" | "fanny" | "automation" | "client" | "team"

function parseTodoMetadata(raw: string | null | undefined): Record<string, unknown> | null {
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
 * Public response shape — keeps the raw DB record but replaces the `metadata` string with the
 * parsed object (or null on parse failure). Front-end never sees the JSON string directly.
 */
export interface InboxTodoRecord {
  id: string
  workspaceId: string
  conversationId: string | null
  sourceMessageId: string | null
  sourceActionId: string | null
  sourceNoteId: string | null
  title: string
  description: string | null
  status: InboxTodoStatus
  priority: InboxTodoPriority
  assigneeType: InboxTodoAssigneeType
  assigneeId: string | null
  dueAt: Date | null
  remindAt: Date | null
  createdBy: string
  createdSource: string
  completedAt: Date | null
  completedBy: string | null
  dismissedAt: Date | null
  dismissedReason: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

function formatTodo(todo: {
  id: string
  workspaceId: string
  conversationId: string | null
  sourceMessageId: string | null
  sourceActionId: string | null
  sourceNoteId: string | null
  title: string
  description: string | null
  status: string
  priority: string
  assigneeType: string
  assigneeId: string | null
  dueAt: Date | null
  remindAt: Date | null
  createdBy: string
  createdSource: string
  completedAt: Date | null
  completedBy: string | null
  dismissedAt: Date | null
  dismissedReason: string | null
  metadata: string | null
  createdAt: Date
  updatedAt: Date
}): InboxTodoRecord {
  return {
    ...todo,
    status: todo.status as InboxTodoStatus,
    priority: todo.priority as InboxTodoPriority,
    assigneeType: todo.assigneeType as InboxTodoAssigneeType,
    metadata: parseTodoMetadata(todo.metadata),
  }
}

// ─── List ───────────────────────────────────────────────────────────────────────

interface ListTodosParams {
  workspaceId: string
  /** Filter by status. Pass `"open,waiting"` (comma-separated) to combine. */
  status?: string | null
  /** Filter by assignee user id. `"unassigned"` is reserved for future use; for now treat as null. */
  assigneeId?: string | null
  /** Restrict to a single conversation. */
  conversationId?: string | null
  /** Pagination — keep small to start; lists are typically <500 open items per workspace. */
  skip?: number
  take?: number
}

export async function listTodos(params: ListTodosParams): Promise<InboxTodoRecord[]> {
  const { workspaceId, status, assigneeId, conversationId, skip = 0, take = 200 } = params

  const where: Prisma.InboxTodoWhereInput = { workspaceId }

  if (status && status.trim()) {
    const statuses = status
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter((s): s is InboxTodoStatus => VALID_STATUSES.has(s as InboxTodoStatus))
    if (statuses.length === 1) {
      where.status = statuses[0]
    } else if (statuses.length > 1) {
      where.status = { in: statuses }
    }
  }

  if (assigneeId && assigneeId.trim()) {
    where.assigneeId = assigneeId.trim()
  }

  if (conversationId && conversationId.trim()) {
    where.conversationId = conversationId.trim()
  }

  const todos = await db.inboxTodo.findMany({
    where,
    orderBy: [
      { status: "asc" },
      { dueAt: "asc" },
      { createdAt: "desc" },
    ],
    skip,
    take: Math.max(1, Math.min(500, take)),
  })

  return todos.map(formatTodo)
}

// ─── Create ─────────────────────────────────────────────────────────────────────

export interface CreateTodoInput {
  workspaceId: string
  title: string
  description?: string | null
  conversationId?: string | null
  sourceMessageId?: string | null
  sourceActionId?: string | null
  sourceNoteId?: string | null
  status?: InboxTodoStatus
  priority?: InboxTodoPriority
  assigneeType?: InboxTodoAssigneeType
  assigneeId?: string | null
  dueAt?: Date | null
  remindAt?: Date | null
  /** Defaults to `"operator"` at the route layer; service requires it explicitly to keep audit honest. */
  createdBy: string
  createdSource?: string
  metadata?: Record<string, unknown> | null
}

/**
 * Validate that any cross-tenant reference (conversation, message, action) actually belongs to
 * the same workspace. We do this in three small lookups instead of one big join — Turso latency
 * is tolerable and the queries are indexed.
 */
async function assertSourcesBelongToWorkspace(input: {
  workspaceId: string
  conversationId?: string | null
  sourceMessageId?: string | null
  sourceActionId?: string | null
}) {
  if (input.conversationId) {
    const conversation = await db.conversation.findFirst({
      where: { id: input.conversationId, workspaceId: input.workspaceId },
      select: { id: true },
    })
    if (!conversation) {
      throw new Error("conversationId does not belong to this workspace")
    }
  }

  if (input.sourceMessageId) {
    const message = await db.message.findFirst({
      where: { id: input.sourceMessageId, workspaceId: input.workspaceId },
      select: { id: true, conversationId: true },
    })
    if (!message) {
      throw new Error("sourceMessageId does not belong to this workspace")
    }
    /**
     * If both conversationId and sourceMessageId are set we enforce that the message belongs to
     * the named conversation. This catches accidental UI cross-wiring early.
     */
    if (input.conversationId && message.conversationId !== input.conversationId) {
      throw new Error("sourceMessageId belongs to a different conversation")
    }
  }

  if (input.sourceActionId) {
    const action = await db.conversationAction.findFirst({
      where: { id: input.sourceActionId, workspaceId: input.workspaceId },
      select: { id: true, conversationId: true },
    })
    if (!action) {
      throw new Error("sourceActionId does not belong to this workspace")
    }
    if (input.conversationId && action.conversationId !== input.conversationId) {
      throw new Error("sourceActionId belongs to a different conversation")
    }
  }
  /** sourceNoteId is also a Message id (internal note) — same validation path covers it. */
}

export async function createTodo(input: CreateTodoInput): Promise<InboxTodoRecord> {
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

  const status = input.status && VALID_STATUSES.has(input.status) ? input.status : "open"
  const priority = input.priority && VALID_PRIORITIES.has(input.priority) ? input.priority : "normal"
  const assigneeType = input.assigneeType && VALID_ASSIGNEE_TYPES.has(input.assigneeType)
    ? input.assigneeType
    : "me"

  await assertSourcesBelongToWorkspace({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId ?? null,
    sourceMessageId: input.sourceMessageId ?? input.sourceNoteId ?? null,
    sourceActionId: input.sourceActionId ?? null,
  })

  const now = new Date()
  const completedAt = status === "done" ? now : null
  const completedBy = status === "done" ? input.createdBy.trim() : null

  const todo = await db.inboxTodo.create({
    data: {
      workspaceId: input.workspaceId,
      conversationId: input.conversationId ?? null,
      sourceMessageId: input.sourceMessageId ?? null,
      sourceActionId: input.sourceActionId ?? null,
      sourceNoteId: input.sourceNoteId ?? null,
      title,
      description: input.description?.trim() ? input.description.trim() : null,
      status,
      priority,
      assigneeType,
      assigneeId: input.assigneeId?.trim() ? input.assigneeId.trim() : null,
      dueAt: input.dueAt ?? null,
      remindAt: input.remindAt ?? null,
      createdBy: input.createdBy.trim(),
      createdSource: input.createdSource?.trim() || "operator",
      completedAt,
      completedBy,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  })

  return formatTodo(todo)
}

// ─── Status transitions ─────────────────────────────────────────────────────────

interface UpdateTodoStatusInput {
  id: string
  workspaceId: string
  status: InboxTodoStatus
  actorId: string
  /** Only honored when `status === "dismissed"`; ignored otherwise. */
  reason?: string | null
}

/**
 * Reversible status update. The transition table:
 *
 *   target=done       → completedAt=now,  completedBy=actor,    dismissedAt/Reason cleared.
 *   target=open       → completedAt/By cleared,                 dismissedAt/Reason cleared.
 *   target=dismissed  → dismissedAt=now,  dismissedReason=reason, completedAt/By cleared.
 *   target=waiting    → only status change. completion/dismiss fields untouched (so reopening
 *                        from waiting → done still feels honest about when it was done).
 *
 * This is intentionally **strict about field clearing** so the audit trail never lies (a "done"
 * record always has completedAt; a "dismissed" record always has dismissedAt; reopening clears
 * both). Returns null when the todo doesn't exist or doesn't belong to the workspace.
 */
export async function updateTodoStatus(input: UpdateTodoStatusInput): Promise<InboxTodoRecord | null> {
  if (!VALID_STATUSES.has(input.status)) {
    throw new Error(`invalid status: ${input.status}`)
  }
  if (!input.actorId?.trim()) {
    throw new Error("actorId is required")
  }

  const existing = await db.inboxTodo.findFirst({
    where: { id: input.id, workspaceId: input.workspaceId },
  })
  if (!existing) return null

  if (existing.status === input.status) {
    return formatTodo(existing)
  }

  const now = new Date()
  const data: Prisma.InboxTodoUpdateInput = { status: input.status }

  if (input.status === "done") {
    data.completedAt = now
    data.completedBy = input.actorId.trim()
    data.dismissedAt = null
    data.dismissedReason = null
  } else if (input.status === "open") {
    data.completedAt = null
    data.completedBy = null
    data.dismissedAt = null
    data.dismissedReason = null
  } else if (input.status === "dismissed") {
    data.dismissedAt = now
    data.dismissedReason = input.reason?.trim() ? input.reason.trim() : null
    data.completedAt = null
    data.completedBy = null
  }
  /** "waiting" intentionally leaves completion/dismiss fields alone. */

  const todo = await db.inboxTodo.update({
    where: { id: input.id },
    data,
  })

  return formatTodo(todo)
}

// ─── Dismiss (convenience wrapper) ──────────────────────────────────────────────

interface DismissTodoInput {
  id: string
  workspaceId: string
  actorId: string
  reason?: string | null
}

export async function dismissTodo(input: DismissTodoInput): Promise<InboxTodoRecord | null> {
  return updateTodoStatus({
    id: input.id,
    workspaceId: input.workspaceId,
    status: "dismissed",
    actorId: input.actorId,
    reason: input.reason ?? null,
  })
}

// ─── Field updates (safe subset) ────────────────────────────────────────────────

export interface UpdateTodoFieldsInput {
  id: string
  workspaceId: string
  /** Only fields in this allow-list can be patched via the API. */
  patch: {
    title?: string
    description?: string | null
    priority?: InboxTodoPriority
    assigneeType?: InboxTodoAssigneeType
    assigneeId?: string | null
    dueAt?: Date | null
    remindAt?: Date | null
    metadata?: Record<string, unknown> | null
  }
}

/**
 * Surgical field update. Status changes are NOT allowed here — callers must use updateTodoStatus
 * so the audit fields stay consistent. Returns null when the todo doesn't exist or doesn't belong
 * to the workspace. Whitelisted fields only — anything else in `patch` is silently ignored.
 */
export async function updateTodoFields(input: UpdateTodoFieldsInput): Promise<InboxTodoRecord | null> {
  const existing = await db.inboxTodo.findFirst({
    where: { id: input.id, workspaceId: input.workspaceId },
    select: { id: true },
  })
  if (!existing) return null

  const data: Prisma.InboxTodoUpdateInput = {}

  if (typeof input.patch.title === "string") {
    const title = input.patch.title.trim()
    if (!title) throw new Error("title cannot be empty")
    if (title.length > 500) throw new Error("title is too long (max 500 chars)")
    data.title = title
  }

  if (input.patch.description !== undefined) {
    data.description = input.patch.description?.trim() ? input.patch.description.trim() : null
  }

  if (input.patch.priority !== undefined) {
    if (!VALID_PRIORITIES.has(input.patch.priority)) {
      throw new Error(`invalid priority: ${input.patch.priority}`)
    }
    data.priority = input.patch.priority
  }

  if (input.patch.assigneeType !== undefined) {
    if (!VALID_ASSIGNEE_TYPES.has(input.patch.assigneeType)) {
      throw new Error(`invalid assigneeType: ${input.patch.assigneeType}`)
    }
    data.assigneeType = input.patch.assigneeType
  }

  if (input.patch.assigneeId !== undefined) {
    data.assigneeId = input.patch.assigneeId?.trim() ? input.patch.assigneeId.trim() : null
  }

  if (input.patch.dueAt !== undefined) {
    data.dueAt = input.patch.dueAt
  }

  if (input.patch.remindAt !== undefined) {
    data.remindAt = input.patch.remindAt
  }

  if (input.patch.metadata !== undefined) {
    data.metadata = input.patch.metadata ? JSON.stringify(input.patch.metadata) : null
  }

  if (Object.keys(data).length === 0) {
    /** No-op patch — return current state without writing. */
    const current = await db.inboxTodo.findFirst({
      where: { id: input.id, workspaceId: input.workspaceId },
    })
    return current ? formatTodo(current) : null
  }

  const todo = await db.inboxTodo.update({
    where: { id: input.id },
    data,
  })

  return formatTodo(todo)
}
