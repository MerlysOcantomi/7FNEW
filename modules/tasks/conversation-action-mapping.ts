/**
 * Conversation → WorkspaceTask mapping (PR 6).
 *
 * Drives the WorkspaceTask write that fires whenever an approved
 * `create_task` ConversationAction is executed (and, more generally,
 * whenever an inbox conversion produces a `Tarea`). The mapping lives
 * here, alongside `inbox-todo-mapping.ts`, so every WorkspaceTask
 * writer has a single dedicated module per upstream surface.
 *
 * Pure function; no Prisma client access. The caller owns the
 * transaction and passes already-resolved rows (Tarea, optional
 * ConversationAction, optional Conversation context).
 *
 * The output is the same `WorkspaceTaskCreateData` shape used by the
 * dual-write path. Required fields (`sourceType`, `sourceId`,
 * `createdBy`) are always populated:
 *
 *   - `sourceType`: `"fanny_suggestion"` when the upstream action was
 *     AI-generated (`action.source === "ai"`), `"inbox_conversation"`
 *     otherwise (operator-driven convert, manual action, or no action
 *     at all).
 *   - `sourceId`: the originating `ConversationAction.id` when an
 *     action drove the conversion. Falls back to the `conversationId`
 *     so forensics queries can still trace the row to its origin.
 *   - `suggestedBy`: `"fanny"` for AI-generated, `null` otherwise.
 *
 * Operator approval is enforced upstream — the caller has already run
 * `executeConversationAction` (or a convert route that requires write
 * access). This module just maps; it never gates.
 */

import type { WorkspaceTaskCreateData } from "./inbox-todo-mapping"

/**
 * Subset of `Tarea` columns used to seed the WorkspaceTask. Defined
 * structurally so callers can pass a Prisma row, a hand-rolled object,
 * or a libSQL row interchangeably.
 */
export interface ConversionTareaRow {
  id: string
  titulo: string
  descripcion: string | null
  prioridad: string | null
  fechaLimite: Date | null
}

/**
 * Subset of `ConversationAction` fields needed to enrich the mapping.
 * `null` is a valid input — corresponds to convert flows that have no
 * upstream action (operator-driven `/api/inbox/conversations/{id}/convert`).
 */
export interface ConversionActionRow {
  id: string
  type: string
  source: string | null
  data: string | null
  sourceMessageId: string | null
}

export interface ConversionConversationRow {
  id: string
  /** Used as a fallback `messageId` only when no action is present and
   *  the conversion came in with a `sourceMessageId` argument. */
  sourceMessageId?: string | null
}

export interface BuildConversationWorkspaceTaskInput {
  workspaceId: string
  /** Operator (or system actor) executing the conversion. Required —
   *  audit trail must always know who created the row. */
  createdBy: string
  conversation: ConversionConversationRow
  tarea: ConversionTareaRow
  /** Linked ConversationAction when the conversion was driven from an
   *  approved Smart-Inbox action; `null` for the operator-driven
   *  convert route. */
  action: ConversionActionRow | null
  /** Optional pre-resolved cliente / proyecto IDs (operator may have
   *  promoted those during the same transaction). */
  clienteId: string | null
  proyectoId: string | null
}

/** Tarea.prioridad uses Spanish vocabulary (urgente / alta / media /
 *  baja). Map to the WorkspaceTask vocabulary. Unknown values default
 *  to `"normal"` so a stray Tarea.prioridad never blocks creation. */
function mapPriority(raw: string | null | undefined): WorkspaceTaskCreateData["priority"] {
  switch ((raw ?? "").toLowerCase()) {
    case "urgente":
      return "urgent"
    case "alta":
      return "high"
    case "baja":
      return "low"
    case "media":
    case "":
    default:
      return "normal"
  }
}

/**
 * Try to read a string field from the action's serialised `data`
 * blob. Mirrors the `readMetaString` pattern in
 * `inbox-tasks-read.ts`. Tolerant of malformed JSON — returns `null`
 * rather than throwing so the mapping never blocks the conversion.
 */
function readActionDataString(action: ConversionActionRow | null, key: string): string | null {
  if (!action?.data) return null
  try {
    const parsed = JSON.parse(action.data) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const v = (parsed as Record<string, unknown>)[key]
      if (typeof v === "string" && v.trim().length > 0) return v.trim()
    }
  } catch {
    /** swallow — caller falls back to Tarea fields */
  }
  return null
}

function isFannyAuthored(action: ConversionActionRow | null): boolean {
  /** `intelligence.ts` writes Fanny suggestions with `source = "ai"`.
   *  Anything else (operator-created actions, system-default rows
   *  without an explicit source) is treated as non-AI. */
  return action?.source === "ai"
}

