/**
 * InboxTodo → WorkspaceTask field mapping.
 *
 * @deprecated PR 8 — the dual-write contract this module enables is
 * retired. Production write paths now target `WorkspaceTask` directly
 * via `modules/inbox/inbox-tasks-write.ts` and never create
 * `InboxTodo` rows. This module is preserved exclusively to back
 * `scripts/backfill-workspace-tasks.ts`, which still walks legacy
 * `InboxTodo` rows that pre-date the dual-write era and ensures each
 * one has a paired `WorkspaceTask`. Do NOT add new callers.
 *
 * Single source of truth for the dual-write transition (PR 3). Used
 * (historically) by:
 *   - `modules/inbox/todo-service.ts#createTodo` to mirror every new
 *     InboxTodo into a WorkspaceTask in the same transaction.
 *   - `scripts/backfill-workspace-tasks.ts` to retro-mirror historic
 *     InboxTodo rows that pre-date dual-write.
 *
 * Keeping this in `modules/tasks/` (not in inbox/) emphasises that
 * WorkspaceTask is the destination model — InboxTodo is the legacy
 * input. The mapping lives next to the rest of the WorkspaceTask
 * surface (`types.ts`, `service.ts`).
 *
 * The output is a Prisma `unchecked create` shape (scalar
 * `workspaceId` instead of `workspace.connect`) to mirror what the
 * existing `createWorkspaceTask` and other writers in the codebase
 * use. The result is a plain object, not a Prisma type, so callers
 * can pass it to `db.workspaceTask.create({ data: ... })` or
 * `tx.workspaceTask.create({ data: ... })` interchangeably.
 */

import type {
  WorkspaceTaskAssigneeType,
  WorkspaceTaskExecutionMode,
  WorkspaceTaskPriority,
  WorkspaceTaskStatus,
  WorkspaceTaskSuggestedBy,
} from "./types"

/**
 * The subset of InboxTodo columns the mapping reads. Defined
 * structurally (not via `Prisma.InboxTodoGetPayload`) so the helper
 * works equally well with raw libSQL rows during backfill and with
 * Prisma-typed rows during the dual-write.
 */
export interface InboxTodoSourceRow {
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
}

/**
 * Plain `data` shape for `db.workspaceTask.create({ data: ... })`.
 * Kept loose (no Prisma type) so we don't drag generator output into
 * a module that's also imported by a script. The Prisma client
 * accepts this object verbatim because every field name matches the
 * model definition.
 */
export interface WorkspaceTaskCreateData {
  workspaceId: string
  title: string
  description: string | null
  status: WorkspaceTaskStatus
  priority: WorkspaceTaskPriority
  assigneeType: WorkspaceTaskAssigneeType
  assigneeId: string | null
  dueAt: Date | null
  remindAt: Date | null
  completedAt: Date | null
  completedBy: string | null
  dismissedAt: Date | null
  dismissedReason: string | null
  sourceType: string
  sourceId: string
  sourceLabel: string | null
  conversationId: string | null
  messageId: string | null
  conversationActionId: string | null
  clienteId: string | null
  proyectoId: string | null
  eventoId: string | null
  tareaId: string | null
  createdBy: string
  suggestedBy: WorkspaceTaskSuggestedBy | null
  executionMode: WorkspaceTaskExecutionMode
  metadata: string
}

/**
 * Status: InboxTodo and WorkspaceTask share the four lifecycle states
 * that exist in both vocabularies. WorkspaceTask additionally has
 * `proposed` and `in_progress`, neither of which any InboxTodo can
 * be in today. If a future InboxTodo extension introduces an unknown
 * status string, we fall back to `"open"` rather than corrupting the
 * WorkspaceTask schema with an invalid value.
 */
function mapStatus(raw: string): WorkspaceTaskStatus {
  switch (raw) {
    case "open":
    case "waiting":
    case "done":
    case "dismissed":
      return raw
    default:
      return "open"
  }
}

/**
 * Priority: same set in both models. Falls back to `"normal"` for
 * anything unrecognised (defensive — InboxTodo's `VALID_PRIORITIES`
 * is identical, but the column is a free `String` at the DB level).
 */
