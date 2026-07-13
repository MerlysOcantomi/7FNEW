import assert from "node:assert/strict"
import test from "node:test"
import {
  buildScopeEvaluationInput,
  applyScopePolicy,
  type ScopePolicyLayers,
  type ScopeEvaluator,
  type ScopeDecision,
  type ScopeVerdict,
} from "./scope-policy"

const LAYERS: ScopePolicyLayers = {
  domainInstructions: "Gestión de un negocio de belleza.",
  activeVertical: "beauty",
  allowedTools: ["get_today_summary", "propose_action"],
  permissions: ["read"],
  offTopicResponse:
    "Ese tema no está relacionado con la gestión de tu negocio en Finesse. " +
    "Puedo ayudarte con citas, clientas, servicios, cobros, marketing y tendencias de belleza.",
}

// ─── Policy composition (pure) ───────────────────────────────────────────────

test("buildScopeEvaluationInput carries the vertical context, tools and permissions", () => {
  const input = buildScopeEvaluationInput(LAYERS, "¿tendencias de nails?", ["prev turn"])
  assert.equal(input.turnText, "¿tendencias de nails?")
  assert.equal(input.layers.activeVertical, "beauty")
  assert.deepEqual(input.layers.allowedTools, ["get_today_summary", "propose_action"])
  assert.deepEqual(input.layers.permissions, ["read"])
  assert.deepEqual(input.context, ["prev turn"])
})

test("applyScopePolicy: off_topic → redirection line + no tools", () => {
  const d = applyScopePolicy(LAYERS, "off_topic", "unrelated to the business")
  assert.equal(d.verdict, "off_topic")
  assert.equal(d.redirect, LAYERS.offTopicResponse)
  assert.deepEqual(d.allowedTools, [])
})

test("applyScopePolicy: in_scope / contextual → keep allowed tools, no redirect", () => {
  for (const v of ["in_scope", "contextual"] as ScopeVerdict[]) {
    const d = applyScopePolicy(LAYERS, v, "business goal")
    assert.equal(d.verdict, v)
    assert.equal(d.redirect, undefined)
    assert.deepEqual(d.allowedTools, LAYERS.allowedTools)
  }
})

// ─── Injectable/async evaluator (fake) — semantics live in a later phase ─────

/**
 * Fake evaluator: NOT a real classifier. It returns a canned verdict per test so
 * we can exercise the composition/redirection/context plumbing without baking any
 * word-based semantics into 0A.
 */
function fakeEvaluator(verdict: ScopeVerdict, reason: string): ScopeEvaluator {
  return {
    async evaluate(input): Promise<ScopeDecision> {
      // Prove the evaluator receives the composed layers + turn.
      assert.ok(input.layers.activeVertical === "beauty")
      return applyScopePolicy(input.layers, verdict, reason)
    },
  }
}

test("ScopeEvaluator is injectable/async and redirects off-topic turns", async () => {
  const evaluator = fakeEvaluator("off_topic", "elephants are unrelated")
  const decision = await evaluator.evaluate(
    buildScopeEvaluationInput(LAYERS, "Háblame de los elefantes"),
  )
  assert.equal(decision.verdict, "off_topic")
  assert.equal(decision.redirect, LAYERS.offTopicResponse)
  assert.deepEqual(decision.allowedTools, [])
})

test("ScopeEvaluator: contextual business goal keeps tools (no redirect)", async () => {
  const evaluator = fakeEvaluator("contextual", "campaign is a beauty marketing goal")
  const decision = await evaluator.evaluate(
    buildScopeEvaluationInput(LAYERS, "Crea una campaña de nails inspirada en elefantes"),
  )
  assert.equal(decision.verdict, "contextual")
  assert.equal(decision.redirect, undefined)
  assert.deepEqual(decision.allowedTools, LAYERS.allowedTools)
})
