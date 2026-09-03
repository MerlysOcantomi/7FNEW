/**
 * Tests for the REAL Beauty "Hoy" contract (pure part).
 *
 * Covers the truth rules (no attendance claims, no invented gaps, actions
 * always backed by real rows with a stated basis), the data-source policy
 * (real by default — mocks only behind explicit QA), and the tenant-stamped
 * query filters.
 */

import assert from "node:assert/strict"
import test from "node:test"
import {
  appointmentPhase,
  ATTENTION_LIMIT,
  buildAppointments,
  buildAttentionDigest,
  buildBeautyTodayQueryFilters,
  categorizeBeautyActions,
  computeGaps,
  findNextAppointment,
  GAP_MIN_MINUTES,
  INSPIRATION_LIMIT,
  INSPIRATION_PURPOSES,
  isAttentionHrefNavigable,
  resolveBeautyTodayDataSource,
  resolveFocusedAppointment,
  SUGGESTED_ACTIONS_LIMIT,
  URGENT_ACTIONS_LIMIT,
  type BeautyEventRow,
  type BeautyTaskEnrichment,
} from "./beauty-real"
import type { TodayItem } from "./types"

const NOW = new Date("2026-07-15T12:00:00Z")

function row(
  id: string,
  start: string,
  end: string | null,
  clienteId: string | null = null,
  clienteNombre: string | null = null,
): BeautyEventRow {
  return {
    id,
    titulo: `Cita ${id}`,
    fechaInicio: new Date(start),
    fechaFin: end ? new Date(end) : null,
    clienteId,
    clienteNombre,
  }
}

function emptyEnrichment(): BeautyTaskEnrichment {
  return { byTaskId: new Map(), clientNames: new Map() }
}

function taskItem(overrides: Partial<TodayItem> & { id: string }): TodayItem {
  return {
    kind: "task",
    title: "t",
    description: null,
    dueAt: null,
    priority: "normal",
    source: { kind: "manual", href: "/today" },
    assignee: null,
    assigneeType: "user",
    isProposed: false,
    isWaiting: false,
    ...overrides,
  }
}

// ─── Data-source policy ──────────────────────────────────────────────────────

test("data source: real Beauty workspace defaults to REAL — mocks never by default", () => {
  assert.equal(
    resolveBeautyTodayDataSource({ todayDataParam: null, isForcedPreview: false }),
    "real",
  )
  // Random/garbage params never opt into mocks.
  assert.equal(
    resolveBeautyTodayDataSource({ todayDataParam: "yes", isForcedPreview: false }),
    "real",
  )
})

test("data source: mocks only behind explicit QA param or forced non-Beauty preview", () => {
  assert.equal(
    resolveBeautyTodayDataSource({ todayDataParam: "mock", isForcedPreview: false }),
    "mock",
  )
  assert.equal(
    resolveBeautyTodayDataSource({ todayDataParam: null, isForcedPreview: true }),
    "mock",
  )
})

// ─── Phases (time statements, never attendance claims) ───────────────────────

test("appointmentPhase: upcoming / current / past are purely time-derived", () => {
  assert.equal(appointmentPhase(new Date("2026-07-15T13:00:00Z"), null, NOW), "upcoming")
  assert.equal(
    appointmentPhase(new Date("2026-07-15T11:30:00Z"), new Date("2026-07-15T12:30:00Z"), NOW),
    "current",
  )
  assert.equal(
    appointmentPhase(new Date("2026-07-15T10:00:00Z"), new Date("2026-07-15T11:00:00Z"), NOW),
    "past",
  )
  // Started, unknown end → "past" (never guess an ongoing state).
  assert.equal(appointmentPhase(new Date("2026-07-15T11:30:00Z"), null, NOW), "past")
})

test("buildAppointments: sorted by start, real client link preserved", () => {
  const appts = buildAppointments(
    [
      row("b", "2026-07-15T14:00:00Z", "2026-07-15T15:00:00Z", "c1", "María"),
      row("a", "2026-07-15T09:00:00Z", "2026-07-15T10:00:00Z"),
    ],
    NOW,
  )
  assert.deepEqual(
    appts.map((a) => a.eventoId),
    ["a", "b"],
  )
  assert.equal(appts[1].clientId, "c1")
  assert.equal(appts[1].clientName, "María")
  assert.equal(appts[0].phase, "past")
  assert.equal(appts[1].phase, "upcoming")
})