/**
 * Build the `WorkspaceTaskCreateData` payload for the WorkspaceTask
 * mirror that accompanies a Tarea created from inbox conversion.
 *
 * Field decisions:
 *   - `title` prefers the action's payload title (which Fanny / the
 *     operator already shaped for human display) and falls back to the
 *     Tarea's `titulo`, which itself already encodes the conversation
 *     intent / summary.
 *   - `description` prefers the action's payload description and
 *     falls back to the Tarea's `descripcion`.
 *   - `status` is always `"open"` — the operator has approved /
 *     executed the action, so the work item is actionable now (never
 *     `"proposed"`, even when Fanny was the source).
 *   - `executionMode` is always `"manual"` per PR 6 spec. PR 7+ may
 *     introduce `"ai_assisted"` writes when AI does the actual work.
 *   - `assigneeType` / `assigneeId` stay `unassigned` / `null`. The
 *     operator is the executor of the *action*, not necessarily the
 *     owner of the resulting work; assigning is a separate step.
 *   - `dueAt` mirrors `Tarea.fechaLimite` (currently always `null` on
 *     conversion-created Tareas, but the wiring is here for when the
 *     prompt or the convert route starts populating it).
 *   - `metadata` records the upstream pointers as `inboxConversation*`
 *     keys, parallel to the `inboxTodo*` namespace used by
 *     `inbox-todo-mapping.ts`. Keeps the round-trip explicit and lets
 *     PR 8 reconstruct full provenance from WorkspaceTask alone.
 */
export function buildConversationToWorkspaceTaskData(
  input: BuildConversationWorkspaceTaskInput,
): WorkspaceTaskCreateData {
  const { action, conversation, tarea } = input

  const fanny = isFannyAuthored(action)

  const title =
    readActionDataString(action, "title")
    ?? tarea.titulo
    ?? "Task from Inbox"

  const description =
    readActionDataString(action, "description")
    ?? tarea.descripcion
    ?? null

  /**
   * Source resolution
   * ─────────────────
   * `sourceType` tells the read layer where this work came from:
   *   - AI-generated action  → `fanny_suggestion`
   *   - Operator action OR convert-without-action → `inbox_conversation`
   *
   * `sourceId` is the action id when there is one (the most precise
   * pointer back to the upstream artefact); otherwise the conversation
   * id (so the row still has a non-null traceback). This matches the
   * existing pattern in `inbox-todo-mapping.ts` where `sourceId` is
   * always populated.
   */
  const sourceType = fanny ? "fanny_suggestion" : "inbox_conversation"
  const sourceId = action?.id ?? conversation.id

  const messageId = action?.sourceMessageId ?? conversation.sourceMessageId ?? null

  const metadata: Record<string, unknown> = {
    inboxConversationId: conversation.id,
    inboxTareaId: tarea.id,
  }
  if (action) {
    metadata.inboxConversationActionId = action.id
    metadata.inboxConversationActionType = action.type
    metadata.inboxConversationActionSource = action.source ?? null
  }

  return {
    workspaceId: input.workspaceId,
    title,
    description,
    status: "open",
    priority: mapPriority(tarea.prioridad),
    assigneeType: "unassigned",
    assigneeId: null,
    dueAt: tarea.fechaLimite ?? null,
    remindAt: null,
    completedAt: null,
    completedBy: null,
    dismissedAt: null,
    dismissedReason: null,
    sourceType,
    sourceId,
    sourceLabel: "From Inbox",
    conversationId: conversation.id,
    messageId,
    conversationActionId: action?.id ?? null,
    clienteId: input.clienteId,
    proyectoId: input.proyectoId,
    eventoId: null,
    tareaId: tarea.id,
    createdBy: input.createdBy,
    suggestedBy: fanny ? "fanny" : null,
    executionMode: "manual",
    metadata: JSON.stringify(metadata),
  }
}

// ─── PR 7 — Proposed (Fanny-suggested) WorkspaceTasks ───────────────────────

/**
 * `Conversation.urgency` vocabulary: `critica | alta | media | baja | null`.
 * Translate to the `WorkspaceTaskPriority` union used by the model.
 */
function mapUrgencyToPriority(
  raw: string | null | undefined,
): WorkspaceTaskCreateData["priority"] {
  switch ((raw ?? "").toLowerCase()) {
    case "critica":
      return "urgent"
    case "alta":
      return "high"
    case "baja":
      return "low"
    case "media":
    case "":
    default:
      return "normal"
  }
}

/**
 * Slice that the Fanny-side helper needs from the upstream
 * ConversationAction. Required (PR 7 only writes proposed tasks for
 * actions that already exist in the DB, so the id is always known).
 */
