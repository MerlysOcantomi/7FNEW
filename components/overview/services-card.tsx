"use client"

import { TrendingUp } from "lucide-react"
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  type FormatLocale,
} from "@core/i18n/format"
import type { BeautyOverviewConfig } from "@modules/overview/beauty-overview"
import type { ServicePerformance } from "@modules/overview/types"
import {
  CARD_CLASS,
  CARD_HINT_CLASS,
  CARD_TITLE_CLASS,
  CHART_TRACK,
  CHIP_CLASS,
} from "./overview-ui"

/**
 * "Lo que más aman tus clientas" — ranked services with visits, revenue and a
 * comparative bar (share of visits). Handles archived services, missing
 * revenue (no finance data) and fewer than five services. Rows are not links:
 * there is no per-service detail surface yet, so nothing pretends to navigate.
 */
export function TopServicesCard({
  config,
  services,
  totalVisits,
  locale,
  currency,
}: {
  config: BeautyOverviewConfig
  services: ServicePerformance[]
  totalVisits: number | null
  locale: FormatLocale
  currency: string
}) {
  return (
    <section aria-label={config.services.title} className={`${CARD_CLASS} p-5`}>
      <div className="mb-4 flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
          style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
        >
          <TrendingUp size={15} strokeWidth={2} />
        </span>
        <div className="min-w-0">
          <h3 className={CARD_TITLE_CLASS}>{config.services.title}</h3>
          {totalVisits != null && totalVisits > 0 ? (
            <p className={CARD_HINT_CLASS}>
              {config.services.hintPrefix} {formatNumber(totalVisits, { locale })}{" "}
              {config.services.hintSuffix}
            </p>
          ) : null}
        </div>
      </div>

      {services.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--border-dark)] p-5 text-center">
          <p className="text-[13px] font-medium text-[var(--text-primary-light)]">
            {config.services.empty.title}
          </p>
          <p className="mt-1 text-[11.5px] text-[var(--text-secondary-light)]">
            {config.services.empty.description}
          </p>
        </div>
      ) : (
        <ol className="flex flex-col gap-3.5" role="list">
          {services.map((s, i) => (
            <li key={s.serviceId}>
              <div className="mb-1.5 flex items-center gap-2.5">
                <span
                  aria-hidden="true"
                  className="grid h-5 w-5 shrink-0 place-items-center rounded-md text-[10.5px] font-bold"
                  style={
                    i === 0
                      ? { background: "var(--accent-primary)", color: "#fff" }
                      : { background: "var(--accent-muted)", color: "var(--accent-on-dark)" }
                  }
                >
                  {i + 1}
                </span>
                <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--text-primary-light)]">
                  {s.name}
                  {s.archived ? (
                    <span
                      className={`${CHIP_CLASS} ml-2 align-middle`}
                      style={{
                        color: "var(--text-tertiary-light)",
                        background: "var(--app-surface-subtle)",
                        borderColor: "var(--border-dark)",
                      }}
                    >
                      {config.services.archivedLabel}
                    </span>
                  ) : null}
                </p>
                <span className="hidden shrink-0 font-mono text-[11px] text-[var(--text-secondary-light)] sm:inline">
                  {formatNumber(s.visits, { locale })}×
                  {s.revenue != null ? ` · ${formatCurrency(s.revenue, { locale, currency })}` : ""}
                </span>
                <span className="w-10 shrink-0 text-right font-mono text-[12px] font-semibold text-[var(--accent-on-dark)]">
                  {formatPercent(s.visitShare, { locale })}
                </span>
              </div>
              <div
                aria-hidden="true"
                className="h-2 overflow-hidden rounded-full"
                style={{ background: CHART_TRACK }}
              >
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(4, s.visitShare * 100)}%`,
                    background:
                      i === 0
                        ? "linear-gradient(90deg, color-mix(in srgb, var(--accent-primary) 65%, transparent), var(--accent-primary))"
                        : "color-mix(in srgb, var(--accent-primary) 40%, var(--app-surface-dark-elevated))",
                  }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
