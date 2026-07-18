import assert from "node:assert/strict"
import test from "node:test"

import {
  FINESSE_MAX_QUESTION_LENGTH,
  getFinesseAssistantCopy,
  getFinesseSuggestions,
  resolveFinessePageKey,
  type FinesseAssistantContext,
  type FinesseAssistantPageKey,
} from "./finesse-assistant"

const ALL_PAGES: FinesseAssistantPageKey[] = [
  "my-salon",
  "today",
  "agenda",
  "clients",
  "messages",
  "catalog",
  "marketing",
  "billing",
  "team",
  "settings",
  "other",
]

// ─── Route → page key ────────────────────────────────────────────────────────

test("resolveFinessePageKey maps every Finesse shell route", () => {
  assert.equal(resolveFinessePageKey("/"), "my-salon")
  assert.equal(resolveFinessePageKey("/today"), "today")
  assert.equal(resolveFinessePageKey("/calendario"), "agenda")
  assert.equal(resolveFinessePageKey("/clientes"), "clients")
  assert.equal(resolveFinessePageKey("/clientes/abc123"), "clients")
  assert.equal(resolveFinessePageKey("/inbox"), "messages")
  assert.equal(resolveFinessePageKey("/inbox/overview"), "messages")
  assert.equal(resolveFinessePageKey("/services"), "catalog")
  assert.equal(resolveFinessePageKey("/contenido"), "marketing")
  assert.equal(resolveFinessePageKey("/facturacion"), "billing")
  assert.equal(resolveFinessePageKey("/usuarios"), "team")
  assert.equal(resolveFinessePageKey("/business-profile"), "settings")
})

test("resolveFinessePageKey: unknown routes are an honest 'other'", () => {
  assert.equal(resolveFinessePageKey("/forte/improvements"), "other")
  assert.equal(resolveFinessePageKey("/proyectos"), "other")
  assert.equal(resolveFinessePageKey("/calendarios-otros"), "other")
  // No accidental prefix bleed: /clientesX must not match /clientes.
  assert.equal(resolveFinessePageKey("/clientesx"), "other")
})

// ─── Suggestions ─────────────────────────────────────────────────────────────

test("every page has suggestions in BOTH locales; en/es texts differ; keys differ per page", () => {
  for (const page of ALL_PAGES) {
    const es = getFinesseSuggestions(page, "es")
    const en = getFinesseSuggestions(page, "en")
    assert.ok(es.length >= 1, `${page} needs suggestions`)
    assert.equal(en.length, es.length, `${page} en/es must stay aligned`)
    for (const s of [...es, ...en]) assert.ok(s.trim().length > 0)
    assert.notDeepEqual(en, es, `${page} en/es must be really translated`)
  }
  // Page-awareness: My Salon and Agenda must not share the same prompts.
  assert.notDeepEqual(getFinesseSuggestions("my-salon", "es"), getFinesseSuggestions("agenda", "es"))
  assert.notDeepEqual(getFinesseSuggestions("my-salon", "en"), getFinesseSuggestions("agenda", "en"))
})

test("suggestions: unknown / not-yet-translated locales fall back to English", () => {
  assert.deepEqual(getFinesseSuggestions("today", "pt-BR"), getFinesseSuggestions("today", "en"))
  assert.deepEqual(getFinesseSuggestions("today", "de"), getFinesseSuggestions("today", "en"))
  assert.deepEqual(getFinesseSuggestions("today", null), getFinesseSuggestions("today", "en"))
  // Regional Spanish resolves to the Spanish catalog.
  assert.deepEqual(getFinesseSuggestions("today", "es-MX"), getFinesseSuggestions("today", "es"))
})

