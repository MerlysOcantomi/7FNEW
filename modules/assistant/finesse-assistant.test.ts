import assert from "node:assert/strict"
import test from "node:test"

import {
  FINESSE_ASSISTANT_COPY,
  FINESSE_MAX_QUESTION_LENGTH,
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

test("every page has at least one Spanish suggestion; keys differ per page", () => {
  for (const page of ALL_PAGES) {
    const suggestions = getFinesseSuggestions(page)
    assert.ok(suggestions.length >= 1, `${page} needs suggestions`)
    for (const s of suggestions) assert.ok(s.trim().length > 0)
  }
  // Page-awareness: My Salon and Agenda must not share the same prompts.
  assert.notDeepEqual(getFinesseSuggestions("my-salon"), getFinesseSuggestions("agenda"))
})

test("mission §8 anchor suggestions exist on their pages", () => {
  assert.ok(getFinesseSuggestions("my-salon").some((s) => s.includes("Explícame")))
  assert.ok(getFinesseSuggestions("today").some((s) => s.includes("primero")))
  assert.ok(getFinesseSuggestions("agenda").some((s) => s.toLowerCase().includes("hueco")))
  assert.ok(getFinesseSuggestions("clients").some((s) => s.toLowerCase().includes("no han vuelto")))
  assert.ok(getFinesseSuggestions("messages").some((s) => s.toLowerCase().includes("respuesta")))
  assert.ok(getFinesseSuggestions("catalog").some((s) => s.toLowerCase().includes("servicio")))
  assert.ok(getFinesseSuggestions("marketing").some((s) => s.toLowerCase().includes("campaña")))
})

// ─── Copy completeness ───────────────────────────────────────────────────────

test("copy covers every page key (labels + intros), nothing empty", () => {
  for (const page of ALL_PAGES) {
    assert.ok(FINESSE_ASSISTANT_COPY.pageLabels[page]?.length > 0, `label for ${page}`)
    assert.ok(FINESSE_ASSISTANT_COPY.intros[page]?.length > 0, `intro for ${page}`)
  }
  assert.ok(FINESSE_ASSISTANT_COPY.honestyNote.length > 0)
  assert.ok(FINESSE_ASSISTANT_COPY.unavailable.title.length > 0)
  assert.ok(FINESSE_MAX_QUESTION_LENGTH >= 200)
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
