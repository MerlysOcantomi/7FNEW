"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CalendarPlus,
  Clock,
  MessageSquare,
  Receipt,
  Sparkles,
} from "lucide-react"
import { useFetch } from "@/hooks/use-fetch"
import { useI18n } from "@/components/i18n-provider"
import { useRegisterFinesseAssistantContext } from "@/components/assistant/finesse-assistant-provider"
import { getBeautyTodayMessages, type BeautyTodayMessages } from "@modules/today/i18n"
import type {
  BeautyTodayAction,
  BeautyTodayAppointment,
  BeautyTodayGap,
  BeautyTodayPayload,
} from "@modules/today/beauty-real"
import { BEAUTY_SPECIALIST_AGENT } from "@core/vertical-packs/specialists"
import { formatCurrency, toIntlLocale } from "@core/i18n/format"

/**
 * Beauty / Finesse "Hoy" — the REAL appointment-first Today. Same route, same
 * AppShell, same visual language as the Studio preview, but every figure is a
 * real workspace fact from `GET /api/today/beauty`:
 *   - the agenda is today's real citas (`Evento` + `Cliente`);
 *   - free slots exist only where two bounded citas leave a real hole;
 *   - "Para hoy" / "Finesse sugiere" are the SAME task rows the work-first
 *     workboard shows (via `aggregateToday`), each with its stated basis;
 *   - messages/collections come from `Conversation`/`Factura`.
 *
 * HONESTY RULES ON SCREEN:
 *   - No attendance/confirmation chips — `Evento` has no such state. Past
 *     citas only dim (a time statement); "En curso" is time-derived.
 *   - No booked-value figure — `Evento` carries no price.
 *   - Every CTA is a REAL navigation (client, calendar, inbox, billing,
 *     workboard). There are NO write buttons here: no backend action exists
 *     yet for confirm/reschedule/collect, so none is simulated.
 *   - The work-first workboard (with its Send-to-AI / Take-over writes) stays
 *     one link away (`/today?todayLayout=work_first`) — nothing is hidden.
 */

const CARD = "rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)]"

function fmtTime(iso: string, intlLocale: string): string {
  return new Date(iso).toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })
}

// ─── Entry ───────────────────────────────────────────────────────────────────

