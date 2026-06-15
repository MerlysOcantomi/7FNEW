"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  BookOpen,
  CalendarPlus,
  CheckCircle2,
  Circle,
  Clock,
  DollarSign,
  Gift,
  GraduationCap,
  HeartHandshake,
  MapPin,
  MessageSquare,
  Navigation,
  NotebookPen,
  Phone,
  PlayCircle,
  Send,
  Sparkles,
  UserRound,
  Users,
  Video,
} from "lucide-react"
import {
  deriveSessionDay,
  type FlowTone,
  type SessionDerived,
  type SessionFlowItem,
  type SessionStatus,
  type SessionVariant,
  type TodaySession,
  type TodaySessionDay,
} from "@modules/today/sessions"
import { normalizeSessionVariant } from "@modules/today/today-layout-mode"
import { getSessionDayMock } from "./sessions/session-mock"
import { cn } from "@/lib/utils"

/**
 * Session-first Today layout — the continuity canvas for businesses whose day
 * turns around sessions/people, not bookings. Same `/today` route, AppShell and
 * tokens. Three variants share one hybrid 3-zone shell (ordered list · a living
 * protagonist + timeline · a Fanny flow rail):
 *
 *   - class → "Today's classes" (schools, academies, group classes)
 *   - tutor → "Today's sessions" (1:1 tutoring / coaching / mentoring)
 *   - care  → "Community today" (lightweight people follow-up — pastoral care,
 *             small NGOs, gentle wellness check-ins; NOT a clinical product and
 *             NOT the full church/NGO Today — see modules/today/sessions.ts)
 *
 * GATED OFF by default and currently renders the isolated demo adapter (no real
 * session backend exists yet — see modules/today/today-layout-mode.ts).
 * Reviewers preview it with `?todayLayout=session_first&variant=class|tutor|care`
 * (invalid/absent variant falls back to class). Every action is DISABLED (no
 * fake writes). The Today Peek is a deliberate follow-up, not built here.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}
function fmtRange(start?: string, end?: string): string {
  if (!start) return ""
  return end ? `${fmtTime(start)} – ${fmtTime(end)}` : fmtTime(start)
}
function minutesUntil(iso: string | undefined, now: Date | null): number | null {
  if (!iso || !now) return null
  return Math.round((new Date(iso).getTime() - now.getTime()) / 60_000)
}
function initials(name: string): string {
  return name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase()
}
function firstName(name: string): string {
  return name.split(/\s+/)[0]
}

// ─── Tones + status ──────────────────────────────────────────────────────────

function toneColor(tone: FlowTone): string {
  switch (tone) {
    case "accent": return "var(--accent-on-dark)"
    case "info": return "var(--inbox-info)"
    case "success": return "var(--inbox-success)"
    case "lead": return "var(--inbox-lead)"
    case "urgency": return "var(--inbox-urgency)"
  }
}

interface StatusStyle { bg: string; text: string; border: string; label: string }

const STATUS_STYLE: Record<SessionStatus, StatusStyle> = {
  scheduled: { bg: "var(--app-surface-dark-elevated)", text: "var(--text-secondary-light)", border: "var(--border-dark)", label: "Scheduled" },
  starting_soon: { bg: "var(--accent-muted)", text: "var(--accent-on-dark)", border: "var(--accent-muted-border)", label: "Starting soon" },
  in_progress: { bg: "var(--accent-muted)", text: "var(--accent-on-dark)", border: "var(--accent-muted-border)", label: "In progress" },
  completed: { bg: "var(--inbox-success-soft)", text: "var(--inbox-success)", border: "color-mix(in srgb, var(--inbox-success) 32%, transparent)", label: "Completed" },
  cancelled: { bg: "var(--inbox-urgency-soft)", text: "var(--inbox-urgency)", border: "color-mix(in srgb, var(--inbox-urgency) 32%, transparent)", label: "Cancelled" },
  no_show: { bg: "var(--inbox-urgency-soft)", text: "var(--inbox-urgency)", border: "color-mix(in srgb, var(--inbox-urgency) 32%, transparent)", label: "No-show" },
  needs_follow_up: { bg: "var(--inbox-lead-soft)", text: "var(--inbox-lead)", border: "color-mix(in srgb, var(--inbox-lead) 32%, transparent)", label: "Follow-up" },
  waiting_reply: { bg: "var(--inbox-info-soft)", text: "var(--inbox-info)", border: "color-mix(in srgb, var(--inbox-info) 32%, transparent)", label: "Waiting reply" },
}

const MODE_LABEL: Record<TodaySession["mode"], string> = {
  online: "Online",
  in_person: "In person",
  hybrid: "Hybrid",
}

// ─── Variant meta ──────────────────────────────────────────────────────────

const VARIANT_META: Record<SessionVariant, {
  title: string
  icon: typeof Users
  leftHeader: string
  leftHint: string
  flowHeader: string
  flowHint: string
  protagonistLabel: string
}> = {
  class: {
    title: "Today's classes", icon: GraduationCap,
    leftHeader: "Sessions today", leftHint: "today",
    flowHeader: "Class flow", flowHint: "Fanny keeps each class on track",
    protagonistLabel: "Up next",
  },
  tutor: {
    title: "Today's sessions", icon: UserRound,
    leftHeader: "Sessions today", leftHint: "all 1:1",
    flowHeader: "Session flow", flowHint: "Fanny follows each student",
    protagonistLabel: "Up next",
  },
  care: {
    title: "Community today", icon: HeartHandshake,
    leftHeader: "People to follow up", leftHint: "by care",
    flowHeader: "Care flow", flowHint: "Fanny helps you reach everyone",
    protagonistLabel: "Needs you most",
  },
}

const ACTION_ICON: Record<string, typeof Send> = {
  "Mark attendance": CheckCircle2,
  "Send material": Send,
  "Draft reply": MessageSquare,
  "Send reminder": Send,
  "Add note": NotebookPen,
  "Review now": PlayCircle,
  "Mark paid / remind": DollarSign,
  "Send times": CalendarPlus,
  "Call now": Phone,
  "Call": Phone,
  "Get directions": Navigation,
  "Reply": MessageSquare,
  "Send wishes": Gift,
}

// ─── Entry ────────────────────────────────────────────────────────────────────

export function TodaySessionLayout({ businessName }: { businessName: string | null }) {
  const searchParams = useSearchParams()
  const variant = normalizeSessionVariant(searchParams.get("variant"))
  const day = useMemo<TodaySessionDay>(() => getSessionDayMock(variant), [variant])
  const derived = useMemo(() => deriveSessionDay(day), [day])

  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const protagonist = useMemo(
    () => day.sessions.find((s) => s.id === derived.protagonistId) ?? null,
    [day.sessions, derived.protagonistId],
  )
  const ordered = useMemo(() => orderForList(day), [day])

  return (
    <div className="flex flex-col gap-6">
      <SessionSummaryBar
        day={day}
        derived={derived}
        businessName={businessName ?? day.businessName}
      />
      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
        <SessionLeftList day={day} sessions={ordered} protagonistId={derived.protagonistId} />
        <SessionCanvas day={day} protagonist={protagonist} now={now} />
        <SessionFlowRail day={day} derived={derived} />
      </div>
    </div>
  )
}

function orderForList(day: TodaySessionDay): TodaySession[] {
  const list = [...day.sessions]
  if (day.variant === "care") {
    const rank = (s: TodaySession) =>
      s.risks?.some((r) => r.type === "urgent") ? 0 : s.startsAt ? 1 : 2
    return list.sort((a, b) => {
      const r = rank(a) - rank(b)
      if (r !== 0) return r
      const at = a.startsAt ? new Date(a.startsAt).getTime() : Number.POSITIVE_INFINITY
      const bt = b.startsAt ? new Date(b.startsAt).getTime() : Number.POSITIVE_INFINITY
      return at - bt
    })
  }
  return list.sort(
    (a, b) => (a.startsAt ? new Date(a.startsAt).getTime() : 0) - (b.startsAt ? new Date(b.startsAt).getTime() : 0),
  )
}

// ─── Summary bar ──────────────────────────────────────────────────────────────

interface Kpi { label: string; value: string | number; tone: FlowTone | "default"; icon: typeof Users }

function buildKpis(d: SessionDerived): Kpi[] {
  const unpaid: Kpi = { label: "Unpaid", value: d.unpaid, tone: d.unpaid > 0 ? "lead" : "default", icon: DollarSign }
  switch (d.variant) {
    case "tutor":
      return [
        { label: "Sessions", value: d.count, tone: "default", icon: Clock },
        { label: "Practiced", value: `${d.practicedDone}/${d.practicedTotal}`, tone: "default", icon: CheckCircle2 },
        unpaid,
        { label: "Homework", value: d.homeworkToReview, tone: d.homeworkToReview > 0 ? "lead" : "default", icon: BookOpen },
      ]
    case "care":
      return [
        { label: "People", value: d.count, tone: "default", icon: Users },
        { label: "Visits", value: d.visits, tone: "default", icon: MapPin },
        { label: "Calls", value: d.calls, tone: "default", icon: Phone },
        { label: "Urgent", value: d.urgent, tone: d.urgent > 0 ? "urgency" : "default", icon: AlertTriangle },
      ]
    default:
      return [
        { label: "Sessions", value: d.count, tone: "default", icon: Clock },
        { label: "Students", value: d.participants, tone: "default", icon: Users },
        unpaid,
        { label: "Materials", value: d.materialsPending, tone: d.materialsPending > 0 ? "lead" : "default", icon: BookOpen },
      ]
  }
}

function summaryLine(d: SessionDerived): React.ReactNode {
  const lead = (n: number, suffix: string, on: boolean) => (
    <span style={on && n > 0 ? { color: "var(--inbox-lead)" } : undefined}>{n} {suffix}</span>
  )
  if (d.variant === "tutor") {
    return <>{d.count} sessions · {d.count} students · {lead(d.unpaid, "unpaid", true)} · {d.homeworkToReview} homework to review</>
  }
  if (d.variant === "care") {
    return (
      <>
        {d.count} people to follow up · {d.visits} visits ·{" "}
        <span style={d.urgent > 0 ? { color: "var(--inbox-urgency)" } : undefined}>{d.urgent} urgent</span> · {d.reminders} reminders
      </>
    )
  }
  return <>{d.count} sessions · {d.participants} students · {lead(d.unpaid, "unpaid", true)} · {lead(d.materialsPending, "materials pending", true)}</>
}

function SessionSummaryBar({
  day,
  derived,
  businessName,
}: {
  day: TodaySessionDay
  derived: SessionDerived
  businessName: string
}) {
  const meta = VARIANT_META[day.variant]
  const HaloIcon = meta.icon
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })
  const pending = derived.unpaid + derived.materialsPending + derived.homeworkToReview + derived.urgent + derived.waitingReply
  const badge = pending > 0
    ? { label: "Follow-ups pending", color: "var(--inbox-lead)" }
    : { label: "All caught up", color: "var(--inbox-success)" }
  const kpis = buildKpis(derived)

  return (
    <header className="flex flex-col gap-3 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
        >
          <HaloIcon size={16} strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary-light)]">{meta.title}</h1>
            <span suppressHydrationWarning className="text-[12px] text-[var(--text-secondary-light)]">{dateLabel}</span>
            <span className="text-[12px] text-[var(--text-tertiary-light)]">· {businessName}</span>
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
              style={{ color: badge.color, borderColor: `color-mix(in srgb, ${badge.color} 32%, transparent)`, background: `color-mix(in srgb, ${badge.color} 12%, transparent)` }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: badge.color }} aria-hidden="true" />
              {badge.label}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--text-secondary-light)]">{summaryLine(derived)}</p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {kpis.map((k) => {
          const Icon = k.icon
          const color = k.tone === "default" ? null : toneColor(k.tone)
          return (
            <div
              key={k.label}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5"
              style={color
                ? { borderColor: `color-mix(in srgb, ${color} 30%, transparent)`, background: `color-mix(in srgb, ${color} 10%, transparent)` }
                : { borderColor: "var(--border-dark)", background: "var(--app-surface-dark-elevated)" }}
            >
              <span aria-hidden="true" style={{ color: color ?? "var(--text-tertiary-light)" }}><Icon size={12} strokeWidth={2} /></span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary-light)]">{k.label}</span>
              <span className="text-[13px] font-bold tabular-nums" style={{ color: color ?? "var(--text-primary-light)" }}>{k.value}</span>
            </div>
          )
        })}
      </div>
    </header>
  )
}

// ─── Left list ──────────────────────────────────────────────────────────────

function SessionLeftList({
  day,
  sessions,
  protagonistId,
}: {
  day: TodaySessionDay
  sessions: TodaySession[]
  protagonistId: string | null
}) {
  const meta = VARIANT_META[day.variant]
  return (
    <section
      aria-label={meta.leftHeader}
      className="flex flex-col gap-3 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary-light)]">{meta.leftHeader}</h2>
        <span className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary-light)]/80">{meta.leftHint}</span>
      </header>
      <div className="flex flex-col gap-2.5">
        {sessions.map((s) => (
          <LeftCard key={s.id} session={s} variant={day.variant} current={s.id === protagonistId} />
        ))}
      </div>
    </section>
  )
}

/** The single soft flag chip a care person card shows. */
function careFlag(s: TodaySession): { label: string; tone: FlowTone } | null {
  if (s.risks?.some((r) => r.type === "urgent")) return { label: "Urgent", tone: "urgency" }
  if (s.status === "waiting_reply") return { label: "Reply", tone: "info" }
  if (s.contactKind === "visit") return { label: "Visit", tone: "success" }
  if (s.risks?.some((r) => r.type === "reminder")) return { label: "Reminder", tone: "lead" }
  if (s.startsAt) return { label: "Today", tone: "accent" }
  return null
}

