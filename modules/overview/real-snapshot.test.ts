/**
 * Tests for the REAL "Mi salón" aggregation (pure part).
 *
 * Covers the honesty rules (nothing invented, `null`/empty when a module has
 * no data), the metric definitions (completed visits, first-visit new
 * clients, collected earnings), timezone-day membership, and the
 * tenant-isolation guarantee of the query filters.
 */

import assert from "node:assert/strict"
import test from "node:test"
import {
  buildOverviewQueryFilters,
  buildRealOverviewPayload,
  buildSalonProfile,
  isoDateInTimezone,
  isoWeekdayOfDate,
  isValidTimezone,
  type RealOverviewInput,
} from "./real-snapshot"
import type { OverviewPeriod } from "./types"

// ─── Fixtures ────────────────────────────────────────────────────────────────

const WS = "ws_test_1"

/** July 2026 with June as comparison; "now" is July 15th noon UTC. */
const PERIOD: OverviewPeriod = {
  preset: "month",
  start: "2026-07-01",
  end: "2026-07-31",
  comparisonStart: "2026-06-01",
  comparisonEnd: "2026-06-30",
}
const NOW = new Date("2026-07-15T12:00:00Z")

function emptyInput(overrides: Partial<RealOverviewInput> = {}): RealOverviewInput {
  return {
    workspaceId: WS,
    period: PERIOD,
    timezone: "UTC",
    now: NOW,
    currency: "EUR",
    events: [],
    visitBounds: [],
    invoices: [],
    clients: [],
    pendingConversationCount: null,
    openTasks: [],
    totals: { events: 0, invoices: 0, clients: 0, tasks: 0 },
    businessProfile: null,
    serviceCatalog: undefined,
    ...overrides,
  }
}

function evento(
  id: string,
  clienteId: string | null,
  iso: string,
  titulo = "Cita",
): RealOverviewInput["events"][number] {
  return { id, clienteId, titulo, fechaInicio: new Date(iso), fechaFin: null }
}

// ─── Timezone helpers ────────────────────────────────────────────────────────

test("isValidTimezone: accepts real zones, rejects garbage", () => {
  assert.equal(isValidTimezone("Europe/Madrid"), true)
  assert.equal(isValidTimezone("UTC"), true)
  assert.equal(isValidTimezone("Not/AZone"), false)
})

test("isoDateInTimezone: same instant, different local days across zones", () => {
  const instant = new Date("2026-07-14T22:30:00Z")
  assert.equal(isoDateInTimezone(instant, "UTC"), "2026-07-14")
  // Madrid is UTC+2 in July — 22:30Z is already the 15th there.
  assert.equal(isoDateInTimezone(instant, "Europe/Madrid"), "2026-07-15")
  // Invalid timezone falls back to UTC instead of throwing.
  assert.equal(isoDateInTimezone(instant, "Not/AZone"), "2026-07-14")
})

test("isoWeekdayOfDate: ISO weekday 0=Monday…6=Sunday", () => {
  assert.equal(isoWeekdayOfDate("2026-07-13"), 0) // Monday
  assert.equal(isoWeekdayOfDate("2026-07-17"), 4) // Friday
  assert.equal(isoWeekdayOfDate("2026-07-19"), 6) // Sunday
})

// ─── Salon profile ───────────────────────────────────────────────────────────

test("buildSalonProfile: empty profile → zero completeness, no invented values", () => {
  const salon = buildSalonProfile(null, undefined)
  assert.equal(salon.businessName, null)
  assert.equal(salon.description, null)
  assert.equal(salon.region, null)
  assert.equal(salon.workingHours, null)
  assert.deepEqual(salon.activeServices, [])
  assert.equal(salon.completeness, 0)
  assert.equal(salon.completedFields, 0)
  assert.equal(salon.totalFields, 8)
})

test("buildSalonProfile: counts filled canonical fields and resolves the catalog", () => {
  const salon = buildSalonProfile(
    {
      businessName: "Studio Demo",
      businessDescription: "Salón boutique",
      services: ["Manicura"],
      tone: "Cercano",
      region: "Madrid",
      languages: ["es", "en"],
      workingHours: "M-S 10:00-19:00",
      attentionRules: ["Confirmar citas"],
    },
    [
      { name: "Manicura", category: "Uñas", active: true },
      { name: "Pedicura", category: "Uñas", active: false },
    ],
  )
  assert.equal(salon.completedFields, 8)
  assert.equal(salon.completeness, 1)
  assert.deepEqual(salon.activeServices, ["Manicura"], "inactive services are excluded")
})

