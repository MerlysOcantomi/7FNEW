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
  buildAppointments,
  buildBeautyTodayQueryFilters,
  categorizeBeautyActions,
  computeGaps,
  findNextAppointment,
  GAP_MIN_MINUTES,
  resolveBeautyTodayDataSource,
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
  ]
  assert.equal(clauses.length, Object.keys(filters).length, "every filter is asserted")
  for (const clause of clauses) {
    assert.equal(clause.workspaceId, "ws_A", `unscoped clause: ${JSON.stringify(clause)}`)
  }
})