export function BeautyTodayReal({ businessName }: { businessName: string | null }) {
  const { locale } = useI18n()
  const beauty = useMemo(() => getBeautyTodayMessages(locale), [locale])

  const [timezone, setTimezone] = useState<string | null>(null)
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setTimezone(tz && typeof tz === "string" ? tz : "UTC")
    } catch {
      setTimezone("UTC")
    }
  }, [])

  // Live "now" for the agenda divider — gated after mount (no SSR mismatch).
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const url = timezone ? `/api/today/beauty?tz=${encodeURIComponent(timezone)}` : null
  const { data, loading, error, refetch } = useFetch<BeautyTodayPayload>(url)

  // Ground Ask Finesse in the REAL on-screen numbers.
  useRegisterFinesseAssistantContext(
    useMemo(
      () => ({
        page: "today" as const,
        visibleMetrics: {
          citas: data?.appointments.length ?? null,
          huecosLibres: data?.gaps.length ?? null,
          accionesUrgentes: data?.urgentActions.length ?? null,
          mensajesPendientes: data?.pendingConversations ?? null,
        },
      }),
      [data],
    ),
  )

  const t = beauty.real

  if (error) {
    return (
      <div className={`${CARD} mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-8 text-center`}>
        <p className="text-[15px] font-semibold text-[var(--text-primary-light)]">{t.error.title}</p>
        <p className="text-[12.5px] text-[var(--text-secondary-light)]">{t.error.description}</p>
        <button
          type="button"
          onClick={refetch}
          className="mt-2 inline-flex items-center justify-center rounded-xl bg-[var(--accent-primary)] px-3.5 py-2 text-[12.5px] font-semibold text-white"
        >
          {t.error.retry}
        </button>
      </div>
    )
  }

  if (loading || !data || now === null) {
    return (
      <div className="flex flex-col gap-6" aria-busy="true" aria-label={t.loading}>
        <div className={`${CARD} h-24 animate-pulse`} />
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className={`${CARD} h-72 animate-pulse`} />
          <div className="flex flex-col gap-6">
            <div className={`${CARD} h-28 animate-pulse`} />
            <div className={`${CARD} h-48 animate-pulse`} />
          </div>
        </div>
      </div>
    )
  }

  const dayEmpty =
    data.appointments.length === 0 &&
    data.urgentActions.length === 0 &&
    data.suggestedActions.length === 0 &&
    (data.pendingConversations ?? 0) === 0 &&
    (data.overdueInvoices?.count ?? 0) === 0

  return (
    <div className="flex flex-col gap-6">
      <RealHeader studio={businessName} beauty={beauty} data={data} now={now} />

      {dayEmpty ? (
        <EmptyDay t={t} otherOpenTaskCount={data.otherOpenTaskCount} />
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          <div className="order-2 min-w-0 lg:order-none">
            <AgendaPanel data={data} now={now} beauty={beauty} />
          </div>

          <div className="order-1 flex flex-col gap-6 lg:order-none">
            <NextAppointmentCard next={data.nextAppointment} t={t} beauty={beauty} />
            <ActionsSection
              title={t.urgentTitle}
              actions={data.urgentActions}
              t={t}
              beauty={beauty}
            />
            <ActionsSection
              title={t.suggestedTitle}
              actions={data.suggestedActions}
              t={t}
              beauty={beauty}
              suggested
            />
            <OpsRows data={data} t={t} beauty={beauty} />
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Header (real signals only — no invented value figure) ───────────────────

function RealHeader({
  studio,
  beauty,
  data,
  now,
}: {
  studio: string | null
  beauty: BeautyTodayMessages
  data: BeautyTodayPayload
  now: Date
}) {
  const t = beauty.real
  const intlLocale = toIntlLocale(beauty.locale)
  const dateLabel = now.toLocaleDateString(intlLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  })
  const remaining = data.appointments.filter((a) => a.phase === "upcoming").length

  const signals: { text: string; dot: string }[] = [
    { text: t.signals.appointments(data.appointments.length), dot: "var(--accent-primary)" },
    ...(data.appointments.length > 0
      ? [{ text: t.signals.remaining(remaining), dot: "var(--inbox-info)" }]
      : []),
    ...(data.gaps.length > 0
      ? [{ text: t.signals.gaps(data.gaps.length), dot: "var(--inbox-success)" }]
      : []),
  ]

  return (
    <header className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary-light)]">
          {beauty.studio.headerTitle(studio ?? beauty.brandTitle)}
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
          {BEAUTY_SPECIALIST_AGENT.name} {beauty.studio.bySevenef}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span suppressHydrationWarning className="text-[12.5px] capitalize text-[var(--text-secondary-light)]">
          {dateLabel}
        </span>
        {signals.length > 0 ? (
          <span className="h-1 w-1 rounded-full bg-[var(--text-tertiary-light)]" aria-hidden="true" />
        ) : null}
        {signals.map((s) => (
          <span
            key={s.text}
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--text-primary-light)]"
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} aria-hidden="true" />
            {s.text}
          </span>
        ))}
      </div>
    </header>
  )
}

// ─── Agenda (real citas + real gaps, now divider) ────────────────────────────

type AgendaEntry =
  | { kind: "appt"; start: string; appt: BeautyTodayAppointment }
  | { kind: "gap"; start: string; gap: BeautyTodayGap }

