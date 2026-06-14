"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CalendarClock, Clock, MessageSquare, Send, Sparkles, UserPlus } from "lucide-react"
import {
  deriveAppointmentDay,
  type Appointment,
  type AppointmentDay,
  type AppointmentDerived,
  type AppointmentGap,
  type AppointmentStatus,
} from "@modules/today/appointments"
import { getAppointmentDayMock } from "./appointments/appointment-mock"

/**
 * Appointment-first Today layout — the booking/agenda canvas for clinics,
 * salons, barbers, nails, spa and by-appointment services. Same `/today` route,
 * same AppShell, same tokens. It is GATED OFF by default and currently renders
 * the isolated demo adapter (no real appointment backend exists yet) — see
 * modules/today/today-layout-mode.ts. Reviewers preview it with
 * `?todayLayout=appointment_first` (and `&staff=solo` for the single-provider
 * sub-layout). Mobile is untouched; the Today Peek is untouched.
 */

const START_HOUR = 8
const END_HOUR = 20
const HOUR_PX = 52
const TOTAL_PX = (END_HOUR - START_HOUR) * HOUR_PX
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

// ─── Status → tokens ─────────────────────────────────────────────────────────

interface StatusStyle {
  bg: string
  text: string
  border: string
  label: string
}

const STATUS_STYLE: Record<AppointmentStatus, StatusStyle> = {
  confirmed: {
    bg: "var(--accent-muted)",
    text: "var(--accent-on-dark)",
    border: "var(--accent-muted-border)",
    label: "Confirmed",
  },
  pending: {
    bg: "var(--inbox-lead-soft)",
    text: "var(--inbox-lead)",
    border: "color-mix(in srgb, var(--inbox-lead) 32%, transparent)",
    label: "Unconfirmed",
  },
  arrived: {
    bg: "var(--inbox-success-soft)",
    text: "var(--inbox-success)",
    border: "color-mix(in srgb, var(--inbox-success) 32%, transparent)",
    label: "Arrived",
  },
  no_show: {
    bg: "var(--inbox-urgency-soft)",
    text: "var(--inbox-urgency)",
    border: "color-mix(in srgb, var(--inbox-urgency) 32%, transparent)",
    label: "No-show",
  },
  cancelled: {
    bg: "var(--inbox-urgency-soft)",
    text: "var(--inbox-urgency)",
    border: "color-mix(in srgb, var(--inbox-urgency) 32%, transparent)",
    label: "Cancelled",
  },
}

const GAP_COLOR = "var(--inbox-info)"

// ─── Time helpers ──────────────────────────────────────────────────────────

function hourOf(iso: string): number {
  const d = new Date(iso)
  return d.getHours() + d.getMinutes() / 60
}
function clampHour(h: number): number {
  return Math.min(Math.max(h, START_HOUR), END_HOUR)
}
function topPx(iso: string): number {
  return (clampHour(hourOf(iso)) - START_HOUR) * HOUR_PX
}
function blockPx(start: string, end: string): number {
  return Math.max(topPx(end) - topPx(start), 22)
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}
function fmtHourLabel(h: number): string {
  const d = new Date()
  d.setHours(h, 0, 0, 0)
  return d.toLocaleTimeString(undefined, { hour: "numeric" })
}

// ─── Entry layout ────────────────────────────────────────────────────────────

export function TodayAppointmentLayout({ businessName }: { businessName: string | null }) {
  const searchParams = useSearchParams()
  const staffMode = searchParams.get("staff") === "solo" ? "solo" : "multi"
  const day = useMemo<AppointmentDay>(() => getAppointmentDayMock(staffMode), [staffMode])
  const derived = useMemo(() => deriveAppointmentDay(day), [day])

  // Live "now" line — gated after mount to avoid SSR/client mismatch.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])
  const nowHour = now ? now.getHours() + now.getMinutes() / 60 : null
  const nowTop = nowHour !== null && nowHour >= START_HOUR && nowHour <= END_HOUR
    ? (nowHour - START_HOUR) * HOUR_PX
    : null

  const isMulti = day.staff.length >= 2

  return (
    <div className="flex flex-col gap-6">
      <AppointmentSummaryBar
        derived={derived}
        businessName={businessName ?? day.businessName}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {isMulti ? (
            <DayBook day={day} nowTop={nowTop} />
          ) : (
            <Agenda day={day} now={now} />
          )}
        </div>
        <FlowRail day={day} />
      </div>
    </div>
  )
}

