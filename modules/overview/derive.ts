/**
 * My Salon — pure derivations over the business-overview snapshot.
 *
 * Every section of the page reads numbers derived HERE (deltas, shares,
 * recommendation signals, brief facts), so the Finesse summary, the KPI cards
 * and the detail sections can never disagree with each other: one snapshot in,
 * consistent derivations out. No React, no DB, no clock — mirrors
 * `modules/marketing/state.ts`.
 */

import type {
  BookingSourcePerformance,
  BookingSourceKind,
  BusinessOverviewSnapshot,
  BusinessRecommendation,
  ClientMix,
  DemandPattern,
  LookingAheadNote,
  OverviewKpiValue,
  OverviewSignals,
  PerformanceDriver,
  RevenuePoint,
  ServicePerformance,
} from "./types"

// ─── Comparisons ─────────────────────────────────────────────────────────────

export type ComparisonTone = "up" | "down" | "flat"

export interface KpiComparison {
  /** (current − previous) / previous, or `null` when no baseline exists. */
  deltaRatio: number | null
  /** Absolute difference, or `null` when no baseline exists. */
  deltaAbsolute: number | null
  tone: ComparisonTone
}

/** Movements below ±0.5% read as "flat" — a 0.2% delta is noise, not a trend. */
const FLAT_THRESHOLD = 0.005

/**
 * Compare a KPI against its previous period. Total: `null` KPI or missing
 * baseline → honest `null` deltas with a flat tone (the UI hides the chip).
 * A zero baseline with a positive current is "up" but has no computable ratio.
 */
export function compareKpi(kpi: OverviewKpiValue | null | undefined): KpiComparison {
  if (!kpi || kpi.previous === null) {
    return { deltaRatio: null, deltaAbsolute: null, tone: "flat" }
  }
  const deltaAbsolute = kpi.current - kpi.previous
  if (kpi.previous === 0) {
    return {
      deltaRatio: null,
      deltaAbsolute,
      tone: deltaAbsolute > 0 ? "up" : deltaAbsolute < 0 ? "down" : "flat",
    }
  }
  const deltaRatio = deltaAbsolute / kpi.previous
  const tone: ComparisonTone =
    deltaRatio >= FLAT_THRESHOLD ? "up" : deltaRatio <= -FLAT_THRESHOLD ? "down" : "flat"
  return { deltaRatio, deltaAbsolute, tone }
}

// ─── Integer apportionment ───────────────────────────────────────────────────

/**
 * Split `total` into integer parts proportional to `weights` (largest-remainder
 * method), guaranteeing `sum(parts) === total`. This is how the demo adapter
 * keeps every breakdown (trend buckets, services, weekdays, sources) summing
 * EXACTLY to its KPI — coherence by construction, not by hand-tuned numbers.
 */
export function distributeTotal(total: number, weights: number[]): number[] {
  if (weights.length === 0) return []
  const weightSum = weights.reduce((acc, w) => acc + Math.max(0, w), 0)
  if (weightSum <= 0 || total <= 0) return weights.map(() => 0)

  const exact = weights.map((w) => (Math.max(0, w) / weightSum) * total)
  const floors = exact.map((x) => Math.floor(x))
  let remainder = total - floors.reduce((acc, x) => acc + x, 0)

  // Hand out the leftover units to the largest fractional parts first.
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i)
  const parts = [...floors]
  for (const { i } of order) {
    if (remainder <= 0) break
    parts[i] += 1
    remainder -= 1
  }
  return parts
}

// ─── Section math ────────────────────────────────────────────────────────────

export function sumRevenueTrend(points: RevenuePoint[]): number {
  return points.reduce((acc, p) => acc + p.amount, 0)
}

export function sumDrivers(drivers: PerformanceDriver[]): number {
  return drivers.reduce((acc, d) => acc + d.amount, 0)
}

/** Visit share for each service against the period's completed visits. */
export function withVisitShares(
  services: Omit<ServicePerformance, "visitShare">[],
  totalVisits: number,
): ServicePerformance[] {
  return services.map((s) => ({
    ...s,
    visitShare: totalVisits > 0 ? s.visits / totalVisits : 0,
  }))
}

export interface ClientMixShares {
  returningShare: number
  newShare: number
}

/** 0..1 shares of UNIQUE clients. Total of 0 clients → both shares 0. */
export function clientMixShares(mix: ClientMix | null): ClientMixShares {
  if (!mix || mix.uniqueClients <= 0) return { returningShare: 0, newShare: 0 }
  const returningShare = mix.returningClients / mix.uniqueClients
  return { returningShare, newShare: 1 - returningShare }
}

/**
 * Booking sources from raw attribution counts. Unattributed bookings become an
 * explicit `unknown` row (never silently dropped) and shares always sum to 1
 * across the returned rows. Sorted by volume, `unknown` last.
 */
