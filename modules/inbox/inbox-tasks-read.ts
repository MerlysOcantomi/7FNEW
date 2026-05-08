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
 * Identity (PR 5 → PR 8):
 *   PR 5 returned `WorkspaceTask.sourceId` (== originating `InboxTodo.id`)
 *   as the wire `id`. PR 8 retired the dual-write, so new rows have no
 *   originating `InboxTodo`. From PR 8 onward the wire `id` is
 *   `WorkspaceTask.id` — the canonical identifier going forward. The
 *   PATCH route accepts both the new id and any stale `InboxTodo.id`
 *   (resolved via the `InboxTodo.workspaceTaskId` forward link the
 *   dual-write era populated), so deep-links and cached UI sessions
 *   keep working through the deprecation window.
 *   `workspaceTaskId` on the returned record is the same as `id` and
 *   is preserved for callers that depended on the older shape.
 *
 * No mutation in this module. Writes flow through `inbox-tasks-write.ts`
 * (the legacy `todo-service.ts` is `@deprecated` as of PR 8).
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
 * Project a `WorkspaceTask` row into the `InboxTodoRecord` wire shape
 * the existing UI consumes.
 *
 * Wire identity (PR 8):
 *   The wire `id` is now `WorkspaceTask.id` directly — the canonical
 *   identifier going forward. Before PR 8 we used `sourceId`, which
 *   for dual-written rows happened to be the originating
 *   `InboxTodo.id`. With dual-write retired (PR 8), new rows have no
 *   originating InboxTodo, and using a self-pointer for `sourceId`
 *   created a confusing "id == sourceId" coincidence we'd rather not
 *   teach. The PATCH route still accepts old `InboxTodo.id` values
 *   via a workspaceTaskId fallback so any stale UI session survives.
 *
 * Exported (PR 8) so the inbox write module can reuse the same
 * projector after every mutation, keeping the GET / POST / PATCH wire
 * shapes byte-identical without duplicating the mapping.
 */
export function projectWorkspaceTaskAsInboxTodo(row: WorkspaceTaskRow): InboxTodoRecord {
  const meta = parseTaskMetadata(row.metadata)
  const inboxTodoMetadata = readInboxTodoMetadata(meta)

  const createdSource = readMetaString(meta, "inboxTodoCreatedSource") ?? "operator"
  const preservedAssigneeType = readMetaString(meta, "inboxTodoAssigneeType")
  const sourceNoteId = readMetaString(meta, "inboxTodoSourceNoteId")

  return {
    id: row.id,
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

  return rows.map(projectWorkspaceTaskAsInboxTodo)
}

// ─── Proposed Fanny tasks (PR 9) ────────────────────────────────────────────

/**
 * UI-shaped projection of a Fanny-suggested `WorkspaceTask` (status=proposed).
 *
 * Surfaced in the Inbox conversation detail / Smart Hub so the operator can
 * approve (promote → "open") or dismiss the suggestion via the existing
 * `ConversationAction` flows. The shape is deliberately narrow:
 *
 *   - Only fields the Smart Hub card needs (no assignee, no dueAt — Fanny
 *     suggestions don't carry those today).
 *   - `metadata` is parsed once here so the client never has to wrap a JSON
 *     parse in a try/catch. `confidence`, `aiReasoning`, etc. live inside.
 *   - `conversationActionId` is the linkage that makes approve / dismiss
 *     work — UI must defensively handle the (rare) case where it's missing.
 */
export interface ProposedFannyTaskRecord {
  id: string
  title: string
  description: string | null
  priority: InboxTodoPriority
  sourceLabel: string | null
  conversationActionId: string | null
  messageId: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}

interface ListProposedFannyTasksParams {
  workspaceId: string
  conversationId: string
}

/**
 * Read every Fanny-suggested `WorkspaceTask` still in `proposed` status for
 * a single conversation in a single workspace. Used by the Inbox conversation
 * detail payload (`getConversationById`) so the Smart Hub can render the
 * "Fanny suggested tasks" section without an extra round-trip.
 *
 * Hard filters (defense in depth — every clause is workspace-scoped):
 *   - `workspaceId` — multi-tenant boundary.
 *   - `conversationId` — conversation-scoped surface.
 *   - `status = "proposed"` — already-promoted / dismissed rows are out of
 *     scope for the suggestions surface.
 *   - `sourceType = "fanny_suggestion"` — only the Fanny pipeline writes
 *     this value (PR 7). Other writers (`inbox_todo`, `manual`,
 *     `inbox_conversation`) are excluded.
 *   - `suggestedBy = "fanny"` — belt-and-braces against any future writer
 *     that re-uses the `fanny_suggestion` sourceType for non-AI provenance.
 *
 * Order: createdAt desc — most-recent suggestions surface first, matching
 * how the AI pipeline stamps actions.
 *
 * Bounded read (PR 9 hardening): hard-capped at 50 rows. A
 * conversation that genuinely has more than 50 outstanding Fanny
 * suggestions is a runaway-pipeline incident, not a UX problem to
 * scroll through; the cap keeps the detail payload bounded and
 * protects the panel from rendering an unreasonable list.
 *
 * Both required parameters throw on empty strings rather than silently
 * returning `[]`, so a misuse fails loud at the service boundary.
 */
const PROPOSED_FANNY_TASK_TAKE_CAP = 50

export async function listProposedFannyTasksForConversation(
  params: ListProposedFannyTasksParams,
): Promise<ProposedFannyTaskRecord[]> {
  if (!params.workspaceId?.trim()) {
    throw new Error("workspaceId is required")
  }
  if (!params.conversationId?.trim()) {
    throw new Error("conversationId is required")
  }

  const rows = await db.workspaceTask.findMany({
    where: {
      workspaceId: params.workspaceId.trim(),
      conversationId: params.conversationId.trim(),
      status: "proposed",
      sourceType: "fanny_suggestion",
      suggestedBy: "fanny",
    },
    orderBy: { createdAt: "desc" },
    take: PROPOSED_FANNY_TASK_TAKE_CAP,
    select: {
      id: true,
      title: true,
      description: true,
      priority: true,
      sourceLabel: true,
      conversationActionId: true,
      messageId: true,
      metadata: true,
      createdAt: true,
      updatedAt: true,
    },
  })

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    priority: mapPriority(row.priority),
    sourceLabel: row.sourceLabel,
    conversationActionId: row.conversationActionId,
    messageId: row.messageId,
    metadata: parseTaskMetadata(row.metadata),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }))
}