// ─── Summary bar ──────────────────────────────────────────────────────────

function AppointmentSummaryBar({
  derived,
  businessName,
}: {
  derived: AppointmentDerived
  businessName: string
}) {
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
  const staffOrAppts =
    derived.staffCount > 1
      ? `${derived.staffCount} staff`
      : `${derived.appointmentsCount} appointments`

  // Beauty/nails preset (the demo is a salon). A clinic vertical would swap
  // labels to Patients / Unconfirmed / No-show / Room free — same derived data.
  const pills: { label: string; value: string | number; tone?: "lead" | "info" }[] = [
    { label: "Appointments", value: derived.appointmentsCount },
    { label: "Unconfirmed", value: derived.unconfirmedCount, tone: derived.unconfirmedCount > 0 ? "lead" : undefined },
    { label: "Open gap", value: derived.openGaps, tone: "info" },
    { label: "Booked", value: `$${derived.bookedValue.toLocaleString()}` },
  ]

  return (
    <header className="flex flex-col gap-3 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
        >
          <CalendarClock size={16} strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary-light)]">Today</h1>
            <span suppressHydrationWarning className="text-[12px] text-[var(--text-secondary-light)]">
              {dateLabel}
            </span>
            <span className="text-[12px] text-[var(--text-tertiary-light)]">· {businessName}</span>
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--text-secondary-light)]">
            <span style={derived.unconfirmedCount > 0 ? { color: "var(--inbox-lead)" } : undefined}>
              {derived.unconfirmedCount} unconfirmed
            </span>{" "}
            · {derived.openGaps} open gaps · {staffOrAppts}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {pills.map((p) => (
          <div
            key={p.label}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5"
            style={
              p.tone === "lead"
                ? { borderColor: "color-mix(in srgb, var(--inbox-lead) 30%, transparent)", background: "var(--inbox-lead-soft)" }
                : { borderColor: "var(--border-dark)", background: "var(--app-surface-dark-elevated)" }
            }
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary-light)]">
              {p.label}
            </span>
            <span
              className="text-[13px] font-bold tabular-nums"
              style={p.tone === "lead" ? { color: "var(--inbox-lead)" } : p.tone === "info" ? { color: "var(--inbox-info)" } : { color: "var(--text-primary-light)" }}
            >
              {p.value}
            </span>
          </div>
        ))}
      </div>
    </header>
  )
}

// ─── Multi-staff Day Book ────────────────────────────────────────────────

