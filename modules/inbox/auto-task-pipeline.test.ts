/**
 * Integration coverage for the Fanny `create_task` write pipeline (PR 14).
 *
 * The unit-tested surface from PR 13 (`evaluateAutoCreatePolicy`)
 * answers "should this task be auto-created?". This file covers the
 * next layer: "given the gate's answer + the existing-task state,
 * what does the pipeline write?"
 *
 * The actual `runConversationIntelligence` transaction is too heavy
 * for narrow coverage (real Prisma + real DeepSeek call). Instead
 * we drive the pure planner `planCreateTaskWrite` extracted in PR 14,
 * which is the same function the production transaction consumes.
 * Asserting on its returned plan is byte-equivalent to asserting on
 * the actual `tx.workspaceTask.*` / `tx.conversationAction.*` calls
 * that the transaction would emit, because the transaction is now a
 * thin mapping layer on top of the plan (see `intelligence.ts`).
 *
 * Test runner: `node:test` via `tsx --test`. Run narrowly with:
 *
 *   npm run test:fanny-pipeline
 *
 * or directly:
 *
 *   npx tsx --test modules/inbox/auto-task-pipeline.test.ts
 *
 * Behavior guarantee: PR 14 only adds coverage and refactors the
 * decision logic into a planner. The lane semantics, the Prisma
 * write shapes, and the idempotency guards are unchanged from PR 12.
 */

import assert from "node:assert/strict"
import test from "node:test"

import {
  evaluateAutoCreatePolicy,
  type AutoCreatePolicyDecision,
  type AutoCreatePolicyInput,
} from "./auto-task-policy"
import {
  planCreateTaskWrite,
  type CreateTaskWritePlan,
  type ExistingWorkspaceTaskState,
  type PlanCreateTaskWriteInput,
} from "./auto-task-write-planner"
import type { BuildProposedWorkspaceTaskInput } from "@modules/tasks/conversation-action-mapping"

// ─── Test factories ─────────────────────────────────────────────────────────

const ACTION_ID = "act_test_001"
const WORKSPACE_ID = "ws_test"
const CONVERSATION_ID = "conv_test"

/**
 * Default safe inputs that, when fed straight into
 * `evaluateAutoCreatePolicy`, return `auto: true`. Each test only
 * varies the field it cares about, so failures localise to the
 * specific guard under test.
 */
function makePolicyInput(
  overrides: {
    action?: Partial<AutoCreatePolicyInput["action"]>
    conversation?: Partial<AutoCreatePolicyInput["conversation"]>
    otherActionTypesInRun?: readonly string[]
  } = {},
): AutoCreatePolicyInput {
  return {
    action: {
      type: "create_task",
      title: "Update CRM contact info",
      description: "Mark the missing email field as filled",
      confidence: 0.92,
      ...(overrides.action ?? {}),
    },
    conversation: {
      workspaceId: WORKSPACE_ID,
      conversationId: CONVERSATION_ID,
      urgency: "media",
      tipo: "consulta",
      ...(overrides.conversation ?? {}),
    },
    otherActionTypesInRun: overrides.otherActionTypesInRun ?? [],
  }
}

/**
 * Builder input the production code constructs inside the
 * intelligence transaction. Wraps the same shape PR 6/PR 7
 * already accept, so refactoring those builders won't silently
 * desync this test file from production.
 */
function makeBuilderInput(
  overrides: Partial<{
    confidence: number | null
    title: string
    description: string
    sourceMessageId: string | null
  }> = {},
): BuildProposedWorkspaceTaskInput {
  return {
    workspaceId: WORKSPACE_ID,
    conversation: {
      id: CONVERSATION_ID,
      clienteId: null,
      proyectoId: null,
      urgency: "media",
    },
    action: {
      id: ACTION_ID,
      type: "create_task",
      source: "ai",
      data: JSON.stringify({
        title: overrides.title ?? "Update CRM contact info",
        description:
          overrides.description ?? "Mark the missing email field as filled",
        pipelineVersion: "5",
        trigger: "inbox_post",
      }),
      sourceMessageId:
        overrides.sourceMessageId === undefined ? "msg_1" : overrides.sourceMessageId,
      confidence: overrides.confidence === undefined ? 0.92 : overrides.confidence,
    },
    pipeline: {
      pipelineVersion: "5",
      promptVersion: "fanny-v1.2",
      trigger: "inbox_post",
    },
  }
}

