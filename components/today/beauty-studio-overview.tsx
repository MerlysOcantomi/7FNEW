"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  ArrowRight,
  CalendarClock,
  Clock,
  Heart,
  MessageSquare,
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
import type { BeautyTodayConfig } from "@modules/today/beauty-today"
import { BEAUTY_SPECIALIST_AGENT } from "@core/vertical-packs/specialists"
import { getBeautyAppointmentDayMock } from "./appointments/appointment-mock"

/**
 * Beauty / Finesse "Studio" overview — the premium product surface a Beauty
 * workspace lands on ("Hoy" / `/today` in appointment_first mode). It is the
 * native, real-product answer to the v0 "Beauty Control Room" mockups: same
 * route, same AppShell, same tokens — NOT a copy of that markup.
 *
 * Deliberate product decisions (from the review of the v0 direction):
 *   - Product-app layout, NOT a landing: a compact, LEFT-ALIGNED brand +
 *     day header (no centered hero, no "Beauty Control Room" headline).
 *   - Clear hierarchy: the agenda is the protagonist; Finesse's decisions sit
 *     in a side assistant rail that explains what she is doing.
 *   - Operational, not a metrics wall: one inline stat line, no KPI tiles, no
 *     decorative "pulse" cards.
 *
 * Discipline honored (same as `TodayAppointmentLayout`, which stays the generic
 * English appointment preview for other verticals):
 *   - COLORS: semantic theme tokens only. No hardcoded hex, no parallel palette.
 *     Renders correctly under any theme and takes its Rose Nude skin for free
 *     when `data-theme="rose-nude"` is active (?theme=rose-nude or the toggle).
 *   - DATA: the isolated demo adapter (`getBeautyAppointmentDayMock`) — no real
 *     appointment backend exists yet, so a "Vista previa · datos de ejemplo"
 *     chip is always shown and every write-ish action is disabled (never
 *     simulates a write). Spanish copy comes from `beauty-today.ts` / the Beauty
 *     pack + the Finesse voice; nothing is hardcoded here beyond presentation.
 *   - No schema changes, no new route, local UI state only.
 */

// ─── Status → tokens (mirrors the sibling appointment layout) ────────────────

interface StatusTokens {
  bg: string
  text: string
  border: string
}

const STATUS_TOKENS: Record<AppointmentStatus, StatusTokens> = {
  confirmed: {
    bg: "var(--accent-muted)",
    text: "var(--accent-on-dark)",
    border: "var(--accent-muted-border)",
  },
  pending: {
    bg: "var(--inbox-lead-soft)",
    text: "var(--inbox-lead)",
    border: "color-mix(in srgb, var(--inbox-lead) 32%, transparent)",
  },
  arrived: {
    bg: "var(--inbox-success-soft)",
    text: "var(--inbox-success)",
    border: "color-mix(in srgb, var(--inbox-success) 32%, transparent)",
  },
  no_show: {
    bg: "var(--inbox-urgency-soft)",
    text: "var(--inbox-urgency)",
    border: "color-mix(in srgb, var(--inbox-urgency) 32%, transparent)",
  },
  cancelled: {
    bg: "var(--inbox-urgency-soft)",
    text: "var(--inbox-urgency)",
    border: "color-mix(in srgb, var(--inbox-urgency) 32%, transparent)",
  },
}

const GAP_COLOR = "var(--inbox-info)"

// ─── Time helpers ────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
}

/** `€213` style, no decimals — a single glance, not a finance report. */
function fmtEuro(value: number): string {
  return `${value.toLocaleString("es-ES")} €`
}

// ─── Entry ───────────────────────────────────────────────────────────────────

export function BeautyStudioOverview({
  businessName,
  beauty,
}: {
  businessName: string | null
  beauty: BeautyTodayConfig
}) {
  const searchParams = useSearchParams()
  const staffMode = searchParams.get("staff") === "solo" ? "solo" : "multi"
  const day = useMemo<AppointmentDay>(() => getBeautyAppointmentDayMock(staffMode), [staffMode])
  const derived = useMemo(() => deriveAppointmentDay(day), [day])

  // Live "now" — gated after mount to avoid SSR/client mismatch.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col gap-6">
      <StudioHeader
        businessName={businessName ?? day.businessName}
        beauty={beauty}
        appointments={derived.appointmentsCount}
        unconfirmed={derived.unconfirmedCount}
        openGaps={derived.openGaps}
        bookedValue={derived.bookedValue}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <AgendaPanel day={day} now={now} beauty={beauty} />
        <FinesseRail day={day} beauty={beauty} />
      </div>

      <CareSection beauty={beauty} />
    </div>
  )
}