test("buildSalonProfile: empty strings and empty arrays do not count as filled", () => {
  const salon = buildSalonProfile(
    { businessName: "  ", services: [], region: "Madrid" },
    undefined,
  )
  assert.equal(salon.completedFields, 1)
  assert.equal(salon.businessName, null)
})

// ─── Empty workspace honesty ─────────────────────────────────────────────────

test("buildRealOverviewPayload: empty workspace → honest nulls everywhere", () => {
  const payload = buildRealOverviewPayload(emptyInput())
  const s = payload.snapshot

  assert.equal(payload.source, "real")
  assert.equal(s.workspaceId, WS)
  assert.equal(s.kpis, null)
  assert.deepEqual(s.revenueTrend, [])
  assert.deepEqual(s.drivers, [])
  assert.deepEqual(s.topServices, [])
  assert.equal(s.demand, null)
  assert.equal(s.clientMix, null)
  assert.deepEqual(s.topClients, [])
  assert.deepEqual(s.bookingSources, [])
  assert.equal(s.signals.inactiveClients, null)
  assert.equal(s.signals.pendingPayments, null)
  assert.equal(s.signals.peakDayOccupancy, null)
  assert.equal(s.signals.quietPeriodAhead, null)
  assert.equal(s.lookingAhead, null)
  assert.deepEqual(s.dataQuality, {
    finance: false,
    appointments: false,
    clients: false,
    services: false,
    bookingSources: false,
    comparison: false,
  })

  assert.deepEqual(payload.today.appointments, [])
  assert.equal(payload.today.pendingConversations, null)
  assert.equal(payload.today.priorityTasks, null)
  assert.equal(payload.today.activeClients, null)
  assert.equal(payload.today.pendingInvoices, null)
  assert.equal(payload.today.overdueInvoices, null)
})

// ─── Populated workspace ─────────────────────────────────────────────────────

function populatedInput(): RealOverviewInput {
  return emptyInput({
    events: [
      // Completed visits this period (July, before "now" July 15).
      evento("e1", "c1", "2026-07-02T10:00:00Z", "Manicura"),
      evento("e2", "c1", "2026-07-10T10:00:00Z", "Pedicura"),
      evento("e3", "c2", "2026-07-08T16:00:00Z", "Facial"),
      // Today (July 15) — one completed this morning, one later (future).
      evento("e4", "c2", "2026-07-15T09:00:00Z", "Masaje"),
      evento("e5", "c3", "2026-07-15T18:00:00Z", "Nail art"),
      // Future within the period — never a "visit".
      evento("e6", "c1", "2026-07-20T10:00:00Z", "Manicura"),
      // Comparison period (June).
      evento("e7", "c1", "2026-06-05T10:00:00Z", "Manicura"),
      evento("e8", "c4", "2026-06-20T12:00:00Z", "Facial"),
      // Unlinked cita — counts as a visit, joins no client metric.
      evento("e9", null, "2026-07-03T11:00:00Z", "Walk-in"),
    ],
    visitBounds: [
      // c1's first visit long before July → returning.
      { clienteId: "c1", firstVisit: new Date("2026-03-01T10:00:00Z"), lastVisit: new Date("2026-07-10T10:00:00Z") },
      // c2's first ever visit inside July → new client.
      { clienteId: "c2", firstVisit: new Date("2026-07-08T16:00:00Z"), lastVisit: new Date("2026-07-15T09:00:00Z") },
      // c4: first visit in June (new in comparison), inactive since (>60d before now? June 20 → no).
      { clienteId: "c4", firstVisit: new Date("2026-06-20T12:00:00Z"), lastVisit: new Date("2026-06-20T12:00:00Z") },
      // c5: long-gone client → feeds inactiveClients.
      { clienteId: "c5", firstVisit: new Date("2026-01-10T10:00:00Z"), lastVisit: new Date("2026-02-01T10:00:00Z") },
    ],
    invoices: [
      // Collected in July.
      { estado: "pagada", total: 121, fechaEmision: new Date("2026-07-02T10:00:00Z"), paidAt: new Date("2026-07-02T12:00:00Z"), clienteId: "c1" },
      { estado: "pagada", total: 100, fechaEmision: new Date("2026-07-08T10:00:00Z"), paidAt: new Date("2026-07-09T12:00:00Z"), clienteId: "c2" },
      // Collected in June (comparison) — paidAt missing falls back to emision.
      { estado: "pagada", total: 80, fechaEmision: new Date("2026-06-10T10:00:00Z"), paidAt: null, clienteId: "c1" },
      // Uncollected.
      { estado: "enviada", total: 242, fechaEmision: new Date("2026-07-14T10:00:00Z"), paidAt: null, clienteId: "c2" },
      { estado: "vencida", total: 96.8, fechaEmision: new Date("2026-06-30T10:00:00Z"), paidAt: null, clienteId: "c5" },
      // Draft — ignored by every metric.
      { estado: "borrador", total: 50, fechaEmision: new Date("2026-07-14T10:00:00Z"), paidAt: null, clienteId: null },
    ],
    clients: [
      { id: "c1", nombre: "María", estado: "activo" },
      { id: "c2", nombre: "Sofía", estado: "activo" },
      { id: "c3", nombre: "Laura", estado: "activo" },
      { id: "c4", nombre: "Carla", estado: "prospecto" },
      { id: "c5", nombre: "Valentina", estado: "inactivo" },
    ],
    pendingConversationCount: 3,
    openTasks: [
      { status: "open", priority: "high", dueAt: null },
      { status: "open", priority: "normal", dueAt: new Date("2026-07-15T18:00:00Z") },
      { status: "waiting", priority: "normal", dueAt: new Date("2026-07-14T10:00:00Z") },
      // Future-dated normal-priority task — not a priority today.
      { status: "open", priority: "normal", dueAt: new Date("2026-07-20T10:00:00Z") },
    ],
    totals: { events: 9, invoices: 6, clients: 5, tasks: 4 },
    businessProfile: { businessName: "Studio Demo" },
    serviceCatalog: [{ name: "Manicura", active: true }],
  })
}

