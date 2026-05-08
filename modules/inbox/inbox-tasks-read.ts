import { db } from "@core/db"
import type { Prisma } from "@/generated/prisma/client"

import type {
  InboxTodoAssigneeType,
  InboxTodoPriority,
  InboxTodoRecord,
  InboxTodoStatus,
} from "./todo-service"

/**
 * Inbox tab read path — returns inbox-scoped `WorkspaceTask` rows in the same
 * `InboxTodoRecord` wire shape the existing UI consumes.
 *
 * Why this module exists (PR 5):
 * ──────────────────────────────
 * `/today` already reads from `WorkspaceTask` (PR 4). The Inbox To-do tab is
 * the next read surface to migrate. We keep the API contract identical so the
 * existing UI (`InboxTodoList`, `InboxTodoListItem`, `app/inbox/page.tsx`)
 * doesn't change at all — only the row source flips from `InboxTodo` to
 * `WorkspaceTask`.
 *
 * Inbox-scoped subset:
 *   - `sourceType IN ("inbox_todo", "manual")`. These are the two `sourceType`
 *     values the dual-write writer (`mapInboxTodoToWorkspaceTaskData`) emits,
 *     so this filter is exactly the set of WorkspaceTask rows that have a
 *     backing InboxTodo. Anything else (Fanny suggestions, project tasks,
 *     calendar-derived items in the future) is intentionally excluded.
 *
 * Identity preservation:
 *   The wire `id` we return is `WorkspaceTask.sourceId`, which by the dual-
 *   write contract is the originating `InboxTodo.id`. This keeps every
 *   downstream API path that uses ids stable:
 *     - `PATCH /api/inbox/todos/{id}` still operates on the InboxTodo (and
 *       PR 5 propagates updates to the mirror so reads stay consistent).
 *     - The page's `selectedTodoId` deep-link state is unchanged.
 *     - Any other consumer that round-trips an id through the wire keeps
 *       working.
 *   `workspaceTaskId` on the returned record is the `WorkspaceTask.id` —
 *   exactly mirroring the forward link InboxTodo already stores.
 *
 * No mutation in this module. Writes still flow through `todo-service.ts`.
 */

/**
 * `WorkspaceTask.sourceType` values that the Inbox tab is allowed to read.
 *
 * Both values are emitted by the dual-write writer:
 *   - `"inbox_todo"` — a generic InboxTodo (operator-typed in a conversation,
 *     promoted from a pending action, surfaced from a note, etc.).
 *   - `"manual"` — a New-task-dialog capture (createdSource === "manual" on
 *     the InboxTodo side). Always has a `sourceId` pointing to the InboxTodo
 *     row, same as the inbox flow.
 *
 * Future inbox-related sources (e.g. `"inbox_conversation"`,
 * `"inbox_message"`, `"inbox_action"`) are intentionally NOT included yet:
 * no writer emits them today, and adding them silently could surface rows
 * the existing UI doesn't expect to render. PR 6+ can extend this list.
 */
export const INBOX_SCOPED_SOURCE_TYPES = ["inbox_todo", "manual"] as const

const VALID_STATUSES = new Set<InboxTodoStatus>([
  "open",
  "done",
  "dismissed",
  "waiting",
])

/**
 * `WorkspaceTask.status` values we surface in the Inbox tab. The mapping
 * back to `InboxTodoStatus` collapses two extra states the WorkspaceTask
 * vocabulary has but InboxTodo doesn't:
 *
 *   - `"in_progress"` → `"open"`. The Inbox UI doesn't have an in-progress
 *     row treatment; an in-progress task is still "actionable, not done"
 *     from the operator's perspective.
 *   - `"proposed"` → filtered out at the WHERE-clause level. Proposed rows
 *     are AI suggestions awaiting approval and belong to the future
 *     "Suggestions" surface (PR 6), not the legacy Inbox tab.
 */
