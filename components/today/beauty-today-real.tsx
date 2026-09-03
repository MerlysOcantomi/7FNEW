"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Images,
  MessageSquare,
  NotebookPen,
  Phone,
  Receipt,
  Sparkles,
  StickyNote,
} from "lucide-react"
import { useFetch } from "@/hooks/use-fetch"
import { useI18n } from "@/components/i18n-provider"
import { useActiveWorkspace } from "@/hooks/use-active-workspace"
import { useRegisterFinesseAssistantContext } from "@/components/assistant/finesse-assistant-provider"
import { getBeautyTodayMessages, type BeautyTodayMessages } from "@modules/today/i18n"
import {
  buildAttentionDigest,
  isAttentionHrefNavigable,
  resolveFocusedAppointment,
  type BeautyAttentionItem,
  type BeautyTodayAppointment,
  type BeautyTodayInspiration,
  type BeautyTodayPayload,
} from "@modules/today/beauty-real"
import { BEAUTY_SPECIALIST_AGENT } from "@core/vertical-packs/specialists"
import { formatCurrency, toIntlLocale } from "@core/i18n/format"
import { composeEntityLabel, mapVerticalKeyToBusinessType, resolveVocabulary } from "@core/personalization"
import { cn } from "@/lib/utils"

/**
 * Beauty / Finesse "Hoy" — the REAL, mobile-first work surface (FINESSE-UI-02
 * Phase 2). One continuous column that answers, in order:
 *
 *   1. ¿Quién viene ahora?      → `NextClientSection` (the focus cita + prep)
 *   2. ¿Qué necesita mi atención? → `AttentionSection` (a 3-row digest)
 *   3. ¿Qué quiero enseñar/recordar? → `InspirationSection` (workspace photos)
 *
 * Every figure is a real workspace fact from `GET /api/today/beauty`:
 *   - citas are today's `Evento` rows with their `Cliente` (name, phone, notes)
 *     and the cita's own note (`descripcion`) as preparation info;
 *   - the digest re-ranks the SAME task/message/invoice signals the payload
 *     already carried (no new scoring engine, no Inbox duplication);
 *   - inspiration photos are approved `PresenceMedia` originals, read-only.
 *
 * HONESTY RULES ON SCREEN (unchanged from the previous surface):
 *   - no attendance/confirmation claims — "Ahora mismo" is time-derived only;
 *   - no booked-value figure — `Evento` carries no price;
 *   - every CTA is a REAL navigation (client, calendar, inbox, billing,
 *     workboard) or a plain `tel:` link — no write buttons are simulated.
 *
 * Future seam (NOT implemented): `resolveFocusedAppointment` accepts a
 * `selectedEventoId`; nothing here sets it — no selector, no persistence.
 *
 * Desktop is the same composition responding to width (two columns from lg),
 * not a second implementation.
 */

const CARD = "rounded-[20px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)]"

function fmtTime(iso: string, intlLocale: string): string {
  return new Date(iso).toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })
}

// ─── Entry ───────────────────────────────────────────────────────────────────

