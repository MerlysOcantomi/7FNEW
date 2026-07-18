/**
 * My Salon — period resolution (pure date math, no clock reads).
 *
 * Given an explicit reference date and a preset, resolves the LOCAL calendar
 * range plus the previous equivalent range used for comparisons. Dates are
 * encoded as `yyyy-mm-dd` so no timezone conversion happens on the wire
 * (mirrors the "explicit now" rule of `core/i18n/format.ts`).
 *
 * Conventions (Spain-first product):
 *   - Weeks run Monday → Sunday.
 *   - Month/quarter/year are calendar-aligned.
 *   - Comparison is the PREVIOUS equivalent period (last week, last month,
 *     last quarter, last year) — never a rolling window.
 */

import type { OverviewPeriod, OverviewPeriodPreset, RevenuePoint } from "./types"

// ─── Date helpers (local calendar, no Date parsing of yyyy-mm-dd strings) ────

/** Formats a local Date as `yyyy-mm-dd`. */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/**
 * Parses `yyyy-mm-dd` into a LOCAL Date at midnight. Never use `new Date(iso)`
 * for these strings — that parses as UTC and shifts the day in negative-offset
 * timezones.
 */
export function fromIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days)
}

/** Monday of the ISO week containing `d`. */
function startOfIsoWeek(d: Date): Date {
  const weekday = (d.getDay() + 6) % 7 // 0 = Monday … 6 = Sunday
  return addDays(d, -weekday)
}

// ─── Period resolution ───────────────────────────────────────────────────────

/**
 * Resolve the calendar range + previous equivalent range for a preset around
 * an explicit reference date. Pure and total — any `Date` in, ranges out.
 */
export function resolveOverviewPeriod(
  preset: OverviewPeriodPreset,
  reference: Date,
): OverviewPeriod {
  const y = reference.getFullYear()
  const m = reference.getMonth()

  let start: Date
  let end: Date
  let comparisonStart: Date
  let comparisonEnd: Date

  switch (preset) {
    case "week": {
      start = startOfIsoWeek(reference)
      end = addDays(start, 6)
      comparisonStart = addDays(start, -7)
      comparisonEnd = addDays(start, -1)
      break
    }
    case "month": {
      start = new Date(y, m, 1)
      end = new Date(y, m + 1, 0)
      comparisonStart = new Date(y, m - 1, 1)
      comparisonEnd = new Date(y, m, 0)
      break
    }
    case "quarter": {
      const qStartMonth = Math.floor(m / 3) * 3
      start = new Date(y, qStartMonth, 1)
      end = new Date(y, qStartMonth + 3, 0)
      comparisonStart = new Date(y, qStartMonth - 3, 1)
      comparisonEnd = new Date(y, qStartMonth, 0)
      break
    }
    case "year": {
      start = new Date(y, 0, 1)
      end = new Date(y, 11, 31)
      comparisonStart = new Date(y - 1, 0, 1)
      comparisonEnd = new Date(y - 1, 11, 31)
      break
    }
  }

  return {
    preset,
    start: toIsoDate(start),
    end: toIsoDate(end),
    comparisonStart: toIsoDate(comparisonStart),
    comparisonEnd: toIsoDate(comparisonEnd),
  }
}

// ─── Trend buckets ───────────────────────────────────────────────────────────

/**
 * The empty aggregation buckets for a period's revenue trend:
 *   week    → 7 daily buckets
 *   month   → calendar-week buckets (1–7, 8–14, 15–21, 22–end … max 5)
 *   quarter → 3 month buckets
 *   year    → 12 month buckets
 *
 * Returned points carry `amount: 0`; adapters fill amounts. Keeping bucket
 * layout here means the demo adapter and the future Prisma adapter can never
 * disagree with the chart about granularity.
 */
export function buildTrendBuckets(period: OverviewPeriod): RevenuePoint[] {
  const start = fromIsoDate(period.start)
  const end = fromIsoDate(period.end)

  if (period.preset === "week") {
    return Array.from({ length: 7 }, (_, i) => ({
      start: toIsoDate(addDays(start, i)),
      bucket: "day" as const,
      index: i + 1,
      amount: 0,
    }))
  }

  if (period.preset === "month") {
    const points: RevenuePoint[] = []
    let cursor = start
    let index = 1
    while (cursor.getTime() <= end.getTime()) {
      points.push({ start: toIsoDate(cursor), bucket: "week", index, amount: 0 })
      cursor = addDays(cursor, 7)
      index += 1
    }
    // Cap at "1–7 / 8–14 / 15–21 / 22–end": merge a trailing 29–31 stub into week 4.
    if (points.length > 4) points.length = 4
    return points
  }

  const monthCount = period.preset === "quarter" ? 3 : 12
  return Array.from({ length: monthCount }, (_, i) => {
    const monthStart = new Date(start.getFullYear(), start.getMonth() + i, 1)
    return { start: toIsoDate(monthStart), bucket: "month" as const, index: i + 1, amount: 0 }
  })
}