test("visits KPI: completed citas only (future excluded), comparison from June", () => {
  const s = buildRealOverviewPayload(populatedInput()).snapshot
  // July completed: e1, e2, e3, e4 (09:00 < now), e9 (unlinked). e5 (18:00) + e6 future.
  assert.equal(s.kpis?.visits?.current, 5)
  assert.equal(s.kpis?.visits?.previous, 2)
  assert.deepEqual(s.kpis?.visits?.spark, [], "no historical series exists — no invented sparkline")
})

test("client mix + new clients: first-ever visit inside the period", () => {
  const s = buildRealOverviewPayload(populatedInput()).snapshot
  // Unique July clients: c1, c2. New: c2 (first visit July 8). Returning: c1.
  assert.deepEqual(s.clientMix, { uniqueClients: 2, returningClients: 1, newClients: 1 })
  assert.equal(s.kpis?.newClients?.current, 1)
  assert.equal(s.kpis?.returningRate?.current, 0.5)
})

test("earnings KPI: collected invoices; paidAt falls back to fechaEmision", () => {
  const s = buildRealOverviewPayload(populatedInput()).snapshot
  assert.equal(s.kpis?.earnings?.current, 221) // 121 + 100
  assert.equal(s.kpis?.earnings?.previous, 80) // June, via fechaEmision fallback
  assert.equal(s.dataQuality.comparison, true)
})

test("revenue trend: buckets sum to collected earnings, never to invented data", () => {
  const s = buildRealOverviewPayload(populatedInput()).snapshot
  const total = s.revenueTrend.reduce((acc, p) => acc + p.amount, 0)
  assert.equal(total, 221)
  assert.ok(s.revenueTrend.length > 0, "month preset yields weekly buckets")
})

test("demand: completed visits per ISO weekday, no invented peak hours", () => {
  const s = buildRealOverviewPayload(populatedInput()).snapshot
  assert.ok(s.demand, "demand exists when there are completed visits")
  const total = s.demand!.days.reduce((acc, d) => acc + d.visits, 0)
  assert.equal(total, 5)
  assert.equal(s.demand!.peakHours, null, "no capacity model — peakHours must be null")
  const peakDays = s.demand!.days.filter((d) => d.peak)
  assert.ok(peakDays.length >= 1)
  const max = Math.max(...s.demand!.days.map((d) => d.visits))
  for (const d of peakDays) assert.equal(d.visits, max)
})

