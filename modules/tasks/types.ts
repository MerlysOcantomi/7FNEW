/**
 * Workspace Tasks — shared types and validation constants.
 *
 * This module defines the future global work-item contract. PR 2 ships
 * the foundation only:
 *   - Prisma model `WorkspaceTask`
 *   - Migration script `scripts/migrate-workspace-task.ts`
 *   - Type/constant skeleton + thin service in `./service.ts`
 *
 * Nothing reads from or writes to `WorkspaceTask` yet:
 *   - `/today` still aggregates `InboxTodo`, `Tarea`, `Evento`.
 *   - `New → New task` still writes through `POST /api/inbox/todos`.
 *   - `Fanny` is unchanged.
 *
 * Naming note: "Tasks" is the user-facing brand for the global work
 * system; the Spanish `Tarea` model stays as a deeper project/CRM
 * sub-record and may be linked from a `WorkspaceTask` via `tareaId`
 * in a later PR.
 */

/** Status flow (validated server-side):
 *   proposed     — Fanny / AI proposal awaiting operator approval.
 *   open         — Active, ready to be picked up.
 *   in_progress  — Operator (or AI) actively working on it.
 *   waiting      — Blocked by external party but still active.
 *   done         — Completed; `completedAt` / `completedBy` set.
 *   dismissed    — Will not be done; `dismissedAt` / `dismissedReason` set.
 */
export type WorkspaceTaskStatus =
  | "proposed"
  | "open"
  | "in_progress"
  | "waiting"
  | "done"
  | "dismissed"

/** Priority levels. The Today aggregator already maps `urgent` →
 *  `critical` for UI presentation; storage uses the raw schema label. */
export type WorkspaceTaskPriority = "low" | "normal" | "high" | "urgent"

/** Assignee plane. `unassigned` is the default — no one owns the task
 *  yet. `user` and `team` point at workspace members; `ai` points at
 *  Fanny or a future agent. The runtime trusts `assigneeId` to be a
 *  string but does NOT FK-validate it (assignees may be agents that
 *  don't have a `User` row). */
export type WorkspaceTaskAssigneeType = "user" | "ai" | "team" | "unassigned"

/** Where the suggestion came from when the task was proposed.
 *  Distinct from `assigneeType` because a task suggested by Fanny
 *  may still be assigned to a human. */
export type WorkspaceTaskSuggestedBy = "user" | "fanny" | "system"

/** Execution mode. Captures whether the task is meant to be executed
 *  by a human, an AI agent, or jointly. Stored as a free string so
 *  future modes can be added without a migration. */
export type WorkspaceTaskExecutionMode = "manual" | "ai_assisted" | "ai"

/** Allowed `sourceType` values used by writers in later PRs. Open
 *  set — kept as constants (not a TS union) because new sources will
 *  appear over time and we don't want a breaking type change every
 *  time. The service trusts the caller to pass any non-empty string. */
export const WORKSPACE_TASK_SOURCE_TYPES = {
  manual: "manual",
  inboxConversation: "inbox_conversation",
  inboxMessage: "inbox_message",
  inboxAction: "inbox_action",
  fannySuggestion: "fanny_suggestion",
  /**
   * PR 12 — Fanny auto-created task. Distinct from `fanny_suggestion`
   * (which represents a *proposed* task awaiting operator approval).
   * `fanny_auto` rows are written directly with `status="open"` by the
   * conservative auto-create policy in `modules/inbox/auto-task-policy.ts`
   * when an upstream `create_task` action is judged low-risk and
   * high-confidence. They surface in `/today` like any other open
   * task and are deliberately EXCLUDED from:
   *   - the Inbox To-do tab (filter is `sourceType ∈ {inbox_todo, manual}`)
   *   - the Smart Hub "Pending decisions" section + badge counts
   *     (filter is `status="proposed" AND sourceType="fanny_suggestion"`)
   * so they never compete with the proposed-decision lane.
   */
  fannyAuto: "fanny_auto",
  clientRequest: "client_request",
  project: "project",
  client: "client",
  calendar: "calendar",
  /** PR 3 dual-write: an InboxTodo mirrored into a WorkspaceTask row. */
  inboxTodoMigration: "inbox_todo_migration",
} as const

/** Validation sets — exported so route layers and tests can reuse the
 *  same source of truth as the service. Mirrors the `VALID_*` pattern
 *  used by `modules/inbox/todo-service.ts`. */
export const WORKSPACE_TASK_VALID_STATUSES = new Set<WorkspaceTaskStatus>([
  "proposed",
  "open",
  "in_progress",
  "waiting",
  "done",
  "dismissed",
])

export const WORKSPACE_TASK_VALID_PRIORITIES = new Set<WorkspaceTaskPriority>([
  "low",
  "normal",
  "high",
  "urgent",
])

export const WORKSPACE_TASK_VALID_ASSIGNEE_TYPES = new Set<WorkspaceTaskAssigneeType>([
  "user",
  "ai",
  "team",
  "unassigned",
])

export const WORKSPACE_TASK_VALID_SUGGESTED_BY = new Set<WorkspaceTaskSuggestedBy>([
  "user",
  "fanny",
  "system",
])

export const WORKSPACE_TASK_VALID_EXECUTION_MODES = new Set<WorkspaceTaskExecutionMode>([
  "manual",
  "ai_assisted",
  "ai",
])

/**
 * Public response shape — keeps the raw DB row but parses `metadata`
 * into a real object (or `null` when missing/invalid). Mirrors the
 * `InboxTodoRecord` pattern: callers never see the JSON string.
 */
export interface WorkspaceTaskRecord {
  id: string
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
  suggestedBy: WorkspaceTaskSuggestedBy | null
  executionMode: WorkspaceTaskExecutionMode | null
  metadata: Record<string, unknown> | null
  createdAt: Date
  updatedAt: Date
}
