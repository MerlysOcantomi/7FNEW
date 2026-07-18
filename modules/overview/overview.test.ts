import assert from "node:assert/strict"
import test from "node:test"

import { buildTrendBuckets, fromIsoDate, resolveOverviewPeriod, toIsoDate } from "./period"
import {
  clientMixShares,
  compareKpi,
  deriveBriefFacts,
  deriveLookingAhead,
  deriveRecommendations,
  distributeTotal,
  normalizeBookingSources,
  sumDrivers,
  sumRevenueTrend,
  withVisitShares,
} from "./derive"
import {
  getBeautyOverviewDemoSnapshot,
  getEmptyOverviewSnapshot,
  getFirstPeriodOverviewSnapshot,
  getNegativeOverviewSnapshot,
  getPartialOverviewSnapshot,
} from "./demo-data"
import {
  buildBeautyOverviewBrief,
  buildDriverLabel,
  buildRecommendationText,
  resolveBeautyOverviewConfig,
} from "./beauty-overview"
import type { OverviewPeriodPreset, OverviewSignals } from "./types"

const WS = "ws-test"
// Friday 2026-07-17, fixed for determinism.
const NOW = new Date(2026, 6, 17, 10, 0, 0)
const PRESETS: OverviewPeriodPreset[] = ["week", "month", "quarter", "year"]

// ─── Period resolution ───────────────────────────────────────────────────────

test("period: month resolves the calendar month + previous month", () => {
  const p = resolveOverviewPeriod("month", NOW)
  assert.equal(p.start, "2026-07-01")
  assert.equal(p.end, "2026-07-31")
  assert.equal(p.comparisonStart, "2026-06-01")
  assert.equal(p.comparisonEnd, "2026-06-30")
})

test("period: week runs Monday → Sunday with the previous week as comparison", () => {
  const p = resolveOverviewPeriod("week", NOW)
  assert.equal(p.start, "2026-07-13") // Monday
  assert.equal(p.end, "2026-07-19") // Sunday
  assert.equal(p.comparisonStart, "2026-07-06")
  assert.equal(p.comparisonEnd, "2026-07-12")
})

test("period: quarter and year are calendar-aligned", () => {
  const q = resolveOverviewPeriod("quarter", NOW)
  assert.equal(q.start, "2026-07-01")
  assert.equal(q.end, "2026-09-30")
  assert.equal(q.comparisonStart, "2026-04-01")
  assert.equal(q.comparisonEnd, "2026-06-30")

  const y = resolveOverviewPeriod("year", NOW)
  assert.equal(y.start, "2026-01-01")
  assert.equal(y.end, "2026-12-31")
  assert.equal(y.comparisonStart, "2025-01-01")
  assert.equal(y.comparisonEnd, "2025-12-31")
})

test("period: month boundaries — January compares against December of prev year", () => {
  const p = resolveOverviewPeriod("month", new Date(2026, 0, 15))
  assert.equal(p.comparisonStart, "2025-12-01")
  assert.equal(p.comparisonEnd, "2025-12-31")
})

test("period: iso date round-trip is stable (local calendar, no UTC shift)", () => {
  const d = fromIsoDate("2026-07-01")
  assert.equal(toIsoDate(d), "2026-07-01")
})

test("trend buckets: week→7 days, month→4 weeks, quarter→3 months, year→12 months", () => {
  assert.equal(buildTrendBuckets(resolveOverviewPeriod("week", NOW)).length, 7)
  const month = buildTrendBuckets(resolveOverviewPeriod("month", NOW))
  assert.equal(month.length, 4)
  assert.deepEqual(month.map((b) => b.bucket), ["week", "week", "week", "week"])
  assert.equal(buildTrendBuckets(resolveOverviewPeriod("quarter", NOW)).length, 3)
  assert.equal(buildTrendBuckets(resolveOverviewPeriod("year", NOW)).length, 12)
})

// ─── KPI comparison ──────────────────────────────────────────────────────────

test("compareKpi: positive, negative and flat tones", () => {
  const up = compareKpi({ current: 112, previous: 100, spark: [] })
  assert.equal(up.tone, "up")
  assert.ok(Math.abs((up.deltaRatio ?? 0) - 0.12) < 1e-9)
  assert.equal(up.deltaAbsolute, 12)

  const down = compareKpi({ current: 88, previous: 100, spark: [] })
  assert.equal(down.tone, "down")

  const flat = compareKpi({ current: 100.2, previous: 100, spark: [] })
  assert.equal(flat.tone, "flat")
})

