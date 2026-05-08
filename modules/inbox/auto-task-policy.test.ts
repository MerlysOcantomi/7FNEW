/**
 * Unit tests for `evaluateAutoCreatePolicy`.
 *
 * The policy is the single gate that decides whether a `create_task`
 * Fanny suggestion is safe to materialise as `WorkspaceTask(status="open",
 * sourceType="fanny_auto")` (auto lane) or must remain a proposed
 * decision for the operator (review lane). Because the gate is the
 * ONLY automation introduced by PR 12, its behavior must be locked
 * down with deterministic coverage.
 *
 * Test runner: Node's built-in `node:test`, executed via `tsx --test`
 * (matches the existing convention in `core/i18n/i18n.test.ts` and
 * `agents/forte/runtime/*.test.ts`). Run narrowly with:
 *
 *   npm run test:auto-policy
 *
 * or directly with:
 *
 *   npx tsx --test modules/inbox/auto-task-policy.test.ts
 *
 * Behavior guarantee: PR 13 only adds coverage. The policy itself is
 * unchanged — every test here was written against the implementation
 * that shipped in PR 12 (commit f1ce0e5).
 */

import assert from "node:assert/strict"
import test from "node:test"

import {
  AUTO_CREATE_MAX_TITLE_LENGTH,
  AUTO_CREATE_MIN_CONFIDENCE,
  AUTO_CREATE_MIN_TITLE_LENGTH,
  evaluateAutoCreatePolicy,
  type AutoCreatePolicyInput,
} from "./auto-task-policy"

/**
 * Factory for a "minimum viable safe" policy input. Every field
 * defaults to a value that satisfies the gate, so each individual
 * test only has to flip the field it cares about. This keeps each
 * case focused on a single failure mode and makes regressions easy
 * to localise to a specific check.
 */
function makeInput(
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
      workspaceId: "ws_test",
      conversationId: "conv_test",
      urgency: "media",
      tipo: "consulta",
      ...(overrides.conversation ?? {}),
    },
    otherActionTypesInRun: overrides.otherActionTypesInRun ?? [],
  }
}

// ─── Case 1 — auto=true happy path ──────────────────────────────────────────

test("auto=true: low-risk obvious internal task at the threshold", () => {
  const decision = evaluateAutoCreatePolicy(makeInput())
  assert.equal(decision.auto, true)
  if (decision.auto) {
    /**
     * The reason is part of the audit trail (persisted in
     * `WorkspaceTask.metadata.automationReason` and in
     * `ConversationAction.executionNotes`). Lock its prefix so any
     * change to the reason format becomes a deliberate edit.
     */
    assert.ok(
      decision.reason.startsWith("low_risk_internal_followup:"),
      `unexpected auto reason: ${decision.reason}`,
    )
    assert.ok(decision.reason.includes("confidence="), "reason must include confidence")
  }
})

test("auto=true: confidence exactly at AUTO_CREATE_MIN_CONFIDENCE qualifies", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ action: { confidence: AUTO_CREATE_MIN_CONFIDENCE } }),
  )
  assert.equal(decision.auto, true)
})

// ─── Case 2 — reject when action.type is not create_task ────────────────────

test("auto=false: action.type is not create_task", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ action: { type: "create_event" } }),
  )
  assert.equal(decision.auto, false)
  assert.equal(decision.reason, "action_type_not_create_task")
})

test("auto=false: action.type empty string", () => {
  const decision = evaluateAutoCreatePolicy(makeInput({ action: { type: "" } }))
  assert.equal(decision.auto, false)
  assert.equal(decision.reason, "action_type_not_create_task")
})

// ─── Case 3 — confidence missing or non-numeric ─────────────────────────────

test("auto=false: confidence is null", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ action: { confidence: null } }),
  )
  assert.equal(decision.auto, false)
  assert.equal(decision.reason, "missing_confidence")
})

test("auto=false: confidence is undefined", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ action: { confidence: undefined } }),
  )
  assert.equal(decision.auto, false)
  assert.equal(decision.reason, "missing_confidence")
})

// ─── Case 4 — confidence below threshold ────────────────────────────────────

test("auto=false: confidence just below AUTO_CREATE_MIN_CONFIDENCE", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ action: { confidence: AUTO_CREATE_MIN_CONFIDENCE - 0.01 } }),
  )
  assert.equal(decision.auto, false)
  assert.equal(decision.reason, "confidence_below_threshold")
})

test("auto=false: confidence is the typical Fanny default (0.6)", () => {
  /**
   * `intelligence.ts` clamps `create_task` confidence to a default
   * of 0.6 when the model didn't supply one. That default must
   * never qualify for auto — locks the conservative bias of the gate.
   */
  const decision = evaluateAutoCreatePolicy(makeInput({ action: { confidence: 0.6 } }))
  assert.equal(decision.auto, false)
  assert.equal(decision.reason, "confidence_below_threshold")
})

// ─── Case 5 — title too short ───────────────────────────────────────────────