function makePlanInput(overrides: {
  decision?: AutoCreatePolicyDecision
  policyOverrides?: Parameters<typeof makePolicyInput>[0]
  builderOverrides?: Parameters<typeof makeBuilderInput>[0]
  existingTask?: ExistingWorkspaceTaskState | null
} = {}): PlanCreateTaskWriteInput {
  const decision =
    overrides.decision ??
    evaluateAutoCreatePolicy(makePolicyInput(overrides.policyOverrides ?? {}))
  return {
    decision,
    builderInput: makeBuilderInput(overrides.builderOverrides ?? {}),
    existingTask: overrides.existingTask ?? null,
  }
}

/**
 * Decode the JSON metadata column the way the production read
 * layer does (`inbox-tasks-read.ts` / `service.ts`). Centralised
 * here so a metadata-shape regression fails one assertion instead
 * of N.
 */
function readMeta(metadata: string): Record<string, unknown> {
  const parsed = JSON.parse(metadata) as unknown
  assert.ok(parsed && typeof parsed === "object" && !Array.isArray(parsed))
  return parsed as Record<string, unknown>
}

// ─── Scenario 1 — auto=true path ─────────────────────────────────────────────

test("auto=true: creates fanny_auto open WorkspaceTask + flips action to executed", () => {
  const plan = planCreateTaskWrite(makePlanInput())

  assert.equal(plan.lane, "auto")
  assert.equal(plan.decision.auto, true)

  /**
   * The WorkspaceTask write must be a CREATE with the auto-lane
   * shape. Lock every column the read layers / aggregator filter on
   * (`status`, `sourceType`, `suggestedBy`) plus the audit metadata.
   */
  assert.equal(plan.taskWrite.kind, "create")
  if (plan.taskWrite.kind !== "create") return
  assert.equal(plan.taskWrite.data.status, "open")
  assert.equal(plan.taskWrite.data.sourceType, "fanny_auto")
  assert.equal(plan.taskWrite.data.suggestedBy, "fanny")
  assert.equal(plan.taskWrite.data.executionMode, "manual")
  assert.equal(plan.taskWrite.data.workspaceId, WORKSPACE_ID)
  assert.equal(plan.taskWrite.data.conversationId, CONVERSATION_ID)
  assert.equal(plan.taskWrite.data.conversationActionId, ACTION_ID)

  const meta = readMeta(plan.taskWrite.data.metadata)
  assert.equal(meta.autoCreated, true, "metadata.autoCreated must be true")
  assert.equal(
    typeof meta.automationReason,
    "string",
    "metadata.automationReason must be present and a string",
  )
  assert.ok(
    String(meta.automationReason).length > 0,
    "metadata.automationReason must be non-empty",
  )

  /**
   * The ConversationAction must be flipped to `"executed"`. The
   * planner returns intent only — `resultId` and `reviewedAt` are
   * filled by the caller AFTER `tx.workspaceTask.create` runs (since
   * the new id isn't known yet). `reviewedBy` is intentionally NOT
   * in the plan so the production update leaves it `null`.
   */
  assert.notEqual(plan.actionUpdate, null)
  if (!plan.actionUpdate) return
  assert.equal(plan.actionUpdate.kind, "execute")
  assert.equal(plan.actionUpdate.resultModule, "workspace_task")
  assert.ok(
    plan.actionUpdate.executionNotes.startsWith("Auto-created by Fanny "),
    `executionNotes must start with the audit prefix, got: ${plan.actionUpdate.executionNotes}`,
  )
  assert.ok(
    plan.actionUpdate.executionNotes.includes(plan.decision.reason),
    "executionNotes must embed the policy reason for forensics",
  )
})