export function BeautyTodayReal({ businessName }: { businessName: string | null }) {
  const { locale } = useI18n()
  const { workspace } = useActiveWorkspace()
  const beauty = useMemo(() => getBeautyTodayMessages(locale), [locale])
  const t = beauty.real

  // The workspace's OWN client noun (vocabulary layer) — never hardcoded here.
  const clientNoun = useMemo(() => {
    const vocabulary = resolveVocabulary(
      mapVerticalKeyToBusinessType(workspace?.verticalKey ?? ""),
      undefined,
      locale,
    )
    return composeEntityLabel({ vocabulary, entity: "client", form: "singular", fallback: "Cliente" })
  }, [workspace?.verticalKey, locale])

  const [timezone, setTimezone] = useState<string | null>(null)
  useEffect(() => {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setTimezone(tz && typeof tz === "string" ? tz : "UTC")
    } catch {
      setTimezone("UTC")
    }
  }, [])

  // Live "now" — gated after mount (no SSR mismatch), refreshed each minute.
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
          trabajosInspiracion: data?.inspiration.total ?? null,
        },
      }),
      [data],
    ),
  )

  if (error) {
    return (
      <div className={`${CARD} mx-auto mt-6 flex max-w-md flex-col items-center gap-3 p-8 text-center`} role="alert">
        <p className="text-[15px] font-semibold text-[var(--text-primary-light)]">{t.error.title}</p>
        <p className="text-[12.5px] text-[var(--text-secondary-light)]">{t.error.description}</p>
        <button
          type="button"
          onClick={refetch}
          className="mt-2 inline-flex min-h-[44px] items-center justify-center rounded-xl bg-[var(--accent-primary)] px-4 py-2 text-[13px] font-semibold text-[var(--primary-foreground)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
        >
          {t.error.retry}
        </button>
      </div>
    )
  }

  if (loading || !data || now === null) {
    return (
      <div className="flex flex-col gap-5" aria-busy="true" aria-label={t.loading}>
        <div className="h-10 w-2/3 animate-pulse rounded-lg bg-[var(--app-surface-subtle)]" />
        <div className={`${CARD} h-44 animate-pulse`} />
        <div className={`${CARD} h-28 animate-pulse`} />
        <div className={`${CARD} h-36 animate-pulse`} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      <TodayHeader studio={businessName} beauty={beauty} now={now} appointments={data.appointments} />
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        <NextClientSection data={data} now={now} beauty={beauty} clientNoun={clientNoun} />
        <div className="flex flex-col gap-5">
          <AttentionSection data={data} beauty={beauty} />
          <InspirationSection inspiration={data.inspiration} t={t} />
        </div>
      </div>
    </div>
  )
}

// ─── Header (quiet: date · studio · Finesse chip · one real signal) ──────────

function TodayHeader({
  studio,
  beauty,
  now,
  appointments,
}: {
  studio: string | null
  beauty: BeautyTodayMessages
  now: Date
  appointments: BeautyTodayAppointment[]
}) {
  const t = beauty.real
  const intlLocale = toIntlLocale(beauty.locale)
  const raw = now.toLocaleDateString(intlLocale, { weekday: "long", day: "numeric", month: "long" })
  // Sentence case (first letter only) — `capitalize` would title-case every word ("3 De Septiembre").
  const dateLabel = raw.charAt(0).toLocaleUpperCase(intlLocale) + raw.slice(1)
  return (
    <header className="flex flex-col gap-1">
      <p suppressHydrationWarning className="text-[12.5px] font-medium text-[var(--text-secondary-light)]">
        {dateLabel}
        {appointments.length > 0 ? (
          <span className="text-[var(--text-tertiary-light)]"> · {t.signals.appointments(appointments.length)}</span>
        ) : null}
      </p>
      <div className="flex flex-wrap items-center gap-2.5">
        <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-[var(--text-primary-light)]">
          {studio ?? beauty.brandTitle}
        </h1>
        <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--accent-muted-border)] bg-[var(--accent-muted)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--accent-on-dark)]">
          <Sparkles size={11} strokeWidth={2} aria-hidden="true" />
          {BEAUTY_SPECIALIST_AGENT.name} {beauty.studio.bySevenef}
        </span>
      </div>
    </header>
  )
}

// ─── 1. Next client — who is coming now, with what she needs to prepare ─────