export function normalizeBookingSources(
  attributed: Array<{ source: Exclude<BookingSourceKind, "unknown">; bookings: number }>,
  totalBookings: number,
): BookingSourcePerformance[] {
  const attributedSum = attributed.reduce((acc, s) => acc + Math.max(0, s.bookings), 0)
  const total = Math.max(totalBookings, attributedSum)
  if (total <= 0) return []

  const rows: BookingSourcePerformance[] = attributed
    .filter((s) => s.bookings > 0)
    .sort((a, b) => b.bookings - a.bookings)
    .map((s) => ({ source: s.source, bookings: s.bookings, share: s.bookings / total }))

  const unknown = total - attributedSum
  if (unknown > 0) {
    rows.push({ source: "unknown", bookings: unknown, share: unknown / total })
  }
  return rows
}

// ─── Recommendations (derived from signals, never hardcoded) ─────────────────

/** Fiona suggests reactivation from this many inactive clients up. */
const REACTIVATION_MIN_CLIENTS = 5
/** Fanny flags availability when the busiest day is at or above this occupancy. */
const AVAILABILITY_MIN_OCCUPANCY = 0.85

/**
 * Derive the recommendation list from the snapshot's own signals. Each entry
 * exists ONLY when its signal supports it, so the card can never contradict
 * the data. Routes are existing 7F routes (see `nav-profile.ts` rule).
 */
export function deriveRecommendations(
  signals: OverviewSignals,
): BusinessRecommendation[] {
  const recs: BusinessRecommendation[] = []

  if (signals.inactiveClients !== null && signals.inactiveClients >= REACTIVATION_MIN_CLIENTS) {
    recs.push({
      id: "reactivation",
      agent: "fiona",
      kind: "reactivation",
      value: signals.inactiveClients,
      actionHref: "/contenido",
    })
  }

  if (signals.pendingPayments !== null && signals.pendingPayments.count > 0) {
    recs.push({
      id: "pending-payments",
      agent: "felix",
      kind: "pending-payments",
      value: signals.pendingPayments.amount,
      actionHref: "/facturacion",
    })
  }

  if (
    signals.peakDayOccupancy !== null &&
    signals.peakDayOccupancy >= AVAILABILITY_MIN_OCCUPANCY
  ) {
    recs.push({
      id: "availability",
      agent: "fanny",
      kind: "availability",
      value: Math.round(signals.peakDayOccupancy * 100),
      actionHref: "/calendario",
    })
  }

  return recs
}

/**
 * Forward-looking note, also signal-derived. Priority: a known quiet period
 * ahead (act now) beats a nearly-full peak day (optimize). `null` when no
 * signal supports a forecast — the UI simply hides the block.
 */
export function deriveLookingAhead(signals: OverviewSignals): LookingAheadNote | null {
  if (signals.quietPeriodAhead === true) {
    return { kind: "quiet-period", actionHref: "/contenido" }
  }
  if (
    signals.peakDayOccupancy !== null &&
    signals.peakDayOccupancy >= AVAILABILITY_MIN_OCCUPANCY
  ) {
    return { kind: "peak-nearly-full", actionHref: "/calendario" }
  }
  return null
}

// ─── Brief facts (inputs for the Finesse summary) ────────────────────────────

/**
 * The typed facts the Finesse business brief is written from. The config
 * module turns these into a Spanish sentence; because facts come from the SAME
 * snapshot as every card, the summary can never contradict the metrics.
 * Every field is `null`-safe so a partial snapshot yields a partial brief.
 */
export interface OverviewBriefFacts {
  earnings: KpiComparison | null
  topServiceName: string | null
  secondServiceName: string | null
  returningRate: number | null
  /** ISO weekday 0=Mon…6=Sun of the busiest day, when demand data exists. */
  peakWeekday: number | null
  peakNearlyFull: boolean
  hasAnyData: boolean
}

export function deriveBriefFacts(snapshot: BusinessOverviewSnapshot): OverviewBriefFacts {
  const { kpis, topServices, demand, signals } = snapshot

  const peak = findPeakDay(demand)
  const hasAnyData =
    kpis !== null ||
    topServices.length > 0 ||
    snapshot.revenueTrend.length > 0 ||
    snapshot.clientMix !== null

  return {
    earnings: kpis?.earnings ? compareKpi(kpis.earnings) : null,
    topServiceName: topServices[0]?.name ?? null,
    secondServiceName: topServices[1]?.name ?? null,
    returningRate: kpis?.returningRate ? kpis.returningRate.current : null,
    peakWeekday: peak?.weekday ?? null,
    peakNearlyFull:
      signals.peakDayOccupancy !== null &&
      signals.peakDayOccupancy >= AVAILABILITY_MIN_OCCUPANCY,
    hasAnyData,
  }
}

function findPeakDay(demand: DemandPattern | null): { weekday: number; visits: number } | null {
  if (!demand || demand.days.length === 0) return null
  return demand.days.reduce(
    (best, d) => (best === null || d.visits > best.visits ? { weekday: d.weekday, visits: d.visits } : best),
    null as { weekday: number; visits: number } | null,
  )
}
