"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  ArrowRight,
  Camera,
  Heart,
  Instagram,
  MessageSquare,
  Plus,
  Send,
  Sparkles,
  UserPlus,
} from "lucide-react"
import {
  deriveAppointmentDay,
  type Appointment,
  type AppointmentDay,
  type AppointmentGap,
  type AppointmentStatus,
} from "@modules/today/appointments"
import { getBeautyTodayMessages, type BeautyTodayMessages } from "@modules/today/i18n"
import { BEAUTY_SPECIALIST_AGENT } from "@core/vertical-packs/specialists"
import { formatCurrency, toIntlLocale } from "@core/i18n/format"
import { useI18n } from "@/components/i18n-provider"
import { useRegisterFinesseAssistantContext } from "@/components/assistant/finesse-assistant-provider"
import { getBeautyAppointmentDayMock } from "./appointments/appointment-mock"

/**
 * Beauty / Finesse "Studio" overview — the premium product surface a Beauty
 * workspace lands on ("Hoy" / `/today` in appointment_first mode). Native
 * implementation of the Claude Design "Finesse Overview" handoff: same route,
 * same AppShell (its sidebar + mobile nav own navigation — this component
 * renders ONLY the page content), same tokens. NOT a copy of the mockup markup,
 * shell, phone frame, bottom nav or local palette.
 *
 * Layout (product-app, not a landing):
 *   - Compact LEFT-ALIGNED header: "Hoy en {studio}", a "Finesse · by Sevenef"
 *     chip, one intro line, date + derived signals, and the primary
 *     "Preguntar a Finesse" CTA.
 *   - Agenda de hoy as the protagonist, with the free slot integrated inline.
 *   - A right rail: Finesse assistant note · Necesita tu decisión · Cuidado de
 *     clientas · Momento Beauty (one visual opportunity of the day).
 *   - Stacks to a single column on mobile (AppShell's own mobile nav stays).
 *
 * Discipline:
 *   - COLORS: semantic theme tokens only — no hardcoded hex, no parallel
 *     palette. Takes the Rose Nude skin for free under `data-theme="rose-nude"`.
 *   - DATA: the isolated demo adapter (`getBeautyAppointmentDayMock`) drives the
 *     agenda over the real appointment contract; the curated narrative cards
 *     (assistant note, decisions, care, momento) are isolated DEMO content
 *     (see below), mirroring `appointment-mock.ts`. No real backend exists yet,
 *     so a "Vista previa · datos de ejemplo" chip is always shown and every
 *     write-ish action is disabled (never simulates a write). No schema changes.
 */

// ─── Demo narrative content ──────────────────────────────────────────────────
// The curated preview narrative (assistant note, decisions, care, momento)
// lives LOCALIZED in `modules/today/i18n` (`messages.demo`) — product-owned
// sample data that follows the UI language. Never real data.

type CareTone = "vip" | "warn" | "new"

/** Per-decision action icons, keyed by demo decision id (structure, not copy). */
const DECISION_ICONS: Record<string, typeof Send> = {
  d1: Send,
  d2: MessageSquare,
}

// Tone → semantic tokens (accent for VIP, lead/amber for warn, info for new).
const CARE_TONE: Record<CareTone, { bg: string; text: string }> = {
  vip: { bg: "var(--accent-muted)", text: "var(--accent-on-dark)" },
  warn: { bg: "var(--inbox-lead-soft)", text: "var(--inbox-lead)" },
  new: { bg: "var(--inbox-info-soft)", text: "var(--inbox-info)" },
}

// ─── Appointment status → tokens (mirrors the sibling appointment layout) ─────

const STATUS_TOKENS: Record<AppointmentStatus, { bg: string; text: string; border: string }> = {
  confirmed: { bg: "var(--accent-muted)", text: "var(--accent-on-dark)", border: "var(--accent-muted-border)" },
  pending: { bg: "var(--inbox-lead-soft)", text: "var(--inbox-lead)", border: "color-mix(in srgb, var(--inbox-lead) 32%, transparent)" },
  arrived: { bg: "var(--inbox-success-soft)", text: "var(--inbox-success)", border: "color-mix(in srgb, var(--inbox-success) 32%, transparent)" },
  no_show: { bg: "var(--inbox-urgency-soft)", text: "var(--inbox-urgency)", border: "color-mix(in srgb, var(--inbox-urgency) 32%, transparent)" },
  cancelled: { bg: "var(--inbox-urgency-soft)", text: "var(--inbox-urgency)", border: "color-mix(in srgb, var(--inbox-urgency) 32%, transparent)" },
}

