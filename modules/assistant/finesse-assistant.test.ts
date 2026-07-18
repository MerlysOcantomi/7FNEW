import assert from "node:assert/strict"
import test from "node:test"

import {
  FINESSE_MAX_QUESTION_LENGTH,
  resolveFinessePageKey,
  type FinesseAssistantContext,
} from "./finesse-assistant"

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

// ─── Question limit ──────────────────────────────────────────────────────────

test("question limit is generous enough for suggestion prompts", () => {
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
