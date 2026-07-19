"use client"

import Link from "next/link"
import {
  ArrowRight,
  CalendarClock,
  Clock,
  MapPin,
  MessageCircle,
  Receipt,
  Scissors,
  Users,
} from "lucide-react"
import { formatCurrency, formatPercent, formatTime, type FormatLocale } from "@core/i18n/format"
import type { BeautyOverviewMessages } from "@modules/overview/i18n"
import type { SalonProfile, SalonToday } from "@modules/overview/types"
import { BTN_FOCUS, CARD_CLASS, CARD_TITLE_CLASS, CHIP_CLASS } from "./overview-ui"

/**
 * "Mi salón" REAL-data cards: the salon identity (from
 * `Workspace.config.businessProfile` + the resolved service catalog) and the
 * operational "Hoy en el salón" summary. Both render only what the backend
 * actually returned — a `null` metric hides its row, an empty profile shows an
 * honest empty state with a CTA to complete it. Business content (names,
 * hours, descriptions) is the owner's data and is never translated.
 */

const MAX_SERVICE_CHIPS = 6
const MAX_TODAY_APPOINTMENTS = 5

// ─── Salon profile ───────────────────────────────────────────────────────────

export function SalonProfileCard({
  config,
  salon,
  locale,
}: {
  config: BeautyOverviewMessages
  salon: SalonProfile
  locale: FormatLocale
}) {
  const t = config.salonProfile
  const isEmpty = salon.completedFields === 0

  return (
    <section aria-label={t.title} className={`${CARD_CLASS} p-5`}>
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <h3 className={CARD_TITLE_CLASS}>{t.title}</h3>
        <span className={CHIP_CLASS}>
          {t.completeness(formatPercent(salon.completeness, { locale }))}
        </span>
      </div>

      {isEmpty ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-[12px] leading-relaxed text-[var(--text-secondary-light)]">{t.empty}</p>
          <ProfileEditLink label={t.editCta} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {salon.businessName ? (
            <p className="text-[15px] font-semibold text-[var(--text-primary-light)]">
              {salon.businessName}
            </p>
          ) : null}

          {salon.description ? (
            <p className="text-[12px] leading-relaxed text-[var(--text-secondary-light)]">
              {salon.description}
            </p>
          ) : null}

          <dl className="flex flex-col gap-2">
            {salon.region ? (
              <ProfileRow icon={MapPin} label={t.regionLabel} value={salon.region} />
            ) : null}
            {salon.workingHours ? (
              <ProfileRow icon={Clock} label={t.hoursLabel} value={salon.workingHours} />
            ) : null}
          </dl>

          {salon.activeServices.length > 0 ? (
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary-light)]">
                {t.servicesLabel}
              </p>
              <ul className="flex flex-wrap gap-1.5" role="list">
                {salon.activeServices.slice(0, MAX_SERVICE_CHIPS).map((name) => (
                  <li key={name} className={CHIP_CLASS}>
                    {name}
                  </li>
                ))}
                {salon.activeServices.length > MAX_SERVICE_CHIPS ? (
                  <li className={CHIP_CLASS}>+{salon.activeServices.length - MAX_SERVICE_CHIPS}</li>
                ) : null}
              </ul>
            </div>
          ) : null}

          <ProfileEditLink label={t.editCta} />
        </div>
      )}
    </section>
  )
}

function ProfileRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof MapPin
  label: string
  value: string
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon
        size={13}
        strokeWidth={2}
        aria-hidden="true"
        className="mt-0.5 shrink-0 text-[var(--text-tertiary-light)]"
      />
      <div className="min-w-0">
        <dt className="sr-only">{label}</dt>
        <dd className="text-[12px] leading-relaxed text-[var(--text-secondary-light)]">{value}</dd>
      </div>
    </div>
  )
}

function ProfileEditLink({ label }: { label: string }) {
  return (
    <Link
      href="/business-profile"
      className={`inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent-on-dark)] hover:underline ${BTN_FOCUS}`}
    >
      {label}
      <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
    </Link>
  )
}

// ─── Today at the salon ──────────────────────────────────────────────────────