/** Small status/flag chips a class/tutor card shows below the title. */
function classTutorFlags(s: TodaySession): { label: string; tone: FlowTone }[] {
  const flags: { label: string; tone: FlowTone }[] = []
  if (s.homeworkStatus === "to_review" || s.homeworkStatus === "submitted") flags.push({ label: "Homework", tone: "accent" })
  if (s.materialStatus === "missing" || s.materialStatus === "pending") flags.push({ label: "Material", tone: "lead" })
  if (s.paymentStatus === "unpaid" || s.paymentStatus === "overdue") flags.push({ label: "Unpaid", tone: "lead" })
  if (s.paymentStatus === "paid") flags.push({ label: "Paid", tone: "success" })
  if (s.risks?.some((r) => r.type === "reschedule")) flags.push({ label: "Rebook", tone: "lead" })
  return flags
}

function Chip({ label, tone, soft = true }: { label: string; tone: FlowTone; soft?: boolean }) {
  const color = toneColor(tone)
  return (
    <span
      className="inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold"
      style={{
        color,
        borderColor: `color-mix(in srgb, ${color} 32%, transparent)`,
        background: soft ? `color-mix(in srgb, ${color} 12%, transparent)` : "transparent",
      }}
    >
      {label}
    </span>
  )
}

function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center rounded-full font-semibold"
      style={{ width: size, height: size, fontSize: size * 0.36, background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
    >
      {initials(name)}
    </span>
  )
}