function AgendaPanel({
  data,
  now,
  beauty,
}: {
  data: BeautyTodayPayload
  now: Date
  beauty: BeautyTodayMessages
}) {
  const t = beauty.real
  const intlLocale = toIntlLocale(beauty.locale)
  const entries = useMemo<AgendaEntry[]>(() => {
    const merged: AgendaEntry[] = [
      ...data.appointments.map((appt) => ({ kind: "appt" as const, start: appt.startsAt, appt })),
      ...data.gaps.map((gap) => ({ kind: "gap" as const, start: gap.startsAt, gap })),
    ]
    return merged.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  }, [data])

  const nowMs = now.getTime()
  const nowLabel = now.toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })
  let nowShown = false

  return (
    <section className="min-w-0" aria-label={beauty.studio.agendaTitle}>
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-[17px] font-semibold tracking-tight text-[var(--text-primary-light)]">
          {beauty.studio.agendaTitle}
        </h2>
        <span className="ml-auto inline-flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent-primary)" }} aria-hidden="true" />
          <span
            suppressHydrationWarning
            className="text-[11.5px] font-medium tabular-nums"
            style={{ color: "var(--accent-primary)" }}
          >
            {beauty.ui.now} {nowLabel}
          </span>
        </span>
      </div>

      {entries.length === 0 ? (
        <div className={`${CARD} flex flex-col items-start gap-2 p-5`}>
          <p className="text-[12.5px] text-[var(--text-secondary-light)]">{t.agendaEmpty}</p>
          <CalendarLink label={t.openCalendar} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)]">
          {entries.map((entry, i) => {
            const startMs = new Date(entry.start).getTime()
            const showNow = !nowShown && startMs > nowMs
            if (showNow) nowShown = true
            const first = i === 0
            return (
              <div key={entry.kind === "appt" ? entry.appt.eventoId : entry.gap.id}>
                {showNow ? <NowDivider label={beauty.ui.now} /> : null}
                {entry.kind === "appt" ? (
                  <ApptRow appt={entry.appt} beauty={beauty} first={first && !showNow} />
                ) : (
                  <GapRow gap={entry.gap} beauty={beauty} first={first && !showNow} />
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function NowDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-[var(--border-dark)] px-4 py-2" aria-hidden="true">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent-primary)" }} />
      <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent-primary)" }}>
        {label}
      </span>
      <span className="h-px flex-1" style={{ background: "color-mix(in srgb, var(--accent-primary) 40%, transparent)" }} />
    </div>
  )
}

function ApptRow({
  appt,
  beauty,
  first,
}: {
  appt: BeautyTodayAppointment
  beauty: BeautyTodayMessages
  first: boolean
}) {
  const t = beauty.real
  const intlLocale = toIntlLocale(beauty.locale)
  const past = appt.phase === "past"
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${first ? "" : "border-t border-[var(--border-dark)]"} ${past ? "opacity-55" : ""}`}
    >
      <div className="flex w-12 shrink-0 flex-col items-start">
        <span className="text-[13px] font-semibold tabular-nums text-[var(--text-primary-light)]">
          {fmtTime(appt.startsAt, intlLocale)}
        </span>
        {appt.endsAt ? (
          <span className="text-[10px] tabular-nums text-[var(--text-tertiary-light)]">
            {fmtTime(appt.endsAt, intlLocale)}
          </span>
        ) : null}
      </div>
      <span
        className="h-9 w-[3px] shrink-0 rounded-full"
        style={{ background: appt.phase === "current" ? "var(--inbox-success)" : "var(--accent-primary)" }}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13.5px] font-semibold text-[var(--text-primary-light)]">{appt.title}</p>
          {appt.phase === "current" ? (
            <span
              className="shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold"
              style={{
                background: "var(--inbox-success-soft)",
                color: "var(--inbox-success)",
                borderColor: "color-mix(in srgb, var(--inbox-success) 32%, transparent)",
              }}
            >
              {t.phaseCurrent}
            </span>
          ) : null}
        </div>
        {appt.clientName && appt.clientId ? (
          <Link
            href={`/clientes/${appt.clientId}`}
            className="truncate text-[12px] text-[var(--text-secondary-light)] hover:underline"
          >
            {appt.clientName}
          </Link>
        ) : appt.clientName ? (
          <p className="truncate text-[12px] text-[var(--text-secondary-light)]">{appt.clientName}</p>
        ) : null}
      </div>
      {appt.clientId ? (
        <Link
          href={`/clientes/${appt.clientId}`}
          aria-label={t.openClient}
          className="shrink-0 text-[var(--text-tertiary-light)] hover:text-[var(--text-primary-light)]"
        >
          <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  )
}

function GapRow({ gap, beauty, first }: { gap: BeautyTodayGap; beauty: BeautyTodayMessages; first: boolean }) {
  const t = beauty.real
  const intlLocale = toIntlLocale(beauty.locale)
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${first ? "" : "border-t"}`}
      style={{
        background: "var(--inbox-success-soft)",
        borderColor: first ? undefined : "color-mix(in srgb, var(--inbox-success) 20%, transparent)",
      }}
    >
      <span className="w-12 shrink-0 text-[11px] tabular-nums" style={{ color: "var(--inbox-success)" }}>
        {fmtTime(gap.startsAt, intlLocale)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold" style={{ color: "var(--inbox-success)" }}>
          {t.gapRow.title(fmtTime(gap.startsAt, intlLocale), fmtTime(gap.endsAt, intlLocale))}
        </p>
        <p className="text-[11.5px] text-[var(--text-secondary-light)]">{t.gapRow.minutes(gap.minutes)}</p>
      </div>
      <Link
        href="/calendario"
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border bg-[var(--app-surface-dark-elevated)] px-3 py-1.5 text-[11.5px] font-semibold"
        style={{
          borderColor: "color-mix(in srgb, var(--inbox-success) 40%, transparent)",
          color: "var(--inbox-success)",
        }}
      >
        <CalendarPlus size={12} strokeWidth={2} aria-hidden="true" />
        {t.openCalendar}
      </Link>
    </div>
  )
}

// ─── Next appointment ────────────────────────────────────────────────────────

