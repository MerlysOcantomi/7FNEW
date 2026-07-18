/**
 * My Salon — isolated demo adapter.
 *
 * There is NO business-overview backend yet (no Appointment/Service/Payment
 * Prisma models — see `modules/today/appointments.ts`), so the surface runs on
 * this adapter and ALWAYS shows the "Vista previa · datos de ejemplo" chip,
 * exactly like Finesse Marketing (`modules/marketing/demo-data.ts`).
 *
 * COHERENCE BY CONSTRUCTION: every breakdown is produced with
 * `distributeTotal` from the SAME period totals, so trend buckets sum to the
 * earnings KPI, weekday visits sum to the visits KPI, service visits sum to
 * the visits KPI, drivers sum to the earnings delta, and the client mix adds
 * up. Tests in `overview.test.ts` assert these invariants.
 *
 * Replacement seam: a future Prisma/API adapter only needs to return the same
 * `BusinessOverviewSnapshot` (see `types.ts`) from real `Evento` / `Factura` /
 * `Transaccion` aggregation — the UI and derivations stay untouched.
 */

import { buildTrendBuckets } from "./period"
import { en as enOverview } from "./i18n/en"
import type { BeautyOverviewMessages } from "./i18n/types"
import { deriveLookingAhead, distributeTotal, normalizeBookingSources, withVisitShares } from "./derive"
import type {
  BusinessOverviewSnapshot,
  ClientPerformance,
  DemandDay,
  OverviewKpiValue,
  OverviewPeriod,
  OverviewSignals,
  PerformanceDriver,
} from "./types"

/** Demo currency — ISO 4217. A real adapter must read workspace configuration. */
export const DEMO_OVERVIEW_CURRENCY = "EUR"

// ─── Per-preset base totals ──────────────────────────────────────────────────

interface DemoSpec {
  earnings: number
  previousEarnings: number
  visits: number
  previousVisits: number
  uniqueClients: number
  newClients: number
  previousNewClients: number
  returningRatePrevious: number
  /** Relative weights for the revenue-trend buckets (must match bucket count). */
  trendWeights: number[]
  earningsSpark: number[]
  visitsSpark: number[]
  newClientsSpark: number[]
  returningSpark: number[]
}

/**
 * Deterministic, hand-tuned totals per preset (no Math.random — demo output
 * must be stable across renders and safe for hydration). Breakdown numbers are
 * derived from these totals, never written by hand.
 */
const DEMO_SPECS: Record<OverviewPeriod["preset"], DemoSpec> = {
  week: {
    earnings: 1980,
    previousEarnings: 1830,
    visits: 34,
    previousVisits: 31,
    uniqueClients: 31,
    newClients: 6,
    previousNewClients: 5,
    returningRatePrevious: 0.77,
    trendWeights: [12, 15, 14, 16, 22, 17, 4],
    earningsSpark: [1690, 1745, 1710, 1830, 1795, 1900, 1980],
    visitsSpark: [28, 30, 29, 31, 30, 33, 34],
    newClientsSpark: [3, 4, 4, 5, 4, 5, 6],
    returningSpark: [0.72, 0.74, 0.75, 0.77, 0.76, 0.79, 0.81],
  },
  month: {
    earnings: 8420,
    previousEarnings: 7516,
    visits: 142,
    previousVisits: 131,
    uniqueClients: 118,
    newClients: 37,
    previousNewClients: 32,
    returningRatePrevious: 0.66,
    trendWeights: [1720, 2040, 2180, 2480],
    earningsSpark: [6400, 6900, 7100, 7516, 7300, 8000, 8420],
    visitsSpark: [110, 118, 121, 131, 127, 138, 142],
    newClientsSpark: [22, 26, 28, 32, 30, 34, 37],
    returningSpark: [0.58, 0.6, 0.62, 0.66, 0.64, 0.67, 0.69],
  },
  quarter: {
    earnings: 24660,
    previousEarnings: 23140,
    visits: 415,
    previousVisits: 392,
    uniqueClients: 236,
    newClients: 74,
    previousNewClients: 69,
    returningRatePrevious: 0.67,
    trendWeights: [7600, 8200, 8860],
    earningsSpark: [21000, 21900, 22600, 23140, 23600, 24100, 24660],
    visitsSpark: [355, 368, 380, 392, 399, 407, 415],
    newClientsSpark: [58, 61, 65, 69, 70, 72, 74],
    returningSpark: [0.62, 0.64, 0.65, 0.67, 0.67, 0.68, 0.69],
  },
  year: {
    earnings: 96400,
    previousEarnings: 89800,
    visits: 1630,
    previousVisits: 1544,
    uniqueClients: 342,
    newClients: 121,
    previousNewClients: 138,
    returningRatePrevious: 0.6,
    trendWeights: [6900, 7100, 7900, 8100, 8400, 8200, 8420, 6600, 8300, 8700, 8900, 8880],
    earningsSpark: [78200, 81500, 84300, 89800, 91200, 94100, 96400],
    visitsSpark: [1390, 1445, 1490, 1544, 1571, 1602, 1630],
    newClientsSpark: [150, 146, 141, 138, 131, 126, 121],
    returningSpark: [0.55, 0.56, 0.58, 0.6, 0.62, 0.63, 0.65],
  },
}