function mapWorkspaceStatusToInbox(raw: string): InboxTodoStatus {
  switch (raw) {
    case "open":
    case "waiting":
    case "done":
    case "dismissed":
      return raw
    case "in_progress":
      return "open"
    default:
      return "open"
  }
}

function mapPriority(raw: string): InboxTodoPriority {
  switch (raw) {
    case "low":
    case "normal":
    case "high":
    case "urgent":
      return raw
    default:
      return "normal"
  }
}

/**
 * Reverse the assignee-type mapping that `mapInboxTodoToWorkspaceTaskData`
 * applies. The forward map collapses `"fanny"`/`"automation"` into `"ai"`
 * and `"client"` into `"unassigned"`; the original value is preserved in
 * `metadata.inboxTodoAssigneeType` so we round-trip without lossy noise.
 *
 * Order of preference:
 *   1. `metadata.inboxTodoAssigneeType` (only when it's a recognised
 *      InboxTodo value — anything unexpected is ignored).
 *   2. Best-effort mapping of `WorkspaceTask.assigneeType`:
 *        user        → "me"
 *        ai          → "fanny"      (lossy — `automation` is also AI here)
 *        team        → "team"
 *        unassigned  → "me"         (lossy — `client` was also unassigned)
 *      A WorkspaceTask written outside the dual-write path (e.g. a future
 *      Fanny direct write) won't have the metadata hint, so this fallback
 *      is the safety net.
 */
function deriveInboxAssigneeType(
  workspaceAssigneeType: string,
  preservedAssigneeType: string | null,
): InboxTodoAssigneeType {
  const VALID_INBOX = new Set<InboxTodoAssigneeType>([
    "me",
    "fanny",
    "automation",
    "client",
    "team",
  ])
  if (preservedAssigneeType && VALID_INBOX.has(preservedAssigneeType as InboxTodoAssigneeType)) {
    return preservedAssigneeType as InboxTodoAssigneeType
  }
  switch (workspaceAssigneeType) {
    case "user":
      return "me"
    case "ai":
      return "fanny"
    case "team":
      return "team"
    case "unassigned":
    default:
      return "me"
  }
}

/**
 * Parse `WorkspaceTask.metadata` defensively. Returns null on missing or
 * malformed JSON, never throws — same contract as `parseTodoMetadata` in
 * `todo-service.ts`.
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
 * Read a single string-typed key from a parsed metadata object, returning
 * null when missing or not a string. Keeps callers branch-free.
 */
function readMetaString(meta: Record<string, unknown> | null, key: string): string | null {
  if (!meta) return null
  const v = meta[key]
  return typeof v === "string" && v.length > 0 ? v : null
}

/**
 * Read the original InboxTodo `metadata` blob (preserved verbatim by the
 * forward mapping). Returns the parsed object when present and an object,
 * or null otherwise. Falls back to `null` for the legacy `inboxTodoMetadataRaw`
 * shape (we don't try to surface unparsable raw strings to the UI).
 */
function readInboxTodoMetadata(
  meta: Record<string, unknown> | null,
): Record<string, unknown> | null {
  if (!meta) return null
  const inboxMeta = meta.inboxTodoMetadata
  if (inboxMeta && typeof inboxMeta === "object" && !Array.isArray(inboxMeta)) {
    return inboxMeta as Record<string, unknown>
  }
  return null
}

/**
 * Shape the WorkspaceTask findMany returns. Defined structurally rather
 * than via `Prisma.WorkspaceTaskGetPayload` so this stays a thin local
 * contract and doesn't depend on which select / include the caller used.
 */
interface WorkspaceTaskRow {
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
  conversationId: string | null
  messageId: string | null
  conversationActionId: string | null
  createdBy: string
  metadata: string | null
  createdAt: Date
  updatedAt: Date
}

