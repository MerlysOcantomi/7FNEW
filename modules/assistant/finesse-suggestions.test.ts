import assert from "node:assert/strict"
import test from "node:test"

import {
  MAX_SUGGESTIONS,
  buildFinesseSuggestions,
  fallbackSuggestions,
  type FinesseSuggestion,
} from "./finesse-suggestions"
import { type FinesseAssistantPageContext } from "./finesse-assistant"
import { FINESSE_ASSISTANT_MESSAGES } from "./i18n"

// The engine is locale-agnostic: copy comes from the catalog passed in. The
// English base catalog drives these behavioral tests; catalog integrity per
// locale is covered by `modules/assistant/i18n.test.ts`.
const M = FINESSE_ASSISTANT_MESSAGES.en

function ctx(partial: Partial<FinesseAssistantPageContext> & { page: FinesseAssistantPageContext["page"] }): FinesseAssistantPageContext {
  return { ...partial }
}

const ids = (s: FinesseSuggestion[]) => s.map((x) => x.id)

// ─── Candidate generation per signal ─────────────────────────────────────────

test("my-salon: revenue drop produces the drop question first", () => {
  const out = buildFinesseSuggestions({
    page: "my-salon",
    context: ctx({ page: "my-salon", visibleMetrics: { ingresosDelta: -0.12 } }),
  }, M)
  assert.equal(out[0].id, "overview-earnings-drop")
  assert.equal(out[0].source, "overview")
})

test("my-salon: revenue growth produces the growth question (not the drop)", () => {
  const out = buildFinesseSuggestions({
    page: "my-salon",
    context: ctx({ page: "my-salon", visibleMetrics: { ingresosDelta: 0.12 } }),
  }, M)
  assert.ok(ids(out).includes("overview-earnings-growth"))
  assert.ok(!ids(out).includes("overview-earnings-drop"))
})

test("my-salon: first period (no comparison) wins over delta prompts", () => {
  const out = buildFinesseSuggestions({
    page: "my-salon",
    context: ctx({
      page: "my-salon",
      visibleMetrics: { sinComparativa: 1, ingresosDelta: null },
    }),
  }, M)
  assert.ok(ids(out).includes("overview-first-period"))
  assert.ok(!ids(out).includes("overview-earnings-drop"))
})

test("my-salon: weak rebooking, pending payments and full peak day all rank", () => {
  const out = buildFinesseSuggestions({
    page: "my-salon",
    context: ctx({
      page: "my-salon",
      visibleMetrics: {
        ingresosDelta: -0.1,
        tasaRetorno: 0.5,
        cobrosPendientes: 310,
        ocupacionDiaPunta: 0.92,
      },
    }),
  }, M)
  // Capped at MAX with the highest priorities first.
  assert.equal(out.length, MAX_SUGGESTIONS)
  assert.deepEqual(ids(out), [
    "overview-earnings-drop",
    "overview-weak-rebooking",
    "overview-pending-payments",
    "overview-peak-availability",
  ])
})

test("agenda: gaps, confirmations, cancellations and full-day signals", () => {
  const out = buildFinesseSuggestions({
    page: "agenda",
    context: ctx({
      page: "agenda",
      visibleMetrics: {
        huecosManana: 2,
        citasSinConfirmar: 3,
        cancelacionesHoy: 1,
        diaCasiCompleto: 1,
      },
    }),
  }, M)
  assert.deepEqual(ids(out), [
    "agenda-fill-tomorrow",
    "agenda-pending-confirmation",
    "agenda-cancelled-slot",
    "agenda-fit-urgent",
  ])
})

test("clients: selected client adds entity-scoped suggestions", () => {
  const out = buildFinesseSuggestions({
    page: "clients",
    context: ctx({
      page: "clients",
      selectedEntityType: "client",
      selectedEntityId: "c-42",
      visibleMetrics: { clientasSinVolver: 14 },
    }),
  }, M)
  assert.equal(out[0].id, "clients-selected-summary:c-42")
  assert.equal(out[0].entityId, "c-42")
  assert.ok(ids(out).includes("clients-overdue-rebooking"))
})

test("clients: never emits an entity suggestion without a selected entity", () => {
  const out = buildFinesseSuggestions({
    page: "clients",
    context: ctx({ page: "clients", visibleMetrics: { clientasSinVolver: 5 } }),
  }, M)
  assert.ok(out.every((s) => s.entityId === undefined))
})

test("messages: selected conversation vs inbox-wide signals", () => {
  const selected = buildFinesseSuggestions({
    page: "messages",
    context: ctx({
      page: "messages",
      selectedEntityType: "conversation",
      selectedEntityId: "conv-1",
      visibleMetrics: { mensajesSinResponder: 4 },
    }),
  }, M)
  assert.equal(selected[0].id, "messages-selected-summary:conv-1")

  const none = buildFinesseSuggestions({ page: "messages", context: null }, M)
  assert.equal(none[0].source, "fallback")
})

