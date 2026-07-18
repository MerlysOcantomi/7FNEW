"use client"

import Link from "next/link"
import { Banknote, CalendarDays, Repeat, UserPlus, type LucideIcon } from "lucide-react"
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  type FormatLocale,
} from "@core/i18n/format"
import { compareKpi } from "@modules/overview/derive"
import type { BeautyOverviewMessages } from "@modules/overview/i18n"
import type { OverviewKpiValue, OverviewKpis, OverviewPeriodPreset } from "@modules/overview/types"
import { BTN_FOCUS, CARD_CLASS, TONE_GLYPH, TONE_STYLES } from "./overview-ui"

interface KpiDescriptor {
  id: keyof OverviewKpis
  icon: LucideIcon
  /** Accent tokens for the icon + sparkline. */
  iconBg: string
  iconColor: string
  /** Existing 7F route this KPI drills into (cards are real links). */
  href: string
  format: (value: number, locale: FormatLocale, currency: string) => string
}

const KPI_DESCRIPTORS: KpiDescriptor[] = [
  {
    id: "earnings",
    // Neutral money glyph — the workspace currency drives the formatted value.
    icon: Banknote,
    iconBg: "var(--accent-muted)",
    iconColor: "var(--accent-on-dark)",
    href: "/facturacion",
    format: (v, locale, currency) => formatCurrency(v, { locale, currency }),
  },
  {
    id: "visits",
    icon: CalendarDays,
    iconBg: "var(--inbox-info-soft, color-mix(in srgb, var(--inbox-info) 12%, transparent))",
    iconColor: "var(--inbox-info)",
    href: "/calendario",
    format: (v, locale) => formatNumber(v, { locale }),
  },
  {
    id: "newClients",
    icon: UserPlus,
    iconBg: "var(--inbox-success-soft, color-mix(in srgb, var(--inbox-success) 12%, transparent))",
    iconColor: "var(--inbox-success)",
    href: "/clientes",
    format: (v, locale) => formatNumber(v, { locale }),
  },
  {
    id: "returningRate",
    icon: Repeat,
    iconBg: "var(--inbox-lead-soft, color-mix(in srgb, var(--inbox-lead) 12%, transparent))",
    iconColor: "var(--inbox-lead)",
    href: "/clientes",
    format: (v, locale) => formatPercent(v, { locale }),
  },
]

/** 2×2 on mobile, one row of four on desktop. */
export function OverviewKpiGrid({
  config,
  kpis,
  preset,
  locale,
  currency,
}: {
  config: BeautyOverviewMessages
  kpis: OverviewKpis | null
  preset: OverviewPeriodPreset
  locale: FormatLocale
  currency: string
}) {
  return (
    <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
      {KPI_DESCRIPTORS.map((d) => (
        <OverviewKpiCard
          key={d.id}
          descriptor={d}
          label={config.kpis[d.id]}
          kpi={kpis?.[d.id] ?? null}
          config={config}
          preset={preset}
          locale={locale}
          currency={currency}
        />
      ))}
    </div>
  )
}

function OverviewKpiCard({
  descriptor,
  label,
  kpi,
  config,
  preset,
  locale,
  currency,
}: {
  descriptor: KpiDescriptor
  label: string
  kpi: OverviewKpiValue | null
  config: BeautyOverviewMessages
  preset: OverviewPeriodPreset
  locale: FormatLocale
  currency: string
}) {
  const Icon = descriptor.icon

  const head = (
    <div className="flex items-center gap-2">
      <span
        aria-hidden="true"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
        style={{ background: descriptor.iconBg, color: descriptor.iconColor }}
      >
        <Icon size={14} strokeWidth={2} />
      </span>
      <span className="truncate text-[11px] font-semibold text-[var(--text-secondary-light)]">{label}</span>
    </div>
  )

  // Honest missing-data state — never a fake 0.
  if (!kpi) {
    return (
      <div className={`${CARD_CLASS} p-3.5 md:p-4`}>
        {head}
        <p className="mt-3 text-[13px] text-[var(--text-tertiary-light)]">{config.kpis.noData}</p>
      </div>
    )
  }

  const cmp = compareKpi(kpi)
  const tone = TONE_STYLES[cmp.tone]
  const value = descriptor.format(kpi.current, locale, currency)
  const deltaLabel =
    cmp.deltaRatio !== null ? formatPercent(Math.abs(cmp.deltaRatio), { locale }) : null

  return (
    <Link
      href={descriptor.href}
      className={`${CARD_CLASS} group block p-3.5 transition-colors hover:border-[var(--accent-muted-border)] hover:bg-[var(--app-surface-dark-elevated)] md:p-4 ${BTN_FOCUS}`}
      aria-label={`${label}: ${value}`}
    >
      {head}
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <p className="text-[22px] font-semibold leading-none tracking-tight text-[var(--text-primary-light)] md:text-[24px]">
          {value}
        </p>
        <Sparkline values={kpi.spark} color={descriptor.iconColor} ariaLabel={config.kpis.sparkAria} />
      </div>
      <p className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10.5px] text-[var(--text-tertiary-light)]">
        {deltaLabel ? (
          <>
            <span
              className="inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 font-bold"
              style={{ color: tone.text, background: tone.bg, borderColor: tone.border }}
            >
              <span aria-hidden="true">{TONE_GLYPH[cmp.tone]}</span>
              {deltaLabel}
            </span>
            <span>{config.kpis.comparisonSuffix[preset]}</span>
            <span className="sr-only">
              {cmp.tone === "up"
                ? config.kpis.srTones.more
                : cmp.tone === "down"
                  ? config.kpis.srTones.less
                  : config.kpis.srTones.same}
            </span>
          </>
        ) : (
          <span>{config.kpis.noComparison}</span>
        )}
      </p>
    </Link>
  )
}

/**
 * Tiny CSS bar sparkline (no chart library). Purely decorative — the delta
 * chip + comparison text carry the accessible meaning, so the visual is
 * `aria-hidden` with a short label on the wrapper.
 */
function Sparkline({
  values,
  color,
  ariaLabel,
}: {
  values: number[]
  color: string
  ariaLabel: string
}) {
  if (values.length < 2) return null
  const max = Math.max(...values)
  if (max <= 0) return null

  return (
    <span role="img" aria-label={ariaLabel} className="flex h-7 items-end gap-[2px]">
      {values.slice(-7).map((v, i, arr) => (
        <span
          key={i}
          aria-hidden="true"
          className="w-[4px] rounded-[2px]"
          style={{
            height: `${Math.max(14, (v / max) * 100)}%`,
            background: color,
            opacity: i === arr.length - 1 ? 1 : 0.45,
          }}
        />
      ))}
    </span>
  )
}
