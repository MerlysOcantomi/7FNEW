import assert from "node:assert/strict"
import test from "node:test"
import {
  buildScopeEvaluationInput,
  applyScopePolicy,
  intersectAllowedTools,
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

// ─── intersectAllowedTools (adjustment 5) ────────────────────────────────────

test("intersectAllowedTools: keeps only tools present in both, requested order", () => {
  assert.deepEqual(
    intersectAllowedTools(["propose_action", "get_today_summary"], LAYERS.allowedTools),
    ["propose_action", "get_today_summary"],
  )
})

test("intersectAllowedTools: drops unauthorized tools (no escalation)", () => {
  assert.deepEqual(
    intersectAllowedTools(["delete_everything", "get_today_summary"], LAYERS.allowedTools),
    ["get_today_summary"],
  )
})

test("intersectAllowedTools: removes duplicates", () => {
  assert.deepEqual(
    intersectAllowedTools(["get_today_summary", "get_today_summary"], LAYERS.allowedTools),
    ["get_today_summary"],
  )
})

test("intersectAllowedTools: never adds a capability that was not authorized", () => {
  assert.deepEqual(intersectAllowedTools(["delete_everything"], LAYERS.allowedTools), [])
  // Requesting nothing yields nothing — it can only narrow.
  assert.deepEqual(intersectAllowedTools([], LAYERS.allowedTools), [])
})

// ─── Policy composition (pure) ───────────────────────────────────────────────

test("buildScopeEvaluationInput carries the vertical context, tools and permissions", () => {
  const input = buildScopeEvaluationInput(LAYERS, "¿tendencias de nails?", ["prev turn"])
  assert.equal(input.turnText, "¿tendencias de nails?")
  assert.equal(input.layers.activeVertical, "beauty")
  assert.deepEqual(input.layers.allowedTools, ["get_today_summary", "propose_action"])
  assert.deepEqual(input.layers.permissions, ["read"])
  assert.deepEqual(input.context, ["prev turn"])
})

test("applyScopePolicy: off_topic → redirection line + NO tools (even if requested)", () => {
  const d = applyScopePolicy(LAYERS, "off_topic", "unrelated", ["get_today_summary"])
  assert.equal(d.verdict, "off_topic")
  assert.equal(d.redirect, LAYERS.offTopicResponse)
  assert.deepEqual(d.allowedTools, [])
})

test("applyScopePolicy: authorized requested tool is kept", () => {
  const d = applyScopePolicy(LAYERS, "in_scope", "ok", ["get_today_summary"])
  assert.deepEqual(d.allowedTools, ["get_today_summary"])
  assert.equal(d.redirect, undefined)
})

test("applyScopePolicy: unauthorized requested tool is removed", () => {
  const d = applyScopePolicy(LAYERS, "contextual", "goal", ["delete_everything"])
  assert.deepEqual(d.allowedTools, [])
})

test("applyScopePolicy: mixed request → only the intersection survives", () => {
  const d = applyScopePolicy(LAYERS, "contextual", "goal", ["get_today_summary", "delete_everything"])
  assert.deepEqual(d.allowedTools, ["get_today_summary"])
})

test("applyScopePolicy: contextual cannot escalate beyond authorized tools", () => {
  const d = applyScopePolicy(LAYERS, "contextual", "goal", [
    "get_today_summary",
    "propose_action",
    "charge_card",
  ])
  assert.deepEqual(d.allowedTools, ["get_today_summary", "propose_action"])
})

// ─── Injectable/async evaluator (fake) — semantics live in a later phase ─────

/**
 * Fake evaluator: NOT a real classifier. Returns a canned verdict + requested
 * tools per test so we exercise composition/redirection/intersection plumbing
 * without baking word-based semantics into 0A.
 */
function fakeEvaluator(
  verdict: ScopeVerdict,
  reason: string,
  requestedTools: string[],
): ScopeEvaluator {
  return {
    async evaluate(input): Promise<ScopeDecision> {
      assert.ok(input.layers.activeVertical === "beauty")
      return applyScopePolicy(input.layers, verdict, reason, requestedTools)
    },
  }
}

test("ScopeEvaluator is injectable/async and redirects off-topic (no tools)", async () => {
  const evaluator = fakeEvaluator("off_topic", "elephants are unrelated", ["get_today_summary"])
  const decision = await evaluator.evaluate(
    buildScopeEvaluationInput(LAYERS, "Háblame de los elefantes"),
  )
  assert.equal(decision.verdict, "off_topic")
  assert.equal(decision.redirect, LAYERS.offTopicResponse)
  assert.deepEqual(decision.allowedTools, [])
})

test("ScopeEvaluator: contextual keeps only authorized tools (no permission escalation)", async () => {
  const evaluator = fakeEvaluator("contextual", "beauty marketing goal", [
    "get_today_summary",
    "charge_card",
  ])
  const decision = await evaluator.evaluate(
    buildScopeEvaluationInput(LAYERS, "Crea una campaña de nails inspirada en elefantes"),
  )
  assert.equal(decision.verdict, "contextual")
  assert.equal(decision.redirect, undefined)
  assert.deepEqual(decision.allowedTools, ["get_today_summary"])
})
