import assert from "node:assert/strict"
import test from "node:test"
import {
  BEAUTY_PACK,
  BEAUTY_SERVICE_CATALOG_SEED,
  buildBeautyDefaultConfig,
} from "./beauty"
import { mapVerticalKeyToBusinessType, resolveVocabulary } from "../personalization/resolve"

// ─── Pack → defaultConfig (what the seed writes to the DB) ────────────────────

test("buildBeautyDefaultConfig produces valid, Beauty-shaped config", () => {
  const cfg = JSON.parse(buildBeautyDefaultConfig())

  assert.equal(cfg.locale, "es")
  assert.equal(cfg.nav.profile, "beauty")

  // Active for Beauty
  assert.equal(cfg.modules.today, true)
  assert.equal(cfg.modules.agenda, true)
  assert.equal(cfg.modules.clientes, true)
  assert.equal(cfg.modules.marketing, true)

  // Hidden for Beauty MVP
  assert.equal(cfg.modules.projects, false)
  assert.equal(cfg.modules.reports, false)
  assert.equal(cfg.modules.financeAdvanced, false)
  assert.equal(cfg.modules.inventoryAdvanced, false)
  assert.equal(cfg.modules.businessOverview, false)
  assert.equal(cfg.modules.inboxOverview, false)
  assert.equal(cfg.modules.tasksPage, false)
})

test("Today is declared appointment_first but NOT auto-activated for real workspaces", () => {
  const cfg = JSON.parse(buildBeautyDefaultConfig())
  assert.equal(cfg.today.mode, "appointment_first")
  assert.equal(cfg.today.activateRealForRealWorkspaces, false)
})

test("service catalog seed has the 8 Beauty services", () => {
  assert.equal(BEAUTY_SERVICE_CATALOG_SEED.length, 8)
  const names = BEAUTY_SERVICE_CATALOG_SEED.map((s) => s.name)
  assert.ok(names.includes("Manicura semipermanente"))
  assert.ok(names.includes("Lifting de pestañas"))
  assert.ok(names.includes("Depilación de cejas"))
  assert.ok(BEAUTY_SERVICE_CATALOG_SEED.every((s) => s.active === true))
})

test("pack is Spanish-first and appointment-based", () => {
  assert.equal(BEAUTY_PACK.locale, "es")
  assert.equal(BEAUTY_PACK.businessType, "beauty")
  assert.equal(BEAUTY_PACK.today.mode, "appointment_first")
})

// ─── Personalization: Beauty labels + no regression ──────────────────────────

test("beauty verticalKeys map to the beauty business type", () => {
  assert.equal(mapVerticalKeyToBusinessType("beauty"), "beauty")
  assert.equal(mapVerticalKeyToBusinessType("salon"), "beauty")
  assert.equal(mapVerticalKeyToBusinessType("nails"), "beauty")
})

test("beauty vocabulary is Spanish (Clientas / Agenda / Mensajes)", () => {
  const v = resolveVocabulary("beauty")
  assert.equal(v.client.plural, "Clientas")
  assert.equal(v.client.singular, "Clienta")
  assert.equal(v.calendar.singular, "Agenda")
  assert.equal(v.inbox.singular, "Mensajes")
  assert.equal(v.billing.plural, "Cobros")
})

test("NO REGRESSION: existing verticals and defaults are unchanged", () => {
  // creative-agency still resolves to the creator preset
  assert.equal(mapVerticalKeyToBusinessType("creative-agency"), "creator")
  // default vocabulary untouched
  assert.equal(resolveVocabulary("default").client.plural, "Clients")
  // creator vocabulary untouched
  assert.equal(resolveVocabulary("creator").client.plural, "Clients")
  // unknown verticalKey still falls back to default
  assert.equal(mapVerticalKeyToBusinessType("something-new"), "default")
})