// ─── Scenario 2 — auto=false (review lane) path ──────────────────────────────

test("auto=false (low confidence 0.6): preserves PR 7 proposed lane untouched", () => {
  const plan = planCreateTaskWrite(
    makePlanInput({
      policyOverrides: { action: { confidence: 0.6 } },
      builderOverrides: { confidence: 0.6 },
    }),
  )

  assert.equal(plan.lane, "review")
  assert.equal(plan.decision.auto, false)
  assert.equal(plan.decision.reason, "confidence_below_threshold")

  assert.equal(plan.taskWrite.kind, "create")
  if (plan.taskWrite.kind !== "create") return
  assert.equal(plan.taskWrite.data.status, "proposed")
  assert.equal(plan.taskWrite.data.sourceType, "fanny_suggestion")
  assert.equal(plan.taskWrite.data.suggestedBy, "fanny")
  assert.equal(plan.taskWrite.data.executionMode, "manual")

  /**
   * The review lane must NOT touch the ConversationAction — the
   * Smart Hub still needs to render it as `"suggested"` so the
   * operator can approve / dismiss. Locks the contract that
   * `resultModule` / `resultId` are NEVER attached on the proposed
   * lane.
   */
  assert.equal(plan.actionUpdate, null)

  /**
   * Negative metadata assertion: the proposed lane must NOT carry
   * the auto-create markers. Otherwise PR 7 read filters
   * (`metadata.autoCreated` is unused today, but other surfaces
   * may grow to depend on its absence) would mis-classify.
   */
  const meta = readMeta(plan.taskWrite.data.metadata)
  assert.equal(meta.autoCreated, undefined)
  assert.equal(meta.automationReason, undefined)
})

// ─── Scenario 3 — cross-action guard ─────────────────────────────────────────

test("cross-action guard: safe create_task + create_event in same run → review lane", () => {
  /**
   * Inputs are auto-eligible on every other dimension (high
   * confidence, safe title, non-critical urgency). The ONLY reason
   * this should drop to review is the co-occurring `create_event`
   * action — which carries external impact (the operator must
   * approve the calendar event before any internal task assumes the
   * meeting is on the books).
   */
  const policyInput = makePolicyInput({
    otherActionTypesInRun: ["create_event"],
  })
  const decision = evaluateAutoCreatePolicy(policyInput)
  assert.equal(decision.auto, false)
  assert.equal(decision.reason, "external_impact_action_in_run:create_event")

  const plan = planCreateTaskWrite(makePlanInput({ decision }))
  assert.equal(plan.lane, "review")
  assert.equal(plan.taskWrite.kind, "create")
  if (plan.taskWrite.kind !== "create") return
  assert.equal(plan.taskWrite.data.status, "proposed")
  assert.equal(plan.taskWrite.data.sourceType, "fanny_suggestion")
  assert.equal(plan.actionUpdate, null)
})

// ─── Scenario 4 — idempotency matrix ─────────────────────────────────────────

test("idempotency: rerun on auto task with no existing row → plan a single create", () => {
  /**
   * A naive pipeline that called `tx.workspaceTask.create(...)`
   * unconditionally would duplicate rows on every Fanny re-run.
   * The plan must be `kind: "create"` only when there is no
   * existing mirror — verified here, then complemented by the
   * subsequent re-run cases.
   */
  const plan = planCreateTaskWrite(makePlanInput({ existingTask: null }))
  assert.equal(plan.taskWrite.kind, "create")
})

