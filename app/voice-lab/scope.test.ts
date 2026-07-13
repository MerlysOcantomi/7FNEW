import assert from "node:assert/strict"
import test from "node:test"
import { DOMAIN_INSTRUCTIONS, scopeGuardrailPlaceholder } from "./scope"
import { LAB_AGENT_NAME, LAB_SPEAKER_LABEL } from "./config"

test("agent name is 7F, never Finesse", () => {
  assert.equal(LAB_AGENT_NAME, "7F Voice Lab")
  assert.ok(!/finesse/i.test(LAB_AGENT_NAME))
})

test("speaker label is 7F", () => {
  assert.equal(LAB_SPEAKER_LABEL, "7F")
})

test("instructions cast 7F as the interface and Finesse as the product (not a persona)", () => {
  assert.match(DOMAIN_INSTRUCTIONS, /interfaz de voz de 7F dentro de Finesse by Sevenef/)
  // Finesse is never personified ("Eres Finesse" / "Soy Finesse").
  assert.ok(!/eres finesse/i.test(DOMAIN_INSTRUCTIONS))
  assert.ok(!/soy finesse/i.test(DOMAIN_INSTRUCTIONS))
})

test("guardrail is a declared placeholder and never trips (real one deferred to CORE-VOICE-2)", async () => {
  assert.match(scopeGuardrailPlaceholder.name, /placeholder/)
  const result = await scopeGuardrailPlaceholder.execute({} as never)
  assert.equal(result.tripwireTriggered, false)
})
