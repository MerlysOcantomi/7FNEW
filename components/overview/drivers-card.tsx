"use client"

import Link from "next/link"
import { ArrowRight, CalendarClock, HelpCircle } from "lucide-react"
import { formatCurrency, type FormatLocale } from "@core/i18n/format"
import { sumDrivers } from "@modules/overview/derive"
import { buildDriverLabel } from "@modules/overview/beauty-overview"
import type { BeautyOverviewMessages } from "@modules/overview/i18n"
import type { LookingAheadNote, PerformanceDriver } from "@modules/overview/types"
import {
  BTN_FOCUS,
  CARD_CLASS,
  CARD_HINT_CLASS,
  CARD_TITLE_CLASS,
  CHART_TRACK,
  CHIP_CLASS,
  TONE_STYLES,
} from "./overview-ui"

/**
 * "Por qué ganaste más/menos" — the analytical explanation block plus the
 * forward-looking note. HONESTY: every driver renders its confidence label
 * ("Dato confirmado" / "Según datos de reserva" / "Posible influencia"), so a
 * correlation or inference is never presented as fact.
 */
export function PerformanceDriversCard({
  config,
  drivers,
  lookingAhead,
  locale,
  currency,
}: {
  config: BeautyOverviewMessages
  drivers: PerformanceDriver[]
  lookingAhead: LookingAheadNote | null
  locale: FormatLocale
  currency: string
}) {
  if (drivers.length === 0 && !lookingAhead) return null

  const total = sumDrivers(drivers)
  const positive = total >= 0
  const maxAmount = Math.max(...drivers.map((d) => Math.abs(d.amount)), 1)
  const totalTone = TONE_STYLES[positive ? "up" : "down"]
  const title = positive ? config.drivers.titleUp : config.drivers.titleDown

  return (
    <section aria-label={title} className={`${CARD_CLASS} p-5`}>
      {drivers.length > 0 ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
              style={{
                background: "var(--inbox-info-soft, color-mix(in srgb, var(--inbox-info) 12%, transparent))",
                color: "var(--inbox-info)",
              }}
            >
              <HelpCircle size={15} strokeWidth={2} />
            </span>
            <div className="min-w-0 flex-1">
              <h3 className={CARD_TITLE_CLASS}>{title}</h3>
              <p className={CARD_HINT_CLASS}>{config.drivers.subtitle}</p>
            </div>
            <span
              className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 font-mono text-[12px] font-bold"
              style={{ color: totalTone.text, background: totalTone.bg }}
            >
              {formatSignedCurrency(total, locale, currency)}
            </span>
          </div>

          <ul className="flex flex-col gap-3.5" role="list">
            {drivers.map((d) => {
              const tone = TONE_STYLES[d.tone]
              return (
                <li key={d.id}>
                  <div className="mb-1.5 flex items-center gap-2">
                    <span
                      className={CHIP_CLASS}
                      style={{
                        color: "var(--text-secondary-light)",
                        background: "var(--app-surface-subtle)",
                        borderColor: "var(--border-dark)",
                      }}
                    >
                      {config.drivers.confidenceLabels[d.confidence]}
                    </span>
                    <p className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-primary-light)]">
                      {buildDriverLabel(d, config)}
                    </p>
                    <span
                      className="shrink-0 font-mono text-[12px] font-semibold"
                      style={{ color: tone.text }}
                    >
                      {formatSignedCurrency(d.amount, locale, currency)}
                    </span>
                  </div>
                  <div
                    aria-hidden="true"
                    className="h-1.5 overflow-hidden rounded-full"
                    style={{ background: CHART_TRACK }}
                  >
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.max(6, (Math.abs(d.amount) / maxAmount) * 100)}%`,
                        background: tone.text,
                        opacity: 0.75,
                      }}
                    />
                  </div>
                </li>
              )
            })}
          </ul>
        </>
      ) : (
        <>
          <h3 className={CARD_TITLE_CLASS}>{config.drivers.titleUp}</h3>
          <p className="mt-2 text-[12px] text-[var(--text-secondary-light)]">{config.drivers.empty}</p>
        </>
      )}

      {lookingAhead ? <LookingAheadNoteBlock config={config} note={lookingAhead} /> : null}
    </section>
  )
}

/** "Mirando adelante" — recommendation with one safe CTA (existing routes only). */
function LookingAheadNoteBlock({
  config,
  note,
}: {
  config: BeautyOverviewMessages
  note: LookingAheadNote
}) {
  return (
    <div
      className="mt-4 flex items-start gap-3 rounded-xl border p-3.5"
      style={{
        background: "var(--inbox-lead-soft, color-mix(in srgb, var(--inbox-lead) 10%, transparent))",
        borderColor: "color-mix(in srgb, var(--inbox-lead) 28%, transparent)",
      }}
    >
      <span
        aria-hidden="true"
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--app-surface-dark)]"
        style={{ color: "var(--inbox-lead)" }}
      >
        <CalendarClock size={14} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11.5px] leading-relaxed" style={{ color: "var(--inbox-lead)" }}>
          <strong>{config.lookingAhead.lead}</strong> {config.lookingAhead.texts[note.kind]}
        </p>
        {note.actionHref ? (
          <Link
            href={note.actionHref}
            className={`mt-2 inline-flex items-center gap-1 rounded-lg text-[11.5px] font-semibold text-[var(--accent-on-dark)] transition-colors hover:text-[var(--accent-primary)] ${BTN_FOCUS}`}
          >
            {config.lookingAhead.actions[note.kind]}
            <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </div>
  )
}

function formatSignedCurrency(value: number, locale: FormatLocale, currency: string): string {
  const abs = formatCurrency(Math.abs(value), { locale, currency })
  return value >= 0 ? `+${abs}` : `−${abs}`
}
