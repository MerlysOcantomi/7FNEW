"use client"

import { formatCurrency, type FormatLocale } from "@core/i18n/format"
import { compareKpi, sumRevenueTrend } from "@modules/overview/derive"
import { fromIsoDate } from "@modules/overview/period"
import type { BeautyOverviewMessages } from "@modules/overview/i18n"
import type { OverviewKpiValue, RevenuePoint } from "@modules/overview/types"
import {
  CARD_CLASS,
  CARD_HINT_CLASS,
  CARD_TITLE_CLASS,
  CHART_BAR_MUTED,
  CHART_BAR_PRIMARY,
  formatCurrencyCompact,
  formatDateParts,
} from "./overview-ui"

/**
 * "Lo que ganaste" — lightweight CSS bar chart (no chart library). Buckets come
 * pre-aggregated from the snapshot (days/weeks/months per preset) so the chart
 * and the earnings KPI can never disagree. Accessible summary text carries the
 * numbers; bars are decorative.
 */
export function RevenueTrendCard({
  config,
  trend,
  earnings,
  locale,
  currency,
}: {
  config: BeautyOverviewMessages
  trend: RevenuePoint[]
  earnings: OverviewKpiValue | null
  locale: FormatLocale
  currency: string
}) {
  if (trend.length === 0) {
    return (
      <section aria-label={config.revenue.title} className={`${CARD_CLASS} p-5`}>
        <h3 className={CARD_TITLE_CLASS}>{config.revenue.title}</h3>
        <div className="mt-4 rounded-xl border border-dashed border-[var(--border-dark)] p-5 text-center">
          <p className="text-[13px] font-medium text-[var(--text-primary-light)]">
            {config.revenue.empty.title}
          </p>
          <p className="mt-1 text-[11.5px] text-[var(--text-secondary-light)]">
            {config.revenue.empty.description}
          </p>
        </div>
      </section>
    )
  }

  const total = sumRevenueTrend(trend)
  const max = Math.max(...trend.map((p) => p.amount), 1)
  const bucket = trend[0].bucket
  const cmp = earnings ? compareKpi(earnings) : null
  const deltaAbs = cmp?.deltaAbsolute

  const chartSummary = trend
    .map((p) => `${bucketLabel(p, locale, config)}: ${formatCurrency(p.amount, { locale, currency })}`)
    .join(", ")

  return (
    <section aria-label={config.revenue.title} className={`${CARD_CLASS} p-5`}>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className={CARD_TITLE_CLASS}>{config.revenue.title}</h3>
          <p className={`mt-0.5 ${CARD_HINT_CLASS}`}>{config.revenue.subtitle[bucket]}</p>
        </div>
        <div className="text-right">
          <p className="text-[19px] font-semibold leading-none tracking-tight text-[var(--text-primary-light)]">
            {formatCurrency(total, { locale, currency })}
          </p>
          {deltaAbs != null && deltaAbs !== 0 ? (
            <p
              className="mt-1 text-[11px] font-semibold"
              style={{
                color: deltaAbs > 0 ? "var(--inbox-success)" : "var(--inbox-urgency)",
              }}
            >
              {formatCurrency(Math.abs(deltaAbs), { locale, currency })}{" "}
              {deltaAbs > 0 ? config.revenue.moreSuffix : config.revenue.lessSuffix}
            </p>
          ) : deltaAbs === 0 ? (
            <p className="mt-1 text-[11px] text-[var(--text-tertiary-light)]">{config.revenue.sameNote}</p>
          ) : null}
        </div>
      </div>

      <div role="img" aria-label={`${config.revenue.title}. ${chartSummary}`}>
        <div aria-hidden="true" className="relative flex h-36 items-end gap-2 sm:gap-3">
          {/* Dashed guide lines */}
          <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className="border-t border-dashed border-[var(--border-dark)] opacity-60" />
            ))}
          </div>
          {trend.map((p, i) => {
            const last = i === trend.length - 1
            return (
              <div key={p.start} className="relative z-[1] flex h-full min-w-0 flex-1 flex-col items-center justify-end">
                {/* Amount labels collide below ~5 buckets width on phones; show from sm up, and always on ≤4 buckets. */}
                <span
                  className={`mb-1 font-mono text-[10px] font-semibold text-[var(--accent-on-dark)] ${
                    trend.length > 4 ? "hidden sm:block" : ""
                  }`}
                >
                  {formatCurrencyCompact(p.amount, { locale, currency })}
                </span>
                <div
                  className="w-full max-w-[56px] rounded-t-lg rounded-b-[4px]"
                  style={{
                    height: `${Math.max(4, (p.amount / max) * 100)}%`,
                    background: last ? CHART_BAR_PRIMARY : CHART_BAR_MUTED,
                  }}
                />
              </div>
            )
          })}
        </div>
        <div aria-hidden="true" className="mt-1.5 flex gap-2 sm:gap-3">
          {trend.map((p) => (
            <span
              key={p.start}
              className="min-w-0 flex-1 truncate text-center text-[10px] text-[var(--text-tertiary-light)]"
            >
              {bucketLabel(p, locale, config)}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

function bucketLabel(
  point: RevenuePoint,
  locale: FormatLocale,
  config: BeautyOverviewMessages,
): string {
  const date = fromIsoDate(point.start)
  switch (point.bucket) {
    case "day":
      return formatDateParts(date, { locale, weekday: "short" })
    case "week":
      return `${config.revenue.weekPrefix} ${point.index}`
    case "month":
      return formatDateParts(date, { locale, month: "short" })
  }
}
