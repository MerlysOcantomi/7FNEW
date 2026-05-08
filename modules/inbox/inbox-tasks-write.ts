import { db } from "@core/db"
import type { Prisma } from "@/generated/prisma/client"

import type {
  InboxTodoAssigneeType,
  InboxTodoPriority,
  InboxTodoRecord,
  InboxTodoStatus,
} from "./todo-service"
import { projectWorkspaceTaskAsInboxTodo } from "./inbox-tasks-read"

/**
 * Inbox tab write path — backs `POST /api/inbox/todos` and
 * `PATCH /api/inbox/todos/{id}` directly on `WorkspaceTask`, with
 * zero `InboxTodo` writes.
 *
 * Why this module exists (PR 8):
 * ──────────────────────────────
 * PR 3 introduced a dual-write where every `InboxTodo` insert was
 * mirrored into a `WorkspaceTask`. PR 4 / PR 5 then routed every
 * read through the mirror, and PR 6 / PR 7 added new `WorkspaceTask`
 * writers (operator approve→execute, Fanny suggestions). With both
 * sides covered, the dual-write became pure overhead — every new
 * `InboxTodo` row was effectively forensic data with no live consumer.
 *
 * PR 8 cuts the cord:
 *   - The legacy inbox endpoints stay live (UI compatibility).
 *   - Their service-layer calls now route here, which writes only
 *     `WorkspaceTask` rows and never touches `InboxTodo`.
 *   - The wire shape returned to clients is still
 *     `InboxTodoRecord`-shaped (projected via the existing read
 *     module) so no UI component re-renders against a different
 *     contract.
 *
 * Identity contract going forward:
 *   The wire `id` returned by every endpoint in this module is the
 *   `WorkspaceTask.id`. Any PATCH that arrives with a stale
 *   `InboxTodo.id` is resolved via the `InboxTodo.workspaceTaskId`
 *   forward link populated by the legacy dual-write — so callers
 *   that cached old ids during the transition window keep working.
 *
 * `InboxTodo` writes
 *   The functions in `./todo-service.ts` (`createTodo`,
 *   `updateTodoStatus`, `updateTodoFields`, `dismissTodo`) are
 *   `@deprecated` and no longer reachable from the HTTP surface.
 *   They remain exported for one-off rescue scripts and the historic
 *   backfill path; production traffic always goes through this
 *   module.
 */

const VALID_STATUSES = new Set<InboxTodoStatus>([
  "open",
  "done",
  "dismissed",
  "waiting",
])

const VALID_PRIORITIES = new Set<InboxTodoPriority>([
  "low",
  "normal",
  "high",
  "urgent",
])

const VALID_ASSIGNEE_TYPES = new Set<InboxTodoAssigneeType>([
  "me",
  "fanny",
  "automation",
  "client",
  "team",
])

// ─── Inbox → WorkspaceTask vocabulary mapping ───────────────────────────────

/**
 * Forward-map the legacy `InboxTodoAssigneeType` (which the HTTP
 * surface still accepts on the wire) to the canonical
 * `WorkspaceTaskAssigneeType` vocabulary. Identical mapping to the
 * dual-write `mapAssigneeType` from `modules/tasks/inbox-todo-mapping.ts`
 * — duplicated here so the deprecation of that module stays clean.
 */
function mapAssigneeType(raw: InboxTodoAssigneeType): "user" | "ai" | "team" | "unassigned" {
  switch (raw) {
    case "me":
      return "user"
    case "fanny":
    case "automation":
      return "ai"
    case "team":
      return "team"
    case "client":
    default:
      return "unassigned"
  }
}

/**
 * Map the wire `createdSource` to the canonical `WorkspaceTask.sourceType`:
 *   - `"manual"` (NewTaskDialog and inline manual captures) → `"manual"`
 *   - everything else (operator, automation, ai_pending_item,
 *     internal_note…) → `"inbox_todo"`
 *
 * The Inbox To-do tab read path filters on
 * `sourceType IN ("inbox_todo", "manual")`, so both branches stay
 * visible in the existing UI — no behaviour change for callers.
 */
function mapSourceType(createdSource: string): string {
  return createdSource === "manual" ? "manual" : "inbox_todo"
}

/**
 * Build the metadata blob attached to the WorkspaceTask. We keep the
 * `inboxTodo*` namespace used by the legacy dual-write so the read
 * projection (`projectWorkspaceTaskAsInboxTodo`) round-trips the same
 * fields without any PR-8-specific branching:
 *
 *   - `inboxTodoCreatedSource` — preserves the legacy `createdSource`
 *     string so the wire response can show the same value the caller
 *     POSTed (operator, automation, internal_note, …).
 *   - `inboxTodoAssigneeType` — preserves the legacy assignee
 *     vocabulary because the forward mapping is lossy
 *     (`fanny`/`automation` → `ai`, `client` → `unassigned`). Without
 *     this, the read projection would default everything to `me`.
 *   - `inboxTodoSourceNoteId` — `WorkspaceTask` has no first-class
 *     column for the legacy `sourceNoteId`, so we tuck it into
 *     metadata where the read projection expects it.
 *   - `inboxTodoMetadata` — operator-supplied free metadata, parsed
 *     and re-stringified inside the JSON envelope.
 */