// ─── Fixed demo catalog (names only — numbers are derived) ───────────────────

/**
 * Demo service catalog — names are LOCALIZED product-owned sample content
 * (`nameKey` into `BeautyOverviewMessages.demo.serviceNames`); ids/weights are
 * structure. Real service names, once a backend exists, are business data and
 * are never translated.
 */
const DEMO_SERVICES: Array<{
  id: string
  nameKey: keyof BeautyOverviewMessages["demo"]["serviceNames"]
  visitWeight: number
  revenueWeight: number
}> = [
  { id: "corte-peinado", nameKey: "cutStyle", visitWeight: 38, revenueWeight: 27 },
  { id: "color-completo", nameKey: "fullColor", visitWeight: 24, revenueWeight: 25 },
  { id: "mechas-balayage", nameKey: "balayage", visitWeight: 16, revenueWeight: 23 },
  { id: "tratamiento-brillo", nameKey: "treatment", visitWeight: 12, revenueWeight: 15 },
  { id: "peinado-evento", nameKey: "eventStyle", visitWeight: 10, revenueWeight: 10 },
]

/** Weekday visit weights, Monday → Sunday. Friday + Saturday peak. */
const DEMO_WEEKDAY_WEIGHTS = [11, 13, 14, 16, 20, 18, 8]
const DEMO_PEAK_WEEKDAYS = new Set([4, 5]) // Fri, Sat

const DEMO_SOURCE_WEIGHTS: Array<{ source: "instagram" | "whatsapp" | "walk-in" | "referral"; weight: number }> = [
  { source: "instagram", weight: 40 },
  { source: "whatsapp", weight: 29 },
  { source: "walk-in", weight: 14 },
  { source: "referral", weight: 11 },
]
/** Share of bookings with no attribution — surfaces the honest "unknown" row. */
const DEMO_UNKNOWN_WEIGHT = 6

const DEMO_CLIENTS: Array<{ id: string; name: string; visitWeight: number; spendWeight: number; vip: boolean }> = [
  { id: "camila-ruiz", name: "Camila Ruiz", visitWeight: 8, spendWeight: 33, vip: true },
  { id: "marta-vidal", name: "Marta Vidal", visitWeight: 6, spendWeight: 26, vip: false },
  { id: "maria-gomez", name: "María Gómez", visitWeight: 6, spendWeight: 22, vip: false },
  { id: "laura-sanchez", name: "Laura Sánchez", visitWeight: 5, spendWeight: 19, vip: false },
]

// ─── Builders ────────────────────────────────────────────────────────────────

function kpi(current: number, previous: number | null, spark: number[]): OverviewKpiValue {
  return { current, previous, spark }
}

interface DemoOptions {
  /**
   * When false, everything finance-flavored (earnings, revenue trend, service
   * revenue, client spend, drivers, pending payments) is withheld — used for
   * both the "no finance data" and "no finance permission" QA states.
   */
  financeVisible?: boolean
  /** When false, deltas/comparisons disappear (a business's first period). */
  withComparison?: boolean
  /** Inverts the trend into an honest "worse than last period" dataset. */
  negative?: boolean
  /**
   * Localized demo service names (product-owned sample content) from the
   * overview catalog. Defaults to the English catalog names.
   */
  serviceNames?: BeautyOverviewMessages["demo"]["serviceNames"]
}

