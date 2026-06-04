import { db } from "@core/db"

/**
 * Smart Action state — the SevenF-native signal that turns the Smart Inbox into
 * something more than a normal inbox ("Conversations in. Work done."). It is a
 * single, derived, read-only summary of where Fanny's work on a conversation
 * currently stands, computed per conversation from existing rows (no schema
 * change, no writes, no Fanny-logic change).
 *
 * PR 1 (this module) only DERIVES the state and attaches it to the conversation
 * list payload. There is no filter UI yet — PR 2 will surface it as a "Needs
 * review" hero affordance + an "AI status" control in More filters.
 *
 * Stable enum (kept small on purpose — labels are mapped client-side):
 *   - failed        a related ConversationAction failed (needs attention)
 *   - needs_review  Fanny proposed something awaiting a human decision
 *                   (proposed WorkspaceTask) or a suggested ConversationAction
 *   - draft_ready   an unsent ghost-reply ConversationDraft is waiting
 *   - action_ready  a ConversationAction is approved but not yet executed
 *   - task_created  a real WorkspaceTask (open / in_progress) exists for it
 *   - none          nothing actionable derived
 *
 * Reserved for later (PR 2+ when a reliable signal exists, NOT derived today):
 *   waiting_for_fanny, no_action_needed.
 */
export type SmartActionState =
  | "none"
  | "failed"
  | "needs_review"
  | "draft_ready"
  | "action_ready"
  | "task_created"

/**
 * Priority high → low. The first matching signal wins so each conversation maps
 * to exactly one state. `failed` is surfaced first (it's a problem), then the
 * states that need a human (`needs_review`, `draft_ready`, `action_ready`),
 * then the purely informational `task_created`.
 */
const STATE_PRIORITY: readonly SmartActionState[] = [
  "failed",
  "needs_review",
  "draft_ready",
  "action_ready",
  "task_created",
]

interface ConversationSignals {
  failed: boolean
  needsReview: boolean
  draftReady: boolean
  actionReady: boolean
  taskCreated: boolean
}

function pickState(signals: ConversationSignals): SmartActionState {
  for (const state of STATE_PRIORITY) {
    if (state === "failed" && signals.failed) return "failed"
    if (state === "needs_review" && signals.needsReview) return "needs_review"
    if (state === "draft_ready" && signals.draftReady) return "draft_ready"
    if (state === "action_ready" && signals.actionReady) return "action_ready"
    if (state === "task_created" && signals.taskCreated) return "task_created"
  }
  return "none"
}

export interface DeriveSmartActionStatesParams {
  workspaceId: string
  /**
   * Visible conversation ids the inbox list will render. Always pass the page's
   * slice (≤ pageSize) so every IN-clause below stays bounded — never an
   * unbounded universe of ids. Blanks/dupes are filtered internally.
   */
  conversationIds: readonly string[]
  /**
   * Per-conversation count of proposed Fanny `WorkspaceTask` rows, already
   * computed by the list route via `listProposedFannyTaskCountsByConversation`.
   * Reused here (instead of re-querying) so a conversation with > 0 proposed
   * tasks resolves to `needs_review` without an extra round-trip.
   */
  proposedTaskCounts?: ReadonlyMap<string, number>
}

/**
 * Derive the Smart Action state for a page of conversations.
 *
 * Resilience contract (mirrors `listProposedFannyTaskCountsByConversation` +
 * the way the list route already degrades the proposed-task badge):
 *   - All queries are page-scoped (`conversationId IN visible ids`) → no N+1,
 *     no unbounded scan.
 *   - Each signal query is independent (`Promise.allSettled`); if one fails the
 *     others still contribute, and the failing signal simply reads as "absent".
 *   - The function NEVER throws. A fully-empty / all-failed run yields a map
 *     where every conversation defaults to `none` (callers do `?? "none"`).
 *   - Read-only: no row is created or mutated.
 */
export async function deriveSmartActionStatesByConversation(
  params: DeriveSmartActionStatesParams,
): Promise<Map<string, SmartActionState>> {
  const result = new Map<string, SmartActionState>()

  const workspaceId = params.workspaceId?.trim()
  if (!workspaceId) return result

  const ids = Array.from(
    new Set(
      params.conversationIds.filter(
        (id): id is string => typeof id === "string" && id.trim().length > 0,
      ),
    ),
  )
  if (ids.length === 0) return result

  const failedSet = new Set<string>()
  const suggestedSet = new Set<string>()
  const approvedSet = new Set<string>()
  const draftSet = new Set<string>()
  const taskSet = new Set<string>()

  const [actionRes, draftRes, taskRes] = await Promise.allSettled([
    /**
     * ConversationAction status per conversation. One groupBy returns every
     * (conversationId, status) pair we care about; we fan it out into the
     * failed / suggested / approved sets below.
     */
    db.conversationAction.groupBy({
      by: ["conversationId", "status"],
      where: {
        workspaceId,
        conversationId: { in: ids },
        status: { in: ["failed", "suggested", "approved"] },
      },
      _count: { _all: true },
    }),
    /**
     * Unsent ghost-reply drafts. `status = "draft"` is the active, waiting
     * state (intelligence.ts marks replaced ones `superseded` and the UI marks
     * resolved ones `dismissed`), so its mere presence means "draft ready".
     */
    db.conversationDraft.groupBy({
      by: ["conversationId"],
      where: {
        workspaceId,
        conversationId: { in: ids },
        status: "draft",
      },
      _count: { _all: true },
    }),
    /**
     * Real, actionable WorkspaceTasks created for the conversation. `proposed`
     * is intentionally excluded here — that is the `needs_review` signal and is
     * supplied via `proposedTaskCounts`.
     */
    db.workspaceTask.groupBy({
      by: ["conversationId"],
      where: {
        workspaceId,
        conversationId: { in: ids },
        status: { in: ["open", "in_progress"] },
      },
      _count: { _all: true },
    }),
  ])

  if (actionRes.status === "fulfilled") {
    for (const row of actionRes.value) {
      if (!row.conversationId) continue
      if (row.status === "failed") failedSet.add(row.conversationId)
      else if (row.status === "suggested") suggestedSet.add(row.conversationId)
      else if (row.status === "approved") approvedSet.add(row.conversationId)
    }
  }
  if (draftRes.status === "fulfilled") {
    for (const row of draftRes.value) {
      if (row.conversationId) draftSet.add(row.conversationId)
    }
  }
  if (taskRes.status === "fulfilled") {
    for (const row of taskRes.value) {
      if (row.conversationId) taskSet.add(row.conversationId)
    }
  }

  for (const id of ids) {
    const proposedCount = params.proposedTaskCounts?.get(id) ?? 0
    const state = pickState({
      failed: failedSet.has(id),
      needsReview: proposedCount > 0 || suggestedSet.has(id),
      draftReady: draftSet.has(id),
      actionReady: approvedSet.has(id),
      taskCreated: taskSet.has(id),
    })
    if (state !== "none") result.set(id, state)
  }

  return result
}