// ─── Header: compact, LEFT-ALIGNED brand + day + one inline stat line ─────────

function StudioHeader({
  businessName,
  beauty,
  appointments,
  unconfirmed,
  openGaps,
  bookedValue,
}: {
  businessName: string
  beauty: BeautyTodayConfig
  appointments: number
  unconfirmed: number
  openGaps: number
  bookedValue: number
}) {
  const dateLabel = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  const stats: { label: string; value: string; tone?: "lead" | "info" }[] = [
    { label: "Citas", value: String(appointments) },
    { label: "Sin confirmar", value: String(unconfirmed), tone: unconfirmed > 0 ? "lead" : undefined },
    { label: "Huecos", value: String(openGaps), tone: openGaps > 0 ? "info" : undefined },
    { label: "Ingresos previstos", value: fmtEuro(bookedValue) },
  ]

  return (
    <header className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Brand lockup — FINESSE wordmark (Inter, wide tracking) + by Sevenef */}
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{
              background:
                "linear-gradient(135deg, var(--agent-rose, var(--accent-primary)), var(--accent-rich))",
              color: "#fff",
            }}
          >
            <Sparkles size={17} strokeWidth={1.9} />
          </span>
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[15px] font-semibold uppercase leading-none tracking-[0.28em] text-[var(--text-primary-light)]">
                Finesse
              </span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-[var(--text-tertiary-light)]">
                by Sevenef
              </span>
            </div>
            <p suppressHydrationWarning className="mt-1 text-[12.5px] text-[var(--text-secondary-light)]">
              <span className="font-medium text-[var(--text-primary-light)]">{businessName}</span>
              <span className="text-[var(--text-tertiary-light)]"> · {dateLabel}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span
            className="inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide"
            style={{
              borderColor: "color-mix(in srgb, var(--inbox-info) 40%, transparent)",
              color: "var(--inbox-info)",
            }}
            title="Datos de ejemplo mientras conectamos las citas reales."
          >
            {beauty.previewChip}
          </span>
          {/* Finesse entry — disabled until the assistant is wired (no fake action). */}
          <button
            type="button"
            disabled
            title="Disponible al conectar el asistente"
            className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium opacity-80"
            style={{
              borderColor: "var(--accent-muted-border)",
              background: "var(--accent-muted)",
              color: "var(--accent-on-dark)",
            }}
          >
            <Sparkles size={13} strokeWidth={2} aria-hidden="true" />
            {BEAUTY_SPECIALIST_AGENT.voice.ask}
          </button>
        </div>
      </div>

      {/* One operational stat line — figures at a glance, not a KPI wall. */}
      <div className="flex flex-wrap items-stretch gap-2">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-2 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-3 py-2"
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary-light)]">
              {s.label}
            </span>
            <span
              className="text-[14px] font-bold tabular-nums"
              style={{
                color:
                  s.tone === "lead"
                    ? "var(--inbox-lead)"
                    : s.tone === "info"
                      ? "var(--inbox-info)"
                      : "var(--text-primary-light)",
              }}
            >
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </header>
  )
}

// ─── Agenda protagonist ──────────────────────────────────────────────────────

type AgendaEntry =
  | { kind: "appt"; start: string; appt: Appointment }
  | { kind: "gap"; start: string; gap: AppointmentGap }