const SLOT_COLOR = "var(--inbox-success)"

// ─── Regional format helpers (effective locale, EUR demo currency) ───────────

function fmtTime(iso: string, intlLocale: string): string {
  return new Date(iso).toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })
}
function fmtMoney(value: number, locale: string): string {
  // Demo currency is EUR; real data will carry the workspace currency.
  return formatCurrency(value, { locale, currency: "EUR" })
}

// ─── Entry ───────────────────────────────────────────────────────────────────

export function BeautyStudioOverview({ businessName }: { businessName: string | null }) {
  const searchParams = useSearchParams()
  const { locale } = useI18n()
  const beauty = useMemo(() => getBeautyTodayMessages(locale), [locale])
  const staffMode = searchParams.get("staff") === "solo" ? "solo" : "multi"
  // Demo day regenerates with the catalog's localized service names.
  const day = useMemo<AppointmentDay>(
    () => getBeautyAppointmentDayMock(staffMode, beauty.demo.services),
    [staffMode, beauty.demo.services],
  )
  const derived = useMemo(() => deriveAppointmentDay(day), [day])

  // Live "now" — gated after mount to avoid SSR/client mismatch.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const studio = businessName ?? day.businessName

  // Publish today's on-screen signals so Ask Finesse answers in context
  // ("¿qué hago primero?" knows the visible appointment/gap counts).
  useRegisterFinesseAssistantContext(
    useMemo(
      () => ({
        page: "today" as const,
        visibleMetrics: {
          citas: derived.appointmentsCount,
          huecosLibres: derived.openGaps,
          valorPrevisto: derived.bookedValue,
        },
      }),
      [derived.appointmentsCount, derived.openGaps, derived.bookedValue],
    ),
  )

  return (
    <div className="flex flex-col gap-6">
      <StudioHeader studio={studio} beauty={beauty} derived={derived} />

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <AgendaPanel day={day} now={now} beauty={beauty} />

        <div className="flex flex-col gap-6">
          <FinesseAssistant beauty={beauty} />
          <DecisionsSection beauty={beauty} />
          <CareSection beauty={beauty} />
          <MomentoBeauty beauty={beauty} />
        </div>
      </div>
    </div>
  )
}

// ─── Header ──────────────────────────────────────────────────────────────────