function LeftCard({ session, variant, current }: { session: TodaySession; variant: SessionVariant; current: boolean }) {
  const ring = current ? "border-[var(--accent-muted-border)] ring-1 ring-[var(--accent-muted-border)]" : "border-[var(--border-dark)]"

  if (variant === "care") {
    const flag = careFlag(session)
    return (
      <article className={cn("flex gap-2.5 rounded-xl border bg-[var(--app-surface-dark-elevated)] p-3", ring)}>
        <Avatar name={session.title} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[13px] font-semibold text-[var(--text-primary-light)]">{session.title}</p>
            {flag ? <Chip label={flag.label} tone={flag.tone} /> : null}
          </div>
          {session.situation ? <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary-light)]">{session.situation}</p> : null}
          {session.lastContactLabel ? <p className="mt-0.5 truncate text-[10px] text-[var(--text-tertiary-light)]">{session.lastContactLabel}</p> : null}
        </div>
      </article>
    )
  }

  const st = STATUS_STYLE[session.status]
  const flags = classTutorFlags(session)
  return (
    <article className={cn("rounded-xl border bg-[var(--app-surface-dark-elevated)] p-3", ring)}>
      <div className="flex items-start justify-between gap-2">
        <p className="truncate text-[13px] font-semibold text-[var(--text-primary-light)]">{session.title}</p>
        {session.startsAt ? <span className="shrink-0 text-[11px] tabular-nums text-[var(--text-tertiary-light)]">{fmtTime(session.startsAt)}</span> : null}
      </div>
      <p className="mt-0.5 truncate text-[11px] text-[var(--text-secondary-light)]">
        {session.subjectOrTopic}{session.level ? ` · ${session.level}` : ""}
      </p>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="rounded-full border px-1.5 py-0.5 text-[9px] font-semibold" style={{ background: st.bg, color: st.text, borderColor: st.border }}>
          {st.label}
        </span>
        {flags.map((f) => <Chip key={f.label} label={f.label} tone={f.tone} />)}
      </div>
    </article>
  )
}