test("findNextAppointment: first not-yet-started cita; null when none remain", () => {
  const appts = buildAppointments(
    [
      row("a", "2026-07-15T09:00:00Z", "2026-07-15T10:00:00Z"),
      row("b", "2026-07-15T14:00:00Z", "2026-07-15T15:00:00Z"),
      row("c", "2026-07-15T16:00:00Z", "2026-07-15T17:00:00Z"),
    ],
    NOW,
  )
  assert.equal(findNextAppointment(appts, NOW)?.eventoId, "b")
  assert.equal(findNextAppointment(appts, new Date("2026-07-15T18:00:00Z")), null)
})

// ─── Gaps (honest by construction) ───────────────────────────────────────────

test("computeGaps: a real hole between two bounded citas", () => {
  const appts = buildAppointments(
    [
      row("a", "2026-07-15T12:30:00Z", "2026-07-15T13:00:00Z"),
      row("b", "2026-07-15T14:00:00Z", "2026-07-15T15:00:00Z"),
    ],
    NOW,
  )
  const gaps = computeGaps(appts, NOW)
  assert.equal(gaps.length, 1)
  assert.equal(gaps[0].id, "gap:a", "deterministic id")
  assert.equal(gaps[0].minutes, 60)
})

test("computeGaps: unknown duration breaks the chain — no invented gap", () => {
  const appts = buildAppointments(
    [
      row("a", "2026-07-15T12:30:00Z", null), // no fechaFin
      row("b", "2026-07-15T15:00:00Z", "2026-07-15T16:00:00Z"),
    ],
    NOW,
  )
  assert.deepEqual(computeGaps(appts, NOW), [])
})

test("computeGaps: below threshold, overlapping and fully-past gaps are dropped", () => {
  const short = buildAppointments(
    [
      row("a", "2026-07-15T12:30:00Z", "2026-07-15T13:00:00Z"),
      row("b", "2026-07-15T13:20:00Z", "2026-07-15T14:00:00Z"), // 20 min < threshold
    ],
    NOW,
  )
  assert.deepEqual(computeGaps(short, NOW), [])
  assert.ok(GAP_MIN_MINUTES > 20)

  const overlap = buildAppointments(
    [
      row("a", "2026-07-15T12:30:00Z", "2026-07-15T14:00:00Z"),
      row("b", "2026-07-15T13:30:00Z", "2026-07-15T15:00:00Z"),
    ],
    NOW,
  )
  assert.deepEqual(computeGaps(overlap, NOW), [])

  const past = buildAppointments(
    [
      row("a", "2026-07-15T08:00:00Z", "2026-07-15T09:00:00Z"),
      row("b", "2026-07-15T10:30:00Z", "2026-07-15T11:00:00Z"),
    ],
    NOW,
  )
  assert.deepEqual(computeGaps(past, NOW), [], "a hole that already closed is not offered")
})

// ─── Action categorization (same TodayItems as the workboard) ────────────────

test("categorize: AI proposals split from urgent; basis links attached", () => {
  const enrichment: BeautyTaskEnrichment = {
    byTaskId: new Map([
      [
        "t1",
        { sourceLabel: "Agenda", clienteId: "c9", eventoId: "e5", conversationId: null },
      ],
    ]),
    clientNames: new Map([["c9", "Carla"]]),
  }
  const result = categorizeBeautyActions(
    {
      overdue: [],
      today: [
        taskItem({
          id: "task:t1",
          title: "Confirmar la cita",
          priority: "high",
          dueAt: "2026-07-15T18:00:00.000Z",
          source: { kind: "manual", href: "/today" },
        }),
        taskItem({ id: "task:t2", isProposed: true, assigneeType: "ai" }),
      ],
      undated: [],
    },
    enrichment,
  )

  assert.equal(result.urgent.length, 1)
  assert.equal(result.urgent[0].itemId, "task:t1")
  assert.deepEqual(result.urgent[0].basis, {
    sourceLabel: "Agenda",
    clientId: "c9",
    clientName: "Carla",
    eventoId: "e5",
    conversationId: null,
  })
  assert.equal(result.suggested.length, 1)
  assert.equal(result.suggested[0].suggestedByAi, true)
  assert.equal(result.otherOpenTaskCount, 0)
})