test("marketing: unused photos vs no media are mutually exclusive", () => {
  const withWorks = buildFinesseSuggestions({
    page: "marketing",
    context: ctx({ page: "marketing", visibleMetrics: { trabajosSubidos: 3, publicacionesListas: 1 } }),
  }, M)
  assert.ok(ids(withWorks).includes("marketing-post-latest-work"))
  assert.ok(!ids(withWorks).includes("marketing-no-media"))

  const noMedia = buildFinesseSuggestions({
    page: "marketing",
    context: ctx({ page: "marketing", visibleMetrics: { trabajosSubidos: 0 } }),
  }, M)
  assert.ok(ids(noMedia).includes("marketing-no-media"))
})

test("billing: overdue vs healthy collection are mutually exclusive", () => {
  const overdue = buildFinesseSuggestions({
    page: "billing",
    context: ctx({ page: "billing", visibleMetrics: { cobrosPendientes: 120 } }),
  }, M)
  assert.equal(overdue[0].id, "billing-follow-up")

  const healthy = buildFinesseSuggestions({
    page: "billing",
    context: ctx({ page: "billing", visibleMetrics: { cobrosPendientes: 0, ingresosDelta: 0.08 } }),
  }, M)
  assert.ok(ids(healthy).includes("billing-collection-health"))
  assert.ok(ids(healthy).includes("billing-revenue-change"))
  assert.ok(!ids(healthy).includes("billing-follow-up"))
})

// ─── Ranking / dedup / cap / stability ───────────────────────────────────────

test("suggestions are priority-ordered, deduped and capped", () => {
  const context = ctx({
    page: "my-salon",
    visibleMetrics: {
      ingresosDelta: -0.2,
      tasaRetorno: 0.4,
      cobrosPendientes: 90,
      ocupacionDiaPunta: 0.95,
      clientasSinVolver: 20,
    },
  })
  const out = buildFinesseSuggestions({ page: "my-salon", context }, M)
  assert.ok(out.length <= MAX_SUGGESTIONS)
  for (let i = 1; i < out.length; i += 1) {
    assert.ok(out[i - 1].priority >= out[i].priority, "priority descending")
  }
  assert.equal(new Set(ids(out)).size, out.length, "no duplicate ids")
})

test("deterministic: same context object shape → identical output", () => {
  const context = ctx({ page: "today", visibleMetrics: { citas: 5, huecosLibres: 1 } })
  const a = buildFinesseSuggestions({ page: "today", context }, M)
  const b = buildFinesseSuggestions({ page: "today", context: { ...context } }, M)
  assert.deepEqual(a, b)
})

// ─── Fallback behavior ───────────────────────────────────────────────────────

test("no context → static fallback suggestions, capped", () => {
  for (const page of ["my-salon", "agenda", "marketing", "other"] as const) {
    const out = buildFinesseSuggestions({ page, context: null }, M)
    assert.ok(out.length > 0)
    assert.ok(out.length <= MAX_SUGGESTIONS)
    assert.ok(out.every((s) => s.source === "fallback"))
    assert.equal(out[0].label, M.staticSuggestions[page][0])
  }
})

test("empty metrics → fallback; partial metrics → only supported candidates", () => {
  const empty = buildFinesseSuggestions({
    page: "my-salon",
    context: ctx({ page: "my-salon", visibleMetrics: {} }),
  }, M)
  assert.ok(empty.every((s) => s.source === "fallback"))

  const partial = buildFinesseSuggestions({
    page: "my-salon",
    context: ctx({ page: "my-salon", visibleMetrics: { cobrosPendientes: 45 } }),
  }, M)
  assert.ok(ids(partial).includes("overview-pending-payments"))
  // A single signal is topped up with non-duplicate fallbacks, still capped.
  assert.ok(partial.length >= 2 && partial.length <= MAX_SUGGESTIONS)
})

test("context for a DIFFERENT page never leaks into the current page", () => {
  // Route changed but a stale context object was still registered: engine
  // must ignore it (context.page !== input.page) and fall back.
  const out = buildFinesseSuggestions({
    page: "agenda",
    context: ctx({ page: "my-salon", visibleMetrics: { ingresosDelta: -0.5 } }),
  }, M)
  assert.ok(out.every((s) => s.source === "fallback"))
})

test("entity change changes the suggestion identity (stable per entity)", () => {
  const a = buildFinesseSuggestions({
    page: "clients",
    context: ctx({ page: "clients", selectedEntityType: "client", selectedEntityId: "a" }),
  }, M)
  const b = buildFinesseSuggestions({
    page: "clients",
    context: ctx({ page: "clients", selectedEntityType: "client", selectedEntityId: "b" }),
  }, M)
  assert.notDeepEqual(ids(a), ids(b))
})

test("fallbackSuggestions caps and preserves static order", () => {
  const fb = fallbackSuggestions("my-salon", M)
  assert.ok(fb.length <= MAX_SUGGESTIONS)
  assert.deepEqual(
    fb.map((s) => s.label),
    M.staticSuggestions["my-salon"].slice(0, MAX_SUGGESTIONS),
  )
})
