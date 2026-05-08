/**
 * Fanny `create_task` write planner (PR 14).
 *
 * Pure planning layer that decides — for a single `create_task`
 * normalized action — *what* should be written to `WorkspaceTask`
 * and *what* update should be applied to the linked
 * `ConversationAction`. No DB access. No I/O. No randomness.
 *
 * Why this module exists
 * ──────────────────────
 * PR 12 introduced the auto-create lane inline in the
 * `runConversationIntelligence` transaction. That lane has four
 * decision branches (auto×{create, refresh, skip}, review×{create,
 * refresh, skip}) plus an action-update side-effect, all of which
 * are critical to data integrity and idempotency. Testing them
 * end-to-end requires standing up Prisma + a real DB row, which is
 * heavy for the four scenarios we actually care about (auto/review/
 * cross-action/idempotency).
 *
 * This module extracts the *planning* logic into a deterministic
 * function that returns a description of the writes. The transaction
 * in `intelligence.ts` consumes the plan and performs the real
 * `tx.workspaceTask.*` / `tx.conversationAction.*` calls. Production
 * behavior is byte-identical — just routed through a seam that the
 * test file can drive directly.
 *
 * Non-goals
 * ─────────
 *   - This module does NOT call the gate (`evaluateAutoCreatePolicy`)
 *     internally and re-derive the decision. The caller passes the
 *     decision in. That makes tests trivially mix-and-match decisions
 *     with `existingTask` states without crafting policy-passing
 *     inputs each time.
 *   - This module does NOT mutate any DB row. The returned plan is a
 *     plain immutable record that the caller maps to Prisma calls.
 *   - This module does NOT log telemetry. The caller (intelligence.ts)
 *     already owns the structured `console.info` from PR 13 and
 *     reuses `plan.decision` / `plan.lane` so the log never drifts
 *     from the actual writes.
 */

import {
  buildAutoCreatedWorkspaceTaskFromAction,
  buildProposedWorkspaceTaskFromAction,
  pickAutoCreatedWorkspaceTaskRefreshFields,
  pickProposedWorkspaceTaskRefreshFields,
  type BuildProposedWorkspaceTaskInput,
  type ProposedWorkspaceTaskRefreshData,
} from "@modules/tasks/conversation-action-mapping"
import type { WorkspaceTaskCreateData } from "@modules/tasks/inbox-todo-mapping"

import type { AutoCreatePolicyDecision } from "./auto-task-policy"

/**
 * Snapshot of the existing `WorkspaceTask` row (if any) that already
 * mirrors this `ConversationAction`. Resolved by the caller via a
 * `findFirst({ workspaceId, conversationActionId })` query. `null`
 * means no mirror exists yet.
 */
export interface ExistingWorkspaceTaskState {
  id: string
  status: string
  sourceType: string | null
}

export interface PlanCreateTaskWriteInput {
  /** Pre-computed gate output from `evaluateAutoCreatePolicy`. The
   *  planner trusts this verbatim — it does not re-evaluate. */
  decision: AutoCreatePolicyDecision
  /** Builder input for the proposed/auto WorkspaceTask payload.
   *  The planner uses the same shape PR 12 already passes to the
   *  PR 6/PR 7 builders, so callers don't have to construct two
   *  different shapes for the two lanes. */
  builderInput: BuildProposedWorkspaceTaskInput
  /** Existing mirror row, if `findFirst` returned one. */
  existingTask: ExistingWorkspaceTaskState | null
}

/**
 * Why a row is being skipped — surfaced for forensic logging by the
 * caller (or for test assertions). Mirrors the inline comments in
 * the original PR 12 code so we never lose the "why" when reading
 * a skipped plan.
 */
export type CreateTaskWriteSkipReason =
  /** Auto lane: an existing row exists but it's not in the safe
   *  refresh state (`status="open" AND sourceType="fanny_auto"`).
   *  Could be a row promoted from proposed by an operator
   *  (sourceType=`fanny_suggestion`), or a row the operator has
   *  moved to `in_progress` / `done` / `dismissed`. Either way,
   *  Fanny must not touch it. */
  | "auto_existing_not_refreshable"
  /** Review lane: an existing row exists but it's not `"proposed"`.
   *  Means the operator has already approved (now `"open"` /
   *  `"in_progress"` / etc.) or dismissed it. Refreshing would
   *  regress operator-managed work. */
  | "review_existing_not_proposed"

