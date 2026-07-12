import assert from "node:assert/strict"
import test from "node:test"
import { resolveWorkspaceExperience } from "./experience"
import { buildBeautyDefaultConfig } from "./beauty"

// ─── Default / agency ────────────────────────────────────────────────────────

test("default/agency: no Finesse, no beauty nav, standard Today, default state", () => {
  const e = resolveWorkspaceExperience("creative-agency")
  assert.equal(e.verticalKey, "creative-agency")
  assert.equal(e.experienceState, "default")
  assert.equal(e.specialistAgent, null)
  assert.equal(e.specialistAgentId, null)
  assert.equal(e.brandLine, null)
  assert.equal(e.navProfileId, null)
  assert.equal(e.todayMode, "work_first")
  // work_first is always the real, safe Today — no vertical activation gate.
  assert.equal(e.todayActivatesRealWorkspaces, false)
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

test("seeded-but-unbuilt verticals resolve to default experience state", () => {
  // Registered in seed (prisma/seed.ts) but no pack yet → must read as "default",
  // never as a complete/available vertical.
  for (const key of ["construction", "clinic", "law", "florals"]) {
    assert.equal(resolveWorkspaceExperience(key).experienceState, "default", key)
  }
})

// ─── Beauty ──────────────────────────────────────────────────────────────────

test("beauty: full resolved experience", () => {
  const e = resolveWorkspaceExperience("beauty")
  assert.equal(e.verticalKey, "beauty")
  assert.equal(e.experienceState, "complete")
  assert.equal(e.businessType, "beauty")
  assert.equal(e.verticalName, "7F Beauty")
  assert.equal(e.specialistAgentId, "finesse")
  assert.equal(e.specialistAgent?.name, "Finesse")
  assert.equal(e.brandLine, "7F Beauty, powered by Finesse")
  assert.equal(e.defaultThemeKey, "rose-nude")
  assert.deepEqual(e.availableThemeKeys, ["rose-nude", "sage-luxe", "noir-or"])
  assert.equal(e.todayMode, "appointment_first")
  // P0 guardrail: Beauty DECLARES appointment_first, but that layout still
  // renders demo bookings, so a real Beauty workspace must NOT activate it.
  // The gate mirrors BEAUTY_PACK.today.activateRealForRealWorkspaces (false).
  assert.equal(e.todayActivatesRealWorkspaces, false)
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
    // Aliases inherit the same guardrail — none auto-activates the demo Today.
    assert.equal(e.todayActivatesRealWorkspaces, false, `${key} gated`)
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
