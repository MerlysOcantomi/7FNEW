"use client"

import { Sparkles } from "lucide-react"
import type { FormatLocale } from "@core/i18n/format"
import { fromIsoDate } from "@modules/overview/period"
import type { BeautyOverviewMessages } from "@modules/overview/i18n"
import type { OverviewPeriod } from "@modules/overview/types"
import { CARD_CLASS, formatDateParts } from "./overview-ui"

/**
 * Finesse business brief + period card row. The brief text is GENERATED from
 * the snapshot (see `buildBeautyOverviewBrief`) so it can never contradict the
 * metrics; `null` means there is nothing honest to summarize and the caller
 * renders the page empty state instead.
 */
export function FinesseBriefRow({
  config,
  brief,
  period,
  locale,
  hasComparison,
}: {
  config: BeautyOverviewMessages
  brief: string | null
  period: OverviewPeriod
  locale: FormatLocale
  hasComparison: boolean
}) {
  return (
    <div className="flex flex-col items-stretch gap-4 sm:flex-row">
      {brief ? (
        <div
          className="flex flex-1 items-center gap-3.5 rounded-[18px] border p-4"
          style={{
            borderColor: "color-mix(in srgb, var(--inbox-info) 28%, transparent)",
            background:
              "linear-gradient(150deg, var(--inbox-info-soft, color-mix(in srgb, var(--inbox-info) 10%, transparent)), var(--app-surface-dark) 60%)",
          }}
        >
          <span
            aria-hidden="true"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white"
            style={{ background: "var(--inbox-info)" }}
          >
            <Sparkles size={16} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="mb-0.5 flex items-baseline gap-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-[var(--text-primary-light)]">
                {config.brief.agentName}
              </span>
              <span className="text-[9.5px] text-[var(--text-tertiary-light)]">{config.brief.tagline}</span>
            </p>
            <p className="text-[12.5px] leading-relaxed text-[var(--text-primary-light)]">{brief}</p>
          </div>
        </div>
      ) : null}

      <PeriodCard config={config} period={period} locale={locale} hasComparison={hasComparison} />
    </div>
  )
}

/** Active date range: period name + start/end. Updates with the selector. */
function PeriodCard({
  config,
  period,
  locale,
  hasComparison,
}: {
  config: BeautyOverviewMessages
  period: OverviewPeriod
  locale: FormatLocale
  hasComparison: boolean
}) {
  const start = fromIsoDate(period.start)
  const end = fromIsoDate(period.end)
  const rangeLabel = `${formatDateParts(start, { locale, day: "numeric", month: "short" })} – ${formatDateParts(
    end,
    { locale, day: "numeric", month: "short", year: "numeric" },
  )}`

  // Human period name derived from the real range (never a hardcoded month).
  const periodName =
    period.preset === "month"
      ? formatDateParts(start, { locale, month: "long", year: "numeric" })
      : period.preset === "year"
        ? formatDateParts(start, { locale, year: "numeric" })
        : config.header.periodLabels[period.preset]

  return (
    <div className={`${CARD_CLASS} flex w-full shrink-0 flex-col justify-center px-4 py-3.5 sm:w-[190px]`}>
      <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-[var(--text-tertiary-light)]">
        {config.periodCard.eyebrow}
      </p>
      <p className="mt-1 text-[15px] font-semibold capitalize leading-tight text-[var(--text-primary-light)]">
        {periodName}
      </p>
      <p className="mt-0.5 font-mono text-[11px] text-[var(--text-secondary-light)]">{rangeLabel}</p>
      {!hasComparison ? (
        <p className="mt-1 text-[10px] font-medium text-[var(--inbox-lead)]">
          {config.periodCard.noComparisonNote}
        </p>
      ) : null}
    </div>
  )
}
