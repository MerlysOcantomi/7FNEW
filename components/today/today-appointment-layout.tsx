"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import { CalendarClock, CheckCircle2, Clock, Megaphone, MessageSquare, Scissors, Send, Sparkles, UserPlus, Users } from "lucide-react"
import {
  deriveAppointmentDay,
  type Appointment,
  type AppointmentDay,
  type AppointmentDerived,
  type AppointmentGap,
  type AppointmentStatus,
} from "@modules/today/appointments"
import type { BeautyTodayConfig } from "@modules/today/beauty-today"
import { getAppointmentDayMock, getBeautyAppointmentDayMock } from "./appointments/appointment-mock"

/** Status label — Spanish/beauty when a beauty config is present, else the generic English. */
function statusLabelOf(status: AppointmentStatus, beauty?: BeautyTodayConfig | null): string {
  return beauty ? beauty.statusLabels[status] : STATUS_STYLE[status].label
}

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

export function TodayAppointmentLayout({
  businessName,
  beauty = null,
}: {
  businessName: string | null
  /** When present, renders the Spanish, Finesse-branded Beauty "Hoy". */
  beauty?: BeautyTodayConfig | null
}) {
  const searchParams = useSearchParams()
  const staffMode = searchParams.get("staff") === "solo" ? "solo" : "multi"
  const day = useMemo<AppointmentDay>(
    () => (beauty ? getBeautyAppointmentDayMock(staffMode) : getAppointmentDayMock(staffMode)),
    [staffMode, beauty],
  )
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
        beauty={beauty}
      />

      {beauty ? <FinesseBrief derived={derived} beauty={beauty} /> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          {isMulti ? (
            <DayBook day={day} nowTop={nowTop} beauty={beauty} />
          ) : (
            <Agenda day={day} now={now} beauty={beauty} />
          )}
        </div>
        <FlowRail day={day} beauty={beauty} />
      </div>

      {beauty ? <BeautyExtras beauty={beauty} /> : null}
    </div>
  )
}

// ─── Beauty: Finesse brief ──────────────────────────────────────────────────

function FinesseBrief({
  derived,
  beauty,
}: {
  derived: AppointmentDerived
  beauty: BeautyTodayConfig
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-[18px] border p-4"
      style={{
        borderColor: "var(--agent-rose, var(--accent-muted-border))",
        background: "color-mix(in srgb, var(--agent-rose, var(--accent-primary)) 8%, transparent)",
      }}
    >
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "var(--agent-rose-soft, var(--accent-muted))", color: "var(--agent-rose, var(--accent-on-dark))" }}
      >
        <Sparkles size={15} strokeWidth={1.9} />
      </span>
      <div className="min-w-0">
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--text-tertiary-light)]">
          {beauty.eyebrow}
        </span>
        <p className="mt-0.5 text-[13px] text-[var(--text-primary-light)]">
          Hoy tienes <strong>{derived.appointmentsCount} citas</strong>,{" "}
          <strong>{derived.unconfirmedCount} sin confirmar</strong> y{" "}
          <strong>{derived.openGaps} huecos libres</strong>. Te dejo lo importante a mano.
        </p>
      </div>
    </div>
  )
}

// ─── Summary bar ──────────────────────────────────────────────────────────

