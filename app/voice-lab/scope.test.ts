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

test("off-topic redirection is multilingual — no fixed literal Spanish phrase forced", () => {
  // The old contradiction ("responde exactamente con esta frase" + fixed quote)
  // is gone: the model may phrase the redirect in the user's own language.
  assert.ok(!/responde con exactamente|responde exactamente/i.test(DOMAIN_INSTRUCTIONS))
  assert.ok(
    !/Ese tema no está relacionado con la gestión de tu negocio en Finesse/.test(DOMAIN_INSTRUCTIONS),
    "the hardcoded verbatim redirect phrase must be removed",
  )
  assert.match(DOMAIN_INSTRUCTIONS, /mismo idioma/i)
  assert.match(DOMAIN_INSTRUCTIONS, /no uses una frase fija/i)
})

test("redirection keeps its intent — brief, kind, back to business tasks", () => {
  assert.match(DOMAIN_INSTRUCTIONS, /breve y\s+amable/i)
  assert.match(DOMAIN_INSTRUCTIONS, /citas, clientas, servicios, cobros, marketing/i)
})

test("Schweizerdeutsch is understood and answered in Hochdeutsch", () => {
  assert.match(DOMAIN_INSTRUCTIONS, /Schweizerdeutsch/)
  assert.match(DOMAIN_INSTRUCTIONS, /Hochdeutsch/)
})

test("guardrail is a declared placeholder and never trips (real one deferred to CORE-VOICE-2)", async () => {
  assert.match(scopeGuardrailPlaceholder.name, /placeholder/)
  const result = await scopeGuardrailPlaceholder.execute({} as never)
  assert.equal(result.tripwireTriggered, false)
})