// ─── Batched proposed-task counts for the list (PR 10) ──────────────────────

interface ListProposedFannyTaskCountsParams {
  workspaceId: string
  /**
   * Visible conversation ids the inbox list will render. Always pass the
   * page's slice — never an unbounded universe of ids — so the IN clause
   * stays bounded by `pageSize` (typically ≤ 50). Empty / falsy entries
   * are filtered out internally; passing only blanks short-circuits to
   * an empty map without touching the DB.
   */
  conversationIds: readonly string[]
}

/**
 * Per-conversation counts of Fanny-suggested `WorkspaceTask` rows still
 * in `proposed` status. Backs the conversation-list "Fanny suggestion"
 * badge surfaced by PR 10 — the inbox list calls this once per page
 * with the visible ids and renders a count chip for any conversation
 * with `count > 0`.
 *
 * Why a `groupBy` (and not N `count()` calls):
 *   - Single round-trip regardless of `pageSize`. With `take=20..50` the
 *     N+1 pattern would produce 20–50 separate DB calls just to render
 *     a list — wasteful even on hot caches.
 *   - The aggregation is naturally bounded by `conversationIds.length`,
 *     which is the inbox page slice (operator never sees more than
 *     `pageSize` rows at once). No unbounded scan possible.
 *
 * Filters (mirrors `listProposedFannyTasksForConversation` exactly so
 * the badge count and the Smart Hub list always agree):
 *   - `workspaceId` — multi-tenant boundary.
 *   - `conversationId IN (visible page)` — keeps the result set small.
 *   - `status = "proposed"` — open suggestions only.
 *   - `sourceType = "fanny_suggestion"` — Fanny-only provenance.
 *   - `suggestedBy = "fanny"` — defence in depth.
 *
 * Returns a `Map<conversationId, count>` so callers can do an O(1)
 * lookup per row when merging into the response. Conversations with
 * no proposed tasks are simply absent from the map — callers must
 * default to `0`.
 */
export async function listProposedFannyTaskCountsByConversation(
  params: ListProposedFannyTaskCountsParams,
): Promise<Map<string, number>> {
  if (!params.workspaceId?.trim()) {
    throw new Error("workspaceId is required")
  }

  /**
   * Dedupe + drop empties before issuing the query. Without this a
   * caller passing duplicate or blank ids would either inflate the
   * `IN (...)` clause (cheap waste) or trigger a Prisma validation
   * error on empty strings. Defensive cleanup keeps the helper
   * forgiving without hiding real misuse — a fully-empty input simply
   * returns an empty map and skips the round-trip.
   */
  const ids = Array.from(
    new Set(
      params.conversationIds.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0,
      ),
    ),
  )
  if (ids.length === 0) return new Map<string, number>()

  const rows = await db.workspaceTask.groupBy({
    by: ["conversationId"],
    where: {
      workspaceId: params.workspaceId.trim(),
      conversationId: { in: ids },
      status: "proposed",
      sourceType: "fanny_suggestion",
      suggestedBy: "fanny",
    },
    _count: { _all: true },
  })

  const map = new Map<string, number>()
  for (const row of rows) {
    /**
     * `groupBy` on a nullable column can in theory yield a `null`
     * key. Our filter excludes nulls (nullable `conversationId IN
     * [...]` with non-null ids), but we guard anyway so the public
     * Map<string, number> contract stays honest.
     */
    if (row.conversationId) {
      map.set(row.conversationId, row._count._all)
    }
  }
  return map
}