function AppointmentSummaryBar({
  derived,
  businessName,
  beauty,
}: {
  derived: AppointmentDerived
  businessName: string
  beauty?: BeautyTodayConfig | null
}) {
  const dateLabel = new Date().toLocaleDateString(beauty ? "es-ES" : undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
  const staffOrAppts = beauty
    ? derived.staffCount > 1
      ? `${derived.staffCount} en el equipo`
      : `${derived.appointmentsCount} citas`
    : derived.staffCount > 1
      ? `${derived.staffCount} staff`
      : `${derived.appointmentsCount} appointments`

  const title = beauty ? beauty.brandTitle : "Today"
  const p = beauty?.ui.pills
  const pills: { label: string; value: string | number; tone?: "lead" | "info" }[] = [
    { label: p?.appointments ?? "Appointments", value: derived.appointmentsCount },
    { label: p?.unconfirmed ?? "Unconfirmed", value: derived.unconfirmedCount, tone: derived.unconfirmedCount > 0 ? "lead" : undefined },
    { label: p?.openGaps ?? "Open gap", value: derived.openGaps, tone: "info" },
    { label: p?.booked ?? "Booked", value: `$${derived.bookedValue.toLocaleString()}` },
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
            <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary-light)]">{title}</h1>
            <span suppressHydrationWarning className="text-[12px] text-[var(--text-secondary-light)]">
              {dateLabel}
            </span>
            <span className="text-[12px] text-[var(--text-tertiary-light)]">· {businessName}</span>
            {beauty ? (
              <span
                className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                style={{ borderColor: "color-mix(in srgb, var(--inbox-info) 40%, transparent)", color: "var(--inbox-info)" }}
                title="Datos de ejemplo mientras conectamos las citas reales."
              >
                {beauty.previewChip}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--text-secondary-light)]">
            <span style={derived.unconfirmedCount > 0 ? { color: "var(--inbox-lead)" } : undefined}>
              {derived.unconfirmedCount} {beauty ? "sin confirmar" : "unconfirmed"}
            </span>{" "}
            · {derived.openGaps} {beauty ? "huecos" : "open gaps"} · {staffOrAppts}
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

function DayBook({ day, nowTop, beauty }: { day: AppointmentDay; nowTop: number | null; beauty?: BeautyTodayConfig | null }) {
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
                  <GapBlock key={g.id} gap={g} beauty={beauty} />
                ))}
                {appts.map((a) => (
                  <AppointmentBlock key={a.id} appt={a} beauty={beauty} />
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

function AppointmentBlock({ appt, beauty }: { appt: Appointment; beauty?: BeautyTodayConfig | null }) {
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
      title={`${appt.clientName} · ${appt.service} · ${fmtTime(appt.start)} (${statusLabelOf(appt.status, beauty)})`}
    >
      <p className="truncate text-[11px] font-semibold text-[var(--text-primary-light)]">{appt.clientName}</p>
      <p className="truncate text-[10px]" style={{ color: st.text }}>
        {appt.service} · {fmtTime(appt.start)}
      </p>
    </div>
  )
}

function GapBlock({ gap, beauty }: { gap: AppointmentGap; beauty?: BeautyTodayConfig | null }) {
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
        {beauty ? beauty.ui.openGap : "Open"} · {fmtTime(gap.start)}
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

function Agenda({ day, now, beauty }: { day: AppointmentDay; now: Date | null; beauty?: BeautyTodayConfig | null }) {
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
                  {beauty ? beauty.ui.now : "Now"}
                </span>
                <span className="h-px flex-1" style={{ background: "var(--accent-primary)" }} />
              </div>
            ) : null}
            {entry.kind === "appt" ? <AgendaApptCard appt={entry.appt} beauty={beauty} /> : <AgendaGapCard gap={entry.gap} beauty={beauty} />}
          </div>
        )
      })}
    </div>
  )
}

function AgendaApptCard({ appt, beauty }: { appt: Appointment; beauty?: BeautyTodayConfig | null }) {
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
          {statusLabelOf(appt.status, beauty)}
        </span>
        {typeof appt.price === "number" ? (
          <span className="text-[11px] tabular-nums text-[var(--text-tertiary-light)]">${appt.price}</span>
        ) : null}
      </div>
    </div>
  )
}

function AgendaGapCard({ gap, beauty }: { gap: AppointmentGap; beauty?: BeautyTodayConfig | null }) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border border-dashed px-4 py-3"
      style={{ borderColor: "color-mix(in srgb, var(--inbox-info) 45%, transparent)", background: "color-mix(in srgb, var(--inbox-info) 6%, transparent)" }}
    >
      <Clock size={14} className="shrink-0" style={{ color: GAP_COLOR }} aria-hidden="true" />
      <p className="flex-1 text-[12.5px] font-medium" style={{ color: GAP_COLOR }}>
        {beauty ? `${beauty.ui.openGap} · ${fmtTime(gap.start)} – ${fmtTime(gap.end)}` : `Open gap · ${fmtTime(gap.start)} – ${fmtTime(gap.end)}`}
      </p>
    </div>
  )
}

// ─── Fanny flow rail ─────────────────────────────────────────────────────────

