"use client"

import Link from "next/link"
import {
  ArrowRight,
  Footprints,
  Globe,
  Instagram,
  MessageCircle,
  Phone,
  Search,
  Share2,
  Sparkles,
  UserRound,
  type LucideIcon,
} from "lucide-react"
import { formatPercent, type FormatLocale } from "@core/i18n/format"
import {
  buildRecommendationText,
  type BeautyOverviewConfig,
} from "@modules/overview/beauty-overview"
import type {
  BookingSourceKind,
  BookingSourcePerformance,
  BusinessRecommendation,
} from "@modules/overview/types"
import {
  BTN_FOCUS,
  CARD_CLASS,
  CARD_TITLE_CLASS,
  CHART_TRACK,
  CHIP_CLASS,
} from "./overview-ui"

// ─── Booking sources ─────────────────────────────────────────────────────────

const SOURCE_ICONS: Record<BookingSourceKind, LucideIcon> = {
  instagram: Instagram,
  whatsapp: MessageCircle,
  google: Search,
  website: Globe,
  direct: Sparkles,
  "walk-in": Footprints,
  referral: Share2,
  phone: Phone,
  unknown: UserRound,
}

const SOURCE_COLORS: Record<BookingSourceKind, string> = {
  instagram: "var(--accent-primary)",
  whatsapp: "var(--inbox-success)",
  google: "var(--inbox-info)",
  website: "var(--inbox-info)",
  direct: "var(--accent-primary)",
  "walk-in": "var(--inbox-lead)",
  referral: "var(--inbox-info)",
  phone: "var(--inbox-lead)",
  unknown: "var(--text-tertiary-light)",
}

/**
 * "Cómo te encuentran" — attributed booking sources. Unattributed bookings
 * surface as an explicit "Sin identificar" row (shares always sum to 100%),
 * never silently dropped or invented.
 */
export function BookingSourcesCard({
  config,
  sources,
  locale,
}: {
  config: BeautyOverviewConfig
  sources: BookingSourcePerformance[]
  locale: FormatLocale
}) {
  return (
    <section aria-label={config.sources.title} className={`${CARD_CLASS} p-5`}>
      <h3 className={`${CARD_TITLE_CLASS} mb-3.5`}>{config.sources.title}</h3>

      {sources.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-dark)] p-5 text-center text-[12px] text-[var(--text-secondary-light)]">
          {config.sources.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3" role="list">
          {sources.map((s) => {
            const Icon = SOURCE_ICONS[s.source]
            const color = SOURCE_COLORS[s.source]
            return (
              <li key={s.source}>
                <div className="mb-1.5 flex items-center gap-2">
                  <span
                    aria-hidden="true"
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-lg"
                    style={{
                      background: `color-mix(in srgb, ${color} 14%, transparent)`,
                      color,
                    }}
                  >
                    <Icon size={12} strokeWidth={2} />
                  </span>
                  <p className="min-w-0 flex-1 truncate text-[12px] font-semibold text-[var(--text-primary-light)]">
                    {config.sources.labels[s.source]}
                  </p>
                  <span className="shrink-0 font-mono text-[11.5px] font-semibold text-[var(--text-secondary-light)]">
                    {formatPercent(s.share, { locale })}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  className="h-1.5 overflow-hidden rounded-full"
                  style={{ background: CHART_TRACK }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(3, s.share * 100)}%`, background: color, opacity: 0.85 }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ─── Finesse recommendations ─────────────────────────────────────────────────

const AGENT_TONES: Record<BusinessRecommendation["agent"], string> = {
  fiona: "var(--agent-teal, var(--inbox-info))",
  felix: "var(--inbox-lead)",
  fanny: "var(--inbox-info)",
  finesse: "var(--agent-rose, var(--accent-primary))",
}

/**
 * "Ideas de Finesse" — recommendations DERIVED from the snapshot signals
 * (`deriveRecommendations`), each with its source agent, the relevant number
 * baked into the copy, and one safe navigation action. Empty signals render a
 * positive empty state — never invented advice.
 */
export function BusinessRecommendationsCard({
  config,
  recommendations,
  locale,
  currency,
}: {
  config: BeautyOverviewConfig
  recommendations: BusinessRecommendation[]
  locale: FormatLocale
  currency: string
}) {
  return (
    <section
      aria-label={config.recommendations.title}
      className="rounded-[18px] border p-5"
      style={{
        borderColor: "var(--accent-muted-border)",
        background:
          "linear-gradient(155deg, var(--accent-muted), var(--app-surface-dark) 55%)",
      }}
    >
      <div className="mb-3.5 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white"
          style={{ background: "var(--accent-primary)" }}
        >
          <Sparkles size={13} strokeWidth={2} />
        </span>
        <h3 className="text-[12px] font-bold uppercase tracking-[0.11em] text-[var(--text-primary-light)]">
          {config.recommendations.title}
        </h3>
      </div>

      {recommendations.length === 0 ? (
        <p className="text-[12px] leading-relaxed text-[var(--text-secondary-light)]">
          {config.recommendations.emptyPositive}
        </p>
      ) : (
        <ul className="flex flex-col gap-3.5" role="list">
          {recommendations.map((rec) => {
            const tone = AGENT_TONES[rec.agent]
            return (
              <li key={rec.id} className="flex items-start gap-2.5">
                <span
                  className={`${CHIP_CLASS} mt-0.5 shrink-0`}
                  style={{
                    color: tone,
                    background: `color-mix(in srgb, ${tone} 13%, transparent)`,
                    borderColor: `color-mix(in srgb, ${tone} 32%, transparent)`,
                  }}
                >
                  {config.recommendations.agentLabels[rec.agent]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11.5px] leading-relaxed text-[var(--text-primary-light)]">
                    {buildRecommendationText(rec, { locale, currency })}
                  </p>
                  <Link
                    href={rec.actionHref}
                    className={`mt-1.5 inline-flex items-center gap-1 rounded-lg text-[11.5px] font-semibold text-[var(--accent-on-dark)] transition-colors hover:text-[var(--accent-primary)] ${BTN_FOCUS}`}
                  >
                    {config.recommendations.actionLabels[rec.kind]}
                    <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
                  </Link>
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
