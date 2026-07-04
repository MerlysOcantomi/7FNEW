import assert from "node:assert/strict"
import test from "node:test"
import { resolveWorkspaceExperience } from "./experience"
import { buildBeautyDefaultConfig } from "./beauty"

// ─── Default / agency ────────────────────────────────────────────────────────

test("default/agency: no Finesse, no beauty nav, standard Today", () => {
  const e = resolveWorkspaceExperience("creative-agency")
  assert.equal(e.verticalKey, "creative-agency")
  assert.equal(e.specialistAgent, null)
  assert.equal(e.specialistAgentId, null)
  assert.equal(e.brandLine, null)
  assert.equal(e.navProfileId, null)
  assert.equal(e.todayMode, "work_first")
  assert.ok(!e.availableThemeKeys.includes("rose-nude"))
})

test("empty / unknown verticalKey → safe default experience (no crash)", () => {
  for (const key of [null, undefined, "", "saas", "totally-unknown"]) {
    const e = resolveWorkspaceExperience(key)
    assert.equal(e.specialistAgent, null)
    assert.equal(e.todayMode, "work_first")
    assert.equal(e.navProfileId, null)
  }
})

// ─── Beauty ──────────────────────────────────────────────────────────────────

test("beauty: full resolved experience", () => {
  const e = resolveWorkspaceExperience("beauty")
  assert.equal(e.verticalKey, "beauty")
  assert.equal(e.businessType, "beauty")
  assert.equal(e.verticalName, "7F Beauty")
  assert.equal(e.specialistAgentId, "finesse")
  assert.equal(e.specialistAgent?.name, "Finesse")
  assert.equal(e.brandLine, "7F Beauty, powered by Finesse")
  assert.equal(e.defaultThemeKey, "rose-nude")
  assert.deepEqual(e.availableThemeKeys, ["rose-nude", "sage-luxe", "noir-or"])
  assert.equal(e.todayMode, "appointment_first")
  assert.equal(e.navProfileId, "beauty")
  assert.deepEqual(e.recommendedChannels, ["whatsapp", "instagram", "email"])
  assert.deepEqual(e.recommendedModules, [
    "calendar",
    "clients",
    "messages",
    "marketing",
    "catalog",
    "services",
  ])
})

test("beauty aliases (salon/nails/…) resolve to the beauty experience", () => {
  for (const key of ["salon", "nails", "barber", "spa", "lashes", "estetica"]) {
    const e = resolveWorkspaceExperience(key)
    assert.equal(e.businessType, "beauty", `${key} → beauty`)
    assert.equal(e.specialistAgentId, "finesse")
    assert.equal(e.todayMode, "appointment_first")
    assert.equal(e.defaultThemeKey, "rose-nude")
  }
})

// ─── No regression ───────────────────────────────────────────────────────────

test("NO REGRESSION: new pack facets are NOT serialized into defaultConfig", () => {
  const cfg = JSON.parse(buildBeautyDefaultConfig())
  // The DB config shape is unchanged — themes/channels/recommendedModules stay in-code.
  assert.equal(cfg.themes, undefined)
  assert.equal(cfg.channels, undefined)
  assert.equal(cfg.recommendedModules, undefined)
  // Existing keys still present.
  assert.equal(cfg.nav.profile, "beauty")
  assert.equal(cfg.today.mode, "appointment_first")
})