function AgendaPanel({
  day,
  now,
  beauty,
}: {
  day: AppointmentDay
  now: Date | null
  beauty: BeautyTodayConfig
}) {
  const entries = useMemo<AgendaEntry[]>(() => {
    const merged: AgendaEntry[] = [
      ...day.appointments.map((appt) => ({ kind: "appt" as const, start: appt.start, appt })),
      ...day.gaps.map((gap) => ({ kind: "gap" as const, start: gap.start, gap })),
    ]
    return merged.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  }, [day])

  const nowMs = now ? now.getTime() : null
  const nowLabel = now
    ? now.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" })
    : null
  let nowShown = false

  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4">
      <div className="flex items-center gap-2">
        <CalendarClock size={15} strokeWidth={1.9} className="text-[var(--accent-on-dark)]" aria-hidden="true" />
        <h2 className="text-[14px] font-semibold tracking-tight text-[var(--text-primary-light)]">
          Agenda de hoy
        </h2>
        <span className="text-[11px] tabular-nums text-[var(--text-tertiary-light)]">
          {day.appointments.length} citas · {day.gaps.length} huecos
        </span>
        {nowLabel ? (
          <span className="ml-auto inline-flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent-primary)" }} aria-hidden="true" />
            <span suppressHydrationWarning className="text-[11px] font-medium tabular-nums" style={{ color: "var(--accent-primary)" }}>
              {beauty.ui.now} {nowLabel}
            </span>
          </span>
        ) : null}
      </div>

      <div className="flex flex-col gap-2.5">
        {entries.map((entry) => {
          const startMs = new Date(entry.start).getTime()
          const showNow = nowMs !== null && !nowShown && startMs > nowMs
          if (showNow) nowShown = true
          return (
            <div key={entry.kind === "appt" ? entry.appt.id : entry.gap.id} className="flex flex-col gap-2.5">
              {showNow ? (
                <div className="flex items-center gap-2" aria-hidden="true">
                  <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent-primary)" }} />
                  <span
                    className="text-[10px] font-semibold uppercase tracking-widest"
                    style={{ color: "var(--accent-primary)" }}
                  >
                    {beauty.ui.now}
                  </span>
                  <span className="h-px flex-1" style={{ background: "var(--accent-primary)" }} />
                </div>
              ) : null}
              {entry.kind === "appt" ? (
                <AgendaApptRow appt={entry.appt} beauty={beauty} />
              ) : (
                <AgendaGapRow gap={entry.gap} beauty={beauty} />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function AgendaApptRow({ appt, beauty }: { appt: Appointment; beauty: BeautyTodayConfig }) {
  const st = STATUS_TOKENS[appt.status]
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3.5 py-3">
      <div className="flex w-14 shrink-0 flex-col items-start">
        <span className="text-[13px] font-semibold tabular-nums text-[var(--text-primary-light)]">{fmtTime(appt.start)}</span>
        <span className="text-[10px] tabular-nums text-[var(--text-tertiary-light)]">{fmtTime(appt.end)}</span>
      </div>
      {/* Status accent bar — the color IS the state, at a glance. */}
      <span className="h-9 w-[3px] shrink-0 rounded-full" style={{ background: st.text }} aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-semibold text-[var(--text-primary-light)]">{appt.clientName}</p>
        <p className="truncate text-[12px] text-[var(--text-secondary-light)]">{appt.service}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: st.bg, color: st.text, borderColor: st.border }}
        >
          {beauty.statusLabels[appt.status]}
        </span>
        {typeof appt.price === "number" ? (
          <span className="text-[11px] tabular-nums text-[var(--text-tertiary-light)]">{fmtEuro(appt.price)}</span>
        ) : null}
      </div>
    </div>
  )
}

function AgendaGapRow({ gap, beauty }: { gap: AppointmentGap; beauty: BeautyTodayConfig }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-dashed px-3.5 py-2.5"
      style={{
        borderColor: "color-mix(in srgb, var(--inbox-info) 45%, transparent)",
        background: "color-mix(in srgb, var(--inbox-info) 6%, transparent)",
      }}
    >
      <Clock size={14} className="shrink-0" style={{ color: GAP_COLOR }} aria-hidden="true" />
      <p className="flex-1 text-[12.5px] font-medium" style={{ color: GAP_COLOR }}>
        {beauty.ui.groups.openGaps} · {fmtTime(gap.start)} – {fmtTime(gap.end)}
      </p>
      {/* Disabled until appointment actions are connected (never fakes a write). */}
      <button
        type="button"
        disabled
        title="Disponible al conectar las citas reales"
        className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-dashed px-2 py-1 text-[11px] font-medium opacity-80"
        style={{ borderColor: "color-mix(in srgb, var(--inbox-info) 45%, transparent)", color: GAP_COLOR }}
      >
        <UserPlus size={11} strokeWidth={2} aria-hidden="true" />
        {beauty.ui.actions.waitlist}
      </button>
    </div>
  )
}

// ─── Finesse rail — the assistant panel: brief + "Necesita tu decisión" ───────

interface Decision {
  id: string
  agent: string
  title: string
  meta: string
  action: { icon: typeof Send; label: string }
}

function FinesseRail({ day, beauty }: { day: AppointmentDay; beauty: BeautyTodayConfig }) {
  const derived = deriveAppointmentDay(day)

  const decisions: Decision[] = [
    ...day.appointments
      .filter((a) => a.status === "pending")
      .map((a) => ({
        id: `unc-${a.id}`,
        agent: "Fanny",
        title: `Confirmar a ${a.clientName} (${fmtTime(a.start)})`,
        meta: `${a.service} · sin confirmar`,
        action: { icon: Send, label: beauty.ui.actions.remind },
      })),
    ...day.gaps.slice(0, 1).map((g) => ({
      id: `gap-${g.id}`,
      agent: BEAUTY_SPECIALIST_AGENT.name,
      title: `Llenar el hueco de las ${fmtTime(g.start)}`,
      meta: "Ofrécelo a clientas frecuentes",
      action: { icon: UserPlus, label: beauty.ui.actions.waitlist },
    })),
    ...day.appointments
      .filter((a) => a.status === "no_show" || a.status === "cancelled")
      .map((a) => ({
        id: `fu-${a.id}`,
        agent: "Fanny",
        title: `Recuperar a ${a.clientName}`,
        meta: `${beauty.statusLabels[a.status]} · ${a.service}`,
        action: { icon: MessageSquare, label: beauty.ui.actions.message },
      })),
  ]

  return (
    <aside className="flex flex-col gap-4 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4">
      {/* Finesse identity + brief — she explains what she is doing. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-[var(--accent-on-dark)]" aria-hidden="true" />
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-on-dark)]">
            {beauty.eyebrow}
          </span>
        </div>
        <p className="text-[12.5px] leading-relaxed text-[var(--text-primary-light)]">
          Hoy tienes <strong>{derived.appointmentsCount} citas</strong>,{" "}
          <strong>{derived.unconfirmedCount} sin confirmar</strong> y{" "}
          <strong>{derived.openGaps} huecos libres</strong>. Te dejo lo importante a mano.
        </p>
      </div>

      <div className="h-px w-full" style={{ background: "var(--border-dark)" }} aria-hidden="true" />

      {/* Necesita tu decisión */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary-light)]">
            Necesita tu decisión
          </span>
          <span
            className="ml-auto inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-md px-1.5 text-[10px] font-bold text-white"
            style={{ background: "var(--accent-primary)" }}
          >
            {decisions.length}
          </span>
        </div>

        {decisions.length === 0 ? (
          <p className="text-[11px] text-[var(--text-tertiary-light)]">{beauty.ui.nothingHere}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {decisions.map((d) => (
              <DecisionCard key={d.id} decision={d} />
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function DecisionCard({ decision }: { decision: Decision }) {
  const Icon = decision.action.icon
  return (
    <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] p-3">
      <div className="mb-1.5 flex items-center gap-1.5">
        <span
          className="inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold"
          style={{ background: "var(--agent-rose-soft, var(--accent-muted))", color: "var(--agent-rose, var(--accent-on-dark))" }}
        >
          {decision.agent}
        </span>
      </div>
      <p className="text-[12.5px] font-semibold leading-snug text-[var(--text-primary-light)]">{decision.title}</p>
      <p className="mt-0.5 truncate text-[11px] text-[var(--text-tertiary-light)]">{decision.meta}</p>
      <div className="mt-2.5 flex items-center gap-2">
        {/* Primary action — disabled until the backend is connected. */}
        <button
          type="button"
          disabled
          title="Disponible al conectar las citas reales"
          className="inline-flex flex-1 cursor-not-allowed items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11.5px] font-semibold text-white opacity-80"
          style={{ background: "var(--accent-primary)" }}
        >
          <Icon size={12} strokeWidth={2} aria-hidden="true" />
          {decision.action.label}
        </button>
        <button
          type="button"
          disabled
          title="Disponible al conectar las citas reales"
          className="inline-flex cursor-not-allowed items-center rounded-md border border-[var(--border-dark)] bg-[var(--app-surface-hover)] px-2.5 py-1.5 text-[11.5px] font-medium text-[var(--text-secondary-light)] opacity-80"
        >
          Después
        </button>
      </div>
    </div>
  )
}

// ─── Cuidado de clientas — supporting, operational ────────────────────────────

function CareSection({ beauty }: { beauty: BeautyTodayConfig }) {
  return (
    <section className="flex flex-col gap-3 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4">
      <div className="flex items-center gap-2">
        <Heart size={14} strokeWidth={1.9} className="text-[var(--accent-on-dark)]" aria-hidden="true" />
        <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[var(--text-secondary-light)]">
          {beauty.ui.groups.care}
        </h2>
      </div>
      <div className="grid gap-2.5 md:grid-cols-2">
        {beauty.extras.clientsToCare.map((c) => (
          <div
            key={c.name}
            className="flex items-center gap-3 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3.5 py-3"
          >
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold"
              style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
            >
              {c.name.slice(0, 1)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[var(--text-primary-light)]">{c.name}</p>
              <p className="truncate text-[11.5px] text-[var(--text-secondary-light)]">{c.meta}</p>
            </div>
            <button
              type="button"
              disabled
              title="Disponible al conectar el asistente"
              className="inline-flex cursor-not-allowed items-center gap-1 rounded-md border border-[var(--border-dark)] bg-[var(--app-surface-hover)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--text-secondary-light)] opacity-80"
            >
              {beauty.ui.actions.message}
              <ArrowRight size={11} strokeWidth={2} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