export interface ProposedActionRow {
  id: string
  type: string
  source: string | null
  data: string | null
  sourceMessageId: string | null
  confidence: number | null
}

export interface ProposedConversationContext {
  id: string
  clienteId: string | null
  proyectoId: string | null
  /** `Conversation.urgency` raw value, used to seed the priority. */
  urgency: string | null
}

export interface BuildProposedWorkspaceTaskInput {
  workspaceId: string
  conversation: ProposedConversationContext
  action: ProposedActionRow
  /** Pipeline metadata kept verbatim in `metadata` for forensics
   *  (matches what Fanny writes into `ConversationAction.data`). */
  pipeline?: {
    pipelineVersion?: string | null
    promptVersion?: string | null
    trigger?: string | null
  }
}

/**
 * Build the `WorkspaceTaskCreateData` payload for a Fanny-proposed
 * task (status="proposed").
 *
 * Differences vs `buildConversationToWorkspaceTaskData`:
 *   - `status: "proposed"` — awaiting operator approval, hidden from
 *     `/today` (the aggregator already excludes proposed) and from
 *     the Inbox To-do tab (sourceType is `fanny_suggestion`, which
 *     `listInboxScopedTasks` does not include).
 *   - `priority` is seeded from `Conversation.urgency` (no Tarea yet
 *     to read priority from).
 *   - `tareaId` and `dueAt` start `null`; the execute path (PR 6)
 *     fills them when promoting the row to "open".
 *   - `createdBy: "system"` because the Fanny pipeline runs without
 *     an authenticated session. PR 6's promote step will record the
 *     operator id in audit columns of the Tarea + ConversationAction
 *     (the WorkspaceTask itself doesn't gain a `reviewedBy` column —
 *     that's the linked action's job).
 */
export function buildProposedWorkspaceTaskFromAction(
  input: BuildProposedWorkspaceTaskInput,
): WorkspaceTaskCreateData {
  const { action, conversation } = input

  const title = (readActionDataString(action, "title") ?? "Tarea sugerida").slice(0, 500)
  const description = readActionDataString(action, "description")

  const metadata: Record<string, unknown> = {
    inboxConversationId: conversation.id,
    inboxConversationActionId: action.id,
    inboxConversationActionType: action.type,
    inboxConversationActionSource: action.source ?? null,
  }
  if (typeof action.confidence === "number") {
    metadata.fannyConfidence = action.confidence
  }
  if (input.pipeline?.pipelineVersion) {
    metadata.fannyPipelineVersion = input.pipeline.pipelineVersion
  }
  if (input.pipeline?.promptVersion) {
    metadata.fannyPromptVersion = input.pipeline.promptVersion
  }
  if (input.pipeline?.trigger) {
    metadata.fannyTrigger = input.pipeline.trigger
  }

  return {
    workspaceId: input.workspaceId,
    title,
    description,
    status: "proposed",
    priority: mapUrgencyToPriority(conversation.urgency),
    assigneeType: "unassigned",
    assigneeId: null,
    dueAt: null,
    remindAt: null,
    completedAt: null,
    completedBy: null,
    dismissedAt: null,
    dismissedReason: null,
    sourceType: "fanny_suggestion",
    sourceId: action.id,
    sourceLabel: "From Inbox",
    conversationId: conversation.id,
    messageId: action.sourceMessageId,
    conversationActionId: action.id,
    clienteId: conversation.clienteId,
    proyectoId: conversation.proyectoId,
    eventoId: null,
    tareaId: null,
    createdBy: "system",
    suggestedBy: "fanny",
    executionMode: "manual",
    metadata: JSON.stringify(metadata),
  }
}

/**
 * Mutable subset of `WorkspaceTaskCreateData` re-applied when Fanny
 * re-runs and updates an existing *proposed* WorkspaceTask. Excludes:
 *
 *   - identity / link columns (`workspaceId`, `sourceType`,
 *     `sourceId`, `conversationId`, `messageId`,
 *     `conversationActionId`, `tareaId`, `eventoId`)
 *   - audit / origin (`createdBy`, `suggestedBy`, `executionMode`,
 *     `status`)
 *
 * Keeping the status column off this update is critical: Fanny must
 * never regress an "open" / "executed" / "dismissed" task back to
 * "proposed" just because it re-ran on the same conversation. The
 * caller is responsible for guarding with `status === "proposed"`
 * before applying this patch.
 */
export type ProposedWorkspaceTaskRefreshData = Pick<
  WorkspaceTaskCreateData,
  | "title"
  | "description"
  | "priority"
  | "messageId"
  | "clienteId"
  | "proyectoId"
  | "sourceLabel"
  | "metadata"
>

/**
 * Reduce a freshly built proposed payload to the safe-to-refresh
 * subset above. Used by intelligence.ts when the operator hasn't
 * touched the suggestion yet but Fanny has new text / new
 * conversation context.
 */