// ─── Center canvas ──────────────────────────────────────────────────────────

function SessionCanvas({ day, protagonist, now }: { day: TodaySessionDay; protagonist: TodaySession | null; now: Date | null }) {
  return (
    <section className="flex min-w-0 flex-col gap-4" aria-label={VARIANT_META[day.variant].title}>
      {protagonist ? (
        day.variant === "tutor" ? (
          <TutorProtagonist session={protagonist} now={now} />
        ) : day.variant === "care" ? (
          <CareProtagonist session={protagonist} />
        ) : (
          <ClassProtagonist session={protagonist} now={now} />
        )
      ) : null}
      <SessionTimeline day={day} protagonistId={protagonist?.id ?? null} />
    </section>
  )
}

function ProtagonistShell({
  label, now, session, children, actions,
}: {
  label: string
  now: Date | null
  session: TodaySession
  children: React.ReactNode
  actions: React.ReactNode
}) {
  const mins = minutesUntil(session.startsAt, now)
  const soon = mins !== null && mins >= 0 && mins <= 60
  return (
    <div className="flex flex-col gap-4 rounded-[18px] border border-[var(--accent-muted-border)] bg-[var(--app-surface-dark)] p-5">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent-on-dark)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent-primary)" }} aria-hidden="true" />
        {label}
        {soon ? <span className="text-[var(--text-tertiary-light)]">· in {mins} min</span> : null}
        {session.startsAt ? <span className="ml-auto font-normal tracking-normal text-[var(--text-tertiary-light)]">{fmtRange(session.startsAt, session.endsAt)}</span> : null}
      </div>
      {children}
      <div className="flex flex-wrap items-center gap-2">{actions}</div>
    </div>
  )
}