function FlowRail({ day, beauty }: { day: AppointmentDay; beauty?: BeautyTodayConfig | null }) {
  const unconfirmed = day.appointments.filter((a) => a.status === "pending")
  const followUps = day.appointments.filter((a) => a.status === "no_show" || a.status === "cancelled")
  const g = beauty?.ui.groups
  const act = beauty?.ui.actions
  const empty = beauty?.ui.nothingHere ?? "Nothing here."

  return (
    <aside className="flex flex-col gap-4 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-[var(--accent-on-dark)]" aria-hidden="true" />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-on-dark)]">
          {beauty ? beauty.ui.railTitle : "Fanny flow"}
        </span>
      </div>

      <FlowGroup label={g?.unconfirmed ?? "Unconfirmed"} count={unconfirmed.length} tone="lead" emptyLabel={empty}>
        {unconfirmed.map((a) => (
          <FlowCard
            key={a.id}
            title={a.clientName}
            meta={`${a.service} · ${fmtTime(a.start)}`}
            action={{ icon: Send, label: act?.remind ?? "Send reminder" }}
          />
        ))}
      </FlowGroup>

      <FlowGroup label={g?.openGaps ?? "Open gaps"} count={day.gaps.length} tone="info" emptyLabel={empty}>
        {day.gaps.map((gap) => (
          <FlowCard
            key={gap.id}
            title={`${beauty ? beauty.ui.openGap : "Open"} · ${fmtTime(gap.start)}–${fmtTime(gap.end)}`}
            meta={beauty ? "Ofrécelo a una clienta frecuente" : "Could be offered to a waitlist client"}
            action={{ icon: UserPlus, label: act?.waitlist ?? "Offer to waitlist" }}
          />
        ))}
      </FlowGroup>

      <FlowGroup label={g?.followUps ?? "Follow-ups"} count={followUps.length} tone="urgency" emptyLabel={empty}>
        {followUps.map((a) => (
          <FlowCard
            key={a.id}
            title={a.clientName}
            meta={`${statusLabelOf(a.status, beauty)} · ${a.service}`}
            action={{ icon: MessageSquare, label: act?.message ?? "Draft message" }}
          />
        ))}
      </FlowGroup>

      {/* Beauty-only extra flows (static demo content). */}
      {beauty ? (
        <>
          <FlowGroup label={beauty.ui.groups.messages} count={beauty.extras.pendingMessages.length} tone="info" emptyLabel={empty}>
            {beauty.extras.pendingMessages.map((m, i) => (
              <FlowCard key={i} title={m.name} meta={m.text} action={{ icon: MessageSquare, label: beauty.ui.actions.message }} />
            ))}
          </FlowGroup>

          <FlowGroup label={beauty.ui.groups.care} count={beauty.extras.clientsToCare.length} tone="lead" emptyLabel={empty}>
            {beauty.extras.clientsToCare.map((c, i) => (
              <FlowCard key={i} title={c.name} meta={c.meta} action={{ icon: Send, label: beauty.ui.actions.message }} />
            ))}
          </FlowGroup>

          <FlowGroup label={beauty.ui.groups.content} count={1} tone="info" emptyLabel={empty}>
            <FlowCard
              title={beauty.extras.postIdea.title}
              meta={beauty.extras.postIdea.meta}
              action={{ icon: Megaphone, label: "Preparar post" }}
            />
          </FlowGroup>
        </>
      ) : null}
    </aside>
  )
}

// ─── Beauty: extra summary blocks below the day ─────────────────────────────

function BeautyExtras({ beauty }: { beauty: BeautyTodayConfig }) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      <ExtraCard icon={Users} title="Clientas recientes">
        <ul className="flex flex-col gap-1">
          {beauty.extras.recentClients.map((c) => (
            <li key={c} className="truncate text-[12.5px] text-[var(--text-secondary-light)]">{c}</li>
          ))}
        </ul>
      </ExtraCard>

      <ExtraCard icon={Scissors} title="Servicios destacados">
        <div className="flex flex-wrap gap-1.5">
          {beauty.extras.featuredServices.map((s) => (
            <span
              key={s}
              className="inline-flex items-center rounded-full border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-2 py-0.5 text-[11px] text-[var(--text-secondary-light)]"
            >
              {s}
            </span>
          ))}
        </div>
      </ExtraCard>

      <ExtraCard icon={CheckCircle2} title="Acciones recomendadas">
        <ul className="flex flex-col gap-2">
          {beauty.extras.recommendedActions.map((a) => (
            <li key={a.title} className="flex flex-col">
              <span className="truncate text-[12.5px] font-medium text-[var(--text-primary-light)]">{a.title}</span>
              <span className="truncate text-[11px] text-[var(--text-tertiary-light)]">{a.meta}</span>
            </li>
          ))}
        </ul>
      </ExtraCard>
    </div>
  )
}

function ExtraCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Users
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-2.5 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4">
      <div className="flex items-center gap-2">
        <Icon size={13} strokeWidth={1.9} className="text-[var(--accent-on-dark)]" aria-hidden="true" />
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[var(--text-secondary-light)]">{title}</span>
      </div>
      {children}
    </section>
  )
}

function FlowGroup({
  label,
  count,
  tone,
  children,
  emptyLabel = "Nothing here.",
}: {
  label: string
  count: number
  tone: "lead" | "info" | "urgency"
  children: React.ReactNode
  emptyLabel?: string
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
        <p className="px-1 text-[11px] text-[var(--text-tertiary-light)]">{emptyLabel}</p>
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