export function pickProposedWorkspaceTaskRefreshFields(
  data: WorkspaceTaskCreateData,
): ProposedWorkspaceTaskRefreshData {
  return {
    title: data.title,
    description: data.description,
    priority: data.priority,
    messageId: data.messageId,
    clienteId: data.clienteId,
    proyectoId: data.proyectoId,
    sourceLabel: data.sourceLabel,
    metadata: data.metadata,
  }
}

// ─── PR 12 — Auto-created (Fanny low-risk automation lane) WorkspaceTasks ──

export interface BuildAutoCreatedWorkspaceTaskInput
  extends BuildProposedWorkspaceTaskInput {
  /** Short, human-readable reason from `evaluateAutoCreatePolicy`,
   *  persisted in `metadata.automationReason` for audit. Always set
   *  by the caller; the helper never invents a reason. */
  automationReason: string
}

/**
 * Build the `WorkspaceTaskCreateData` payload for a Fanny
 * auto-created task (status="open"). This is the automation lane
 * that bypasses the proposed-decision queue for low-risk obvious
 * internal work. The decision to call this builder lives in
 * `modules/inbox/auto-task-policy.ts`; this module just maps.
 *
 * Differences vs `buildProposedWorkspaceTaskFromAction`:
 *   - `status: "open"` — actionable immediately, surfaces in `/today`
 *     like any other open task.
 *   - `sourceType: "fanny_auto"` — distinct from `"fanny_suggestion"`
 *     so:
 *       * `listProposedFannyTasksForConversation` (PR 9 Smart Hub)
 *         filters by `fanny_suggestion` → auto rows are hidden.
 *       * `listProposedFannyTaskCountsByConversation` (PR 10 badge)
 *         filters by `fanny_suggestion` → auto rows do NOT inflate
 *         the "pending decision" badge.
 *       * `listInboxScopedTasks` (Inbox To-do tab) filters by
 *         `inbox_todo | manual` → auto rows do NOT pollute that view.
 *   - `metadata.autoCreated: true` and `metadata.automationReason`
 *     for audit / forensics.
 *   - `executionMode: "manual"` — the *creation* was automatic, but
 *     the operator still does the actual work. Staying with
 *     `"manual"` keeps the existing semantics of `executionMode`
 *     (how the task is meant to be done, not how it was created).
 *   - `suggestedBy: "fanny"` — same as proposed, so analytics that
 *     filter by Fanny-originated work continue to include both lanes.
 *
 * Identity / link columns mirror the proposed builder exactly so
 * downstream code (e.g. dismiss / promote flows) can resolve the
 * row from the same `(workspaceId, conversationActionId)` key.
 */
export function buildAutoCreatedWorkspaceTaskFromAction(
  input: BuildAutoCreatedWorkspaceTaskInput,
): WorkspaceTaskCreateData {
  const proposed = buildProposedWorkspaceTaskFromAction(input)

  /**
   * Re-parse the metadata the proposed builder produced and stamp
   * the auto-create markers on top. We round-trip through JSON so
   * we never mutate the proposed builder's output object and the
   * resulting metadata stays valid JSON.
   */
  let metadataObj: Record<string, unknown> = {}
  try {
    const parsed = JSON.parse(proposed.metadata) as unknown
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      metadataObj = parsed as Record<string, unknown>
    }
  } catch {
    metadataObj = {}
  }
  metadataObj.autoCreated = true
  metadataObj.automationReason = input.automationReason

  return {
    ...proposed,
    status: "open",
    sourceType: "fanny_auto",
    sourceLabel: "Auto-created from Inbox",
    metadata: JSON.stringify(metadataObj),
  }
}

/**
 * Mutable subset of fields refreshed when Fanny re-runs over an
 * auto-created task that the operator hasn't touched yet. Identical
 * shape to `ProposedWorkspaceTaskRefreshData` — keeping them in sync
 * means re-runs behave the same in both lanes (text and priority
 * may shift, identity and lifecycle never do).
 *
 * Status is intentionally NOT in this subset: even though auto rows
 * are born `"open"`, Fanny must never silently regress an
 * `in_progress` / `done` / `dismissed` task back to `open` based on
 * a re-classification. The caller is responsible for guarding with
 * `status === "open"` before applying this patch.
 */
export type AutoCreatedWorkspaceTaskRefreshData = ProposedWorkspaceTaskRefreshData

export function pickAutoCreatedWorkspaceTaskRefreshFields(
  data: WorkspaceTaskCreateData,
): AutoCreatedWorkspaceTaskRefreshData {
  return pickProposedWorkspaceTaskRefreshFields(data)
}