function NextAppointmentCard({
  next,
  t,
  beauty,
}: {
  next: BeautyTodayAppointment | null
  t: BeautyTodayMessages["real"]
  beauty: BeautyTodayMessages
}) {
  const intlLocale = toIntlLocale(beauty.locale)
  return (
    <section className={`${CARD} p-4`} aria-label={t.nextTitle}>
      <div className="mb-2 flex items-center gap-2">
        <Clock size={14} strokeWidth={2} className="text-[var(--accent-on-dark)]" aria-hidden="true" />
        <h2 className="text-[14px] font-semibold tracking-tight text-[var(--text-primary-light)]">
          {t.nextTitle}
        </h2>
      </div>
      {next === null ? (
        <p className="text-[12px] text-[var(--text-secondary-light)]">{t.nextNone}</p>
      ) : (
        <div className="flex items-center gap-3">
          <span className="text-[18px] font-semibold tabular-nums text-[var(--text-primary-light)]">
            {fmtTime(next.startsAt, intlLocale)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-[var(--text-primary-light)]">{next.title}</p>
            {next.clientName ? (
              next.clientId ? (
                <Link
                  href={`/clientes/${next.clientId}`}
                  className="truncate text-[12px] text-[var(--text-secondary-light)] hover:underline"
                >
                  {next.clientName}
                </Link>
              ) : (
                <p className="truncate text-[12px] text-[var(--text-secondary-light)]">{next.clientName}</p>
              )
            ) : null}
          </div>
          {next.clientId ? (
            <Link
              href={`/clientes/${next.clientId}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-[var(--accent-muted-border)] bg-[var(--accent-muted)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--accent-on-dark)]"
            >
              {t.openClient}
            </Link>
          ) : null}
        </div>
      )}
    </section>
  )
}

// ─── Actions (real tasks with stated basis) ──────────────────────────────────

function ActionsSection({
  title,
  actions,
  t,
  beauty,
  suggested = false,
}: {
  title: string
  actions: BeautyTodayAction[]
  t: BeautyTodayMessages["real"]
  beauty: BeautyTodayMessages
  suggested?: boolean
}) {
  if (actions.length === 0) return null
  const intlLocale = toIntlLocale(beauty.locale)
  return (
    <section className="flex flex-col gap-3" aria-label={title}>
      <div className="flex items-center gap-2">
        <h2 className="text-[14px] font-semibold tracking-tight text-[var(--text-primary-light)]">{title}</h2>
        <span
          className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-md px-1.5 text-[10px] font-bold text-white"
          style={{ background: "var(--accent-primary)" }}
        >
          {actions.length}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {actions.map((action) => {
          const badges: Array<{ text: string; tone: string }> = []
          if (action.suggestedByAi) badges.push({ text: t.proposedLabel, tone: "var(--inbox-info)" })
          if (action.overdue) badges.push({ text: t.overdueLabel, tone: "var(--inbox-urgency)" })
          if (action.isWaiting) badges.push({ text: t.waitingLabel, tone: "var(--inbox-lead)" })

          const basisChips: string[] = []
          if (action.basis.sourceLabel) basisChips.push(action.basis.sourceLabel)
          if (action.basis.clientName) basisChips.push(action.basis.clientName)

          return (
            <div key={action.itemId} className="rounded-[15px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-3.5">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-[12.5px] font-semibold leading-snug text-[var(--text-primary-light)]">
                    {action.title}
                  </p>
                  {action.description ? (
                    <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-[var(--text-secondary-light)]">
                      {action.description}
                    </p>
                  ) : null}
                </div>
                {badges.map((b) => (
                  <span
                    key={b.text}
                    className="shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold"
                    style={{
                      color: b.tone,
                      borderColor: `color-mix(in srgb, ${b.tone} 36%, transparent)`,
                      background: `color-mix(in srgb, ${b.tone} 10%, transparent)`,
                    }}
                  >
                    {b.text}
                  </span>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
                {suggested && basisChips.length > 0 ? (
                  <span className="text-[10.5px] text-[var(--text-tertiary-light)]">
                    {t.basisPrefix} {basisChips.join(" · ")}
                  </span>
                ) : basisChips.length > 0 ? (
                  <span className="text-[10.5px] text-[var(--text-tertiary-light)]">{basisChips.join(" · ")}</span>
                ) : null}
                {action.dueAt && !action.overdue ? (
                  <span className="text-[10.5px] tabular-nums text-[var(--text-tertiary-light)]">
                    {t.dueAtLabel(fmtTime(action.dueAt, intlLocale))}
                  </span>
                ) : null}
                <Link
                  href={action.href}
                  className="ml-auto inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--accent-on-dark)] hover:underline"
                >
                  {t.open}
                  <ArrowRight size={11} strokeWidth={2} aria-hidden="true" />
                </Link>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Cross-module rows (messages / collections / workboard) ──────────────────

function OpsRows({
  data,
  t,
  beauty,
}: {
  data: BeautyTodayPayload
  t: BeautyTodayMessages["real"]
  beauty: BeautyTodayMessages
}) {
  const rows: Array<{
    key: string
    icon: typeof MessageSquare
    text: string
    href: string
    label: string
    tone: string
  }> = []

  if (data.pendingConversations !== null && data.pendingConversations > 0) {
    rows.push({
      key: "messages",
      icon: MessageSquare,
      text: t.messagesRow(data.pendingConversations),
      href: "/inbox",
      label: t.openInbox,
      tone: "var(--inbox-info)",
    })
  }
  if (data.overdueInvoices !== null && data.overdueInvoices.count > 0) {
    rows.push({
      key: "overdue",
      icon: Receipt,
      text: t.overdueInvoicesRow(
        data.overdueInvoices.count,
        formatCurrency(data.overdueInvoices.amount, { locale: beauty.locale, currency: data.currency }),
      ),
      href: "/facturacion",
      label: t.openBilling,
      tone: "var(--inbox-urgency)",
    })
  }
  if (data.pendingInvoices !== null && data.pendingInvoices.count > 0) {
    rows.push({
      key: "pending",
      icon: Receipt,
      text: t.pendingInvoicesRow(
        data.pendingInvoices.count,
        formatCurrency(data.pendingInvoices.amount, { locale: beauty.locale, currency: data.currency }),
      ),
      href: "/facturacion",
      label: t.openBilling,
      tone: "var(--inbox-lead)",
    })
  }

  const showAllClear =
    rows.length === 0 && data.urgentActions.length === 0 && data.suggestedActions.length === 0

  return (
    <section className={`${CARD} flex flex-col gap-2.5 p-4`}>
      {rows.map((row) => {
        const Icon = row.icon
        return (
          <div key={row.key} className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-lg"
              style={{ background: `color-mix(in srgb, ${row.tone} 14%, transparent)`, color: row.tone }}
            >
              <Icon size={12} strokeWidth={2} />
            </span>
            <p className="min-w-0 flex-1 text-[12px] text-[var(--text-primary-light)]">{row.text}</p>
            <Link
              href={row.href}
              className="shrink-0 text-[11.5px] font-semibold text-[var(--accent-on-dark)] hover:underline"
            >
              {row.label}
            </Link>
          </div>
        )
      })}
      {showAllClear ? (
        <p className="text-[12px] text-[var(--text-secondary-light)]">{t.allClear}</p>
      ) : null}
      <div className="border-t border-[var(--border-dark)] pt-2.5">
        <Link
          href="/today?todayLayout=work_first"
          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--accent-on-dark)] hover:underline"
        >
          {data.otherOpenTaskCount > 0 ? `${t.otherTasksRow(data.otherOpenTaskCount)} · ` : ""}
          {t.openWorkboard}
          <ArrowRight size={11} strokeWidth={2} aria-hidden="true" />
        </Link>
      </div>
    </section>
  )
}

// ─── Honest empty day ────────────────────────────────────────────────────────

function EmptyDay({
  t,
  otherOpenTaskCount,
}: {
  t: BeautyTodayMessages["real"]
  otherOpenTaskCount: number
}) {
  return (
    <div className={`${CARD} mx-auto mt-4 flex w-full max-w-lg flex-col items-center gap-3 p-8 text-center`}>
      <p className="text-[15px] font-semibold text-[var(--text-primary-light)]">{t.emptyDay.title}</p>
      <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary-light)]">{t.emptyDay.description}</p>
      <CalendarLink label={t.emptyDay.cta} primary />
      {otherOpenTaskCount > 0 ? (
        <Link
          href="/today?todayLayout=work_first"
          className="text-[11.5px] font-semibold text-[var(--accent-on-dark)] hover:underline"
        >
          {t.otherTasksRow(otherOpenTaskCount)} · {t.openWorkboard}
        </Link>
      ) : null}
    </div>
  )
}

function CalendarLink({ label, primary = false }: { label: string; primary?: boolean }) {
  return (
    <Link
      href="/calendario"
      className={
        primary
          ? "mt-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 py-2 text-[12.5px] font-semibold text-white"
          : "inline-flex items-center gap-1 text-[12px] font-semibold text-[var(--accent-on-dark)] hover:underline"
      }
    >
      <CalendarPlus size={13} strokeWidth={2} aria-hidden="true" />
      {label}
    </Link>
  )
}