test("idempotency: rerun on existing fanny_auto/open task → refresh, no duplicate", () => {
  const existingTask: ExistingWorkspaceTaskState = {
    id: "wt_existing_auto",
    status: "open",
    sourceType: "fanny_auto",
  }
  const plan = planCreateTaskWrite(makePlanInput({ existingTask }))

  assert.equal(plan.lane, "auto")
  assert.equal(plan.taskWrite.kind, "refresh")
  if (plan.taskWrite.kind !== "refresh") return
  assert.equal(plan.taskWrite.existingTaskId, existingTask.id)

  /**
   * Refresh must contain ONLY mutable presentation fields. Identity,
   * lifecycle, audit, and link columns must be absent — those
   * belong to the operator (or the original create) and are never
   * rewritten by re-classifications.
   */
  const refresh = plan.taskWrite.refreshData
  const allowedKeys = new Set([
    "title",
    "description",
    "priority",
    "messageId",
    "clienteId",
    "proyectoId",
    "sourceLabel",
    "metadata",
  ])
  const forbiddenKeys = [
    "status",
    "sourceType",
    "createdBy",
    "suggestedBy",
    "executionMode",
    "workspaceId",
    "conversationId",
    "conversationActionId",
    "tareaId",
    "eventoId",
    "completedAt",
    "completedBy",
    "dismissedAt",
    "dismissedReason",
  ]
  for (const key of Object.keys(refresh)) {
    assert.ok(
      allowedKeys.has(key),
      `refreshData has unexpected key "${key}" — only mutable presentation fields are allowed`,
    )
  }
  for (const key of forbiddenKeys) {
    assert.equal(
      (refresh as Record<string, unknown>)[key],
      undefined,
      `refreshData must NOT include "${key}" (would regress operator-managed columns)`,
    )
  }

  /**
   * No action update on refresh — the action was already flipped
   * to `"executed"` on the first auto-create run. Re-flipping
   * would clobber the original `reviewedAt` timestamp.
   */
  assert.equal(plan.actionUpdate, null)
})

test("idempotency: existing task in_progress (operator picked it up) → skip, do not reset", () => {
  /**
   * The operator has actively moved the task into `in_progress`.
   * Fanny re-running on the same conversation must NOT regress
   * that to `open`. The planner returns `kind: "skip"` so the
   * production transaction performs zero writes.
   */
  const existingTask: ExistingWorkspaceTaskState = {
    id: "wt_existing_in_progress",
    status: "in_progress",
    sourceType: "fanny_auto",
  }
  const plan = planCreateTaskWrite(makePlanInput({ existingTask }))

  assert.equal(plan.lane, "auto")
  assert.equal(plan.taskWrite.kind, "skip")
  if (plan.taskWrite.kind !== "skip") return
  assert.equal(plan.taskWrite.reason, "auto_existing_not_refreshable")
  assert.equal(plan.taskWrite.existingStatus, "in_progress")
  assert.equal(plan.actionUpdate, null)
})

test("idempotency: auto decision but existing row is fanny_suggestion (operator-promoted) → skip", () => {
  /**
   * Edge case worth locking: the gate flips between runs (e.g. a
   * borderline confidence shifts from 0.84 → 0.92 over time). The
   * existing row was created on the proposed lane and the operator
   * has approved it (now `"open"` with `sourceType="fanny_suggestion"`).
   * Auto-refreshing would overwrite the operator's
   * approve-step audit with an auto-create payload. Must skip.
   */
  const existingTask: ExistingWorkspaceTaskState = {
    id: "wt_existing_promoted",
    status: "open",
    sourceType: "fanny_suggestion",
  }
  const plan = planCreateTaskWrite(makePlanInput({ existingTask }))

  assert.equal(plan.lane, "auto")
  assert.equal(plan.taskWrite.kind, "skip")
  if (plan.taskWrite.kind !== "skip") return
  assert.equal(plan.taskWrite.reason, "auto_existing_not_refreshable")
  assert.equal(plan.taskWrite.existingSourceType, "fanny_suggestion")
})