test("auto=false: title shorter than AUTO_CREATE_MIN_TITLE_LENGTH", () => {
  const tooShort = "a".repeat(AUTO_CREATE_MIN_TITLE_LENGTH - 1)
  const decision = evaluateAutoCreatePolicy(makeInput({ action: { title: tooShort } }))
  assert.equal(decision.auto, false)
  assert.equal(decision.reason, "title_too_short_or_empty")
})

test("auto=false: title is empty", () => {
  const decision = evaluateAutoCreatePolicy(makeInput({ action: { title: "" } }))
  assert.equal(decision.auto, false)
  assert.equal(decision.reason, "title_too_short_or_empty")
})

test("auto=false: title is whitespace only (gets trimmed)", () => {
  const decision = evaluateAutoCreatePolicy(makeInput({ action: { title: "      " } }))
  assert.equal(decision.auto, false)
  assert.equal(decision.reason, "title_too_short_or_empty")
})

// ─── Case 6 — title too long ────────────────────────────────────────────────

test("auto=false: title longer than AUTO_CREATE_MAX_TITLE_LENGTH", () => {
  const tooLong = "a".repeat(AUTO_CREATE_MAX_TITLE_LENGTH + 1)
  const decision = evaluateAutoCreatePolicy(makeInput({ action: { title: tooLong } }))
  assert.equal(decision.auto, false)
  assert.equal(decision.reason, "title_too_long")
})

// ─── Case 7 — urgencia critica ──────────────────────────────────────────────

test("auto=false: urgencia is critica", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ conversation: { urgency: "critica" } }),
  )
  assert.equal(decision.auto, false)
  assert.equal(decision.reason, "blocked_urgency:critica")
})

test("auto=false: urgencia is critica (mixed case)", () => {
  /**
   * Defensive: the gate normalises to lowercase before checking,
   * so a stray uppercase value from a re-classification cache
   * still blocks. Locks the case-insensitive contract.
   */
  const decision = evaluateAutoCreatePolicy(
    makeInput({ conversation: { urgency: "CRITICA" } }),
  )
  assert.equal(decision.auto, false)
  assert.equal(decision.reason, "blocked_urgency:critica")
})

// ─── Case 8 — tipo factura ──────────────────────────────────────────────────

test("auto=false: tipo is factura", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ conversation: { tipo: "factura" } }),
  )
  assert.equal(decision.auto, false)
  assert.equal(decision.reason, "blocked_conversation_type:factura")
})

// ─── Case 9 — external-impact action types in same run ──────────────────────

for (const externalType of [
  "create_event",
  "schedule_followup",
  "generate_proposal",
  "assign_operator",
] as const) {
  test(`auto=false: same run also has external-impact action ${externalType}`, () => {
    const decision = evaluateAutoCreatePolicy(
      makeInput({ otherActionTypesInRun: [externalType] }),
    )
    assert.equal(decision.auto, false)
    assert.equal(decision.reason, `external_impact_action_in_run:${externalType}`)
  })
}

test("auto=true: same run has only innocuous action types", () => {
  /**
   * Negative control for case 9. `create_client` and `create_project`
   * are NOT in the external-impact set (they have their own approval
   * surfaces and don't side-effect the customer), so a co-occurring
   * action of those types should not block auto-create.
   */
  const decision = evaluateAutoCreatePolicy(
    makeInput({ otherActionTypesInRun: ["create_client", "create_project"] }),
  )
  assert.equal(decision.auto, true)
})

// ─── Case 10 — deny-list: communication (ES + EN) ───────────────────────────

test("auto=false: deny-list communication EN — 'send email to customer'", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ action: { title: "Send email to customer about pricing" } }),
  )
  assert.equal(decision.auto, false)
  assert.ok(
    decision.reason.startsWith("deny_pattern:"),
    `expected deny_pattern:* reason, got ${decision.reason}`,
  )
})

test("auto=false: deny-list communication ES — 'responder al cliente'", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ action: { title: "Responder al cliente sobre la cotización" } }),
  )
  assert.equal(decision.auto, false)
  assert.ok(decision.reason.startsWith("deny_pattern:"))
})

test("auto=false: deny pattern matches in description even if title is clean", () => {
  /**
   * The gate scans `title + description`. A clean title with a
   * risky description must still reject — verifies the haystack
   * concatenation contract.
   */
  const decision = evaluateAutoCreatePolicy(
    makeInput({
      action: {
        title: "Internal CRM update",
        description: "Reach out to the customer to confirm pricing",
      },
    }),
  )
  assert.equal(decision.auto, false)
  assert.ok(decision.reason.startsWith("deny_pattern:reach out"))
})

// ─── Case 11 — deny-list: billing / refunds (ES + EN) ───────────────────────

test("auto=false: deny-list billing EN — 'issue refund'", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ action: { title: "Issue refund for last invoice" } }),
  )
  assert.equal(decision.auto, false)
  assert.ok(decision.reason.startsWith("deny_pattern:"))
})

