import assert from "node:assert/strict"
import test from "node:test"

import {
  MAX_SUGGESTIONS,
  buildFinesseSuggestions,
  fallbackSuggestions,
  type FinesseSuggestion,
  type FinesseSuggestionInput,
} from "./finesse-suggestions"
import { getFinesseSuggestions, type FinesseAssistantPageContext } from "./finesse-assistant"

function ctx(partial: Partial<FinesseAssistantPageContext> & { page: FinesseAssistantPageContext["page"] }): FinesseAssistantPageContext {
  return { ...partial }
}

// Behavioral tests run pinned to the Spanish catalog (the original copy);
// locale-specific behavior has its own tests at the bottom.
function build(input: Omit<FinesseSuggestionInput, "locale">): FinesseSuggestion[] {
  return buildFinesseSuggestions({ ...input, locale: "es" })
}

const ids = (s: FinesseSuggestion[]) => s.map((x) => x.id)

// ─── Candidate generation per signal ─────────────────────────────────────────

test("my-salon: revenue drop produces the drop question first", () => {
  const out = build({
    page: "my-salon",
    context: ctx({ page: "my-salon", visibleMetrics: { ingresosDelta: -0.12 } }),
  })
  assert.equal(out[0].id, "overview-earnings-drop")
  assert.equal(out[0].source, "overview")
})

test("my-salon: revenue growth produces the growth question (not the drop)", () => {
  const out = build({
    page: "my-salon",
    context: ctx({ page: "my-salon", visibleMetrics: { ingresosDelta: 0.12 } }),
  })
  assert.ok(ids(out).includes("overview-earnings-growth"))
  assert.ok(!ids(out).includes("overview-earnings-drop"))
})

test("my-salon: first period (no comparison) wins over delta prompts", () => {
  const out = build({
    page: "my-salon",
    context: ctx({
      page: "my-salon",
      visibleMetrics: { sinComparativa: 1, ingresosDelta: null },
    }),
  })
  assert.ok(ids(out).includes("overview-first-period"))
  assert.ok(!ids(out).includes("overview-earnings-drop"))
})

test("my-salon: weak rebooking, pending payments and full peak day all rank", () => {
  const out = build({
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
  })
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
  const out = build({
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
  })
  assert.deepEqual(ids(out), [
    "agenda-fill-tomorrow",
    "agenda-pending-confirmation",
    "agenda-cancelled-slot",
    "agenda-fit-urgent",
  ])
})

test("clients: selected client adds entity-scoped suggestions", () => {
  const out = build({
    page: "clients",
    context: ctx({
      page: "clients",
      selectedEntityType: "client",
      selectedEntityId: "c-42",
      visibleMetrics: { clientasSinVolver: 14 },
    }),
  })
  assert.equal(out[0].id, "clients-selected-summary:c-42")
  assert.equal(out[0].entityId, "c-42")
  assert.ok(ids(out).includes("clients-overdue-rebooking"))
})

test("clients: never emits an entity suggestion without a selected entity", () => {
  const out = build({
    page: "clients",
    context: ctx({ page: "clients", visibleMetrics: { clientasSinVolver: 5 } }),
  })
  assert.ok(out.every((s) => s.entityId === undefined))
})

test("messages: selected conversation vs inbox-wide signals", () => {
  const selected = build({
    page: "messages",
    context: ctx({
      page: "messages",
      selectedEntityType: "conversation",
      selectedEntityId: "conv-1",
      visibleMetrics: { mensajesSinResponder: 4 },
    }),
  })
  assert.equal(selected[0].id, "messages-selected-summary:conv-1")

  const none = build({ page: "messages", context: null })
  assert.equal(none[0].source, "fallback")
})

test("marketing: unused photos vs no media are mutually exclusive", () => {
  const withWorks = build({
    page: "marketing",
    context: ctx({ page: "marketing", visibleMetrics: { trabajosSubidos: 3, publicacionesListas: 1 } }),
  })
  assert.ok(ids(withWorks).includes("marketing-post-latest-work"))
  assert.ok(!ids(withWorks).includes("marketing-no-media"))

  const noMedia = build({
    page: "marketing",
    context: ctx({ page: "marketing", visibleMetrics: { trabajosSubidos: 0 } }),
  })
  assert.ok(ids(noMedia).includes("marketing-no-media"))
})

test("billing: overdue vs healthy collection are mutually exclusive", () => {
  const overdue = build({
    page: "billing",
    context: ctx({ page: "billing", visibleMetrics: { cobrosPendientes: 120 } }),
  })
  assert.equal(overdue[0].id, "billing-follow-up")

  const healthy = build({
    page: "billing",
    context: ctx({ page: "billing", visibleMetrics: { cobrosPendientes: 0, ingresosDelta: 0.08 } }),
  })
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
  const out = build({ page: "my-salon", context })
  assert.ok(out.length <= MAX_SUGGESTIONS)
  for (let i = 1; i < out.length; i += 1) {
    assert.ok(out[i - 1].priority >= out[i].priority, "priority descending")
  }
  assert.equal(new Set(ids(out)).size, out.length, "no duplicate ids")
})