test("idempotency: review lane with existing proposed row → refresh proposed", () => {
  /**
   * Symmetric review-lane idempotency: re-runs of the same
   * `create_task` with an existing `"proposed"` mirror should
   * refresh the mutable fields (PR 7 contract). Locks PR 7
   * behavior survives the PR 14 refactor.
   */
  const existingTask: ExistingWorkspaceTaskState = {
    id: "wt_existing_proposed",
    status: "proposed",
    sourceType: "fanny_suggestion",
  }
  const plan = planCreateTaskWrite(
    makePlanInput({
      policyOverrides: { action: { confidence: 0.6 } },
      builderOverrides: { confidence: 0.6 },
      existingTask,
    }),
  )

  assert.equal(plan.lane, "review")
  assert.equal(plan.taskWrite.kind, "refresh")
  if (plan.taskWrite.kind !== "refresh") return
  assert.equal(plan.taskWrite.existingTaskId, existingTask.id)
  assert.equal(plan.actionUpdate, null)
})

test("idempotency: review lane with existing dismissed row → skip, do not resurrect", () => {
  /**
   * The operator dismissed the proposed task. Re-running Fanny
   * must NOT recreate / unhide it. The planner skips and returns
   * the diagnostic reason for forensic logging.
   */
  const existingTask: ExistingWorkspaceTaskState = {
    id: "wt_existing_dismissed",
    status: "dismissed",
    sourceType: "fanny_suggestion",
  }
  const plan = planCreateTaskWrite(
    makePlanInput({
      policyOverrides: { action: { confidence: 0.6 } },
      builderOverrides: { confidence: 0.6 },
      existingTask,
    }),
  )

  assert.equal(plan.lane, "review")
  assert.equal(plan.taskWrite.kind, "skip")
  if (plan.taskWrite.kind !== "skip") return
  assert.equal(plan.taskWrite.reason, "review_existing_not_proposed")
  assert.equal(plan.actionUpdate, null)
})

// ─── Behavior contract — plan is pure & exhaustive ──────────────────────────

test("contract: plan.lane always matches plan.decision.auto", () => {
  /**
   * Light invariant: there is no path through the planner where
   * `lane` and `decision.auto` disagree. Catches future refactors
   * that might forget to thread one of them through.
   */
  const inputs: PlanCreateTaskWriteInput[] = [
    makePlanInput(),
    makePlanInput({ existingTask: { id: "x", status: "open", sourceType: "fanny_auto" } }),
    makePlanInput({ existingTask: { id: "x", status: "in_progress", sourceType: "fanny_auto" } }),
    makePlanInput({
      policyOverrides: { action: { confidence: 0.6 } },
      builderOverrides: { confidence: 0.6 },
    }),
    makePlanInput({
      policyOverrides: { action: { confidence: 0.6 } },
      builderOverrides: { confidence: 0.6 },
      existingTask: { id: "y", status: "proposed", sourceType: "fanny_suggestion" },
    }),
    makePlanInput({
      policyOverrides: { otherActionTypesInRun: ["schedule_followup"] },
    }),
  ]

  for (const input of inputs) {
    const plan: CreateTaskWritePlan = planCreateTaskWrite(input)
    if (plan.decision.auto) {
      assert.equal(plan.lane, "auto")
    } else {
      assert.equal(plan.lane, "review")
    }
  }
})

test("contract: plan is deterministic (pure function)", () => {
  /**
   * Same input → identical plan. Locks "no caching, no IO, no
   * randomness" — the production transaction relies on this so a
   * retry of the same intelligence run never produces a different
   * write set than the first attempt.
   */
  const input = makePlanInput({
    existingTask: { id: "wt_x", status: "open", sourceType: "fanny_auto" },
  })
  const a = planCreateTaskWrite(input)
  const b = planCreateTaskWrite(input)
  assert.deepEqual(a, b)
})
