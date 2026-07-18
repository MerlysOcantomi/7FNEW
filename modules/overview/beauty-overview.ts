/**
 * Beauty "Mi salón" — vertical activation + localized copy builders for the
 * Finesse business overview.
 *
 * Mirrors `modules/marketing/beauty-marketing.ts`: pure and DB-free. The
 * vertical gate resolves entirely from `verticalKey` (covering aliases
 * salon/nails/… via the business type), so `/` keeps its generic core
 * overview untouched for everyone else. All visible copy lives in the
 * localized catalogs under `modules/overview/i18n` (English canonical,
 * Spanish complete), resolved from the effective `useI18n()` locale.
 *
 * DATA HONESTY: no overview backend exists yet (no Appointment/Service/Payment
 * models), so the surface runs on the isolated demo adapter (`demo-data.ts`)
 * and ALWAYS shows the localized "Preview · sample data" chip. The Finesse
 * brief and every card are generated from ONE snapshot (see `derive.ts`) so
 * the summary can never contradict the metrics.
 *
 * Activation note: like Finesse Marketing (and unlike the appointment Today),
 * this surface activates for real Beauty workspaces — it is the designed
 * business overview for the vertical, its demo layer is always labeled with
 * the preview chip, and nothing on the page mutates business data.
 */

import { mapVerticalKeyToBusinessType } from "@core/personalization"
import { formatCurrency, formatPercent, type FormatLocale } from "@core/i18n/format"
import type { OverviewBriefFacts } from "./derive"
import type { BusinessRecommendation, PerformanceDriver } from "./types"
import type { BeautyOverviewMessages } from "./i18n/types"

/** True when the vertical (or its salon/nails/… aliases) is a beauty workspace. */
export function isBeautyOverviewVertical(verticalKey: string | null | undefined): boolean {
  if (!verticalKey) return false
  return mapVerticalKeyToBusinessType(verticalKey) === "beauty"
}

// ─── Driver copy ─────────────────────────────────────────────────────────────

/**
 * Localized label for a performance driver. Templates may carry a `{detail}`
 * placeholder (e.g. the attribution channel) filled from the driver itself —
 * the detail is data (e.g. "Instagram") and is never translated.
 */
export function buildDriverLabel(
  driver: PerformanceDriver,
  messages: BeautyOverviewMessages,
): string {
  const template = messages.drivers.sourceLabels[driver.source]
  return template.replace("{detail}", driver.detail ?? messages.drivers.detailFallback)
}

// ─── Recommendation copy (from derived, data-backed recommendations) ─────────

/**
 * Localized sentence for a derived recommendation. Numbers come from the
 * recommendation's own `value` (which `deriveRecommendations` took from the
 * snapshot signals), so the card text always matches the data; money is
 * formatted through the central regional formatters.
 */
export function buildRecommendationText(
  rec: BusinessRecommendation,
  {
    messages,
    locale,
    currency,
  }: { messages: BeautyOverviewMessages; locale: FormatLocale; currency: string },
): string {
  const t = messages.recommendations.texts
  switch (rec.kind) {
    case "reactivation":
      return t.reactivation(rec.value)
    case "pending-payments":
      return t.pendingPayments(formatCurrency(rec.value, { locale, currency }))
    case "availability":
      return t.availability(rec.value)
    case "quiet-period":
      return t.quietPeriod
  }
}

// ─── Finesse brief (generated from snapshot facts, never hardcoded) ──────────

/**
 * Assemble the Finesse business brief from derived facts, in the catalog's
 * language. Only states what the snapshot supports: no earnings data → no
 * earnings clause; no retention data → no retention clause. Returns `null`
 * when there is nothing to summarize (the UI then shows the empty-page state
 * instead of an invented summary).
 */
export function buildBeautyOverviewBrief(
  facts: OverviewBriefFacts,
  { messages, locale }: { messages: BeautyOverviewMessages; locale: FormatLocale },
): string | null {
  if (!facts.hasAnyData) return null

  const t = messages.brief
  const parts: string[] = []

  if (facts.earnings && facts.earnings.deltaRatio !== null) {
    const pct = formatPercent(Math.abs(facts.earnings.deltaRatio), { locale })
    if (facts.earnings.tone === "up") {
      parts.push(t.earningsUp(pct, facts.topServiceName))
    } else if (facts.earnings.tone === "down") {
      parts.push(t.earningsDown(pct))
    } else {
      parts.push(t.earningsFlat)
    }
  } else if (facts.topServiceName) {
    parts.push(t.topServiceOnly(facts.topServiceName))
  }

  if (facts.peakNearlyFull) {
    parts.push(t.peakNearlyFull)
  }

  if (facts.returningRate !== null) {
    const pct = formatPercent(facts.returningRate, { locale })
    parts.push(t.returningRate(pct))
  }

  return parts.length > 0 ? parts.join(" ") : null
}