function buildMetadata(input: {
  createdSource: string
  assigneeType: InboxTodoAssigneeType
  sourceNoteId: string | null
  metadata: Record<string, unknown> | null
}): string {
  const meta: Record<string, unknown> = {
    inboxTodoCreatedSource: input.createdSource,
    inboxTodoAssigneeType: input.assigneeType,
  }
  if (input.sourceNoteId) {
    meta.inboxTodoSourceNoteId = input.sourceNoteId
  }
  if (input.metadata && typeof input.metadata === "object") {
    meta.inboxTodoMetadata = input.metadata
  }
  return JSON.stringify(meta)
}

/**
 * Status flow guard — accepts only the four `InboxTodo`-vocabulary
 * statuses that the legacy API surface knows. The `WorkspaceTask`
 * vocabulary additionally has `proposed` and `in_progress`, but those
 * are PR 6 / PR 7 territory and never reachable from the inbox HTTP
 * routes.
 */
function normalizeStatus(raw: string | undefined, fallback: InboxTodoStatus): InboxTodoStatus {
  if (raw && VALID_STATUSES.has(raw as InboxTodoStatus)) {
    return raw as InboxTodoStatus
  }
  return fallback
}

// ─── Cross-tenant validation ────────────────────────────────────────────────

/**
 * Same audit guard the legacy `todo-service.assertSourcesBelongToWorkspace`
 * applied: every cross-tenant reference (conversation, message, action)
 * is verified to belong to the caller's workspace BEFORE we open a
 * write transaction. Fails loud with a `VALIDATION_ERROR` so the route
 * layer can return a 400 instead of leaking a row that points at
 * another tenant's data.
 *
 * Note: `sourceNoteId` is also a `Message.id` (internal notes are
 * just messages with `isInternal=true`), so it's validated as a
 * message — same path the legacy code used.
 */