function NextClientSection({
  data,
  now,
  beauty,
  clientNoun,
}: {
  data: BeautyTodayPayload
  now: Date
  beauty: BeautyTodayMessages
  clientNoun: string
}) {
  const t = beauty.real
  const intlLocale = toIntlLocale(beauty.locale)
  // `selectedEventoId` is deliberately not passed: the manual switch is a
  // later mission (no selector, no persistence, no API here).
  const focused = useMemo(() => resolveFocusedAppointment(data.appointments, now), [data.appointments, now])
  const { focus, mode, following, remainingAfterFocus, allDone } = focused
  const title = mode === "current" ? t.nextClient.nowTitle : t.nextClient.title(clientNoun)

  return (
    <section className={`${CARD} flex flex-col gap-4 p-4 sm:p-5`} aria-labelledby="today-next-client">
      <div className="flex items-center justify-between gap-3">
        <h2 id="today-next-client" className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary-light)]">
          {title}
        </h2>
        {mode === "current" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--inbox-success-soft)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--inbox-success)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--inbox-success)]" aria-hidden="true" />
            {t.phaseCurrent}
          </span>
        ) : null}
      </div>

      {focus === null ? (
        <div className="flex flex-col gap-1 py-2">
          <p className="text-[17px] font-semibold text-[var(--text-primary-light)]">
            {allDone ? t.nextClient.emptyAllDone.title : t.nextClient.emptyNoneToday.title}
          </p>
          <p className="text-[13px] leading-relaxed text-[var(--text-secondary-light)]">
            {allDone ? t.nextClient.emptyAllDone.description : t.nextClient.emptyNoneToday.description}
          </p>
        </div>
      ) : (
        <FocusAppointment appt={focus} t={t} intlLocale={intlLocale} />
      )}

      {following ? (
        <p className="flex items-baseline gap-2 text-[13px] text-[var(--text-secondary-light)]">
          <span className="font-semibold uppercase tracking-wide text-[11px] text-[var(--text-tertiary-light)]">
            {t.nextClient.followingLabel}
          </span>
          <span className="tabular-nums font-semibold text-[var(--text-primary-light)]">{fmtTime(following.startsAt, intlLocale)}</span>
          <span className="truncate">{following.clientName ?? following.title}</span>
          {remainingAfterFocus > 1 ? (
            <span className="ml-auto shrink-0 text-[12px] text-[var(--text-tertiary-light)]">
              {t.nextClient.moreToday(remainingAfterFocus - 1)}
            </span>
          ) : null}
        </p>
      ) : null}

      <Link
        href="/calendario"
        className="flex min-h-[48px] items-center justify-between gap-2 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3.5 text-[13.5px] font-semibold text-[var(--accent-on-dark)] transition-colors hover:bg-[var(--app-surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
      >
        <span className="inline-flex items-center gap-2">
          <CalendarDays size={16} strokeWidth={2} aria-hidden="true" />
          {t.nextClient.viewAgenda}
        </span>
        <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
      </Link>
    </section>
  )
}

