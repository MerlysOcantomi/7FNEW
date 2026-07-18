"use client"

import Link from "next/link"
import { formatCurrency, formatNumber, formatPercent, type FormatLocale } from "@core/i18n/format"
import { clientMixShares } from "@modules/overview/derive"
import type { BeautyOverviewConfig } from "@modules/overview/beauty-overview"
import type { ClientMix, ClientPerformance } from "@modules/overview/types"
import {
  BTN_FOCUS,
  CARD_CLASS,
  CARD_HINT_CLASS,
  CARD_TITLE_CLASS,
  CHIP_CLASS,
  MIX_NEW_COLOR,
  MIX_RETURNING_COLOR,
} from "./overview-ui"

/**
 * "Clientas nuevas y habituales" — donut of UNIQUE clients (explicitly not
 * visits; see `modules/overview/types.ts` metric definitions). Donut is a
 * conic-gradient with the numbers alongside, so color is never the only
 * indicator.
 */
export function ClientMixCard({
  config,
  mix,
  locale,
}: {
  config: BeautyOverviewConfig
  mix: ClientMix | null
  locale: FormatLocale
}) {
  return (
    <section aria-label={config.clientMix.title} className={`${CARD_CLASS} p-5`}>
      <h3 className={`${CARD_TITLE_CLASS} mb-4`}>{config.clientMix.title}</h3>

      {!mix || mix.uniqueClients === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-dark)] p-5 text-center text-[12px] text-[var(--text-secondary-light)]">
          {config.clientMix.empty}
        </p>
      ) : (
        <MixBody config={config} mix={mix} locale={locale} />
      )}
    </section>
  )
}

function MixBody({
  config,
  mix,
  locale,
}: {
  config: BeautyOverviewConfig
  mix: ClientMix
  locale: FormatLocale
}) {
  const shares = clientMixShares(mix)
  const returningPct = shares.returningShare * 100

  const rows = [
    {
      label: config.clientMix.returning,
      value: mix.returningClients,
      share: shares.returningShare,
      color: MIX_RETURNING_COLOR,
    },
    {
      label: config.clientMix.newLabel,
      value: mix.newClients,
      share: shares.newShare,
      color: MIX_NEW_COLOR,
    },
  ]

  return (
    <div className="flex items-center gap-5">
      <div
        role="img"
        aria-label={`${config.clientMix.title}: ${formatNumber(mix.uniqueClients, { locale })} ${config.clientMix.centerLabel}. ${config.clientMix.returning}: ${formatNumber(mix.returningClients, { locale })} (${formatPercent(shares.returningShare, { locale })}). ${config.clientMix.newLabel}: ${formatNumber(mix.newClients, { locale })} (${formatPercent(shares.newShare, { locale })}).`}
        className="relative h-[104px] w-[104px] shrink-0 rounded-full"
        style={{
          background: `conic-gradient(${MIX_RETURNING_COLOR} 0% ${returningPct}%, ${MIX_NEW_COLOR} ${returningPct}% 100%)`,
        }}
      >
        <div className="absolute inset-[14px] flex flex-col items-center justify-center rounded-full bg-[var(--app-surface-dark)]">
          <p className="text-[19px] font-semibold leading-none text-[var(--text-primary-light)]">
            {formatNumber(mix.uniqueClients, { locale })}
          </p>
          <p className="mt-0.5 text-[9px] text-[var(--text-tertiary-light)]">{config.clientMix.centerLabel}</p>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3.5" aria-hidden="true">
        {rows.map((r) => (
          <div key={r.label}>
            <p className="flex items-center gap-2 text-[12px] font-semibold text-[var(--text-primary-light)]">
              <span className="h-2 w-2 rounded-[3px]" style={{ background: r.color }} />
              {r.label}
            </p>
            <p className="mt-0.5 flex items-baseline gap-1.5 pl-4">
              <span className="text-[17px] font-semibold text-[var(--text-primary-light)]">
                {formatNumber(r.value, { locale })}
              </span>
              <span className="text-[11px] text-[var(--text-tertiary-light)]">
                {formatPercent(r.share, { locale })}
              </span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * "Tus clientas más fieles" — loyalty/frequency list. Spend hides when the
 * viewer lacks finance visibility (`spend === null`). Rows link to the real
 * client profile only for real client ids; demo ids render as plain rows so
 * nothing pretends to navigate.
 */
export function TopClientsCard({
  config,
  clients,
  locale,
  currency,
  clientHref,
}: {
  config: BeautyOverviewConfig
  clients: ClientPerformance[]
  locale: FormatLocale
  currency: string
  /** Maps a clientId to its profile route, or null when not navigable (demo data). */
  clientHref: (clientId: string) => string | null
}) {
  return (
    <section aria-label={config.topClients.title} className={`${CARD_CLASS} p-5`}>
      <div className="mb-3.5 flex items-baseline gap-2">
        <h3 className={CARD_TITLE_CLASS}>{config.topClients.title}</h3>
        <span className={CARD_HINT_CLASS}>{config.topClients.hint}</span>
      </div>

      {clients.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-dark)] p-5 text-center text-[12px] text-[var(--text-secondary-light)]">
          {config.topClients.empty}
        </p>
      ) : (
        <ul className="flex flex-col gap-3" role="list">
          {clients.map((c) => {
            const href = clientHref(c.clientId)
            const row = (
              <>
                <span
                  aria-hidden="true"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
                  style={{
                    background:
                      "linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 55%, transparent), var(--accent-primary))",
                  }}
                >
                  {initials(c.name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-[12.5px] font-semibold text-[var(--text-primary-light)]">
                      {c.name}
                    </span>
                    {c.vip ? (
                      <span
                        className={CHIP_CLASS}
                        style={{
                          color: "var(--accent-on-dark)",
                          background: "var(--accent-muted)",
                          borderColor: "var(--accent-muted-border)",
                        }}
                      >
                        {config.topClients.vipLabel}
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 block text-[10.5px] text-[var(--text-tertiary-light)]">
                    {formatNumber(c.visits, { locale })} {config.topClients.visitsSuffix}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-[12px] font-semibold text-[var(--accent-on-dark)]">
                  {c.spend != null
                    ? formatCurrency(c.spend, { locale, currency })
                    : config.topClients.restrictedSpend}
                </span>
              </>
            )

            return (
              <li key={c.clientId}>
                {href ? (
                  <Link
                    href={href}
                    className={`flex w-full items-center gap-3 rounded-lg transition-colors hover:bg-[var(--app-surface-dark-elevated)] ${BTN_FOCUS}`}
                  >
                    {row}
                  </Link>
                ) : (
                  <div className="flex items-center gap-3">{row}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
}