test("categorize: overdue always urgent; undated normal-priority counts as other", () => {
  const result = categorizeBeautyActions(
    {
      overdue: [taskItem({ id: "task:o1", priority: "normal" })],
      today: [],
      undated: [taskItem({ id: "task:u1", priority: "normal" })],
    },
    emptyEnrichment(),
  )
  assert.equal(result.urgent.length, 1)
  assert.equal(result.urgent[0].overdue, true)
  assert.equal(result.otherOpenTaskCount, 1)
})

test("categorize: events never become actions; legacy tareas keep a null-link basis", () => {
  const result = categorizeBeautyActions(
    {
      overdue: [],
      today: [
        {
          ...taskItem({ id: "evento:e1" }),
          kind: "event",
          source: { kind: "calendar", href: "/calendario" },
        },
        taskItem({
          id: "tarea:l1",
          priority: "high",
          source: { kind: "project", projectId: null, projectName: null, href: "/tareas/l1" },
        }),
      ],
      undated: [],
    },
    emptyEnrichment(),
  )
  assert.equal(result.urgent.length, 1)
  assert.equal(result.urgent[0].itemId, "tarea:l1")
  assert.equal(result.urgent[0].href, "/tareas/l1")
  assert.deepEqual(result.urgent[0].basis, {
    sourceLabel: null,
    clientId: null,
    clientName: null,
    eventoId: null,
    conversationId: null,
  })
})

test("categorize: list caps hold and overflow lands in otherOpenTaskCount", () => {
  const many = Array.from({ length: 10 }, (_, i) =>
    taskItem({ id: `task:h${i}`, priority: "high", dueAt: "2026-07-15T10:00:00.000Z" }),
  )
  const proposals = Array.from({ length: 5 }, (_, i) =>
    taskItem({ id: `task:p${i}`, isProposed: true }),
  )
  const result = categorizeBeautyActions(
    { overdue: [], today: [...many, ...proposals], undated: [] },
    emptyEnrichment(),
  )
  assert.equal(result.urgent.length, URGENT_ACTIONS_LIMIT)
  assert.equal(result.suggested.length, SUGGESTED_ACTIONS_LIMIT)
  assert.equal(result.otherOpenTaskCount, 10 - URGENT_ACTIONS_LIMIT + (5 - SUGGESTED_ACTIONS_LIMIT))
})

// ─── Tenant isolation ────────────────────────────────────────────────────────

test("buildBeautyTodayQueryFilters: every clause is stamped with the workspaceId", () => {
  const filters = buildBeautyTodayQueryFilters("ws_A", {
    startOfToday: new Date("2026-07-15T00:00:00Z"),
    startOfTomorrow: new Date("2026-07-16T00:00:00Z"),
  })
  const clauses: Array<Record<string, unknown>> = [
    filters.todayCitas,
    filters.anyCita,
    filters.taskEnrichment(["t1", "t2"]),
    filters.pendingConversations,
    filters.anyConversation,
    filters.overdueInvoices,
    filters.pendingInvoices,
    filters.anyInvoice,
    filters.inspirationMedia,
  ]
  assert.equal(clauses.length, Object.keys(filters).length, "every filter is asserted")
  for (const clause of clauses) {
    assert.equal(clause.workspaceId, "ws_A", `unscoped clause: ${JSON.stringify(clause)}`)
  }
})

// ─── FINESSE-UI-02 Phase 2 — focus cita, attention digest, inspiration ───────