test("auto=false: deny-list billing ES — 'procesar reembolso'", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ action: { title: "Procesar reembolso del cliente" } }),
  )
  assert.equal(decision.auto, false)
  assert.ok(decision.reason.startsWith("deny_pattern:"))
})

// ─── Case 12 — deny-list: legal / contracts ─────────────────────────────────

test("auto=false: deny-list legal EN — 'prepare contract review'", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ action: { title: "Prepare contract review for client" } }),
  )
  assert.equal(decision.auto, false)
  assert.ok(decision.reason.startsWith("deny_pattern:contract"))
})

test("auto=false: deny-list legal ES — 'revisar contrato'", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ action: { title: "Revisar contrato con el equipo legal" } }),
  )
  assert.equal(decision.auto, false)
  assert.ok(decision.reason.startsWith("deny_pattern:"))
})

// ─── Case 13 — deny-list: meeting / calendar ────────────────────────────────

test("auto=false: deny-list meeting EN — 'schedule a meeting'", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ action: { title: "Schedule a meeting next Tuesday" } }),
  )
  assert.equal(decision.auto, false)
  assert.ok(decision.reason.startsWith("deny_pattern:schedule"))
})

test("auto=false: deny-list meeting ES — 'agendar reunión'", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ action: { title: "Agendar reunión con el equipo de ventas" } }),
  )
  assert.equal(decision.auto, false)
  assert.ok(decision.reason.startsWith("deny_pattern:agendar reuni"))
})

// ─── Case 14 — deny-list: escalation / cancellation ─────────────────────────

test("auto=false: deny-list escalation EN — 'escalate to manager'", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ action: { title: "Escalate to manager about delayed delivery" } }),
  )
  assert.equal(decision.auto, false)
  assert.ok(decision.reason.startsWith("deny_pattern:escalate"))
})

test("auto=false: deny-list cancellation EN — 'cancel subscription'", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ action: { title: "Cancel subscription per customer request" } }),
  )
  assert.equal(decision.auto, false)
  assert.ok(decision.reason.startsWith("deny_pattern:cancel subscription"))
})

test("auto=false: deny-list cancellation ES — 'cancelar suscripción'", () => {
  const decision = evaluateAutoCreatePolicy(
    makeInput({ action: { title: "Cancelar suscripción del cliente premium" } }),
  )
  assert.equal(decision.auto, false)
  assert.ok(decision.reason.startsWith("deny_pattern:cancelar suscrip"))
})

// ─── Case 15 — reasons are deterministic and useful for audit ───────────────

test("reason determinism: same input always returns the same decision", () => {
  /**
   * `evaluateAutoCreatePolicy` is pure. Two consecutive evaluations
   * of the same input must return identical decisions. Locks the
   * "no hidden state, no randomness" contract — a regression here
   * would mean someone introduced caching, IO, or randomness, all
   * of which are out of scope for the gate.
   */
  const input = makeInput({ action: { title: "Send email to customer" } })
  const a = evaluateAutoCreatePolicy(input)
  const b = evaluateAutoCreatePolicy(input)
  assert.deepEqual(a, b)
})

test("reason is a non-empty stable string for every documented branch", () => {
  /**
   * Sweep: every documented rejection branch must return a
   * non-empty `reason`. The audit trail relies on this — an empty
   * reason would land as `"Auto-created by Fanny ()"` in
   * `ConversationAction.executionNotes`, which is unreviewable.
   */
  const cases: AutoCreatePolicyInput[] = [
    makeInput({ action: { type: "create_event" } }),
    makeInput({ action: { confidence: null } }),
    makeInput({ action: { confidence: 0.5 } }),
    makeInput({ action: { title: "abc" } }),
    makeInput({ action: { title: "z".repeat(AUTO_CREATE_MAX_TITLE_LENGTH + 5) } }),
    makeInput({ conversation: { urgency: "critica" } }),
    makeInput({ conversation: { tipo: "factura" } }),
    makeInput({ otherActionTypesInRun: ["schedule_followup"] }),
    makeInput({ action: { title: "Send email to customer" } }),
  ]

  for (const input of cases) {
    const decision = evaluateAutoCreatePolicy(input)
    assert.equal(
      decision.auto,
      false,
      `expected auto=false for ${JSON.stringify(input.action)}`,
    )
    assert.equal(typeof decision.reason, "string")
    assert.ok(
      decision.reason.length > 0,
      `reason must be a non-empty string for ${JSON.stringify(input.action)}`,
    )
  }
})

test("reason for the auto-true branch encodes the confidence", () => {
  /**
   * Useful-for-debugging contract: when the gate decides "auto", the
   * reason embeds the (rounded) confidence so operators reading
   * audit logs can see *why* this row went through without having
   * to cross-reference a separate column.
   */
  const decision = evaluateAutoCreatePolicy(makeInput({ action: { confidence: 0.93 } }))
  assert.equal(decision.auto, true)
  if (decision.auto) {
    assert.match(decision.reason, /confidence=0\.93/)
  }
})