export function SalonTodayCard({
  config,
  today,
  locale,
  currency,
}: {
  config: BeautyOverviewMessages
  today: SalonToday
  locale: FormatLocale
  currency: string
}) {
  const t = config.todayOps

  return (
    <section aria-label={t.title} className={`${CARD_CLASS} p-5`}>
      <h3 className={`${CARD_TITLE_CLASS} mb-3.5`}>{t.title}</h3>

      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-[var(--text-tertiary-light)]">
        {t.appointmentsTitle}
      </p>
      {today.appointments.length === 0 ? (
        <p className="mb-3 rounded-xl border border-dashed border-[var(--border-dark)] p-4 text-center text-[12px] text-[var(--text-secondary-light)]">
          {t.appointmentsEmpty}
        </p>
      ) : (
        <ul className="mb-3 flex flex-col gap-2" role="list">
          {today.appointments.slice(0, MAX_TODAY_APPOINTMENTS).map((appt) => (
            <li key={appt.eventoId} className="flex items-center gap-2.5">
              <span className="w-11 shrink-0 text-[12px] font-semibold tabular-nums text-[var(--text-primary-light)]">
                {formatTime(appt.startsAt, { locale })}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold text-[var(--text-primary-light)]">
                  {appt.title}
                </p>
                {appt.clientName ? (
                  appt.clientId ? (
                    <Link
                      href={`/clientes/${appt.clientId}`}
                      className={`truncate text-[11.5px] text-[var(--text-secondary-light)] hover:underline ${BTN_FOCUS}`}
                    >
                      {appt.clientName}
                    </Link>
                  ) : (
                    <p className="truncate text-[11.5px] text-[var(--text-secondary-light)]">
                      {appt.clientName}
                    </p>
                  )
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
      <OpsLink href="/calendario" label={t.openAgenda} />

      <div className="mt-4 flex flex-col gap-2.5 border-t border-[var(--border-dark)] pt-3.5">
        {today.pendingConversations !== null && today.pendingConversations > 0 ? (
          <OpsRow
            icon={MessageCircle}
            text={t.pendingConversations(today.pendingConversations)}
            href="/inbox"
            actionLabel={t.openInbox}
          />
        ) : null}
        {today.priorityTasks !== null && today.priorityTasks > 0 ? (
          <OpsRow
            icon={CalendarClock}
            text={t.priorityTasks(today.priorityTasks)}
            href="/today"
            actionLabel={t.openToday}
          />
        ) : null}
        {today.overdueInvoices !== null && today.overdueInvoices.count > 0 ? (
          <OpsRow
            icon={Receipt}
            text={t.overdueInvoices(
              today.overdueInvoices.count,
              formatCurrency(today.overdueInvoices.amount, { locale, currency }),
            )}
            href="/facturacion"
            actionLabel={t.openBilling}
            tone="warning"
          />
        ) : null}
        {today.pendingInvoices !== null && today.pendingInvoices.count > 0 ? (
          <OpsRow
            icon={Receipt}
            text={t.pendingInvoices(
              today.pendingInvoices.count,
              formatCurrency(today.pendingInvoices.amount, { locale, currency }),
            )}
            href="/facturacion"
            actionLabel={t.openBilling}
          />
        ) : null}
        {today.activeClients !== null && today.activeClients > 0 ? (
          <OpsRow icon={Users} text={t.activeClients(today.activeClients)} href="/clientes" />
        ) : null}
        {today.appointments.length === 0 &&
        (today.pendingConversations ?? 0) === 0 &&
        (today.priorityTasks ?? 0) === 0 ? (
          <p className="flex items-center gap-2 text-[12px] text-[var(--text-secondary-light)]">
            <Scissors size={13} strokeWidth={2} aria-hidden="true" />
            {config.recommendations.emptyPositive}
          </p>
        ) : null}
      </div>
    </section>
  )
}

function OpsRow({
  icon: Icon,
  text,
  href,
  actionLabel,
  tone = "default",
}: {
  icon: typeof MessageCircle
  text: string
  href: string
  actionLabel?: string
  tone?: "default" | "warning"
}) {
  const color = tone === "warning" ? "var(--inbox-urgency)" : "var(--inbox-info)"
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-lg"
        style={{ background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
      >
        <Icon size={12} strokeWidth={2} />
      </span>
      <p className="min-w-0 flex-1 text-[12px] text-[var(--text-primary-light)]">{text}</p>
      {actionLabel ? (
        <Link
          href={href}
          className={`shrink-0 text-[11.5px] font-semibold text-[var(--accent-on-dark)] hover:underline ${BTN_FOCUS}`}
        >
          {actionLabel}
        </Link>
      ) : (
        <Link href={href} aria-label={text} className={`shrink-0 ${BTN_FOCUS}`}>
          <ArrowRight
            size={13}
            strokeWidth={2}
            aria-hidden="true"
            className="text-[var(--text-tertiary-light)]"
          />
        </Link>
      )}
    </div>
  )
}

function OpsLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent-on-dark)] hover:underline ${BTN_FOCUS}`}
    >
      {label}
      <ArrowRight size={12} strokeWidth={2} aria-hidden="true" />
    </Link>
  )
}