function DayBook({ day, nowTop }: { day: AppointmentDay; nowTop: number | null }) {
  return (
    <div
      className="overflow-auto rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)]"
      style={{ maxHeight: "calc(100dvh - 14rem)" }}
    >
      <div className="flex min-w-max">
        {/* Hours rail */}
        <div className="sticky left-0 z-20 w-14 shrink-0 bg-[var(--app-surface-dark)]">
          <div className="sticky top-0 z-10 h-9 border-b border-r border-[var(--border-dark)] bg-[var(--app-surface-dark)]" />
          <div className="relative border-r border-[var(--border-dark)]" style={{ height: TOTAL_PX }}>
            {HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-[var(--text-tertiary-light)]"
                style={{ top: (h - START_HOUR) * HOUR_PX }}
              >
                {fmtHourLabel(h)}
              </div>
            ))}
          </div>
        </div>

        {/* Staff columns */}
        {day.staff.map((s) => {
          const appts = day.appointments.filter((a) => a.staffId === s.id)
          const gaps = day.gaps.filter((g) => g.staffId === s.id)
          return (
            <div key={s.id} className="w-[208px] shrink-0 border-l border-[var(--border-dark)]">
              <div className="sticky top-0 z-10 flex h-9 items-center gap-2 border-b border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-3">
                <span
                  aria-hidden="true"
                  className="flex h-5 w-5 items-center justify-center rounded-full text-[9px] font-semibold"
                  style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
                >
                  {s.name.slice(0, 1)}
                </span>
                <span className="truncate text-[12px] font-medium text-[var(--text-primary-light)]">{s.name}</span>
              </div>
              <div className="relative" style={{ height: TOTAL_PX }}>
                {HOURS.map((h) => (
                  <div
                    key={h}
                    aria-hidden="true"
                    className="absolute inset-x-0 border-t border-[var(--border-dark)]/50"
                    style={{ top: (h - START_HOUR) * HOUR_PX }}
                  />
                ))}
                {gaps.map((g) => (
                  <GapBlock key={g.id} gap={g} />
                ))}
                {appts.map((a) => (
                  <AppointmentBlock key={a.id} appt={a} />
                ))}
                {nowTop !== null ? <NowLine top={nowTop} /> : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function AppointmentBlock({ appt }: { appt: Appointment }) {
  const st = STATUS_STYLE[appt.status]
  return (
    <div
      className="absolute inset-x-1 overflow-hidden rounded-md border px-2 py-1"
      style={{
        top: topPx(appt.start),
        height: blockPx(appt.start, appt.end),
        background: st.bg,
        borderColor: st.border,
      }}
      title={`${appt.clientName} · ${appt.service} · ${fmtTime(appt.start)} (${st.label})`}
    >
      <p className="truncate text-[11px] font-semibold text-[var(--text-primary-light)]">{appt.clientName}</p>
      <p className="truncate text-[10px]" style={{ color: st.text }}>
        {appt.service} · {fmtTime(appt.start)}
      </p>
    </div>
  )
}

function GapBlock({ gap }: { gap: AppointmentGap }) {
  return (
    <div
      className="absolute inset-x-1 flex items-center justify-center rounded-md border border-dashed"
      style={{
        top: topPx(gap.start),
        height: blockPx(gap.start, gap.end),
        borderColor: "color-mix(in srgb, var(--inbox-info) 45%, transparent)",
        background: "color-mix(in srgb, var(--inbox-info) 7%, transparent)",
      }}
    >
      <span className="text-[10px] font-medium" style={{ color: GAP_COLOR }}>
        Open · {fmtTime(gap.start)}
      </span>
    </div>
  )
}

function NowLine({ top }: { top: number }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top }} aria-hidden="true">
      <div className="relative h-px w-full" style={{ background: "var(--accent-primary)" }}>
        <span
          className="absolute -left-0.5 -top-[3px] h-1.5 w-1.5 rounded-full"
          style={{ background: "var(--accent-primary)" }}
        />
      </div>
    </div>
  )
}

// ─── Single-provider Agenda ────────────────────────────────────────────────

type AgendaEntry =
  | { kind: "appt"; start: string; appt: Appointment }
  | { kind: "gap"; start: string; gap: AppointmentGap }

function Agenda({ day, now }: { day: AppointmentDay; now: Date | null }) {
  const entries = useMemo<AgendaEntry[]>(() => {
    const merged: AgendaEntry[] = [
      ...day.appointments.map((appt) => ({ kind: "appt" as const, start: appt.start, appt })),
      ...day.gaps.map((gap) => ({ kind: "gap" as const, start: gap.start, gap })),
    ]
    return merged.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime())
  }, [day])

  const nowMs = now ? now.getTime() : null
  let nowShown = false

  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4">
      {entries.map((entry) => {
        const startMs = new Date(entry.start).getTime()
        const showNow = nowMs !== null && !nowShown && startMs > nowMs
        if (showNow) nowShown = true
        return (
          <div key={entry.kind === "appt" ? entry.appt.id : entry.gap.id} className="flex flex-col gap-2.5">
            {showNow ? (
              <div className="flex items-center gap-2" aria-hidden="true">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent-primary)" }} />
                <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent-primary)" }}>
                  Now
                </span>
                <span className="h-px flex-1" style={{ background: "var(--accent-primary)" }} />
              </div>
            ) : null}
            {entry.kind === "appt" ? <AgendaApptCard appt={entry.appt} /> : <AgendaGapCard gap={entry.gap} />}
          </div>
        )
      })}
    </div>
  )
}

function AgendaApptCard({ appt }: { appt: Appointment }) {
  const st = STATUS_STYLE[appt.status]
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-4 py-3">
      <div className="flex w-16 shrink-0 flex-col items-start">
        <span className="text-[13px] font-semibold tabular-nums text-[var(--text-primary-light)]">{fmtTime(appt.start)}</span>
        <span className="text-[10px] tabular-nums text-[var(--text-tertiary-light)]">{fmtTime(appt.end)}</span>
      </div>
      <div className="min-w-0 flex-1 border-l border-[var(--border-dark)] pl-3">
        <p className="truncate text-[13.5px] font-semibold text-[var(--text-primary-light)]">{appt.clientName}</p>
        <p className="truncate text-[12px] text-[var(--text-secondary-light)]">{appt.service}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span
          className="rounded-full border px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: st.bg, color: st.text, borderColor: st.border }}
        >
          {st.label}
        </span>
        {typeof appt.price === "number" ? (
          <span className="text-[11px] tabular-nums text-[var(--text-tertiary-light)]">${appt.price}</span>
        ) : null}
      </div>
    </div>
  )
}