test("compareKpi: honest nulls — no baseline, or zero baseline", () => {
  assert.deepEqual(compareKpi(null), { deltaRatio: null, deltaAbsolute: null, tone: "flat" })
  assert.deepEqual(compareKpi({ current: 5, previous: null, spark: [] }), {
    deltaRatio: null,
    deltaAbsolute: null,
    tone: "flat",
  })
  const fromZero = compareKpi({ current: 5, previous: 0, spark: [] })
  assert.equal(fromZero.deltaRatio, null)
  assert.equal(fromZero.tone, "up")
})

// ─── Apportionment + shares ──────────────────────────────────────────────────

test("distributeTotal: parts always sum exactly to the total", () => {
  for (const [total, weights] of [
    [142, [38, 24, 16, 12, 10]],
    [8420, [1720, 2040, 2180, 2480]],
    [7, [1, 1, 1]],
    [0, [3, 2]],
  ] as Array<[number, number[]]>) {
    const parts = distributeTotal(total, weights)
    assert.equal(parts.reduce((a, b) => a + b, 0), total)
    assert.equal(parts.length, weights.length)
  }
  assert.deepEqual(distributeTotal(10, []), [])
})

test("clientMixShares: shares sum to 1 and empty mixes are safe", () => {
  const shares = clientMixShares({ uniqueClients: 118, returningClients: 81, newClients: 37 })
  assert.ok(Math.abs(shares.returningShare + shares.newShare - 1) < 1e-9)
  assert.ok(Math.abs(shares.returningShare - 81 / 118) < 1e-9)
  assert.deepEqual(clientMixShares(null), { returningShare: 0, newShare: 0 })
})

test("normalizeBookingSources: unattributed becomes an explicit unknown row; shares sum to 1", () => {
  const rows = normalizeBookingSources(
    [
      { source: "instagram", bookings: 60 },
      { source: "whatsapp", bookings: 44 },
    ],
    120,
  )
  const unknown = rows.find((r) => r.source === "unknown")
  assert.equal(unknown?.bookings, 16)
  assert.ok(Math.abs(rows.reduce((a, r) => a + r.share, 0) - 1) < 1e-9)
  // Sorted by volume, unknown last.
  assert.equal(rows[0].source, "instagram")
  assert.equal(rows[rows.length - 1].source, "unknown")
})

test("withVisitShares: service shares derive from the total visits", () => {
  const ranked = withVisitShares(
    [{ serviceId: "s1", name: "Corte", visits: 71, revenue: 100 }],
    142,
  )
  assert.ok(Math.abs(ranked[0].visitShare - 0.5) < 1e-9)
})

// ─── Recommendations + forward look ──────────────────────────────────────────

const FULL_SIGNALS: OverviewSignals = {
  inactiveClients: 14,
  pendingPayments: { count: 4, amount: 310 },
  peakDayOccupancy: 0.92,
  quietPeriodAhead: true,
}

test("recommendations derive only from supporting signals", () => {
  const recs = deriveRecommendations(FULL_SIGNALS)
  assert.deepEqual(recs.map((r) => r.kind), ["reactivation", "pending-payments", "availability"])
  assert.deepEqual(recs.map((r) => r.agent), ["fiona", "felix", "fanny"])
  assert.equal(recs[0].value, 14)
  assert.equal(recs[1].value, 310)

  // No signals → positive empty state, not invented advice.
  assert.deepEqual(
    deriveRecommendations({
      inactiveClients: null,
      pendingPayments: null,
      peakDayOccupancy: null,
      quietPeriodAhead: null,
    }),
    [],
  )
  // Below thresholds → no recommendation.
  assert.deepEqual(
    deriveRecommendations({
      inactiveClients: 2,
      pendingPayments: { count: 0, amount: 0 },
      peakDayOccupancy: 0.4,
      quietPeriodAhead: null,
    }),
    [],
  )
})

