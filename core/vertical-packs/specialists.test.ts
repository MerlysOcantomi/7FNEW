import assert from "node:assert/strict"
import test from "node:test"
import { resolveVerticalSpecialist, BEAUTY_SPECIALIST_AGENT } from "./specialists"
import { AGENT_ROSTER, SPECIALIST_ROSTER, getVerticalSpecialists } from "../../modules/agents/roster"

// ─── resolveVerticalSpecialist ───────────────────────────────────────────────

test("resolveVerticalSpecialist: 'beauty' → Finesse", () => {
  const s = resolveVerticalSpecialist("beauty")
  assert.equal(s, BEAUTY_SPECIALIST_AGENT)
  assert.equal(s?.name, "Finesse")
  assert.equal(s?.tagline, "7F Beauty, powered by Finesse")
  assert.equal(s?.shortLabel, "Especialista Beauty")
})

test("resolveVerticalSpecialist: beauty aliases → Finesse", () => {
  for (const k of ["salon", "nails", "barber", "barbershop", "spa", "lashes", "estetica"]) {
    assert.equal(resolveVerticalSpecialist(k)?.id, "finesse", `expected ${k} → finesse`)
  }
})

test("resolveVerticalSpecialist: non-beauty / empty → null", () => {
  assert.equal(resolveVerticalSpecialist("creative-agency"), null)
  assert.equal(resolveVerticalSpecialist(null), null)
  assert.equal(resolveVerticalSpecialist(undefined), null)
  assert.equal(resolveVerticalSpecialist(""), null)
})

test("Finesse LEADS Beauty but COORDINATES WITH (does not replace) the 7 core agents", () => {
  for (const id of ["francis", "forte", "fanny", "freya", "fiona", "felix", "fathom"]) {
    assert.ok(
      BEAUTY_SPECIALIST_AGENT.coordinatesWith.includes(id),
      `Finesse must coordinate with ${id}`,
    )
  }
})

// ─── Roster: additive surfacing + no regression ──────────────────────────────

test("NO REGRESSION: the 7 core agents / 6 specialists are unchanged", () => {
  assert.equal(AGENT_ROSTER.length, 7)
  assert.equal(SPECIALIST_ROSTER.length, 6)
  // Finesse is never part of the core roster
  assert.ok(!AGENT_ROSTER.some((a) => a.id === "finesse"))
})

test("getVerticalSpecialists: beauty returns Finesse as the vertical lead", () => {
  const list = getVerticalSpecialists("beauty")
  assert.equal(list.length, 1)
  assert.equal(list[0].id, "finesse")
  assert.equal(list[0].isVerticalLead, true)
  assert.equal(list[0].isLead, false) // not the global lead (that is Francis)
  assert.equal(list[0].verticalKey, "beauty")
})

test("getVerticalSpecialists: non-beauty → [] (only the 7 core agents show)", () => {
  assert.deepEqual(getVerticalSpecialists("creative-agency"), [])
  assert.deepEqual(getVerticalSpecialists(null), [])
})