function ClassProtagonist({ session, now }: { session: TodaySession; now: Date | null }) {
  return (
    <ProtagonistShell
      label="Up next"
      now={now}
      session={session}
      actions={<><PrimaryAction icon={Video} label="Join class" /><GhostAction icon={CheckCircle2} label="Take attendance" /></>}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_240px]">
        <div className="flex items-start gap-3">
          <Avatar name={session.title} size={44} />
          <div className="min-w-0">
            <h3 className="text-[18px] font-semibold text-[var(--text-primary-light)]">{session.title}</h3>
            <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary-light)]">{session.subjectOrTopic}{session.focus ? ` · ${session.focus}` : ""}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-tertiary-light)]">
              <span className="inline-flex items-center gap-1"><Users size={11} aria-hidden="true" />{session.participantCount ?? session.expectedAttendance ?? 0} students expected</span>
              <span aria-hidden="true">·</span>
              <span>{MODE_LABEL[session.mode]}</span>
            </div>
          </div>
        </div>
        {session.prepChecklist?.length ? (
          <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] p-3">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary-light)]">Ready to teach</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {session.prepChecklist.map((item) => (
                <li key={item.label} className="flex items-center gap-1.5 text-[11.5px]" style={{ color: item.done ? "var(--text-secondary-light)" : "var(--inbox-lead)" }}>
                  {item.done
                    ? <CheckCircle2 size={12} strokeWidth={2.2} style={{ color: "var(--inbox-success)" }} aria-hidden="true" />
                    : <Circle size={12} strokeWidth={2.2} aria-hidden="true" />}
                  {item.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </ProtagonistShell>
  )
}

function TutorProtagonist({ session, now }: { session: TodaySession; now: Date | null }) {
  return (
    <ProtagonistShell
      label="Up next"
      now={now}
      session={session}
      actions={<><PrimaryAction icon={PlayCircle} label="Start session" /><GhostAction icon={UserRound} label="Open student" />{session.homeworkStatus === "to_review" ? <GhostAction icon={BookOpen} label="Review homework" /> : null}</>}
    >
      <div className="grid gap-4 sm:grid-cols-[1fr_240px]">
        <div className="flex items-start gap-3">
          <Avatar name={session.title} size={44} />
          <div className="min-w-0">
            <h3 className="text-[18px] font-semibold text-[var(--text-primary-light)]">{session.title}</h3>
            <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary-light)]">{session.subjectOrTopic}{session.level ? ` · ${session.level}` : ""}</p>
            {session.practice ? (
              <div className="mt-2 flex items-center gap-2 text-[11px] text-[var(--text-tertiary-light)]">
                <span className="uppercase tracking-wide">Practiced</span>
                <PracticeDots practice={session.practice} />
                <span className="tabular-nums">{session.practice.done}/{session.practice.goal} days</span>
              </div>
            ) : null}
          </div>
        </div>
        <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] p-3">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary-light)]">Today&apos;s focus</p>
          <p className="mt-1 text-[12.5px] text-[var(--text-primary-light)]">{session.focus}</p>
          {session.progressNote ? <p className="mt-2 text-[11px] text-[var(--text-tertiary-light)]">{session.progressNote}</p> : null}
          {session.homeworkStatus === "to_review" ? (
            <p className="mt-1 inline-flex items-center gap-1 text-[11px]" style={{ color: "var(--accent-on-dark)" }}><BookOpen size={11} aria-hidden="true" /> Homework to review</p>
          ) : null}
        </div>
      </div>
    </ProtagonistShell>
  )
}

