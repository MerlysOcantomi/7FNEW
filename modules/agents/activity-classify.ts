/**
 * Agents activity classifier (PR 1).
 *
 * PURE function layer. No DB access. No I/O. No React. No API. No
 * randomness. Given the minimal shape of a `WorkspaceTask` or a
 * `ConversationAction` row, decide which Agents lane (if any) the row
 * belongs to.
 *
 * Following the pure-planner pattern documented in
 * `docs/inbox-pipeline-testing.md`: keep the policy/classification
 * deterministic and unit-testable here; let the aggregator
 * (`activity-aggregator.ts`) be a thin DB orchestration layer that maps
 * rows through these functions and never embeds business conditions
 * inline.
 *
 * Lane rules (mirror the product spec exactly):
 *
 *   WorkspaceTask:
 *     - sourceType === "fanny_auto"                          → "automated"
 *     - status === "proposed" && sourceType === "fanny_suggestion" → "needs_review"
 *     - otherwise                                            → null (not shown)
 *
 *   ConversationAction:
 *     - errorMessage present (non-empty)                     → "attention"
 *     - status === "suggested"                               → "attention"
 *     - status === "executed"                                → "executed"
 *     - otherwise (approved / dismissed / unknown)           → null (not shown)
 *
 * `null` means "this row is not part of the Agents surface" — the
 * aggregator drops it. Returning `null` rather than throwing keeps the
 * classifier total over arbitrary input.
 */

import type { AgentsActivityLane } from "./types"

/**
 * Minimal projection of a `WorkspaceTask` the classifier needs. The
 * aggregator selects exactly these columns so we never pull heavy
 * fields (description bodies, metadata blobs) into the hot path.
 */
export interface ClassifiableWorkspaceTask {
  status: string
  sourceType: string | null
}

/**
 * Minimal projection of a `ConversationAction` the classifier needs.
 */
export interface ClassifiableConversationAction {
  status: string
  errorMessage: string | null
}

/** Treat empty / whitespace-only strings as "absent". */
function hasText(value: string | null | undefined): boolean {
  return typeof value === "string" && value.trim().length > 0
}

/**
 * Classify a `WorkspaceTask` into an Agents lane, or `null` when the
 * row should not surface on the Agents board.
 */
export function classifyWorkspaceTask(
  task: ClassifiableWorkspaceTask,
): AgentsActivityLane | null {
  if (task.sourceType === "fanny_auto") {
    return "automated"
  }
  if (task.status === "proposed" && task.sourceType === "fanny_suggestion") {
    return "needs_review"
  }
  return null
}

/**
 * Classify a `ConversationAction` into an Agents lane, or `null` when
 * the row should not surface.
 *
 * Error precedence: an action carrying an `errorMessage` always routes
 * to `attention` regardless of its `status` — a failed run is exactly
 * what a human needs to see, even if the status column wasn't updated.
 */
export function classifyConversationAction(
  action: ClassifiableConversationAction,
): AgentsActivityLane | null {
  if (hasText(action.errorMessage)) {
    return "attention"
  }
  if (action.status === "suggested") {
    return "attention"
  }
  if (action.status === "executed") {
    return "executed"
  }
  return null
}