test("top clients: real ids and names, spend from collected invoices, no VIP invention", () => {
  const s = buildRealOverviewPayload(populatedInput()).snapshot
  assert.equal(s.topClients[0].clientId, "c1")
  assert.equal(s.topClients[0].name, "María")
  assert.equal(s.topClients[0].visits, 2)
  assert.equal(s.topClients[0].spend, 121)
  assert.equal(s.topClients[0].vip, false)
  const c2 = s.topClients.find((c) => c.clientId === "c2")
  assert.equal(c2?.visits, 2) // e3 + e4
  assert.equal(c2?.spend, 100)
})

test("signals: pending payments and inactive clients are real, capacity stays null", () => {
  const s = buildRealOverviewPayload(populatedInput()).snapshot
  assert.deepEqual(s.signals.pendingPayments, { count: 2, amount: 338.8 }) // 242 + 96.8
  assert.equal(s.signals.inactiveClients, 1) // c5 (last visit Feb 1, >60 days before Jul 15)
  assert.equal(s.signals.peakDayOccupancy, null)
  assert.equal(s.signals.quietPeriodAhead, null)
})

test("sections without a backend stay empty — never mixed with real numbers", () => {
  const s = buildRealOverviewPayload(populatedInput()).snapshot
  assert.deepEqual(s.drivers, [])
  assert.deepEqual(s.topServices, [])
  assert.deepEqual(s.bookingSources, [])
  assert.equal(s.dataQuality.services, false)
  assert.equal(s.dataQuality.bookingSources, false)
})

test("today ops: today's citas sorted by time, counts from real modules", () => {
  const payload = buildRealOverviewPayload(populatedInput())
  const today = payload.today

  // July 15 (UTC): e4 09:00 and e5 18:00 — future-today still belongs to today's agenda.
  assert.deepEqual(
    today.appointments.map((a) => a.eventoId),
    ["e4", "e5"],
  )
  assert.equal(today.appointments[0].clientName, "Sofía")
  assert.equal(today.appointments[1].clientName, "Laura")

  assert.equal(today.pendingConversations, 3)
  // high-priority (1) + due today (1) + overdue waiting (1); future normal excluded.
  assert.equal(today.priorityTasks, 3)
  assert.equal(today.activeClients, 3)
  assert.deepEqual(today.pendingInvoices, { count: 1, amount: 242 })
  assert.deepEqual(today.overdueInvoices, { count: 1, amount: 96.8 })
})

test("timezone changes period membership: late-night UTC cita belongs to next Madrid day", () => {
  const input = emptyInput({
    events: [evento("e1", "c1", "2026-07-14T22:30:00Z", "Cita tarde")],
    visitBounds: [
      { clienteId: "c1", firstVisit: new Date("2026-07-14T22:30:00Z"), lastVisit: new Date("2026-07-14T22:30:00Z") },
    ],
    totals: { events: 1, invoices: 0, clients: 0, tasks: 0 },
    timezone: "Europe/Madrid",
    now: new Date("2026-07-15T08:00:00Z"),
  })
  const payload = buildRealOverviewPayload(input)
  // In Madrid the cita happened on the 15th — NOT today’s list? It IS the 15th, so it is today.
  assert.equal(payload.today.appointments.length, 1)
  assert.equal(payload.snapshot.kpis?.visits?.current, 1)
})

// ─── Tenant isolation ────────────────────────────────────────────────────────

test("buildOverviewQueryFilters: every query is stamped with the workspaceId", () => {
  const filters = buildOverviewQueryFilters("ws_A", {
    fetchStart: new Date("2026-06-01T00:00:00Z"),
    fetchEnd: new Date("2026-08-01T00:00:00Z"),
  })

  const clauses: Array<Record<string, unknown>> = [
    filters.eventsInWindow,
    filters.completedEvents(NOW),
    filters.anyEvent,
    filters.invoices,
    filters.anyInvoice,
    filters.clients,
    filters.pendingConversations,
    filters.anyConversation,
    filters.openTasks,
    filters.anyTask,
  ]

  assert.equal(clauses.length, Object.keys(filters).length, "every filter is asserted")
  for (const clause of clauses) {
    assert.equal(clause.workspaceId, "ws_A", `unscoped clause: ${JSON.stringify(clause)}`)
  }
})

test("buildRealOverviewPayload: only echoes the given workspaceId (rows are pre-scoped)", () => {
  const payload = buildRealOverviewPayload(emptyInput({ workspaceId: "ws_B" }))
  assert.equal(payload.snapshot.workspaceId, "ws_B")
})