function CareProtagonist({ session }: { session: TodaySession }) {
  return (
    <div className="flex flex-col gap-4 rounded-[18px] border border-[var(--accent-muted-border)] bg-[var(--app-surface-dark)] p-5">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent-on-dark)" }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent-primary)" }} aria-hidden="true" />
        Needs you most
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_240px]">
        <div className="flex items-start gap-3">
          <Avatar name={session.title} size={44} />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-[18px] font-semibold text-[var(--text-primary-light)]">{session.title}</h3>
              {session.risks?.some((r) => r.type === "urgent") ? <Chip label="Urgent" tone="urgency" /> : null}
            </div>
            {session.situation ? <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--text-secondary-light)]">{session.situation}.</p> : null}
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {session.lastContactLabel ? <Chip label={session.lastContactLabel} tone="info" /> : null}
              {session.locationLabel ? <Chip label={session.locationLabel} tone="accent" /> : null}
            </div>
          </div>
        </div>
        {session.fannySuggestion ? (
          <div className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] p-3">
            <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest" style={{ color: "var(--accent-on-dark)" }}>
              <Sparkles size={11} aria-hidden="true" /> Fanny suggests
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-[var(--text-secondary-light)]">{session.fannySuggestion}</p>
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <PrimaryAction icon={Phone} label={`Call ${firstName(session.title)}`} />
        <GhostAction icon={MessageSquare} label="Send a message" />
        <GhostAction icon={CalendarPlus} label="Schedule visit" />
      </div>
    </div>
  )
}

function PracticeDots({ practice }: { practice: { done: number; goal: number } }) {
  return (
    <span className="flex items-center gap-0.5" aria-hidden="true">
      {Array.from({ length: practice.goal }, (_, i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: i < practice.done ? "var(--accent-primary)" : "color-mix(in srgb, var(--text-tertiary-light) 40%, transparent)" }}
        />
      ))}
    </span>
  )
}

// ── Timeline below the protagonist ──

function SessionTimeline({ day, protagonistId }: { day: TodaySessionDay; protagonistId: string | null }) {
  const { variant } = day
  const header = variant === "care" ? "Today's visits & calls" : variant === "tutor" ? "Your students today" : "Later today"

  const rows = useMemo(() => {
    if (variant === "care") {
      return day.sessions
        .filter((s) => s.startsAt && s.contactKind)
        .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime())
    }
    return day.sessions
      .filter((s) => s.id !== protagonistId && s.startsAt && s.status !== "completed" && s.status !== "cancelled")
      .sort((a, b) => new Date(a.startsAt!).getTime() - new Date(b.startsAt!).getTime())
  }, [day.sessions, variant, protagonistId])

  if (rows.length === 0) return null

  return (
    <div className="flex flex-col gap-2 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4">
      <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary-light)]">{header}</h2>
      <div className="flex flex-col gap-2">
        {rows.map((s) => <TimelineRow key={s.id} session={s} variant={variant} />)}
      </div>
    </div>
  )
}