function AgendaGapCard({ gap }: { gap: AppointmentGap }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-dashed px-4 py-3"
      style={{ borderColor: "color-mix(in srgb, var(--inbox-info) 45%, transparent)", background: "color-mix(in srgb, var(--inbox-info) 6%, transparent)" }}
    >
      <Clock size={14} className="shrink-0" style={{ color: GAP_COLOR }} aria-hidden="true" />
      <p className="flex-1 text-[12.5px] font-medium" style={{ color: GAP_COLOR }}>
        Open gap · {fmtTime(gap.start)} – {fmtTime(gap.end)}
      </p>
    </div>
  )
}

// ─── Fanny flow rail ─────────────────────────────────────────────────────────

function FlowRail({ day }: { day: AppointmentDay }) {
  const unconfirmed = day.appointments.filter((a) => a.status === "pending")
  const followUps = day.appointments.filter((a) => a.status === "no_show" || a.status === "cancelled")

  return (
    <aside className="flex flex-col gap-4 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-[var(--accent-on-dark)]" aria-hidden="true" />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-on-dark)]">
          Fanny flow
        </span>
      </div>

      <FlowGroup label="Unconfirmed" count={unconfirmed.length} tone="lead">
        {unconfirmed.map((a) => (
          <FlowCard
            key={a.id}
            title={a.clientName}
            meta={`${a.service} · ${fmtTime(a.start)}`}
            action={{ icon: Send, label: "Send reminder" }}
          />
        ))}
      </FlowGroup>

      <FlowGroup label="Open gaps" count={day.gaps.length} tone="info">
        {day.gaps.map((g) => (
          <FlowCard
            key={g.id}
            title={`Open · ${fmtTime(g.start)}–${fmtTime(g.end)}`}
            meta="Could be offered to a waitlist client"
            action={{ icon: UserPlus, label: "Offer to waitlist" }}
          />
        ))}
      </FlowGroup>

      <FlowGroup label="Follow-ups" count={followUps.length} tone="urgency">
        {followUps.map((a) => (
          <FlowCard
            key={a.id}
            title={a.clientName}
            meta={`${STATUS_STYLE[a.status].label} · ${a.service}`}
            action={{ icon: MessageSquare, label: "Draft message" }}
          />
        ))}
      </FlowGroup>
    </aside>
  )
}

function FlowGroup({
  label,
  count,
  tone,
  children,
}: {
  label: string
  count: number
  tone: "lead" | "info" | "urgency"
  children: React.ReactNode
}) {
  const color = tone === "lead" ? "var(--inbox-lead)" : tone === "info" ? "var(--inbox-info)" : "var(--inbox-urgency)"
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color }}>
          {label}
        </span>
        <span className="text-[10px] tabular-nums text-[var(--text-tertiary-light)]">{count}</span>
      </div>
      {count === 0 ? (
        <p className="px-1 text-[11px] text-[var(--text-tertiary-light)]">Nothing here.</p>
      ) : (
        <div className="flex flex-col gap-2">{children}</div>
      )}
    </section>
  )
}

function FlowCard({
  title,
  meta,
  action,
}: {
  title: string
  meta: string
  action: { icon: typeof Send; label: string }
}) {
  const Icon = action.icon
  return (
    <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] p-3">
      <p className="truncate text-[12.5px] font-semibold text-[var(--text-primary-light)]">{title}</p>
      <p className="mt-0.5 truncate text-[11px] text-[var(--text-tertiary-light)]">{meta}</p>
      {/* Placeholder action — no real handler yet, so it is disabled (never
          simulates a write). Wires up when the appointment backend lands. */}
      <button
        type="button"
        disabled
        title="Available once appointment actions are connected"
        className="mt-2 inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-[var(--border-dark)] bg-[var(--app-surface-hover)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary-light)] opacity-70"
      >
        <Icon size={11} strokeWidth={2} aria-hidden="true" />
        {action.label}
      </button>
    </div>
  )
}