test("looking ahead prioritizes a quiet period, then peak occupancy, else null", () => {
  assert.equal(deriveLookingAhead(FULL_SIGNALS)?.kind, "quiet-period")
  assert.equal(
    deriveLookingAhead({ ...FULL_SIGNALS, quietPeriodAhead: false })?.kind,
    "peak-nearly-full",
  )
  assert.equal(
    deriveLookingAhead({
      inactiveClients: null,
      pendingPayments: null,
      peakDayOccupancy: null,
      quietPeriodAhead: null,
    }),
    null,
  )
})

// ─── Demo snapshot coherence (the core honesty invariants) ───────────────────

for (const preset of PRESETS) {
  test(`demo snapshot (${preset}): every breakdown sums to its KPI`, () => {
    const period = resolveOverviewPeriod(preset, NOW)
    const s = getBeautyOverviewDemoSnapshot(WS, period)

    assert.equal(s.workspaceId, WS)
    assert.equal(s.period.preset, preset)
    assert.ok(s.kpis?.earnings && s.kpis.visits && s.kpis.newClients && s.kpis.returningRate)
    const kpis = s.kpis!
    const earnings = kpis.earnings!
    const visits = kpis.visits!
    const mix = s.clientMix!
    const demandDays = s.demand?.days ?? []

    // Trend buckets sum exactly to earnings.
    assert.equal(sumRevenueTrend(s.revenueTrend), earnings.current)
    // Bucket count matches the preset layout.
    assert.equal(s.revenueTrend.length, buildTrendBuckets(period).length)

    // Service visits sum exactly to the visits KPI; revenue to earnings.
    assert.equal(
      s.topServices.reduce((a, x) => a + x.visits, 0),
      visits.current,
    )
    assert.equal(
      s.topServices.reduce((a, x) => a + (x.revenue ?? 0), 0),
      earnings.current,
    )
    // Shares sum to 1.
    assert.ok(Math.abs(s.topServices.reduce((a, x) => a + x.visitShare, 0) - 1) < 1e-9)

    // Weekday demand sums exactly to visits, Monday-first, 7 days.
    assert.equal(demandDays.length, 7)
    assert.equal(
      demandDays.reduce((a, d) => a + d.visits, 0),
      visits.current,
    )

    // Client mix adds up and matches the returning-rate KPI.
    assert.ok(mix)
    assert.equal(mix.returningClients + mix.newClients, mix.uniqueClients)
    assert.equal(kpis.newClients!.current, mix.newClients)
    assert.ok(
      Math.abs(
        kpis.returningRate!.current - mix.returningClients / mix.uniqueClients,
      ) < 1e-9,
    )

    // Booking sources: bookings sum to visits, shares to 1, unknown present.
    assert.equal(
      s.bookingSources.reduce((a, x) => a + x.bookings, 0),
      visits.current,
    )
    assert.ok(Math.abs(s.bookingSources.reduce((a, x) => a + x.share, 0) - 1) < 1e-9)
    assert.ok(s.bookingSources.some((x) => x.source === "unknown"))

    // Drivers sum exactly to the earnings delta.
    assert.equal(sumDrivers(s.drivers), earnings.current - (earnings.previous ?? 0))

    // Workspace isolation: every id is scoped to the workspace.
    for (const svc of s.topServices) assert.ok(svc.serviceId.startsWith(`${WS}:`))
    for (const c of s.topClients) assert.ok(c.clientId.startsWith(`${WS}:`))
  })
}

test("demo snapshot: different workspaces never share record ids", () => {
  const period = resolveOverviewPeriod("month", NOW)
  const a = getBeautyOverviewDemoSnapshot("ws-a", period)
  const b = getBeautyOverviewDemoSnapshot("ws-b", period)
  const idsA = new Set([...a.topServices.map((s) => s.serviceId), ...a.topClients.map((c) => c.clientId)])
  for (const id of [...b.topServices.map((s) => s.serviceId), ...b.topClients.map((c) => c.clientId)]) {
    assert.ok(!idsA.has(id))
  }
})

test("negative snapshot: deltas flip down and drivers still sum to the delta", () => {
  const period = resolveOverviewPeriod("month", NOW)
  const s = getNegativeOverviewSnapshot(WS, period)
  assert.ok(s.kpis?.earnings)
  const earnings = s.kpis!.earnings!
  const cmp = compareKpi(earnings)
  assert.equal(cmp.tone, "down")
  assert.equal(sumDrivers(s.drivers), earnings.current - (earnings.previous ?? 0))
  assert.equal(sumRevenueTrend(s.revenueTrend), earnings.current)
})