function mapPriority(raw: string): WorkspaceTaskPriority {
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
 * Assignee plane: vocabularies don't fully overlap.
 *   - InboxTodo `me` is the operator who created the row → WorkspaceTask `user`.
 *   - InboxTodo `fanny` and `automation` are both AI executors → WorkspaceTask `ai`.
 *   - InboxTodo `team` matches WorkspaceTask `team`.
 *   - InboxTodo `client` (assignee is the contact / client itself) has
 *     no first-class equivalent in WorkspaceTask yet — the cleanest
 *     mapping is `unassigned`, with the original value preserved in
 *     metadata so PR 8 can reconstruct it if needed.
 */
function mapAssigneeType(raw: string): WorkspaceTaskAssigneeType {
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
 * Source type: per the PR 3 spec, this is a binary mapping.
 *   - `createdSource === "manual"` → `"manual"` (user typed it from
 *     the New dropdown; the InboxTodo is just transient storage).
 *   - everything else (default `"operator"`, plus any custom source
 *     a future writer might use) → `"inbox_todo"`.
 *
 * `sourceId` is ALWAYS the originating InboxTodo id during the
 * transitional period. We accept the small semantic awkwardness of
 * `sourceType="manual"` having a non-null `sourceId` because the
 * value is genuinely useful for forensic / debugging queries
 * ("which inbox todo did this manual task come from?") and it goes
 * away in PR 8 when InboxTodo is deprecated.
 */
function mapSourceType(createdSource: string): string {
  return createdSource === "manual" ? "manual" : "inbox_todo"
}

/**
 * Build the metadata blob attached to the mirrored WorkspaceTask. We
 * preserve every InboxTodo-specific signal that doesn't have a
 * first-class WorkspaceTask field, so a later "deprecate InboxTodo"
 * pass (PR 8) can rebuild full fidelity from WorkspaceTask alone:
 *
 *   - `inboxTodoId`            — back-pointer (also in `sourceId`).
 *   - `inboxTodoCreatedSource` — original raw value (e.g. "operator",
 *                                "automation").
 *   - `inboxTodoAssigneeType`  — original raw value when our mapping
 *                                is lossy (e.g. `"client"` → `"unassigned"`).
 *   - `inboxTodoSourceNoteId`  — InboxTodo's `sourceNoteId` (also a
 *                                Message id) when it's set and not
 *                                already mirrored to `messageId`.
 *   - `inboxTodoMetadata`      — the original parsed metadata object
 *                                if it was a JSON object, OR
 *     `inboxTodoMetadataRaw`    when the original was unparsable.
 *
 * Everything is namespaced under `inboxTodo*` to make it obvious
 * during PR 8 cleanup that this is legacy auxiliary data, not the
 * canonical task metadata.
 */
function buildMetadata(todo: InboxTodoSourceRow): Record<string, unknown> {
  const meta: Record<string, unknown> = {
    inboxTodoId: todo.id,
    inboxTodoCreatedSource: todo.createdSource,
    inboxTodoAssigneeType: todo.assigneeType,
  }

  if (todo.sourceNoteId) {
    meta.inboxTodoSourceNoteId = todo.sourceNoteId
  }

  if (todo.metadata) {
    try {
      const parsed = JSON.parse(todo.metadata) as unknown
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        meta.inboxTodoMetadata = parsed
      } else {
        meta.inboxTodoMetadataRaw = todo.metadata
      }
    } catch {
      meta.inboxTodoMetadataRaw = todo.metadata
    }
  }

  return meta
}

/**
 * Map a single `InboxTodo` row to the `data` payload for
 * `db.workspaceTask.create({ data })` (or `tx.workspaceTask.create`).
 *
 * Field mapping summary:
 *   workspaceId           → workspaceId            (direct)
 *   title                 → title                  (direct)
 *   description           → description            (direct)
 *   status                → status                 (mapStatus)
 *   priority              → priority               (mapPriority)
 *   assigneeType          → assigneeType           (mapAssigneeType)
 *   assigneeId            → assigneeId             (direct)
 *   dueAt / remindAt      → dueAt / remindAt       (direct)
 *   completedAt / By      → completedAt / By       (direct, used by backfill)
 *   dismissedAt / Reason  → dismissedAt / Reason   (direct, used by backfill)
 *   conversationId        → conversationId         (direct)
 *   sourceMessageId       → messageId              (direct rename)
 *   sourceActionId        → conversationActionId   (direct rename)
 *   sourceNoteId          → metadata.inboxTodoSourceNoteId
 *   createdBy             → createdBy              (direct)
 *   createdSource         → sourceType (binary mapping) + metadata.inboxTodoCreatedSource
 *   metadata              → metadata.inboxTodoMetadata (preserved verbatim)
 *
 * Constants:
 *   - `executionMode` is always `"manual"` — InboxTodo represents
 *     human-actionable work; AI execution will flow through fresh
 *     WorkspaceTask creates from PR 6 onward.
 *   - `suggestedBy` is always `null` — InboxTodo doesn't carry a
 *     real suggested-by signal; setting it would synthesise data we
 *     don't actually have.
 *   - `sourceLabel` is `"From Inbox"` when the row carries a
 *     `conversationId` (so UI can render a chip without resolving
 *     the source row), otherwise null.
 */
export function mapInboxTodoToWorkspaceTaskData(
  todo: InboxTodoSourceRow,
): WorkspaceTaskCreateData {
  return {
    workspaceId: todo.workspaceId,
    title: todo.title,
    description: todo.description,
    status: mapStatus(todo.status),
    priority: mapPriority(todo.priority),
    assigneeType: mapAssigneeType(todo.assigneeType),
    assigneeId: todo.assigneeId,
    dueAt: todo.dueAt,
    remindAt: todo.remindAt,
    completedAt: todo.completedAt,
    completedBy: todo.completedBy,
    dismissedAt: todo.dismissedAt,
    dismissedReason: todo.dismissedReason,
    sourceType: mapSourceType(todo.createdSource),
    sourceId: todo.id,
    sourceLabel: todo.conversationId ? "From Inbox" : null,
    conversationId: todo.conversationId,
    messageId: todo.sourceMessageId,
    conversationActionId: todo.sourceActionId,
    /** Cliente / project / event / tarea linkage is not available on
     *  InboxTodo today — leave null. PR 8 may enrich these by
     *  resolving conversationId → Conversation.{clienteId,proyectoId}. */
    clienteId: null,
    proyectoId: null,
    eventoId: null,
    tareaId: null,
    createdBy: todo.createdBy,
    suggestedBy: null,
    executionMode: "manual",
    metadata: JSON.stringify(buildMetadata(todo)),
  }
}

/**
 * Mutable subset of `WorkspaceTaskCreateData` — the fields a downstream
 * `InboxTodo` mutation (status change, field patch) is allowed to
 * propagate back into the mirror. Excludes everything immutable at the
 * mirror level:
 *
 *   - identity / link columns (`workspaceId`, `sourceType`, `sourceId`,
 *     `sourceLabel`, `conversationId`, `messageId`, `conversationActionId`,
 *     `clienteId`, `proyectoId`, `eventoId`, `tareaId`)
 *   - audit / origin (`createdBy`, `suggestedBy`, `executionMode`)
 *
 * The InboxTodo write path (`updateTodoStatus`, `updateTodoFields`)
 * cannot change any of those fields by design, so leaving them off the
 * mirror update keeps the two sides in sync without ever clobbering
 * relational stable data.
 */
export type WorkspaceTaskMirrorUpdateData = Pick<
  WorkspaceTaskCreateData,
  | "title"
  | "description"
  | "status"
  | "priority"
  | "assigneeType"
  | "assigneeId"
  | "dueAt"
  | "remindAt"
  | "completedAt"
  | "completedBy"
  | "dismissedAt"
  | "dismissedReason"
  | "metadata"
>

/**
 * Build the partial `data` payload for re-syncing a `WorkspaceTask`
 * mirror after its source `InboxTodo` was mutated. The full row passed
 * in must be the post-mutation InboxTodo — this is intentionally not a
 * "diff this patch" helper, because deriving the result row from
 * `tx.inboxTodo.update({ ... })` is both atomic and cheap, and lets us
 * re-run the canonical mapping (`mapStatus`, `mapPriority`,
 * `mapAssigneeType`, `buildMetadata`) so the mirror always sees the
 * same normalised values it would have on first creation.
 *
 * Used by the inbox write paths in `modules/inbox/todo-service.ts`
 * (PR 5) — keep all mirror-mapping logic in this module so future
 * schema tweaks have a single place to touch.
 */
export function mapInboxTodoUpdateToWorkspaceTaskUpdateData(
  todo: InboxTodoSourceRow,
): WorkspaceTaskMirrorUpdateData {
  return {
    title: todo.title,
    description: todo.description,
    status: mapStatus(todo.status),
    priority: mapPriority(todo.priority),
    assigneeType: mapAssigneeType(todo.assigneeType),
    assigneeId: todo.assigneeId,
    dueAt: todo.dueAt,
    remindAt: todo.remindAt,
    completedAt: todo.completedAt,
    completedBy: todo.completedBy,
    dismissedAt: todo.dismissedAt,
    dismissedReason: todo.dismissedReason,
    metadata: JSON.stringify(buildMetadata(todo)),
  }
}