test("mission §8 anchor suggestions exist on their pages (both locales)", () => {
  assert.ok(getFinesseSuggestions("my-salon", "es").some((s) => s.includes("Explícame")))
  assert.ok(getFinesseSuggestions("today", "es").some((s) => s.includes("primero")))
  assert.ok(getFinesseSuggestions("agenda", "es").some((s) => s.toLowerCase().includes("hueco")))
  assert.ok(getFinesseSuggestions("clients", "es").some((s) => s.toLowerCase().includes("no han vuelto")))
  assert.ok(getFinesseSuggestions("messages", "es").some((s) => s.toLowerCase().includes("respuesta")))
  assert.ok(getFinesseSuggestions("catalog", "es").some((s) => s.toLowerCase().includes("servicio")))
  assert.ok(getFinesseSuggestions("marketing", "es").some((s) => s.toLowerCase().includes("campaña")))
  assert.ok(getFinesseSuggestions("my-salon", "en").some((s) => s.includes("Explain")))
  assert.ok(getFinesseSuggestions("today", "en").some((s) => s.toLowerCase().includes("first")))
  assert.ok(getFinesseSuggestions("agenda", "en").some((s) => s.toLowerCase().includes("slot")))
  assert.ok(getFinesseSuggestions("clients", "en").some((s) => s.toLowerCase().includes("come back")))
  assert.ok(getFinesseSuggestions("messages", "en").some((s) => s.toLowerCase().includes("reply")))
  assert.ok(getFinesseSuggestions("catalog", "en").some((s) => s.toLowerCase().includes("service")))
  assert.ok(getFinesseSuggestions("marketing", "en").some((s) => s.toLowerCase().includes("campaign")))
})

// ─── Copy completeness ───────────────────────────────────────────────────────

test("copy covers every page key (labels + intros) in BOTH locales, nothing empty", () => {
  for (const locale of ["en", "es"] as const) {
    const copy = getFinesseAssistantCopy(locale)
    for (const page of ALL_PAGES) {
      assert.ok(copy.pageLabels[page]?.length > 0, `${locale} label for ${page}`)
      assert.ok(copy.intros[page]?.length > 0, `${locale} intro for ${page}`)
    }
    assert.ok(copy.honestyNote.length > 0)
    assert.ok(copy.unavailable.title.length > 0)
  }
  assert.ok(FINESSE_MAX_QUESTION_LENGTH >= 200)
})

test("copy: en and es are really translated; proper nouns stay identical", () => {
  const en = getFinesseAssistantCopy("en")
  const es = getFinesseAssistantCopy("es")
  assert.notEqual(en.launcherLabel, es.launcherLabel)
  assert.notEqual(en.honestyNote, es.honestyNote)
  assert.notEqual(en.intros["my-salon"], es.intros["my-salon"])
  // Proper nouns / branding are never translated.
  assert.equal(en.panelTitle, "Finesse")
  assert.equal(es.panelTitle, "Finesse")
  assert.equal(en.panelSubtitle, es.panelSubtitle)
  assert.equal(en.pageLabels.other, "7F Beauty")
  assert.equal(es.pageLabels.other, "7F Beauty")
})

test("copy: unknown / not-yet-translated locales fall back to English", () => {
  const en = getFinesseAssistantCopy("en")
  assert.equal(getFinesseAssistantCopy("de"), en)
  assert.equal(getFinesseAssistantCopy("fr"), en)
  assert.equal(getFinesseAssistantCopy("it"), en)
  assert.equal(getFinesseAssistantCopy("pt-BR"), en)
  assert.equal(getFinesseAssistantCopy(null), en)
  assert.equal(getFinesseAssistantCopy(undefined), en)
  assert.equal(getFinesseAssistantCopy("es-MX"), getFinesseAssistantCopy("es"))
})

// ─── Context contract ────────────────────────────────────────────────────────

test("assistant context is serializable and survives a JSON round-trip", () => {
  const context: FinesseAssistantContext = {
    workspaceId: "ws-1",
    vertical: "beauty",
    route: "/",
    page: "my-salon",
    period: { preset: "month", start: "2026-07-01", end: "2026-07-31" },
    visibleMetrics: { ingresos: 8420, visitas: 142, moneda: "EUR", nota: null },
    locale: "es",
  }
  const roundTrip = JSON.parse(JSON.stringify(context))
  assert.deepEqual(roundTrip, context)
})
