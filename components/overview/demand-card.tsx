"use client"

import Link from "next/link"
import { ArrowRight, Clock } from "lucide-react"
import { formatNumber, type FormatLocale } from "@core/i18n/format"
import type { BeautyOverviewMessages } from "@modules/overview/i18n"
import type { DemandPattern } from "@modules/overview/types"
import { BTN_FOCUS, CARD_CLASS, CARD_HINT_CLASS, CARD_TITLE_CLASS } from "./overview-ui"

/**
 * "Tus días más ocupados" — visits by weekday with peak days highlighted.
 * The hour range renders ONLY when the snapshot actually carries `peakHours`
 * (never invented), and the CTA maps to the real agenda route.
 */
export function BusiestTimesCard({
  config,
  demand,
  locale,
}: {
  config: BeautyOverviewMessages
  demand: DemandPattern | null
  locale: FormatLocale
}) {
  return (
    <section aria-label={config.demand.title} className={`${CARD_CLASS} p-5`}>
      <div className="mb-4 flex items-baseline gap-2.5">
        <h3 className={CARD_TITLE_CLASS}>{config.demand.title}</h3>
        <span className={CARD_HINT_CLASS}>{config.demand.hint}</span>
      </div>

      {!demand || demand.days.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-dark)] p-5 text-center text-[12px] text-[var(--text-secondary-light)]">
          {config.demand.empty}
        </p>
      ) : (
        <DemandBody config={config} demand={demand} locale={locale} />
      )}
    </section>
  )
}

function DemandBody({
  config,
  demand,
  locale,
}: {
  config: BeautyOverviewMessages
  demand: DemandPattern
  locale: FormatLocale
}) {
  const max = Math.max(...demand.days.map((d) => d.visits), 1)
  const peakDays = demand.days.filter((d) => d.peak)
  const summary = demand.days
    .map(
      (d) =>
        `${config.demand.weekdaysLong[d.weekday]}: ${formatNumber(d.visits, { locale })}`,
    )
    .join(", ")

  const peakLabel = peakDays.map((d) => config.demand.weekdaysLong[d.weekday]).join(config.demand.peakJoiner)
  const hours = demand.peakHours

  return (
    <>
      <div role="img" aria-label={`${config.demand.title}. ${summary}`}>
        <div aria-hidden="true" className="flex h-24 items-end gap-2 sm:gap-2.5">
          {demand.days.map((d) => (
            <div key={d.weekday} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
              <div
                className="w-full rounded-t-md rounded-b-[3px]"
                style={{
                  height: `${Math.max(6, (d.visits / max) * 100)}%`,
                  background: d.peak
                    ? "var(--accent-primary)"
                    : "color-mix(in srgb, var(--accent-primary) 24%, var(--app-surface-dark-elevated))",
                }}
              />
              <span
                className="text-[10px] font-semibold"
                style={{
                  color: d.peak ? "var(--accent-on-dark)" : "var(--text-tertiary-light)",
                }}
              >
                {config.demand.weekdays[d.weekday]}
              </span>
            </div>
          ))}
        </div>
      </div>

      {peakDays.length > 0 ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[var(--border-dark)] pt-3.5">
          <Clock size={13} strokeWidth={2} aria-hidden="true" className="shrink-0 text-[var(--accent-on-dark)]" />
          <p className="min-w-0 flex-1 text-[11.5px] text-[var(--text-secondary-light)]">
            {config.demand.peakLead}{" "}
            <strong className="text-[var(--text-primary-light)]">
              {peakLabel}
              {hours ? `, ${hours.startHour}:00–${hours.endHour}:00` : ""}
            </strong>
          </p>
          <Link
            href="/calendario"
            className={`inline-flex shrink-0 items-center gap-1 rounded-lg text-[11.5px] font-semibold text-[var(--accent-on-dark)] transition-colors hover:text-[var(--accent-primary)] ${BTN_FOCUS}`}
          >
            {config.demand.actionLabel}
            <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
          </Link>
        </div>
      ) : null}
    </>
  )
}