export type CreateTaskWritePlan = {
  /**
   * Audit / telemetry visibility. Mirrors the value the caller
   * publishes in the `fanny_auto_decision` log (PR 13).
   */
  lane: "auto" | "review"
  /**
   * Re-exposed gate decision so the caller's telemetry log can read
   * `plan.decision.reason` without holding on to a separate variable.
   */
  decision: AutoCreatePolicyDecision
  /**
   * What to do with `WorkspaceTask`. Discriminated union so the
   * caller's `switch` is exhaustive and TypeScript rejects forgotten
   * branches.
   */
  taskWrite:
    | { kind: "create"; data: WorkspaceTaskCreateData }
    | {
        kind: "refresh"
        existingTaskId: string
        refreshData: ProposedWorkspaceTaskRefreshData
      }
    | {
        kind: "skip"
        reason: CreateTaskWriteSkipReason
        existingTaskId: string
        existingStatus: string
        existingSourceType: string | null
      }
  /**
   * Optional update to apply to the linked `ConversationAction`
   * AFTER the task write succeeds. Only the auto-create-from-scratch
   * branch produces this — every other branch leaves the
   * `ConversationAction` in its current state (most often
   * `"suggested"`, awaiting human decision).
   *
   * The caller is responsible for filling in `resultId` (the freshly
   * created task id) and `reviewedAt` (`new Date()`); those values
   * cannot be known by the planner because no DB call has run yet.
   */
  actionUpdate:
    | {
        kind: "execute"
        /** Deterministic, non-PII string the caller writes verbatim
         *  into `ConversationAction.executionNotes`. Format:
         *  `"Auto-created by Fanny (${decision.reason})"`. The
         *  prefix is the contract the operator audit search relies
         *  on; the reason carries the policy verdict. */
        executionNotes: string
        /** Module name for the resolved result row, mirrors the
         *  literal `"workspace_task"` used by every other auto-execute
         *  side-effect in `service.ts`. The caller writes this into
         *  `ConversationAction.resultModule`. */
        resultModule: "workspace_task"
      }
    | null
}

/**
 * Plan the WorkspaceTask + ConversationAction writes for a single
 * Fanny-emitted `create_task` action.
 *
 * Pure. Synchronous. Deterministic given inputs. The branches below
 * mirror the PR 12 inline logic exactly:
 *
 *   auto + no existing            → create + execute action
 *   auto + (open, fanny_auto)     → refresh
 *   auto + (anything else)        → skip (auto_existing_not_refreshable)
 *   review + no existing          → create
 *   review + (proposed)           → refresh
 *   review + (anything else)      → skip (review_existing_not_proposed)
 *
 * Refresh data uses the lane-specific `pick*RefreshFields` helper so
 * identity / lifecycle columns (status, sourceType, createdBy,
 * suggestedBy, executionMode, ids) are never overwritten.
 */
export function planCreateTaskWrite(
  input: PlanCreateTaskWriteInput,
): CreateTaskWritePlan {
  const { decision, builderInput, existingTask } = input

  if (decision.auto) {
    /**
     * Build the full create payload up-front. We use it directly for
     * the `create` branch and reduce it to the refresh subset for
     * the `refresh` branch. Building it once is cheap and keeps the
     * two branches consistent (refresh values can never disagree
     * with what a create would have written).
     */
    const autoData = buildAutoCreatedWorkspaceTaskFromAction({
      ...builderInput,
      automationReason: decision.reason,
    })

    if (!existingTask) {
      return {
        lane: "auto",
        decision,
        taskWrite: { kind: "create", data: autoData },
        actionUpdate: {
          kind: "execute",
          executionNotes: `Auto-created by Fanny (${decision.reason})`,
          resultModule: "workspace_task",
        },
      }
    }

    if (
      existingTask.status === "open" &&
      existingTask.sourceType === "fanny_auto"
    ) {
      return {
        lane: "auto",
        decision,
        taskWrite: {
          kind: "refresh",
          existingTaskId: existingTask.id,
          refreshData: pickAutoCreatedWorkspaceTaskRefreshFields(autoData),
        },
        actionUpdate: null,
      }
    }

    return {
      lane: "auto",
      decision,
      taskWrite: {
        kind: "skip",
        reason: "auto_existing_not_refreshable",
        existingTaskId: existingTask.id,
        existingStatus: existingTask.status,
        existingSourceType: existingTask.sourceType,
      },
      actionUpdate: null,
    }
  }

  /**
   * Review lane (default). Mirrors the PR 7 path exactly: only
   * refreshes rows that are still `"proposed"`, never regresses
   * operator-managed work.
   */
  const proposedData = buildProposedWorkspaceTaskFromAction(builderInput)

  if (!existingTask) {
    return {
      lane: "review",
      decision,
      taskWrite: { kind: "create", data: proposedData },
      actionUpdate: null,
    }
  }

  if (existingTask.status === "proposed") {
    return {
      lane: "review",
      decision,
      taskWrite: {
        kind: "refresh",
        existingTaskId: existingTask.id,
        refreshData: pickProposedWorkspaceTaskRefreshFields(proposedData),
      },
      actionUpdate: null,
    }
  }

  return {
    lane: "review",
    decision,
    taskWrite: {
      kind: "skip",
      reason: "review_existing_not_proposed",
      existingTaskId: existingTask.id,
      existingStatus: existingTask.status,
      existingSourceType: existingTask.sourceType,
    },
    actionUpdate: null,
  }
}
