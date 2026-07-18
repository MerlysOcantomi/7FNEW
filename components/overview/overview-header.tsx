"use client"

import { Sparkles } from "lucide-react"
import type { FormatLocale } from "@core/i18n/format"
import type { BeautyOverviewConfig } from "@modules/overview/beauty-overview"
import type { OverviewPeriodPreset } from "@modules/overview/types"
import { BTN_FOCUS, formatDateParts } from "./overview-ui"

/**
 * "Mi salón" page header: title + Finesse brand chip + preview chip, current
 * date, one intro line, and the period selector. There is deliberately NO
 * "Preguntar a Finesse" button here — the global floating launcher is the one
 * persistent assistant entry (mission rule: never both).
 */
export function OverviewHeader({
  config,
  preset,
  onPresetChange,
  locale,
  now,
  exportSlot,
}: {
  config: BeautyOverviewConfig
  preset: OverviewPeriodPreset
  onPresetChange: (preset: OverviewPeriodPreset) => void
  locale: FormatLocale
  now: Date
  exportSlot?: React.ReactNode
}) {
  const dateLabel = formatDateParts(now, { locale, weekday: "long", day: "numeric", month: "long" })

  return (
    <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary-light)]">
            {config.header.title}
          </h1>
          <span
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold"
            style={{
              borderColor: "var(--accent-muted-border)",
              background: "var(--accent-muted)",
              color: "var(--accent-on-dark)",
            }}
          >
            <Sparkles size={12} strokeWidth={2} aria-hidden="true" />
            {config.brandChip}
          </span>
          <span
            className="inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              borderColor: "color-mix(in srgb, var(--inbox-info) 40%, transparent)",
              color: "var(--inbox-info)",
            }}
            title="Datos de ejemplo mientras conectamos tus datos reales."
          >
            {config.previewChip}
          </span>
        </div>

        <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-[var(--text-secondary-light)]">
          {config.header.description}
        </p>

        <p suppressHydrationWarning className="mt-2 text-[12.5px] capitalize text-[var(--text-secondary-light)]">
          {dateLabel}
        </p>
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <OverviewPeriodSelector config={config} preset={preset} onPresetChange={onPresetChange} />
        {exportSlot}
      </div>
    </header>
  )
}

/**
 * Segmented Semana · Mes · Trimestre · Año control. A real radiogroup for
 * keyboard/AT users; the selected preset drives EVERY section of the page.
 */
export function OverviewPeriodSelector({
  config,
  preset,
  onPresetChange,
}: {
  config: BeautyOverviewConfig
  preset: OverviewPeriodPreset
  onPresetChange: (preset: OverviewPeriodPreset) => void
}) {
  const presets: OverviewPeriodPreset[] = ["week", "month", "quarter", "year"]

  return (
    <div
      role="radiogroup"
      aria-label={config.periodCard.eyebrow}
      className="flex items-center gap-0.5 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] p-0.5"
    >
      {presets.map((p) => {
        const active = p === preset
        return (
          <button
            key={p}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onPresetChange(p)}
            className={`rounded-[10px] px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${BTN_FOCUS} ${
              active
                ? "bg-[var(--app-surface-dark)] text-[var(--text-primary-light)] shadow-sm"
                : "text-[var(--text-secondary-light)] hover:text-[var(--text-primary-light)]"
            }`}
          >
            {config.header.periodLabels[p]}
          </button>
        )
      })}
    </div>
  )
}