async function assertSourcesBelongToWorkspace(input: {
  workspaceId: string
  conversationId?: string | null
  sourceMessageId?: string | null
  sourceActionId?: string | null
  sourceNoteId?: string | null
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

  const messageId = input.sourceMessageId ?? input.sourceNoteId ?? null
  if (messageId) {
    const message = await db.message.findFirst({
      where: { id: messageId, workspaceId: input.workspaceId },
      select: { id: true, conversationId: true },
    })
    if (!message) {
      throw new Error("sourceMessageId does not belong to this workspace")
    }
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
}

// ─── Read-back projection helper ────────────────────────────────────────────

/**
 * Fetch a single inbox-scoped row by `WorkspaceTask.id` and project
 * it through the same projector the list endpoint uses. Centralising
 * the read-back here keeps every endpoint in this module returning
 * the byte-identical wire shape clients see from GET.
 *
 * Returns `null` when the row doesn't exist or doesn't belong to the
 * caller's workspace, so write-then-read flows can convert that into
 * a 404 cleanly.
 */
async function fetchProjectedById(
  workspaceId: string,
  workspaceTaskId: string,
): Promise<InboxTodoRecord | null> {
  const row = await db.workspaceTask.findFirst({
    where: { id: workspaceTaskId, workspaceId },
  })
  if (!row) return null
  return projectWorkspaceTaskAsInboxTodo(row)
}

// ─── ID resolver (PR 8 backward-compat shim) ────────────────────────────────

/**
 * Resolve a wire `id` to the canonical `WorkspaceTask.id`.
 *
 * Acceptance rules:
 *   1. The id is a `WorkspaceTask.id` already → use it.
 *   2. Fallback: the id is a stale `InboxTodo.id` from before PR 8
 *      flipped the wire id. Look up the `InboxTodo` in the same
 *      workspace, follow `workspaceTaskId`, and use that.
 *
 * Returns `null` when the id matches neither, signalling a 404. The
 * second branch is bounded — only legacy rows have a non-null
 * `workspaceTaskId` link. Once a deprecation window passes the
 * fallback can be removed.
 */
async function resolveWorkspaceTaskId(
  workspaceId: string,
  id: string,
): Promise<string | null> {
  if (!id || !id.trim()) return null
  const trimmed = id.trim()

  const direct = await db.workspaceTask.findFirst({
    where: { id: trimmed, workspaceId },
    select: { id: true },
  })
  if (direct) return direct.id

  const legacy = await db.inboxTodo.findFirst({
    where: { id: trimmed, workspaceId },
    select: { workspaceTaskId: true },
  })
  if (legacy?.workspaceTaskId) {
    /** Sanity check the linked WorkspaceTask is in the same workspace
     *  before handing the id back. Belt-and-braces against a corrupt
     *  link from the legacy dual-write era. */
    const linked = await db.workspaceTask.findFirst({
      where: { id: legacy.workspaceTaskId, workspaceId },
      select: { id: true },
    })
    if (linked) return linked.id
  }

  return null
}

// ─── Create ─────────────────────────────────────────────────────────────────

export interface CreateInboxScopedTaskInput {
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
  /** Always derived from the authenticated session at the route
   *  layer. The service requires it explicitly so audit data can
   *  never silently drop. */
  createdBy: string
  createdSource?: string
  metadata?: Record<string, unknown> | null
}

/**
 * Create an inbox-scoped `WorkspaceTask` and return it in the wire
 * shape the legacy `/api/inbox/todos` POST callers expect.
 *
 * Audit:
 *   - `createdBy` is recorded directly on the WorkspaceTask.
 *   - `completedAt`/`completedBy` are pre-set when the caller passes
 *     `status: "done"`, mirroring the old `createTodo` behaviour.
 *   - Cross-tenant linkage is validated outside the transaction (read-
 *     only, idempotent) so a 400 fires before any write.
 *
 * Note on `sourceId`:
 *   For organic inbox creates we don't have an upstream ID to point
 *   at, so `sourceId` falls back to `conversationId` when present and
 *   `null` otherwise. The Prisma column is nullable, so this is safe.
 */
export async function createInboxScopedTask(
  input: CreateInboxScopedTaskInput,
): Promise<InboxTodoRecord> {
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

  const status = normalizeStatus(input.status, "open")
  const priority =
    input.priority && VALID_PRIORITIES.has(input.priority) ? input.priority : "normal"
  const assigneeType: InboxTodoAssigneeType =
    input.assigneeType && VALID_ASSIGNEE_TYPES.has(input.assigneeType)
      ? input.assigneeType
      : "me"

  const createdSource = input.createdSource?.trim() || "operator"

  await assertSourcesBelongToWorkspace({
    workspaceId: input.workspaceId,
    conversationId: input.conversationId ?? null,
    sourceMessageId: input.sourceMessageId ?? null,
    sourceActionId: input.sourceActionId ?? null,
    sourceNoteId: input.sourceNoteId ?? null,
  })

  const now = new Date()
  const completedAt = status === "done" ? now : null
  const completedBy = status === "done" ? input.createdBy.trim() : null

  const data: Prisma.WorkspaceTaskUncheckedCreateInput = {
    workspaceId: input.workspaceId,
    title,
    description: input.description?.trim() ? input.description.trim() : null,
    status,
    priority,
    assigneeType: mapAssigneeType(assigneeType),
    assigneeId: input.assigneeId?.trim() ? input.assigneeId.trim() : null,
    dueAt: input.dueAt ?? null,
    remindAt: input.remindAt ?? null,
    completedAt,
    completedBy,
    sourceType: mapSourceType(createdSource),
    /**
     * `sourceId` keeps a non-null value whenever we have one to point
     * at (the originating conversation). For pure-manual captures
     * with no conversation context, `null` is acceptable — the read
     * projection already uses `WorkspaceTask.id` as the wire id.
     */
    sourceId: input.conversationId?.trim() ? input.conversationId.trim() : null,
    sourceLabel: input.conversationId ? "From Inbox" : null,
    conversationId: input.conversationId?.trim() ? input.conversationId.trim() : null,
    messageId: input.sourceMessageId?.trim() ? input.sourceMessageId.trim() : null,
    conversationActionId: input.sourceActionId?.trim() ? input.sourceActionId.trim() : null,
    createdBy: input.createdBy.trim(),
    suggestedBy: null,
    executionMode: "manual",
    metadata: buildMetadata({
      createdSource,
      assigneeType,
      sourceNoteId: input.sourceNoteId?.trim() ? input.sourceNoteId.trim() : null,
      metadata: input.metadata ?? null,
    }),
  }

  const created = await db.workspaceTask.create({ data })

  const projected = await fetchProjectedById(input.workspaceId, created.id)
  if (!projected) {
    /**
     * Should be unreachable — we just inserted the row in the same
     * workspace. If we land here something's wrong upstream and we'd
     * rather fail loud than silently return a malformed record.
     */
    throw new Error("Failed to project newly-created WorkspaceTask as InboxTodoRecord")
  }
  return projected
}

// ─── Update — status ────────────────────────────────────────────────────────

interface UpdateInboxScopedTaskStatusInput {
  /** Wire id from the client. May be a `WorkspaceTask.id` (canonical)
   *  or a legacy `InboxTodo.id` (resolved via the dual-write link). */
  id: string
  workspaceId: string
  status: InboxTodoStatus
  actorId: string
  /** Honored only for `status === "dismissed"`. */
  reason?: string | null
}

/**
 * Reversible status update on a WorkspaceTask, in the same audit
 * shape the legacy `updateTodoStatus` enforced:
 *
 *   target=done       → completedAt=now, completedBy=actor, dismissed* cleared
 *   target=open       → completedAt/By cleared, dismissed* cleared
 *   target=dismissed  → dismissedAt=now, dismissedReason=reason, completedAt/By cleared
 *   target=waiting    → status only; completion / dismissal fields untouched
 *
 * Returns `null` when the row doesn't exist (or doesn't belong to the
 * workspace), so the route layer can render a 404 cleanly.
 */
export async function updateInboxScopedTaskStatus(
  input: UpdateInboxScopedTaskStatusInput,
): Promise<InboxTodoRecord | null> {
  if (!VALID_STATUSES.has(input.status)) {
    throw new Error(`invalid status: ${input.status}`)
  }
  if (!input.actorId?.trim()) {
    throw new Error("actorId is required")
  }

  const taskId = await resolveWorkspaceTaskId(input.workspaceId, input.id)
  if (!taskId) return null

  const existing = await db.workspaceTask.findFirst({
    where: { id: taskId, workspaceId: input.workspaceId },
  })
  if (!existing) return null

  if (existing.status === input.status) {
    return fetchProjectedById(input.workspaceId, taskId)
  }

  const now = new Date()
  const data: Prisma.WorkspaceTaskUpdateInput = { status: input.status }

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

  await db.workspaceTask.update({ where: { id: taskId }, data })

  return fetchProjectedById(input.workspaceId, taskId)
}

// ─── Update — fields ────────────────────────────────────────────────────────

export interface UpdateInboxScopedTaskFieldsInput {
  id: string
  workspaceId: string
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
 * Whitelisted field patch on a WorkspaceTask. Mirrors the contract of
 * the legacy `updateTodoFields`: status changes are NOT allowed here,
 * the title is bounded at 500 chars, and unknown keys are silently
 * ignored.
 *
 * `assigneeType` and `metadata` are routed through the same
 * forward-mapping / metadata-blob helpers used by `createInboxScopedTask`,
 * so the read projection sees consistent values whether the row was
 * created or merely updated.
 */
export async function updateInboxScopedTaskFields(
  input: UpdateInboxScopedTaskFieldsInput,
): Promise<InboxTodoRecord | null> {
  const taskId = await resolveWorkspaceTaskId(input.workspaceId, input.id)
  if (!taskId) return null

  const existing = await db.workspaceTask.findFirst({
    where: { id: taskId, workspaceId: input.workspaceId },
  })
  if (!existing) return null

  const data: Prisma.WorkspaceTaskUpdateInput = {}

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

  /**
   * Assignee patches go through both the canonical `assigneeType`
   * column AND the metadata namespace so the read projection can
   * round-trip the original (lossy) inbox vocabulary. We re-derive
   * the metadata blob from the merged state — preserving any other
   * `inboxTodo*` keys the existing row already carries.
   */
  const metaParsed = parseMetadataString(existing.metadata)
  let mutatedMeta = false

  if (input.patch.assigneeType !== undefined) {
    if (!VALID_ASSIGNEE_TYPES.has(input.patch.assigneeType)) {
      throw new Error(`invalid assigneeType: ${input.patch.assigneeType}`)
    }
    data.assigneeType = mapAssigneeType(input.patch.assigneeType)
    metaParsed.inboxTodoAssigneeType = input.patch.assigneeType
    mutatedMeta = true
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
    if (input.patch.metadata) {
      metaParsed.inboxTodoMetadata = input.patch.metadata
    } else {
      delete metaParsed.inboxTodoMetadata
    }
    mutatedMeta = true
  }

  if (mutatedMeta) {
    data.metadata = JSON.stringify(metaParsed)
  }

  if (Object.keys(data).length === 0) {
    /** No-op patch — return current state without writing. */
    return fetchProjectedById(input.workspaceId, taskId)
  }

  await db.workspaceTask.update({ where: { id: taskId }, data })

  return fetchProjectedById(input.workspaceId, taskId)
}

/**
 * Defensive metadata parse — returns an empty mutable object when the
 * row's metadata column is null, missing, or unparsable. Identical
 * tolerance to the read projection so writes never throw on a
 * corrupt blob.
 */
function parseMetadataString(raw: string | null): Record<string, unknown> {
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return { ...(parsed as Record<string, unknown>) }
    }
    return {}
  } catch {
    return {}
  }
}