const P2_NOW = new Date("2026-09-03T10:00:00Z")
const p2Iso = (h: number, m = 0) => new Date(Date.UTC(2026, 8, 3, h, m)).toISOString()
const p2Appt = (
  id: string,
  startH: number,
  endH: number | null,
  extra: Partial<Parameters<typeof buildAppointments>[0][number]> = {},
) => ({
  id,
  titulo: `Servicio ${id}`,
  fechaInicio: new Date(Date.UTC(2026, 8, 3, startH)),
  fechaFin: endH === null ? null : new Date(Date.UTC(2026, 8, 3, endH)),
  clienteId: `c-${id}`,
  clienteNombre: `Cliente ${id}`,
  ...extra,
})

test("buildAppointments: preparation fields are trimmed, empty → null (nothing invented)", () => {
  const [a] = buildAppointments(
    [p2Appt("a", 11, 12, { descripcion: "  Trae referencia  ", clienteTelefono: " ", clienteNotas: null })],
    P2_NOW,
  )
  assert.equal(a.note, "Trae referencia")
  assert.equal(a.clientPhone, null)
  assert.equal(a.clientNotes, null)
  const [b] = buildAppointments([p2Appt("b", 11, 12)], P2_NOW) // legacy rows without the optional fields
  assert.equal(b.note, null)
  assert.equal(b.clientPhone, null)
  assert.equal(b.clientNotes, null)
})

test("resolveFocusedAppointment: a cita in progress wins and is time-derived 'current'", () => {
  const list = buildAppointments([p2Appt("past", 8, 9), p2Appt("now", 9, 11), p2Appt("next", 12, 13), p2Appt("late", 15, 16)], P2_NOW)
  const f = resolveFocusedAppointment(list, P2_NOW)
  assert.equal(f.focus?.eventoId, "now")
  assert.equal(f.mode, "current")
  assert.equal(f.following?.eventoId, "next")
  assert.equal(f.remainingAfterFocus, 2)
  assert.equal(f.allDone, false)
})

test("resolveFocusedAppointment: otherwise the next cita to start; following/remaining after it", () => {
  const list = buildAppointments([p2Appt("past", 8, 9), p2Appt("next", 12, 13), p2Appt("late", 15, 16)], P2_NOW)
  const f = resolveFocusedAppointment(list, P2_NOW)
  assert.equal(f.focus?.eventoId, "next")
  assert.equal(f.mode, "upcoming")
  assert.equal(f.following?.eventoId, "late")
  assert.equal(f.remainingAfterFocus, 1)
})

test("resolveFocusedAppointment: empty states — no citas vs all citas already past", () => {
  const none = resolveFocusedAppointment([], P2_NOW)
  assert.deepEqual(none, { focus: null, mode: "none", following: null, remainingAfterFocus: 0, allDone: false })
  const done = resolveFocusedAppointment(buildAppointments([p2Appt("a", 7, 8), p2Appt("b", 8, 9)], P2_NOW), P2_NOW)
  assert.equal(done.focus, null)
  assert.equal(done.mode, "none")
  assert.equal(done.allDone, true)
})

test("resolveFocusedAppointment: the future manual-switch seam honours a selected id, ignores unknown ones", () => {
  const list = buildAppointments([p2Appt("now", 9, 11), p2Appt("next", 12, 13), p2Appt("late", 15, 16)], P2_NOW)
  const picked = resolveFocusedAppointment(list, P2_NOW, "late")
  assert.equal(picked.focus?.eventoId, "late")
  assert.equal(picked.mode, "upcoming")
  assert.equal(picked.following, null)
  assert.equal(picked.remainingAfterFocus, 0)
  // Unknown id → default behaviour (no crash, no invented cita).
  assert.equal(resolveFocusedAppointment(list, P2_NOW, "ghost").focus?.eventoId, "now")
  assert.equal(resolveFocusedAppointment(list, P2_NOW, null).focus?.eventoId, "now")
})

const p2Action = (itemId: string, overdue: boolean, clientName: string | null = null) => ({
  itemId,
  title: `Tarea ${itemId}`,
  description: null,
  priority: null,
  dueAt: overdue ? null : p2Iso(13),
  suggestedByAi: false,
  isWaiting: false,
  overdue,
  href: `/tareas/${itemId}`,
  basis: { sourceLabel: null, clientId: null, clientName, eventoId: null, conversationId: null },
})