function TimelineRow({ session, variant }: { session: TodaySession; variant: SessionVariant }) {
  const isVisit = session.contactKind === "visit"
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-3 py-2.5">
      <span className="w-14 shrink-0 text-[12px] font-semibold tabular-nums text-[var(--text-secondary-light)]">{session.startsAt ? fmtTime(session.startsAt) : "—"}</span>
      {variant === "care" ? (
        <span aria-hidden="true" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "var(--app-surface-hover)", color: isVisit ? "var(--inbox-success)" : "var(--inbox-info)" }}>
          {isVisit ? <MapPin size={13} strokeWidth={2} /> : <Phone size={13} strokeWidth={2} />}
        </span>
      ) : (
        <Avatar name={session.title} size={26} />
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-semibold text-[var(--text-primary-light)]">{session.title}</p>
        <p className="truncate text-[11px] text-[var(--text-tertiary-light)]">
          {variant === "care" ? session.situation : session.focus ?? session.subjectOrTopic}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {variant === "tutor" && session.practice ? <PracticeDots practice={session.practice} /> : null}
        {session.risks?.some((r) => r.type === "urgent") ? <Chip label="Urgent" tone="urgency" /> : null}
        {(session.paymentStatus === "unpaid" || session.paymentStatus === "overdue") ? <Chip label="Unpaid" tone="lead" /> : null}
        {session.risks?.some((r) => r.type === "reschedule") ? <Chip label="Rebook" tone="lead" /> : null}
      </div>
    </div>
  )
}

// ─── Fanny flow rail ──────────────────────────────────────────────────────────

function SessionFlowRail({ day, derived }: { day: TodaySessionDay; derived: SessionDerived }) {
  const meta = VARIANT_META[day.variant]
  const total = derived.flow.reduce((n, s) => n + s.items.length, 0)
  return (
    <aside className="flex flex-col gap-4 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4">
      <div className="flex items-center gap-2">
        <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-lg" style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}>
          <Sparkles size={14} />
        </span>
        <div>
          <p className="text-[12px] font-semibold text-[var(--text-primary-light)]">{meta.flowHeader}</p>
          <p className="text-[10px] text-[var(--text-tertiary-light)]">{meta.flowHint}</p>
        </div>
      </div>
      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-4 py-6 text-[11px] text-[var(--text-tertiary-light)]">
          Nothing needs attention right now.
        </p>
      ) : (
        derived.flow.map((s) => <FlowSection key={s.label} section={s} />)
      )}
      <p className="text-[9px] text-[var(--text-tertiary-light)]/70">Proposed by Fanny · actions activate once session actions are connected</p>
    </aside>
  )
}

function FlowSection({ section }: { section: { label: string; tone: FlowTone; items: SessionFlowItem[] } }) {
  const color = toneColor(section.tone)
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color }}>{section.label}</span>
        <span className="text-[10px] tabular-nums text-[var(--text-tertiary-light)]">{section.items.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {section.items.map((item) => (
          <div key={`${section.label}-${item.id}`} className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] p-3">
            <p className="truncate text-[12px] font-semibold text-[var(--text-primary-light)]">{item.title}</p>
            <p className="mt-0.5 truncate text-[11px] text-[var(--text-tertiary-light)]">{item.meta}</p>
            <FlowAction label={item.actionLabel} />
          </div>
        ))}
      </div>
    </section>
  )
}

// ─── Actions (all disabled — no fake writes) ───────────────────────────────────

const DISABLED_TITLE = "Available once session actions are connected"

function PrimaryAction({ icon: Icon, label }: { icon: typeof Send; label: string }) {
  return (
    <button
      type="button" disabled title={DISABLED_TITLE}
      className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-[var(--accent-muted-border)] bg-[var(--accent-muted)] px-3 py-1.5 text-[12px] font-semibold text-[var(--accent-on-dark)] opacity-90"
    >
      <Icon size={13} strokeWidth={2} aria-hidden="true" />
      {label}
    </button>
  )
}

function GhostAction({ icon: Icon, label }: { icon: typeof Send; label: string }) {
  return (
    <button
      type="button" disabled title={DISABLED_TITLE}
      className="inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-[var(--border-dark)] bg-[var(--app-surface-hover)] px-3 py-1.5 text-[12px] font-medium text-[var(--text-secondary-light)] opacity-80"
    >
      <Icon size={13} strokeWidth={2} aria-hidden="true" />
      {label}
    </button>
  )
}

function FlowAction({ label }: { label: string }) {
  const Icon = ACTION_ICON[label] ?? Sparkles
  return (
    <button
      type="button" disabled title={DISABLED_TITLE}
      className="mt-2 inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border border-[var(--border-dark)] bg-[var(--app-surface-hover)] px-2 py-1 text-[11px] font-medium text-[var(--text-secondary-light)] opacity-80"
    >
      <Icon size={11} strokeWidth={2} aria-hidden="true" />
      {label}
    </button>
  )
}