test("partial snapshot: finance withheld honestly, activity still present", () => {
  const period = resolveOverviewPeriod("month", NOW)
  const s = getPartialOverviewSnapshot(WS, period)
  assert.equal(s.kpis?.earnings, null)
  assert.equal(s.revenueTrend.length, 0)
  assert.equal(s.drivers.length, 0)
  assert.ok((s.kpis?.visits?.current ?? 0) > 0)
  for (const svc of s.topServices) assert.equal(svc.revenue, null)
  for (const c of s.topClients) assert.equal(c.spend, null)
  assert.equal(s.dataQuality.finance, false)
  assert.equal(s.dataQuality.appointments, true)
})

test("first-period snapshot: no comparisons anywhere", () => {
  const period = resolveOverviewPeriod("month", NOW)
  const s = getFirstPeriodOverviewSnapshot(WS, period)
  assert.equal(s.kpis?.earnings?.previous, null)
  assert.equal(s.kpis?.visits?.previous, null)
  assert.equal(s.dataQuality.comparison, false)
  assert.equal(s.drivers.length, 0)
})

test("empty snapshot: everything empty, nothing invented", () => {
  const period = resolveOverviewPeriod("month", NOW)
  const s = getEmptyOverviewSnapshot(WS, period)
  assert.equal(s.kpis, null)
  assert.equal(s.clientMix, null)
  assert.equal(s.demand, null)
  assert.deepEqual(s.revenueTrend, [])
  assert.deepEqual(deriveRecommendations(s.signals), [])
  assert.equal(deriveLookingAhead(s.signals), null)
})

// ─── Config + brief consistency ──────────────────────────────────────────────

test("config resolves for beauty (and aliases) and stays null elsewhere", () => {
  assert.ok(resolveBeautyOverviewConfig("beauty"))
  assert.ok(resolveBeautyOverviewConfig("salon"))
  assert.ok(resolveBeautyOverviewConfig("nails"))
  assert.equal(resolveBeautyOverviewConfig("creative-agency"), null)
  assert.equal(resolveBeautyOverviewConfig(null), null)
  assert.equal(resolveBeautyOverviewConfig(undefined), null)
})

test("brief: generated from the snapshot and consistent with its metrics", () => {
  const period = resolveOverviewPeriod("month", NOW)
  const s = getBeautyOverviewDemoSnapshot(WS, period)
  const facts = deriveBriefFacts(s)
  const brief = buildBeautyOverviewBrief(facts, { locale: "es" }) ?? ""

  assert.ok(brief.length > 0)
  // The stated delta and retention are the snapshot's own numbers.
  const earnings = s.kpis!.earnings!
  const deltaPct = Math.round(Math.abs((earnings.current - earnings.previous!) / earnings.previous!) * 100)
  const returningPct = Math.round(s.kpis!.returningRate!.current * 100)
  assert.ok(brief.includes(`${deltaPct}`), `brief mentions the real earnings delta (${brief})`)
  assert.ok(brief.includes(`${returningPct}`), `brief mentions the real returning rate (${brief})`)
  assert.ok(brief.includes(s.topServices[0].name.toLowerCase()))
})

test("brief: partial data yields a partial summary, empty data yields none", () => {
  const period = resolveOverviewPeriod("month", NOW)

  const partial = buildBeautyOverviewBrief(deriveBriefFacts(getPartialOverviewSnapshot(WS, period)), {
    locale: "es",
  }) ?? ""
  assert.ok(partial.length > 0)
  assert.ok(!partial.includes("ganaste"), "no earnings claim without finance data")

  const empty = buildBeautyOverviewBrief(deriveBriefFacts(getEmptyOverviewSnapshot(WS, period)), {
    locale: "es",
  })
  assert.equal(empty, null)
})

test("driver + recommendation copy interpolate real values", () => {
  const config = resolveBeautyOverviewConfig("beauty")!
  const label = buildDriverLabel(
    { id: "x", source: "new-clients", amount: 300, tone: "up", confidence: "correlation", detail: "Instagram" },
    config,
  )
  assert.ok(label.includes("Instagram"))

  const text = buildRecommendationText(
    { id: "p", agent: "felix", kind: "pending-payments", value: 310, actionHref: "/facturacion" },
    { locale: "es", currency: "EUR" },
  )
  assert.ok(text.includes("310"))
})