/**
 * Project a `WorkspaceTask` row into the `InboxTodoRecord` wire shape the
 * existing UI consumes. Returns null when the row is missing the required
 * `sourceId` (which would mean a corrupt mirror — we'd rather skip than
 * return a row the PATCH endpoint can't address).
 */
function projectWorkspaceTaskAsInboxTodo(row: WorkspaceTaskRow): InboxTodoRecord | null {
  if (!row.sourceId) {
    /**
     * Defensive: rows passing the `sourceType IN (inbox_todo, manual)`
     * filter should always have a `sourceId` per the dual-write contract.
     * If the contract is violated we skip rather than render an item the
     * PATCH endpoint can't reach (the wire `id` would be null).
     */
    return null
  }

  const meta = parseTaskMetadata(row.metadata)
  const inboxTodoMetadata = readInboxTodoMetadata(meta)

  const createdSource = readMetaString(meta, "inboxTodoCreatedSource") ?? "operator"
  const preservedAssigneeType = readMetaString(meta, "inboxTodoAssigneeType")
  const sourceNoteId = readMetaString(meta, "inboxTodoSourceNoteId")

  return {
    id: row.sourceId,
    workspaceId: row.workspaceId,
    conversationId: row.conversationId,
    sourceMessageId: row.messageId,
    sourceActionId: row.conversationActionId,
    sourceNoteId,
    title: row.title,
    description: row.description,
    status: mapWorkspaceStatusToInbox(row.status),
    priority: mapPriority(row.priority),
    assigneeType: deriveInboxAssigneeType(row.assigneeType, preservedAssigneeType),
    assigneeId: row.assigneeId,
    dueAt: row.dueAt,
    remindAt: row.remindAt,
    createdBy: row.createdBy,
    createdSource,
    completedAt: row.completedAt,
    completedBy: row.completedBy,
    dismissedAt: row.dismissedAt,
    dismissedReason: row.dismissedReason,
    metadata: inboxTodoMetadata,
    workspaceTaskId: row.id,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

// ─── List ───────────────────────────────────────────────────────────────────

export interface ListInboxScopedTasksParams {
  workspaceId: string
  /** Comma-separated subset of: open | done | dismissed | waiting. */
  status?: string | null
  /** Filter by `assigneeId` (exact match). Empty string is treated as no filter. */
  assigneeId?: string | null
  /** Restrict to a single conversation. */
  conversationId?: string | null
  skip?: number
  take?: number
}

/**
 * List inbox-scoped `WorkspaceTask` rows shaped as `InboxTodoRecord`.
 *
 * The order matches `listTodos`'s previous output (status asc, dueAt asc,
 * createdAt desc) so the UI sees rows in the same sequence it always has.
 * The `take` upper bound (500) and default (200) are also identical.
 *
 * Empty / unrecognised filters are silently dropped — same forgiving
 * behaviour as `listTodos`. The caller doesn't have to round-trip a 400
 * just for a typoed status.
 */
export async function listInboxScopedTasks(
  params: ListInboxScopedTasksParams,
): Promise<InboxTodoRecord[]> {
  const { workspaceId, status, assigneeId, conversationId, skip = 0, take = 200 } = params

  if (!workspaceId?.trim()) {
    throw new Error("workspaceId is required")
  }

  const where: Prisma.WorkspaceTaskWhereInput = {
    workspaceId: workspaceId.trim(),
    sourceType: { in: [...INBOX_SCOPED_SOURCE_TYPES] },
  }

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

  const rows = await db.workspaceTask.findMany({
    where,
    orderBy: [
      { status: "asc" },
      { dueAt: "asc" },
      { createdAt: "desc" },
    ],
    skip: Math.max(0, skip),
    take: Math.max(1, Math.min(500, take)),
  })

  const projected: InboxTodoRecord[] = []
  for (const row of rows) {
    const record = projectWorkspaceTaskAsInboxTodo(row)
    if (record) projected.push(record)
  }
  return projected
}