function StudioHeader({
  studio,
  beauty,
  derived,
}: {
  studio: string
  beauty: BeautyTodayMessages
  derived: ReturnType<typeof deriveAppointmentDay>
}) {
  const t = beauty.studio
  const dateLabel = new Date().toLocaleDateString(toIntlLocale(beauty.locale), {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  const signals: { text: string; dot: string }[] = [
    { text: t.signals.appointments(derived.appointmentsCount), dot: "var(--accent-primary)" },
    { text: t.signals.openGaps(derived.openGaps), dot: "var(--inbox-success)" },
    {
      text: t.signals.bookedValue(fmtMoney(derived.bookedValue, beauty.locale)),
      dot: "var(--inbox-lead)",
    },
  ]

  return (
    <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-[22px] font-semibold tracking-tight text-[var(--text-primary-light)]">
            {t.headerTitle(studio)}
          </h1>
          <span
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[10.5px] font-semibold"
            style={{ borderColor: "var(--accent-muted-border)", background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
          >
            <Sparkles size={12} strokeWidth={2} aria-hidden="true" />
            {BEAUTY_SPECIALIST_AGENT.name} {t.bySevenef}
          </span>
        </div>

        <p className="mt-2 max-w-xl text-[12.5px] leading-relaxed text-[var(--text-secondary-light)]">
          {t.intro}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span suppressHydrationWarning className="text-[12.5px] capitalize text-[var(--text-secondary-light)]">
            {dateLabel}
          </span>
          <span className="h-1 w-1 rounded-full bg-[var(--text-tertiary-light)]" aria-hidden="true" />
          {signals.map((s) => (
            <span key={s.text} className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--text-primary-light)]">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} aria-hidden="true" />
              {s.text}
            </span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <span
          className="inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
          style={{ borderColor: "color-mix(in srgb, var(--inbox-info) 40%, transparent)", color: "var(--inbox-info)" }}
          title={beauty.previewTooltip}
        >
          {beauty.previewChip}
        </span>
        {/*
          The former disabled "Preguntar a Finesse" header CTA was retired:
          the GLOBAL Ask Finesse floating launcher (mounted by AppShell) is
          now the one persistent assistant entry, and the product rule is to
          never duplicate it in page headers.
        */}
      </div>
    </header>
  )
}

// ─── Agenda protagonist (free slot integrated inline) ─────────────────────────

type AgendaEntry =
  | { kind: "appt"; start: string; appt: Appointment }
  | { kind: "gap"; start: string; gap: AppointmentGap }

function AgendaPanel({ day, now, beauty }: { day: AppointmentDay; now: Date | null; beauty: BeautyTodayMessages }) {
  const intlLocale = toIntlLocale(beauty.locale)
  const entries = useMemo<AgendaEntry[]>(() => {
    const merged: AgendaEntry[] = [
      ...day.appointments.map((appt) => ({ kind: "appt" as const, start: appt.start, appt })),
      ...day.gaps.slice(0, 1).map((gap) => ({ kind: "gap" as const, start: gap.start, gap })),
    ]
    return merged.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  }, [day])

  const nowMs = now ? now.getTime() : null
  const nowLabel = now
    ? now.toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })
    : null
  let nowShown = false

  return (
    <section className="min-w-0">
      <div className="mb-3 flex items-baseline gap-3">
        <h2 className="text-[17px] font-semibold tracking-tight text-[var(--text-primary-light)]">{beauty.studio.agendaTitle}</h2>
        <span className="text-[11.5px] tabular-nums text-[var(--text-tertiary-light)]">
          {beauty.studio.agendaHint(day.appointments.length, day.gaps.length)}
        </span>
        {nowLabel ? (
          <span className="ml-auto inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent-primary)" }} aria-hidden="true" />
            <span suppressHydrationWarning className="text-[11.5px] font-medium tabular-nums" style={{ color: "var(--accent-primary)" }}>
              {beauty.ui.now} {nowLabel}
            </span>
          </span>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)]">
        {entries.map((entry, i) => {
          const startMs = new Date(entry.start).getTime()
          const showNow = nowMs !== null && !nowShown && startMs > nowMs
          if (showNow) nowShown = true
          const first = i === 0
          return (
            <div key={entry.kind === "appt" ? entry.appt.id : entry.gap.id}>
              {showNow ? <NowDivider label={beauty.ui.now} /> : null}
              {entry.kind === "appt" ? (
                <AgendaApptRow appt={entry.appt} beauty={beauty} now={now} first={first && !showNow} />
              ) : (
                <AgendaGapRow gap={entry.gap} beauty={beauty} first={first && !showNow} />
              )}
            </div>
          )
        })}
      </div>
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

function AgendaApptRow({
  appt,
  beauty,
  now,
  first,
}: {
  appt: Appointment
  beauty: BeautyTodayMessages
  now: Date | null
  first: boolean
}) {
  const intlLocale = toIntlLocale(beauty.locale)
  const st = STATUS_TOKENS[appt.status]
  // Past appointments read as "done" — pure presentation, no new status.
  const past = now ? new Date(appt.end).getTime() < now.getTime() : false
  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${first ? "" : "border-t border-[var(--border-dark)]"} ${past ? "opacity-55" : ""}`}
    >
      <div className="flex w-12 shrink-0 flex-col items-start">
        <span className="text-[13px] font-semibold tabular-nums text-[var(--text-primary-light)]">{fmtTime(appt.start, intlLocale)}</span>
        <span className="text-[10px] tabular-nums text-[var(--text-tertiary-light)]">{fmtTime(appt.end, intlLocale)}</span>
      </div>
      <span className="h-9 w-[3px] shrink-0 rounded-full" style={{ background: st.text }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13.5px] font-semibold text-[var(--text-primary-light)]">{appt.clientName}</p>
          <span
            className="shrink-0 rounded-full border px-2 py-0.5 text-[9.5px] font-semibold"
            style={{ background: st.bg, color: st.text, borderColor: st.border }}
          >
            {beauty.statusLabels[appt.status]}
          </span>
        </div>
        <p className="truncate text-[12px] text-[var(--text-secondary-light)]">{appt.service}</p>
      </div>
      {typeof appt.price === "number" ? (
        <span className="shrink-0 text-[12.5px] font-semibold tabular-nums" style={{ color: "var(--accent-on-dark)" }}>
          {fmtMoney(appt.price, beauty.locale)}
        </span>
      ) : null}
    </div>
  )
}

function AgendaGapRow({ gap, beauty, first }: { gap: AppointmentGap; beauty: BeautyTodayMessages; first: boolean }) {
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
        {fmtTime(gap.start, intlLocale)}
      </span>
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--app-surface-dark-elevated)]"
        style={{ color: SLOT_COLOR }}
      >
        <Plus size={15} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] font-semibold" style={{ color: "var(--inbox-success)" }}>
          {beauty.studio.gapRow.title(fmtTime(gap.start, intlLocale), fmtTime(gap.end, intlLocale))}
        </p>
        <p className="truncate text-[11.5px] text-[var(--text-secondary-light)]">
          {beauty.studio.gapRow.note}
        </p>
      </div>
      <button
        type="button"
        disabled
        title={beauty.studio.disabledHints.connectAppointments}
        className="inline-flex shrink-0 cursor-not-allowed items-center gap-1.5 rounded-lg border bg-[var(--app-surface-dark-elevated)] px-3 py-1.5 text-[11.5px] font-semibold opacity-85"
        style={{ borderColor: "color-mix(in srgb, var(--inbox-success) 40%, transparent)", color: "var(--inbox-success)" }}
      >
        <UserPlus size={12} strokeWidth={2} aria-hidden="true" />
        {beauty.ui.actions.waitlist}
      </button>
    </div>
  )
}

// ─── Right rail ──────────────────────────────────────────────────────────────

function FinesseAssistant({ beauty }: { beauty: BeautyTodayMessages }) {
  return (
    <div
      className="rounded-[18px] border p-4"
      style={{ borderColor: "color-mix(in srgb, var(--agent-rose, var(--accent-primary)) 30%, transparent)", background: "var(--app-surface-dark)" }}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex h-6 w-6 items-center justify-center rounded-lg"
          style={{ background: "var(--agent-rose-soft, var(--accent-muted))", color: "var(--agent-rose, var(--accent-on-dark))" }}
        >
          <Sparkles size={13} strokeWidth={2} />
        </span>
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-on-dark)]">
          {BEAUTY_SPECIALIST_AGENT.voice.intelligence}
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary-light)]">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--inbox-success)" }} aria-hidden="true" />
          {beauty.studio.upToDate}
        </span>
      </div>
      <p className="text-[12.5px] leading-relaxed text-[var(--text-primary-light)]">{beauty.demo.assistantNote}</p>
    </div>
  )
}

function DecisionsSection({ beauty }: { beauty: BeautyTodayMessages }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <h2 className="text-[14px] font-semibold tracking-tight text-[var(--text-primary-light)]">{beauty.studio.decisionsTitle}</h2>
        <span
          className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-md px-1.5 text-[10px] font-bold text-white"
          style={{ background: "var(--accent-primary)" }}
        >
          {beauty.demo.decisions.length}
        </span>
      </div>
      <div className="flex flex-col gap-2.5">
        {beauty.demo.decisions.map((d) => {
          const Icon = DECISION_ICONS[d.id] ?? Send
          return (
            <div key={d.id} className="rounded-[15px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-3.5">
              <div className="mb-1.5 flex items-center gap-1.5">
                <span
                  className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
                  style={{ background: "var(--agent-rose-soft, var(--accent-muted))", color: "var(--agent-rose, var(--accent-on-dark))" }}
                >
                  {d.agent}
                </span>
                <span className="text-[10px] text-[var(--text-tertiary-light)]">· {d.kind}</span>
              </div>
              <p className="text-[12.5px] font-semibold leading-snug text-[var(--text-primary-light)]">{d.title}</p>
              <p className="mt-1 text-[11px] leading-relaxed text-[var(--text-secondary-light)]">{d.why}</p>
              <div className="mt-2.5 flex items-center gap-2">
                <button
                  type="button"
                  disabled
                  title={beauty.studio.disabledHints.connectAssistant}
                  className="inline-flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11.5px] font-semibold text-white opacity-90"
                  style={{ background: "var(--accent-primary)" }}
                >
                  <Icon size={12} strokeWidth={2} aria-hidden="true" />
                  {d.primary}
                </button>
                <button
                  type="button"
                  disabled
                  title={beauty.studio.disabledHints.connectAssistant}
                  className="inline-flex cursor-not-allowed items-center rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-hover)] px-3 py-2 text-[11.5px] font-medium text-[var(--text-secondary-light)] opacity-85"
                >
                  {beauty.studio.later}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function CareSection({ beauty }: { beauty: BeautyTodayMessages }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Heart size={14} strokeWidth={1.9} className="text-[var(--accent-on-dark)]" aria-hidden="true" />
        <h2 className="text-[14px] font-semibold tracking-tight text-[var(--text-primary-light)]">{beauty.ui.groups.care}</h2>
        <span className="text-[11px] tabular-nums text-[var(--text-tertiary-light)]">{beauty.studio.careCountHint(beauty.demo.care.length)}</span>
      </div>
      <div className="flex flex-col gap-2">
        {beauty.demo.care.map((c) => {
          const tone = CARE_TONE[c.tone]
          return (
            <div
              key={c.name}
              className="flex items-center gap-3 rounded-[14px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-3.5 py-3"
            >
              <span
                aria-hidden="true"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
                style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
              >
                {c.ini}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate text-[12.5px] font-semibold text-[var(--text-primary-light)]">{c.name}</p>
                  <span
                    className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold"
                    style={{ background: tone.bg, color: tone.text }}
                  >
                    {c.tag}
                  </span>
                </div>
                <p className="truncate text-[11px] text-[var(--text-secondary-light)]">{c.note}</p>
              </div>
              <button
                type="button"
                disabled
                title={beauty.studio.disabledHints.connectAssistant}
                className="inline-flex shrink-0 cursor-not-allowed items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold opacity-85"
                style={{ borderColor: "var(--accent-muted-border)", background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
              >
                {c.action}
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

function MomentoBeauty({ beauty }: { beauty: BeautyTodayMessages }) {
  const momento = beauty.demo.momento
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline gap-2">
        <h2 className="text-[14px] font-semibold tracking-tight text-[var(--text-primary-light)]">{beauty.studio.momentoTitle}</h2>
        <span className="text-[11px] text-[var(--text-tertiary-light)]">{beauty.studio.momentoHint}</span>
      </div>
      <div className="overflow-hidden rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)]">
        {/* Photo placeholder — token gradient stands in for the uploaded shot. */}
        <div
          className="relative flex h-40 items-end p-3"
          style={{ background: "linear-gradient(150deg, var(--accent-soft), var(--agent-rose, var(--accent-primary)))" }}
        >
          <span
            className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[9.5px] font-semibold"
            style={{ background: "var(--app-surface-dark-elevated)", color: "var(--accent-on-dark)" }}
          >
            <Instagram size={11} strokeWidth={2} aria-hidden="true" />
            {momento.channel}
          </span>
          <span
            className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-medium text-[var(--text-secondary-light)]"
            style={{ background: "var(--app-surface-dark-elevated)" }}
          >
            <Camera size={11} strokeWidth={2} aria-hidden="true" />
            {beauty.studio.uploadPhoto}
          </span>
        </div>
        <div className="p-4">
          <p className="text-[12.5px] font-semibold leading-snug text-[var(--text-primary-light)]">{momento.title}</p>
          <p className="mt-1.5 text-[11.5px] leading-relaxed text-[var(--text-secondary-light)]">{momento.note}</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              disabled
              title={beauty.studio.disabledHints.connectMarketing}
              className="inline-flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11.5px] font-semibold text-white opacity-90"
              style={{ background: "var(--accent-primary)" }}
            >
              {momento.primary}
            </button>
            <button
              type="button"
              disabled
              title={beauty.studio.disabledHints.connectMarketing}
              className="inline-flex cursor-not-allowed items-center rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-hover)] px-3 py-2 text-[11.5px] font-medium text-[var(--text-secondary-light)] opacity-85"
            >
              {momento.secondary}
            </button>
          </div>
          <div
            className="mt-3 flex items-center justify-center gap-1.5 border-t border-[var(--border-dark)] pt-3 text-[11px] font-semibold"
            style={{ color: "var(--accent-on-dark)" }}
          >
            <Plus size={12} strokeWidth={2} aria-hidden="true" />
            {momento.link}
            <ArrowRight size={12} strokeWidth={2} aria-hidden="true" className="opacity-70" />
          </div>
        </div>
      </div>
    </section>
  )
}
