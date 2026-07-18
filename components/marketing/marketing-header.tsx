"use client"

import { Plus, Sparkles } from "lucide-react"
import type { BeautyMarketingConfig } from "@modules/marketing/beauty-marketing"
import type { MarketingWeeklySummary } from "@modules/marketing/state"
import { BTN_PRIMARY, CARD_CLASS } from "./marketing-ui"

/**
 * Marketing header — compact by design (the featured post is the protagonist).
 * Desktop: title + Finesse chip + description + weekly summary + primary
 * upload CTA. Mobile: title + short Freya tagline and a highly visible photo
 * button (one of the most prominent actions on the screen, per the mobile
 * priority of capture-first).
 */
export function MarketingHeader({
  config,
  summary,
  onUpload,
}: {
  config: BeautyMarketingConfig
  summary: MarketingWeeklySummary
  onUpload: () => void
}) {
  const { header } = config

  const summaryItems: { text: string; dot: string }[] = [
    { text: `${summary.readyCount} ${summary.readyCount === 1 ? "foto lista" : "fotos listas"}`, dot: "var(--accent-primary)" },
    { text: `${summary.scheduledCount} ${summary.scheduledCount === 1 ? "programada" : "programadas"}`, dot: "var(--inbox-info)" },
    { text: `${summary.activeCampaigns} ${summary.activeCampaigns === 1 ? "campaña activa" : "campañas activas"}`, dot: "var(--inbox-success)" },
  ]

  return (
    <header className={`${CARD_CLASS} flex items-start justify-between gap-4 p-4 md:p-5`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary-light)]">
            {header.title}
          </h1>
          <span
            className="inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[10.5px] font-semibold"
            style={{
              background: "var(--accent-muted)",
              color: "var(--accent-on-dark)",
              borderColor: "var(--accent-muted-border)",
            }}
          >
            <Sparkles size={11} strokeWidth={2} aria-hidden="true" />
            {config.brandChip}
          </span>
          <span
            className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              borderColor: "color-mix(in srgb, var(--inbox-info) 40%, transparent)",
              color: "var(--inbox-info)",
            }}
            title="Datos de ejemplo mientras conectamos tus redes y fotos reales."
          >
            {config.previewChip}
          </span>
        </div>

        {/* Description: full on ≥sm, short Freya tagline on mobile. */}
        <p className="mt-1.5 hidden max-w-xl text-[12.5px] leading-relaxed text-[var(--text-secondary-light)] sm:block">
          {header.description}
        </p>
        <p className="mt-1.5 text-[12px] text-[var(--text-secondary-light)] sm:hidden">
          {header.mobileTagline}
        </p>

        <div className="mt-2.5 hidden flex-wrap items-center gap-x-3.5 gap-y-1 sm:flex">
          <span className="text-[12px] text-[var(--text-tertiary-light)]">{header.weekLabel}</span>
          {summaryItems.map((s) => (
            <span
              key={s.text}
              className="inline-flex items-center gap-1.5 text-[12px] font-medium text-[var(--text-primary-light)]"
            >
              <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
              {s.text}
            </span>
          ))}
        </div>
      </div>

      {/* Upload CTA — full button on ≥sm, prominent square icon button on
          mobile. Wrapper divs carry the responsive visibility so `hidden`
          never fights the button's own `inline-flex` display class. */}
      <div className="shrink-0">
        <div className="hidden sm:block">
          <button type="button" onClick={onUpload} className={BTN_PRIMARY}>
            <Plus size={14} strokeWidth={2.2} aria-hidden="true" />
            {header.uploadCta}
          </button>
        </div>
        <div className="sm:hidden">
          <button
            type="button"
            onClick={onUpload}
            aria-label={header.uploadCta}
            className="grid h-11 w-11 place-items-center rounded-xl bg-[var(--accent-primary)] text-white transition-colors hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)] focus-visible:ring-offset-1"
          >
            <Plus size={19} strokeWidth={2.2} aria-hidden="true" />
          </button>
        </div>
      </div>
    </header>
  )
}
