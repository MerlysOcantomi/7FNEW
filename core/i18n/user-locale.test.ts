import assert from "node:assert/strict"
import test from "node:test"

import { parseUserLocalePreference, planUserLocaleUpdate } from "./user-locale"

// ─── parseUserLocalePreference ─────────────────────────────────────────────────

test("parseUserLocalePreference: canonical en/es/de are valid", () => {
  assert.deepEqual(parseUserLocalePreference("en"), { ok: true, value: "en" })
  assert.deepEqual(parseUserLocalePreference("es"), { ok: true, value: "es" })
  assert.deepEqual(parseUserLocalePreference("de"), { ok: true, value: "de" })
})

test("parseUserLocalePreference: null is valid (clears preference)", () => {
  assert.deepEqual(parseUserLocalePreference(null), { ok: true, value: null })
})

test("parseUserLocalePreference: unsupported/malformed values are invalid", () => {
  for (const bad of ["", "fr", "it", "xyz", undefined, 123, 0, {}, [], true]) {
    assert.deepEqual(parseUserLocalePreference(bad), { ok: false }, `expected invalid: ${String(bad)}`)
  }
})

test("parseUserLocalePreference: regional codes are invalid for persistence", () => {
  assert.deepEqual(parseUserLocalePreference("es-MX"), { ok: false })
  assert.deepEqual(parseUserLocalePreference("de-CH"), { ok: false })
  assert.deepEqual(parseUserLocalePreference("en-GB"), { ok: false })
})

// ─── planUserLocaleUpdate: authorization + self-scope ──────────────────────────

test("planUserLocaleUpdate: no session → unauthorized (no write)", () => {
  assert.deepEqual(planUserLocaleUpdate(null, { locale: "es" }), { kind: "unauthorized" })
})

test("planUserLocaleUpdate: valid locale → update scoped to session.userId", () => {
  assert.deepEqual(planUserLocaleUpdate({ userId: "u1" }, { locale: "es" }), {
    kind: "update",
    userId: "u1",
    locale: "es",
  })
})

test("planUserLocaleUpdate: userId in body cannot redirect the target", () => {
  const cmd = planUserLocaleUpdate({ userId: "u1" }, { locale: "de", userId: "attacker", id: "attacker" })
  assert.equal(cmd.kind, "update")
  assert.equal(cmd.kind === "update" && cmd.userId, "u1")
})

test("planUserLocaleUpdate: null locale → update clears preference for session user", () => {
  assert.deepEqual(planUserLocaleUpdate({ userId: "u1" }, { locale: null }), {
    kind: "update",
    userId: "u1",
    locale: null,
  })
})

test("planUserLocaleUpdate: invalid locale → invalid (no write)", () => {
  assert.deepEqual(planUserLocaleUpdate({ userId: "u1" }, { locale: "fr" }), { kind: "invalid" })
  assert.deepEqual(planUserLocaleUpdate({ userId: "u1" }, { locale: "es-MX" }), { kind: "invalid" })
})

test("planUserLocaleUpdate: missing locale key → invalid (no write)", () => {
  assert.deepEqual(planUserLocaleUpdate({ userId: "u1" }, {}), { kind: "invalid" })
  assert.deepEqual(planUserLocaleUpdate({ userId: "u1" }, null), { kind: "invalid" })
})
