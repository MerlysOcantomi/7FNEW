import assert from "node:assert/strict"
import test from "node:test"
import { getForteVerticalPlaybook, BEAUTY_FORTE_PLAYBOOK } from "./index"

test("Forte beauty playbook loads and is keyed to beauty", () => {
  const p = getForteVerticalPlaybook("beauty")
  assert.equal(p, BEAUTY_FORTE_PLAYBOOK)
  assert.equal(p?.verticalKey, "beauty")
})

test("Forte beauty playbook declares Finesse as its specialist", () => {
  assert.equal(BEAUTY_FORTE_PLAYBOOK.specialistAgent?.name, "Finesse")
  assert.equal(BEAUTY_FORTE_PLAYBOOK.specialistAgent?.tagline, "7F Beauty, powered by Finesse")
})

test("Forte beauty playbook states Finesse coordinates without replacing core agents", () => {
  const mentionsCoordination = BEAUTY_FORTE_PLAYBOOK.principles.some(
    (p) => p.toLowerCase().includes("finesse") && p.toLowerCase().includes("sin reemplazar"),
  )
  assert.ok(mentionsCoordination, "a principle must state Finesse leads without replacing core agents")
})

test("getForteVerticalPlaybook: unknown vertical → null", () => {
  assert.equal(getForteVerticalPlaybook("creative-agency"), null)
  assert.equal(getForteVerticalPlaybook(null), null)
})