/** The standard, fully-populated demo snapshot for a Beauty workspace. */
export function getBeautyOverviewDemoSnapshot(
  workspaceId: string,
  period: OverviewPeriod,
  options: DemoOptions = {},
): BusinessOverviewSnapshot {
  const {
    financeVisible = true,
    withComparison = true,
    negative = false,
    serviceNames = enOverview.demo.serviceNames,
  } = options
  const base = DEMO_SPECS[period.preset]

  // Negative mode swaps current/previous so the delta chips, drivers and brief
  // all flip tone from ONE coherent inversion (never hand-edited numbers).
  const spec: DemoSpec = negative
    ? {
        ...base,
        earnings: base.previousEarnings,
        previousEarnings: base.earnings,
        visits: base.previousVisits,
        previousVisits: base.visits,
        newClients: base.previousNewClients,
        previousNewClients: base.newClients,
        returningRatePrevious: Math.min(0.95, base.returningRatePrevious + 0.06),
        earningsSpark: [...base.earningsSpark].reverse(),
        visitsSpark: [...base.visitsSpark].reverse(),
        newClientsSpark: [...base.newClientsSpark].reverse(),
        returningSpark: [...base.returningSpark].reverse(),
      }
    : base

  const returningClients = spec.uniqueClients - spec.newClients
  const returningRate = returningClients / spec.uniqueClients

  // Revenue trend: real bucket layout for the period, amounts distributed so
  // they sum EXACTLY to the earnings KPI.
  const buckets = buildTrendBuckets(period)
  const amounts = distributeTotal(spec.earnings, spec.trendWeights.slice(0, buckets.length))
  const revenueTrend = financeVisible
    ? buckets.map((b, i) => ({ ...b, amount: amounts[i] ?? 0 }))
    : []

  // Services: visits sum to the visits KPI; revenue sums to the earnings KPI.
  const serviceVisits = distributeTotal(spec.visits, DEMO_SERVICES.map((s) => s.visitWeight))
  const serviceRevenue = distributeTotal(spec.earnings, DEMO_SERVICES.map((s) => s.revenueWeight))
  const topServices = withVisitShares(
    DEMO_SERVICES.map((s, i) => ({
      serviceId: `${workspaceId}:service-${s.id}`,
      name: serviceNames[s.nameKey],
      visits: serviceVisits[i] ?? 0,
      revenue: financeVisible ? serviceRevenue[i] ?? 0 : null,
    })),
    spec.visits,
  )

  // Demand: weekday visits sum to the visits KPI.
  const weekdayVisits = distributeTotal(spec.visits, DEMO_WEEKDAY_WEIGHTS)
  const days: DemandDay[] = weekdayVisits.map((visits, weekday) => ({
    weekday,
    visits,
    peak: DEMO_PEAK_WEEKDAYS.has(weekday),
  }))

  // Sources: attributed bookings + an honest unknown remainder sum to visits.
  const sourceCounts = distributeTotal(spec.visits, [
    ...DEMO_SOURCE_WEIGHTS.map((s) => s.weight),
    DEMO_UNKNOWN_WEIGHT,
  ])
  const bookingSources = normalizeBookingSources(
    DEMO_SOURCE_WEIGHTS.map((s, i) => ({ source: s.source, bookings: sourceCounts[i] ?? 0 })),
    spec.visits,
  )

  // Top clients: visits stay within the period's totals; spend shares a
  // realistic slice (~15%) of earnings, distributed by weight.
  const clientSpendPool = Math.round(spec.earnings * 0.15)
  const clientSpend = distributeTotal(clientSpendPool, DEMO_CLIENTS.map((c) => c.spendWeight))
  const scaleVisits = period.preset === "week" ? 0.35 : period.preset === "month" ? 1 : period.preset === "quarter" ? 2.4 : 6
  const topClients: ClientPerformance[] = DEMO_CLIENTS.map((c, i) => ({
    clientId: `${workspaceId}:client-${c.id}`,
    name: c.name,
    visits: Math.max(1, Math.round(c.visitWeight * scaleVisits)),
    spend: financeVisible ? clientSpend[i] ?? 0 : null,
    vip: c.vip,
  }))

  // Drivers: contributions sum EXACTLY to the earnings delta (positive or
  // negative), with honest confidence levels per source.
  const drivers = withComparison && financeVisible
    ? buildDemoDrivers(spec.earnings - spec.previousEarnings)
    : []

  const signals: OverviewSignals = {
    inactiveClients: 14,
    pendingPayments: financeVisible ? { count: 4, amount: 310 } : null,
    peakDayOccupancy: 0.92,
    quietPeriodAhead: period.preset === "month" || period.preset === "quarter",
  }

  return {
    workspaceId,
    period: withComparison ? period : stripComparison(period),
    currency: DEMO_OVERVIEW_CURRENCY,
    kpis: {
      earnings: financeVisible
        ? kpi(spec.earnings, withComparison ? spec.previousEarnings : null, spec.earningsSpark)
        : null,
      visits: kpi(spec.visits, withComparison ? spec.previousVisits : null, spec.visitsSpark),
      newClients: kpi(spec.newClients, withComparison ? spec.previousNewClients : null, spec.newClientsSpark),
      returningRate: kpi(
        returningRate,
        withComparison ? spec.returningRatePrevious : null,
        spec.returningSpark,
      ),
    },
    revenueTrend,
    drivers,
    lookingAhead: deriveLookingAhead(signals),
    topServices,
    demand: { days, peakHours: { startHour: 16, endHour: 19 } },
    clientMix: {
      uniqueClients: spec.uniqueClients,
      returningClients,
      newClients: spec.newClients,
    },
    topClients,
    bookingSources,
    signals,
    dataQuality: {
      finance: financeVisible,
      appointments: true,
      clients: true,
      services: true,
      bookingSources: true,
      comparison: withComparison,
    },
  }
}