function FocusAppointment({
  appt,
  t,
  intlLocale,
}: {
  appt: BeautyTodayAppointment
  t: BeautyTodayMessages["real"]
  intlLocale: string
}) {
  const clientName = appt.clientName ?? t.nextClient.noClient
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <div className="flex shrink-0 flex-col items-start">
          <span className="text-[30px] font-semibold leading-none tabular-nums tracking-tight text-[var(--accent-primary)]">
            {fmtTime(appt.startsAt, intlLocale)}
          </span>
          {appt.endsAt ? (
            <span className="mt-1 text-[11px] tabular-nums text-[var(--text-tertiary-light)]">
              {t.nextClient.untilLabel(fmtTime(appt.endsAt, intlLocale))}
            </span>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          {appt.clientId ? (
            <Link
              href={`/clientes/${appt.clientId}`}
              className="block truncate text-[20px] font-semibold leading-tight text-[var(--text-primary-light)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] rounded-md"
            >
              {clientName}
            </Link>
          ) : (
            <p className="truncate text-[20px] font-semibold leading-tight text-[var(--text-primary-light)]">{clientName}</p>
          )}
          <p className="mt-0.5 truncate text-[14px] text-[var(--text-secondary-light)]">{appt.title}</p>
        </div>
      </div>

      {appt.note || appt.clientNotes ? (
        <div className="flex flex-col gap-2 rounded-xl bg-[var(--app-surface-subtle)] p-3">
          {appt.note ? (
            <PrepLine icon={StickyNote} label={t.nextClient.noteLabel} text={appt.note} />
          ) : null}
          {appt.clientNotes ? (
            <PrepLine icon={NotebookPen} label={t.nextClient.clientNotesLabel} text={appt.clientNotes} />
          ) : null}
        </div>
      ) : null}

      {appt.clientId || appt.clientPhone ? (
        <div className="flex flex-wrap gap-2">
          {appt.clientPhone ? (
            <a
              href={`tel:${appt.clientPhone.replace(/[^\d+]/g, "")}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-[var(--accent-primary)] px-3.5 text-[13px] font-semibold text-[var(--primary-foreground)] hover:bg-[var(--accent-primary-hover)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
            >
              <Phone size={15} strokeWidth={2} aria-hidden="true" />
              {t.nextClient.call}
            </a>
          ) : null}
          {appt.clientId ? (
            <Link
              href={`/clientes/${appt.clientId}`}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-[var(--accent-muted-border)] bg-[var(--accent-muted)] px-3.5 text-[13px] font-semibold text-[var(--accent-on-dark)] hover:bg-[var(--accent-soft)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
            >
              {t.openClient}
              <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

function PrepLine({ icon: Icon, label, text }: { icon: typeof StickyNote; label: string; text: string }) {
  return (
    <div className="flex gap-2.5">
      <Icon size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-[var(--accent-on-dark)]" aria-hidden="true" />
      <div className="min-w-0">
        <p className="text-[10.5px] font-semibold uppercase tracking-wide text-[var(--text-tertiary-light)]">{label}</p>
        <p className="line-clamp-3 whitespace-pre-line text-[13px] leading-relaxed text-[var(--text-primary-light)]">{text}</p>
      </div>
    </div>
  )
}

// ─── 2. What needs attention — a short, ranked digest of existing signals ────

export function AttentionSection({
  data,
  beauty,
  currentPathname,
}: {
  data: BeautyTodayPayload
  beauty: BeautyTodayMessages
  /** Route the section is rendered on (defaults to the router's pathname). */
  currentPathname?: string
}) {
  const t = beauty.real
  const intlLocale = toIntlLocale(beauty.locale)
  const digest = useMemo(() => buildAttentionDigest(data), [data])
  const routerPathname = usePathname()
  const pathname = currentPathname ?? routerPathname ?? "/today"

  return (
    <section className={`${CARD} flex flex-col gap-3 p-4 sm:p-5`} aria-labelledby="today-attention">
      <div className="flex items-center justify-between gap-3">
        <h2 id="today-attention" className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary-light)]">
          {t.attention.title}
        </h2>
        {digest.items.length > 0 ? (
          <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent-primary)] px-1.5 text-[10.5px] font-bold text-[var(--primary-foreground)]">
            {digest.items.length + digest.hiddenCount}
          </span>
        ) : null}
      </div>

      {digest.items.length === 0 ? (
        <p className="text-[13.5px] text-[var(--text-secondary-light)]">{t.attention.empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-[var(--border-dark)]">
          {digest.items.map((item) => (
            <AttentionRow
              key={item.id}
              item={item}
              t={t}
              intlLocale={intlLocale}
              locale={beauty.locale}
              currency={data.currency}
              navigable={isAttentionHrefNavigable(item.href, pathname)}
            />
          ))}
        </ul>
      )}

      {/*
        Quiet footer: overflow count + Finesse proposals summary. Deliberately
        NO general "see all" CTA — the legacy work-first board is not the
        continuation of this Hoy (FINESSE-UI-02 Phase 2 R1); every signal above
        already navigates to its own real surface.
      */}
      {digest.hiddenCount > 0 || digest.suggestedCount > 0 ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[var(--border-dark)] pt-3 text-[12.5px] text-[var(--text-secondary-light)]">
          {digest.hiddenCount > 0 ? <span>{t.attention.more(digest.hiddenCount)}</span> : null}
          {digest.suggestedCount > 0 ? (
            <span className="inline-flex items-center gap-1">
              <Sparkles size={12} strokeWidth={2} className="text-[var(--accent-on-dark)]" aria-hidden="true" />
              {t.attention.suggestions(digest.suggestedCount)}
            </span>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}

function AttentionRow({
  item,
  t,
  intlLocale,
  locale,
  currency,
  navigable,
}: {
  item: BeautyAttentionItem
  t: BeautyTodayMessages["real"]
  intlLocale: string
  locale: BeautyTodayMessages["locale"]
  currency: string
  /** False when the href would be a no-op from this route → informative row, no link affordance. */
  navigable: boolean
}) {
  const money = (amount: number | null) => formatCurrency(amount ?? 0, { locale, currency })
  let Icon = Receipt
  let text = item.title ?? ""
  let detail: string | null = null
  let tone = "var(--accent-primary)"
  switch (item.kind) {
    case "task":
      Icon = StickyNote
      tone = item.overdue ? "var(--inbox-urgency)" : "var(--accent-primary)"
      detail = [
        item.overdue ? t.overdueLabel : item.dueAt ? t.dueAtLabel(fmtTime(item.dueAt, intlLocale)) : null,
        item.clientName,
      ]
        .filter(Boolean)
        .join(" · ") || null
      break
    case "messages":
      Icon = MessageSquare
      text = t.attention.messages(item.count ?? 0)
      tone = "var(--inbox-info)"
      break
    case "overdue-invoices":
      Icon = Receipt
      text = t.attention.overdueInvoices(item.count ?? 0, money(item.amount))
      tone = "var(--inbox-urgency)"
      break
    case "pending-invoices":
      Icon = Receipt
      text = t.attention.pendingInvoices(item.count ?? 0, money(item.amount))
      tone = "var(--inbox-lead)"
      break
  }
  const content = (
    <>
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
        style={{ background: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}
        aria-hidden="true"
      >
        <Icon size={15} strokeWidth={2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13.5px] font-semibold text-[var(--text-primary-light)]">{text}</span>
        {detail ? <span className="block truncate text-[12px] text-[var(--text-secondary-light)]">{detail}</span> : null}
      </span>
    </>
  )
  const rowLayout = "flex min-h-[52px] items-center gap-3 py-2 text-left rounded-lg -mx-1 px-1"
  if (!navigable) {
    // Informative row: same content, priority and layout — no chevron, no
    // hover, no focus ring, not a link (the destination would be this route).
    return (
      <li>
        <div className={rowLayout} data-attention-row="static">
          {content}
        </div>
      </li>
    )
  }
  return (
    <li>
      <Link
        href={item.href}
        data-attention-row="link"
        className={`${rowLayout} transition-colors hover:bg-[var(--app-surface-hover)] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[var(--accent-primary)]`}
      >
        {content}
        <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-[var(--text-tertiary-light)]" aria-hidden="true" />
      </Link>
    </li>
  )
}

// ─── 3. My inspiration — approved workspace photos, read-only ────────────────

export function InspirationSection({
  inspiration,
  t,
}: {
  inspiration: BeautyTodayInspiration
  t: BeautyTodayMessages["real"]
}) {
  return (
    <section className={`${CARD} flex flex-col gap-3 p-4 sm:p-5`} aria-labelledby="today-inspiration">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 id="today-inspiration" className="text-[12px] font-semibold uppercase tracking-[0.08em] text-[var(--text-secondary-light)]">
            {t.inspiration.title}
          </h2>
          <p className="text-[12.5px] text-[var(--text-tertiary-light)]">{t.inspiration.subtitle}</p>
        </div>
        {inspiration.total > 0 ? (
          <span className="shrink-0 text-[12px] font-medium text-[var(--text-secondary-light)]">
            {t.inspiration.count(inspiration.total)}
          </span>
        ) : null}
      </div>

      {inspiration.items.length === 0 ? (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-[var(--border-dark-strong)] bg-[var(--app-surface-subtle)] p-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[var(--accent-muted)] text-[var(--accent-on-dark)]" aria-hidden="true">
            <Images size={18} strokeWidth={2} />
          </span>
          <div className="min-w-0">
            <p className="text-[13.5px] font-semibold text-[var(--text-primary-light)]">{t.inspiration.empty.title}</p>
            <p className="text-[12.5px] leading-relaxed text-[var(--text-secondary-light)]">{t.inspiration.empty.description}</p>
          </div>
        </div>
      ) : (
        <ul className="-mx-1 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden" aria-label={t.inspiration.title}>
          {inspiration.items.map((item, index) => (
            <li key={item.id} className="shrink-0 snap-start">
              {/* eslint-disable-next-line @next/next/no-img-element -- external Blob URLs, fixed thumb box */}
              <img
                src={item.url}
                alt={t.inspiration.imageAlt(index + 1)}
                width={item.width ?? undefined}
                height={item.height ?? undefined}
                loading="lazy"
                decoding="async"
                className={cn(
                  "h-[116px] w-[116px] rounded-[14px] border border-[var(--border-dark)] bg-[var(--app-surface-subtle)] object-cover",
                  "sm:h-[132px] sm:w-[132px]",
                )}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