test("attention digest: 0 signals → empty, no hidden count", () => {
  const d = buildAttentionDigest({
    urgentActions: [],
    suggestedActions: [],
    pendingConversations: null,
    overdueInvoices: null,
    pendingInvoices: null,
  })
  assert.deepEqual(d, { items: [], hiddenCount: 0, suggestedCount: 0 })
})

test("attention digest: 1 signal → one row pointing at its real surface", () => {
  const d = buildAttentionDigest({
    urgentActions: [],
    suggestedActions: [],
    pendingConversations: 2,
    overdueInvoices: { count: 0, amount: 0 },
    pendingInvoices: { count: 0, amount: 0 },
  })
  assert.equal(d.items.length, 1)
  assert.equal(d.items[0].kind, "messages")
  assert.equal(d.items[0].count, 2)
  assert.equal(d.items[0].href, "/inbox")
  assert.equal(d.hiddenCount, 0)
})

test("attention digest: several signals → ranked (overdue task · messages · urgent task · overdue invoices · pending), capped, rest counted", () => {
  const d = buildAttentionDigest({
    urgentActions: [p2Action("t-today", false, "Ana"), p2Action("t-overdue", true)],
    suggestedActions: [p2Action("p1", false), p2Action("p2", false)],
    pendingConversations: 3,
    overdueInvoices: { count: 1, amount: 80 },
    pendingInvoices: { count: 2, amount: 120 },
  })
  assert.equal(ATTENTION_LIMIT, 3)
  assert.deepEqual(d.items.map((i) => i.id), ["t-overdue", "messages", "t-today"])
  assert.equal(d.items[2].clientName, "Ana")
  assert.equal(d.hiddenCount, 2) // overdue + pending invoices did not fit
  assert.equal(d.suggestedCount, 2) // proposals never take a row
  // Limit is respected and a wider limit reveals the invoices in order.
  const wide = buildAttentionDigest(
    {
      urgentActions: [p2Action("t-today", false), p2Action("t-overdue", true)],
      suggestedActions: [],
      pendingConversations: 3,
      overdueInvoices: { count: 1, amount: 80 },
      pendingInvoices: { count: 2, amount: 120 },
    },
    10,
  )
  assert.deepEqual(wide.items.map((i) => i.kind), ["task", "messages", "task", "overdue-invoices", "pending-invoices"])
  assert.equal(wide.hiddenCount, 0)
})

test("inspiration filter: approved ORIGINAL photos only, work purposes, tenant-stamped, capped", () => {
  const f = buildBeautyTodayQueryFilters("ws_A", {
    startOfToday: new Date("2026-09-03T00:00:00Z"),
    startOfTomorrow: new Date("2026-09-04T00:00:00Z"),
  }).inspirationMedia
  assert.equal(f.workspaceId, "ws_A")
  assert.equal(f.kind, "photo")
  assert.equal(f.reviewStatus, "use") // same approval rule as the Presence renderer
  assert.equal(f.sourceMediaId, null) // variants excluded
  assert.deepEqual(f.purpose, { in: ["work_sample", "gallery"] })
  assert.deepEqual([...INSPIRATION_PURPOSES], ["work_sample", "gallery"])
  assert.equal(INSPIRATION_LIMIT, 6)
})

test("attention navigability: from /today, a task pointing at /today is NOT navigable; real surfaces are", () => {
  assert.equal(isAttentionHrefNavigable("/today", "/today"), false)
  assert.equal(isAttentionHrefNavigable("/today?todayLayout=work_first", "/today"), false)
  assert.equal(isAttentionHrefNavigable("/today/x", "/today"), false)
  assert.equal(isAttentionHrefNavigable("/inbox", "/today"), true)
  assert.equal(isAttentionHrefNavigable("/facturacion", "/today"), true)
  assert.equal(isAttentionHrefNavigable("/tareas/t1", "/today"), true)
  // Same href is fine from another route (the board is a real destination there).
  assert.equal(isAttentionHrefNavigable("/today", "/"), true)
  assert.equal(isAttentionHrefNavigable("", "/today"), false)
})