/**
 * Demo drivers proportional to the actual earnings delta. Weights are fixed;
 * amounts come from `distributeTotal` over |delta| so the card's total always
 * matches the KPI movement. In a negative period the driver story inverts.
 */
function buildDemoDrivers(delta: number): PerformanceDriver[] {
  const magnitude = Math.abs(delta)
  if (magnitude === 0) return []

  if (delta > 0) {
    // Gross gains of delta + 116, minus a 116 drag → nets exactly `delta`.
    const drag = Math.min(116, Math.max(40, Math.round(magnitude * 0.13)))
    const gains = distributeTotal(magnitude + drag, [54, 30, 18])
    return [
      { id: "services", source: "services", amount: gains[0] ?? 0, tone: "up", confidence: "confirmed" },
      { id: "new-clients", source: "new-clients", amount: gains[1] ?? 0, tone: "up", confidence: "correlation", detail: "Instagram" },
      { id: "rebooking", source: "rebooking", amount: gains[2] ?? 0, tone: "up", confidence: "confirmed" },
      { id: "walk-ins", source: "walk-ins", amount: -drag, tone: "down", confidence: "inference" },
    ]
  }

  const gain = Math.max(40, Math.round(magnitude * 0.15))
  const losses = distributeTotal(magnitude + gain, [48, 34, 18])
  return [
    { id: "bookings", source: "bookings", amount: -(losses[0] ?? 0), tone: "down", confidence: "confirmed" },
    { id: "cancellations", source: "cancellations", amount: -(losses[1] ?? 0), tone: "down", confidence: "confirmed" },
    { id: "walk-ins", source: "walk-ins", amount: -(losses[2] ?? 0), tone: "down", confidence: "inference" },
    { id: "rebooking", source: "rebooking", amount: gain, tone: "up", confidence: "confirmed" },
  ]
}

function stripComparison(period: OverviewPeriod): OverviewPeriod {
  // Comparison dates stay resolvable (types require them) but dataQuality
  // marks them unusable; the UI checks `dataQuality.comparison`.
  return { ...period }
}

// ─── QA variants ─────────────────────────────────────────────────────────────

/** A workspace with no business data at all — every section renders empty. */
export function getEmptyOverviewSnapshot(
  workspaceId: string,
  period: OverviewPeriod,
): BusinessOverviewSnapshot {
  return {
    workspaceId,
    period,
    currency: DEMO_OVERVIEW_CURRENCY,
    kpis: null,
    revenueTrend: [],
    drivers: [],
    lookingAhead: null,
    topServices: [],
    demand: null,
    clientMix: null,
    topClients: [],
    bookingSources: [],
    signals: {
      inactiveClients: null,
      pendingPayments: null,
      peakDayOccupancy: null,
      quietPeriodAhead: null,
    },
    dataQuality: {
      finance: false,
      appointments: false,
      clients: false,
      services: false,
      bookingSources: false,
      comparison: false,
    },
  }
}

/** Appointments + clients exist, finance does not (or is not permitted). */
export function getPartialOverviewSnapshot(
  workspaceId: string,
  period: OverviewPeriod,
  options: Pick<DemoOptions, "serviceNames"> = {},
): BusinessOverviewSnapshot {
  return getBeautyOverviewDemoSnapshot(workspaceId, period, { ...options, financeVisible: false })
}

/** First period in business — no comparison baseline anywhere. */
export function getFirstPeriodOverviewSnapshot(
  workspaceId: string,
  period: OverviewPeriod,
  options: Pick<DemoOptions, "serviceNames"> = {},
): BusinessOverviewSnapshot {
  return getBeautyOverviewDemoSnapshot(workspaceId, period, { ...options, withComparison: false })
}

/** A worse-than-last-period dataset — negative deltas, inverted drivers. */
export function getNegativeOverviewSnapshot(
  workspaceId: string,
  period: OverviewPeriod,
  options: Pick<DemoOptions, "serviceNames"> = {},
): BusinessOverviewSnapshot {
  return getBeautyOverviewDemoSnapshot(workspaceId, period, { ...options, negative: true })
}