test("deterministic: same context object shape → identical output", () => {
  const context = ctx({ page: "today", visibleMetrics: { citas: 5, huecosLibres: 1 } })
  const a = build({ page: "today", context })
  const b = build({ page: "today", context: { ...context } })
  assert.deepEqual(a, b)
})

// ─── Fallback behavior ───────────────────────────────────────────────────────

test("no context → static fallback suggestions, capped", () => {
  for (const page of ["my-salon", "agenda", "marketing", "other"] as const) {
    const out = build({ page, context: null })
    assert.ok(out.length > 0)
    assert.ok(out.length <= MAX_SUGGESTIONS)
    assert.ok(out.every((s) => s.source === "fallback"))
    assert.equal(out[0].label, getFinesseSuggestions(page, "es")[0])
  }
})

test("empty metrics → fallback; partial metrics → only supported candidates", () => {
  const empty = build({
    page: "my-salon",
    context: ctx({ page: "my-salon", visibleMetrics: {} }),
  })
  assert.ok(empty.every((s) => s.source === "fallback"))

  const partial = build({
    page: "my-salon",
    context: ctx({ page: "my-salon", visibleMetrics: { cobrosPendientes: 45 } }),
  })
  assert.ok(ids(partial).includes("overview-pending-payments"))
  // A single signal is topped up with non-duplicate fallbacks, still capped.
  assert.ok(partial.length >= 2 && partial.length <= MAX_SUGGESTIONS)
})

test("context for a DIFFERENT page never leaks into the current page", () => {
  // Route changed but a stale context object was still registered: engine
  // must ignore it (context.page !== input.page) and fall back.
  const out = build({
    page: "agenda",
    context: ctx({ page: "my-salon", visibleMetrics: { ingresosDelta: -0.5 } }),
  })
  assert.ok(out.every((s) => s.source === "fallback"))
})

test("entity change changes the suggestion identity (stable per entity)", () => {
  const a = build({
    page: "clients",
    context: ctx({ page: "clients", selectedEntityType: "client", selectedEntityId: "a" }),
  })
  const b = build({
    page: "clients",
    context: ctx({ page: "clients", selectedEntityType: "client", selectedEntityId: "b" }),
  })
  assert.notDeepEqual(ids(a), ids(b))
})

test("fallbackSuggestions caps and preserves static order", () => {
  const fb = fallbackSuggestions("my-salon", "es")
  assert.ok(fb.length <= MAX_SUGGESTIONS)
  assert.deepEqual(
    fb.map((s) => s.label),
    getFinesseSuggestions("my-salon", "es").slice(0, MAX_SUGGESTIONS),
  )
})

// ─── Localization ────────────────────────────────────────────────────────────

test("same context → same ids and metadata, locale-specific label/prompt text", () => {
  const context = ctx({
    page: "agenda",
    visibleMetrics: { huecosManana: 2, citasSinConfirmar: 3, cancelacionesHoy: 1, diaCasiCompleto: 1 },
  })
  const es = buildFinesseSuggestions({ page: "agenda", context, locale: "es" })
  const en = buildFinesseSuggestions({ page: "agenda", context, locale: "en" })

  assert.deepEqual(ids(es), ids(en), "identity is locale-independent")
  for (let i = 0; i < es.length; i += 1) {
    assert.notEqual(es[i].label, en[i].label, `${es[i].id} label must be translated`)
    assert.notEqual(es[i].prompt, en[i].prompt, `${es[i].id} prompt must be translated`)
    assert.equal(es[i].reason, en[i].reason)
    assert.equal(es[i].priority, en[i].priority)
    assert.equal(es[i].source, en[i].source)
  }
  // Interpolated counts stay raw integers in both locales.
  const fillEs = es.find((s) => s.id === "agenda-fill-tomorrow")
  const fillEn = en.find((s) => s.id === "agenda-fill-tomorrow")
  assert.ok(fillEs?.prompt.includes("2"))
  assert.ok(fillEn?.prompt.includes("2"))
})

test("unknown locale falls back to English text (dynamic + fallback paths)", () => {
  const context = ctx({ page: "today", visibleMetrics: { citas: 5, huecosLibres: 1 } })
  assert.deepEqual(
    buildFinesseSuggestions({ page: "today", context, locale: "pt-BR" }),
    buildFinesseSuggestions({ page: "today", context, locale: "en" }),
  )
  assert.deepEqual(
    buildFinesseSuggestions({ page: "settings", context: null, locale: "xx" }),
    buildFinesseSuggestions({ page: "settings", context: null, locale: "en" }),
  )
  // Omitted locale follows the same contract (default → English).
  assert.deepEqual(
    buildFinesseSuggestions({ page: "today", context }),
    buildFinesseSuggestions({ page: "today", context, locale: "en" }),
  )
})
