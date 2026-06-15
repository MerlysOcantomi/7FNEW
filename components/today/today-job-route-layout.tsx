"use client"

import { useEffect, useMemo, useState } from "react"
import { useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Clock,
  CloudRain,
  DollarSign,
  KeyRound,
  MapPin,
  MessageSquare,
  Navigation,
  Package,
  Receipt,
  Route,
  Send,
  Sparkles,
} from "lucide-react"
import {
  deriveJobDay,
  type Job,
  type JobCanvasMode,
  type JobDay,
  type JobDayStatus,
  type JobDerived,
  type JobStatus,
} from "@modules/today/jobs"
import { getJobDayMock } from "./jobs/job-mock"
import { cn } from "@/lib/utils"

/**
 * Job-route (field-service) Today layout — the operative canvas for businesses
 * whose day happens at customer locations: cleaning, repair, plumbing,
 * electrical, HVAC, gardening, maintenance, installations, inspections, pest
 * control, small moves, light remodeling.
 *
 * Mother layout = HYBRID, three zones, same `/today` route / AppShell / tokens:
 *   ┌──────────────┬───────────────────────────┬───────────────┐
 *   │ Jobs today   │ Adaptive canvas           │ Fanny flow    │
 *   │ (route order)│ route · timeline · sites  │ (day's flow)  │
 *   └──────────────┴───────────────────────────┴───────────────┘
 *
 * NOT a maps/dispatch app — the center "route" canvas is an ABSTRACT premium
 * visualization, never Google tiles or live driver tracking. It is GATED OFF by
 * default and currently renders the isolated demo adapter (no real
 * field-service backend exists yet) — see modules/today/today-layout-mode.ts.
 * Reviewers preview it with `?todayLayout=job_route`; `&trade=` swaps the
 * vertical preset (cleaning · repair · landscaping · installation ·
 * construction) and `&canvas=` overrides the center (route · timeline ·
 * project_sites). Mobile-friendly stack; the Today Peek is a deliberate
 * follow-up, not built here.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}
function fmtWindow(start: string, end: string): string {
  return `${fmtTime(start)}–${fmtTime(end)}`
}
function fmtDrive(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
function initials(name: string): string {
  return name
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

// ─── Status → tokens ─────────────────────────────────────────────────────────

interface StatusStyle {
  bg: string
  text: string
  border: string
  label: string
}

const STATUS_STYLE: Record<JobStatus, StatusStyle> = {
  scheduled: {
    bg: "var(--app-surface-dark-elevated)",
    text: "var(--text-secondary-light)",
    border: "var(--border-dark)",
    label: "Scheduled",
  },
  confirmed: {
    bg: "var(--accent-muted)",
    text: "var(--accent-on-dark)",
    border: "var(--accent-muted-border)",
    label: "Confirmed",
  },
  on_the_way: {
    bg: "var(--inbox-info-soft)",
    text: "var(--inbox-info)",
    border: "color-mix(in srgb, var(--inbox-info) 32%, transparent)",
    label: "On the way",
  },
  arrived: {
    bg: "var(--inbox-success-soft)",
    text: "var(--inbox-success)",
    border: "color-mix(in srgb, var(--inbox-success) 32%, transparent)",
    label: "Arrived",
  },
  in_progress: {
    bg: "var(--accent-muted)",
    text: "var(--accent-on-dark)",
    border: "var(--accent-muted-border)",
    label: "In progress",
  },
  waiting_on_client: {
    bg: "var(--inbox-lead-soft)",
    text: "var(--inbox-lead)",
    border: "color-mix(in srgb, var(--inbox-lead) 32%, transparent)",
    label: "Waiting",
  },
  completed: {
    bg: "var(--inbox-success-soft)",
    text: "var(--inbox-success)",
    border: "color-mix(in srgb, var(--inbox-success) 32%, transparent)",
    label: "Completed",
  },
  cancelled: {
    bg: "var(--inbox-urgency-soft)",
    text: "var(--inbox-urgency)",
    border: "color-mix(in srgb, var(--inbox-urgency) 32%, transparent)",
    label: "Cancelled",
  },
  no_access: {
    bg: "var(--inbox-urgency-soft)",
    text: "var(--inbox-urgency)",
    border: "color-mix(in srgb, var(--inbox-urgency) 32%, transparent)",
    label: "No access",
  },
}

/** Coarse pin tone for the abstract route canvas. */
type PinTone = "done" | "current" | "upcoming"
function pinTone(status: JobStatus): PinTone {
  if (status === "completed" || status === "arrived") return "done"
  if (status === "in_progress") return "current"
  return "upcoming"
}

function normalizeCanvas(value: string | null): JobCanvasMode | null {
  switch (value) {
    case "route":
      return "route"
    case "timeline":
      return "timeline"
    case "project_sites":
    case "project-sites":
      return "project_sites"
    default:
      return null
  }
}

// ─── Entry ────────────────────────────────────────────────────────────────────

export function TodayJobRouteLayout({ businessName }: { businessName: string | null }) {
  const searchParams = useSearchParams()
  const trade = searchParams.get("trade") ?? "cleaning"
  const day = useMemo<JobDay>(() => getJobDayMock(trade), [trade])
  const derived = useMemo(() => deriveJobDay(day), [day])
  const canvas = normalizeCanvas(searchParams.get("canvas")) ?? day.canvas

  // Live "now" — gated after mount to avoid SSR/client mismatch.
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const jobsByOrder = useMemo(
    () => [...day.jobs].sort((a, b) => a.order - b.order),
    [day.jobs],
  )
  const nextStop = useMemo(
    () => day.jobs.find((j) => j.id === derived.nextStopId) ?? null,
    [day.jobs, derived.nextStopId],
  )

  return (
    <div className="flex flex-col gap-6">
      <JobSummaryBar
        derived={derived}
        day={day}
        businessName={businessName ?? day.businessName}
      />

      <div className="grid gap-6 lg:grid-cols-[300px_minmax(0,1fr)_320px]">
        <JobsList jobs={jobsByOrder} canvas={canvas} />
        <JobCanvas day={day} canvas={canvas} nextStop={nextStop} now={now} />
        <FannyFlowRail day={day} />
      </div>
    </div>
  )
}

// ─── Summary bar ──────────────────────────────────────────────────────────────

const DAY_STATUS_META: Record<JobDayStatus, { label: string; color: string }> = {
  on_track: { label: "On track", color: "var(--inbox-success)" },
  route_optimized: { label: "Route optimized", color: "var(--accent-on-dark)" },
  at_risk: { label: "At risk", color: "var(--inbox-lead)" },
  behind: { label: "Behind", color: "var(--inbox-urgency)" },
}

type PillTone = "default" | "lead" | "urgency" | "info"
interface Kpi {
  label: string
  value: string | number
  icon: typeof Route
  tone: PillTone
}

/** Data-driven KPI pills — the 4 the vertical cares about most. */
function buildKpiPills(day: JobDay, d: JobDerived): Kpi[] {
  const jobsLabel = day.canvas === "project_sites" ? "Sites" : "Jobs"
  const inProgress: Kpi = { label: "In progress", value: d.inProgressCount, icon: Clock, tone: "default" }
  const delayed: Kpi = {
    label: "Delayed", value: d.delayedCount, icon: AlertTriangle,
    tone: d.delayedCount > 0 ? "lead" : "default",
  }
  const atRisk: Kpi = {
    label: "At risk", value: d.atRiskCount, icon: AlertTriangle,
    tone: d.atRiskCount > 0 ? "urgency" : "default",
  }
  const unpaid: Kpi = {
    label: "Unpaid", value: d.unpaidCount, icon: DollarSign,
    tone: d.unpaidCount > 0 ? "lead" : "default",
  }
  const completed: Kpi = { label: "Completed", value: d.completedCount, icon: CheckCircle2, tone: "default" }
  const evidence: Kpi = {
    label: "Evidence", value: d.evidenceNeededCount, icon: Camera,
    tone: d.evidenceNeededCount > 0 ? "lead" : "default",
  }
  const jobs: Kpi = { label: jobsLabel, value: d.jobsCount, icon: Route, tone: "default" }

  switch (day.canvas) {
    case "timeline":
      return [jobs, inProgress, delayed, completed]
    case "project_sites":
      return [jobs, inProgress, atRisk, evidence]
    default:
      // route — repair/landscaping lean on at-risk, cleaning on delayed.
      if (day.trade === "Repair") return [jobs, inProgress, atRisk, unpaid]
      if (day.trade === "Landscaping") return [jobs, inProgress, atRisk, completed]
      return [jobs, inProgress, delayed, unpaid]
  }
}

function JobSummaryBar({
  derived,
  day,
  businessName,
}: {
  derived: JobDerived
  day: JobDay
  businessName: string
}) {
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
  const badge = DAY_STATUS_META[derived.dayStatus]
  const noun = day.canvas === "project_sites" ? "sites" : "jobs"
  const pills = buildKpiPills(day, derived)

  return (
    <header className="flex flex-col gap-3 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
        >
          <Route size={16} strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary-light)]">
              Today&apos;s route
            </h1>
            <span suppressHydrationWarning className="text-[12px] text-[var(--text-secondary-light)]">
              {dateLabel}
            </span>
            <span className="text-[12px] text-[var(--text-tertiary-light)]">· {businessName}</span>
            <span
              className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold"
              style={{
                color: badge.color,
                borderColor: `color-mix(in srgb, ${badge.color} 32%, transparent)`,
                background: `color-mix(in srgb, ${badge.color} 12%, transparent)`,
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: badge.color }} aria-hidden="true" />
              {badge.label}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--text-secondary-light)]">
            {derived.jobsCount} {noun} · {derived.crewsActive} crews active ·{" "}
            <span style={derived.delayedCount > 0 ? { color: "var(--inbox-lead)" } : undefined}>
              {derived.delayedCount} delayed
            </span>{" "}
            ·{" "}
            <span style={derived.unpaidCount > 0 ? { color: "var(--inbox-lead)" } : undefined}>
              {derived.unpaidCount} unpaid
            </span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {pills.map((p) => {
          const Icon = p.icon
          const accentColor =
            p.tone === "lead"
              ? "var(--inbox-lead)"
              : p.tone === "urgency"
                ? "var(--inbox-urgency)"
                : p.tone === "info"
                  ? "var(--inbox-info)"
                  : null
          return (
            <div
              key={p.label}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5"
              style={
                accentColor
                  ? { borderColor: `color-mix(in srgb, ${accentColor} 30%, transparent)`, background: `color-mix(in srgb, ${accentColor} 10%, transparent)` }
                  : { borderColor: "var(--border-dark)", background: "var(--app-surface-dark-elevated)" }
              }
            >
              <span aria-hidden="true" style={{ color: accentColor ?? "var(--text-tertiary-light)" }}>
                <Icon size={12} strokeWidth={2} />
              </span>
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary-light)]">
                {p.label}
              </span>
              <span
                className="text-[13px] font-bold tabular-nums"
                style={{ color: accentColor ?? "var(--text-primary-light)" }}
              >
                {p.value}
              </span>
            </div>
          )
        })}
      </div>
    </header>
  )
}

// ─── Jobs list (left) ──────────────────────────────────────────────────────────

function JobsList({ jobs, canvas }: { jobs: Job[]; canvas: JobCanvasMode }) {
  const header = canvas === "project_sites" ? "Sites today" : "Jobs today"
  const sub = canvas === "project_sites" ? "active sites" : "in route order"
  return (
    <section
      aria-label={header}
      className="flex flex-col gap-3 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4"
    >
      <header className="flex items-center justify-between">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary-light)]">
          {header}
        </h2>
        <span className="text-[10px] uppercase tracking-wide text-[var(--text-tertiary-light)]/80">{sub}</span>
      </header>
      <div className="flex flex-col gap-2.5">
        {jobs.map((job) => (
          <JobCard key={job.id} job={job} />
        ))}
      </div>
    </section>
  )
}

/** The single most salient operational flag for the card's bottom chip. */
function jobFlag(job: Job): { label: string; tone: "urgency" | "lead"; icon: typeof Camera } | null {
  const urgent = job.risks?.find((r) => r.type === "client_not_home" || r.type === "no_access")
  if (urgent) return { label: urgent.label, tone: "urgency", icon: AlertTriangle }
  const supplies = job.risks?.find((r) => r.type === "missing_materials")
  if (supplies) return { label: supplies.label, tone: "lead", icon: Package }
  const weather = job.risks?.find((r) => r.type === "weather")
  if (weather) return { label: weather.label, tone: "lead", icon: CloudRain }
  if (job.evidenceNeeded) return { label: "Evidence needed", tone: "lead", icon: Camera }
  if (job.paymentStatus === "unpaid")
    return { label: typeof job.price === "number" ? `Payment $${job.price}` : "Payment due", tone: "lead", icon: DollarSign }
  return null
}

function JobCard({ job }: { job: Job }) {
  const st = STATUS_STYLE[job.status]
  const flag = jobFlag(job)
  const isCurrent = job.status === "in_progress"
  return (
    <article
      className={cn(
        "rounded-xl border bg-[var(--app-surface-dark-elevated)] p-3",
        isCurrent ? "border-[var(--accent-muted-border)] ring-1 ring-[var(--accent-muted-border)]" : "border-[var(--border-dark)]",
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          aria-hidden="true"
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold tabular-nums"
          style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
        >
          {job.order}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="truncate text-[13px] font-semibold text-[var(--text-primary-light)]">{job.clientName}</p>
            <span
              className="shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold"
              style={{ background: st.bg, color: st.text, borderColor: st.border }}
            >
              {st.label}
            </span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-[11px] text-[var(--text-secondary-light)]">
            <MapPin size={11} strokeWidth={2} className="shrink-0 text-[var(--text-tertiary-light)]" aria-hidden="true" />
            <span className="truncate">{job.zone ?? job.address}</span>
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--text-tertiary-light)]">
            <Clock size={11} strokeWidth={2} className="shrink-0" aria-hidden="true" />
            <span className="tabular-nums">{fmtWindow(job.start, job.end)}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{job.jobType}</span>
          </p>
        </div>
      </div>
      <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[var(--border-dark)] pt-2">
        <span className="flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary-light)]">
          <span
            aria-hidden="true"
            className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-semibold"
            style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
          >
            {initials(job.crewName)}
          </span>
          {job.crewName}
        </span>
        {flag ? (
          <span
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              color: flag.tone === "urgency" ? "var(--inbox-urgency)" : "var(--inbox-lead)",
              background: flag.tone === "urgency" ? "var(--inbox-urgency-soft)" : "var(--inbox-lead-soft)",
            }}
          >
            <flag.icon size={10} strokeWidth={2} aria-hidden="true" />
            {flag.label}
          </span>
        ) : null}
      </div>
    </article>
  )
}

// ─── Center canvas (adaptive) ──────────────────────────────────────────────────

function JobCanvas({
  day,
  canvas,
  nextStop,
  now,
}: {
  day: JobDay
  canvas: JobCanvasMode
  nextStop: Job | null
  now: Date | null
}) {
  return (
    <section className="flex min-w-0 flex-col gap-3" aria-label="Today's route">
      {canvas === "route" ? (
        <RouteCanvas day={day} nextStop={nextStop} />
      ) : canvas === "timeline" ? (
        <TimelineCanvas day={day} nextStop={nextStop} now={now} />
      ) : (
        <ProjectSitesCanvas day={day} />
      )}
    </section>
  )
}

// ── Route canvas (abstract premium map — NOT tiles) ──

function RouteCanvas({ day, nextStop }: { day: JobDay; nextStop: Job | null }) {
  const pinned = useMemo(
    () => day.jobs.filter((j) => j.point).sort((a, b) => a.order - b.order),
    [day.jobs],
  )
  // The "frontier": stops up to the current one are traveled (solid); the rest
  // are upcoming (dotted).
  const currentOrder = useMemo(() => {
    const current = day.jobs.find((j) => j.status === "in_progress")
    if (current) return current.order
    const done = day.jobs.filter((j) => pinTone(j.status) === "done")
    return done.length ? Math.max(...done.map((j) => j.order)) : 0
  }, [day.jobs])
  const crewMarker = useMemo(() => {
    const j = day.jobs.find((x) => x.status === "in_progress" && x.point)
      ?? day.jobs.find((x) => x.status === "on_the_way" && x.point)
    return j ? { point: j.point!, crewName: j.crewName } : null
  }, [day.jobs])

  return (
    <>
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary-light)]">
            Today&apos;s route
          </h2>
          <span
            className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
            style={{ color: "var(--inbox-success)", background: "var(--inbox-success-soft)" }}
          >
            <CheckCircle2 size={9} strokeWidth={2.5} aria-hidden="true" />
            {day.route.optimized ? "Optimized" : "Manual order"}
          </span>
        </div>
        <span className="text-[10px] tabular-nums text-[var(--text-tertiary-light)]">
          {day.route.distanceMi} mi · {fmtDrive(day.route.driveMinutes)} drive
        </span>
      </header>

      <div
        className="relative overflow-hidden rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)]"
        style={{ height: 420 }}
        role="img"
        aria-label={`Abstract route map with ${pinned.length} stops`}
      >
        {/* Abstract streets + route polyline. viewBox is the 0–100 point space;
            preserveAspectRatio="none" maps it linearly to the box so SVG points
            line up with the percentage-positioned pins. */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* faint street grid */}
          {[20, 40, 60, 80].map((y) => (
            <line key={`h${y}`} x1="0" y1={y} x2="100" y2={y} stroke="var(--border-dark)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
          ))}
          {[25, 50, 75].map((x) => (
            <line key={`v${x}`} x1={x} y1="0" x2={x} y2="100" stroke="var(--border-dark)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />
          ))}
          {/* a couple of abstract avenues for depth */}
          <line x1="0" y1="92" x2="100" y2="64" stroke="var(--border-dark-strong)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
          <line x1="8" y1="0" x2="64" y2="100" stroke="var(--border-dark-strong)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />

          {/* route segments between consecutive pinned stops */}
          {pinned.slice(1).map((job, i) => {
            const prev = pinned[i]
            const traveled = job.order <= currentOrder
            return (
              <line
                key={`seg-${job.id}`}
                x1={prev.point!.x}
                y1={prev.point!.y}
                x2={job.point!.x}
                y2={job.point!.y}
                stroke="var(--accent-primary)"
                strokeWidth={traveled ? 2.4 : 1.8}
                strokeLinecap="round"
                strokeDasharray={traveled ? undefined : "1 4"}
                strokeOpacity={traveled ? 0.95 : 0.55}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
        </svg>

        {/* numbered stop pins */}
        {pinned.map((job) => (
          <RoutePin key={job.id} job={job} />
        ))}

        {/* crew "en route" marker */}
        {crewMarker ? (
          <div
            className="absolute z-10 flex -translate-x-1/2 translate-y-3 items-center gap-1 rounded-full border border-[var(--border-dark-strong)] bg-[var(--app-surface-dark-elevated)] px-2 py-0.5 shadow-sm"
            style={{ left: `${crewMarker.point.x}%`, top: `${crewMarker.point.y}%` }}
          >
            <Navigation size={9} strokeWidth={2.5} className="text-[var(--accent-on-dark)]" aria-hidden="true" />
            <span className="text-[9px] font-medium text-[var(--text-secondary-light)]">{crewMarker.crewName} · en route</span>
          </div>
        ) : null}

        {/* legend */}
        <div className="absolute bottom-3 left-3 flex items-center gap-3 rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)]/90 px-2.5 py-1.5 backdrop-blur">
          <LegendDot color="var(--inbox-success)" label="Done" />
          <LegendDot color="var(--accent-primary)" label="Current" />
          <LegendDot color="var(--text-tertiary-light)" label="Upcoming" />
        </div>
      </div>

      {nextStop ? <NextStopStrip job={nextStop} /> : null}
    </>
  )
}

function RoutePin({ job }: { job: Job }) {
  const tone = pinTone(job.status)
  const bg =
    tone === "done" ? "var(--inbox-success)" : tone === "current" ? "var(--accent-primary)" : "var(--app-surface-dark-elevated)"
  const text = tone === "upcoming" ? "var(--text-secondary-light)" : "var(--text-primary-light)"
  const border = tone === "upcoming" ? "var(--border-dark-strong)" : "transparent"
  return (
    <div
      className="absolute z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${job.point!.x}%`, top: `${job.point!.y}%` }}
      title={`${job.order}. ${job.clientName} · ${STATUS_STYLE[job.status].label}`}
    >
      {tone === "current" ? (
        <span className="absolute inset-0 -z-10 animate-ping rounded-full" style={{ background: "var(--accent-primary)", opacity: 0.35 }} aria-hidden="true" />
      ) : null}
      <span
        className="flex h-6 w-6 items-center justify-center rounded-full border text-[10px] font-bold tabular-nums shadow-sm"
        style={{ background: bg, color: text, borderColor: border }}
      >
        {job.order}
      </span>
    </div>
  )
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[9px] font-medium text-[var(--text-secondary-light)]">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  )
}

function NextStopStrip({ job }: { job: Job }) {
  return (
    <div className="flex items-center gap-3 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-3">
      <span
        aria-hidden="true"
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
        style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
      >
        <Navigation size={14} strokeWidth={2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--text-tertiary-light)]">Next stop</p>
        <p className="truncate text-[12.5px] text-[var(--text-primary-light)]">
          <span className="font-semibold">{job.clientName}</span>
          <span className="text-[var(--text-tertiary-light)]"> · {job.zone ?? job.address} · ETA {fmtTime(job.start)}</span>
        </p>
      </div>
      <FieldActionButton icon={Send} label="Send arrival" prominent />
    </div>
  )
}

// ── Timeline canvas (arrival windows) ──

const TL_START = 8
const TL_END = 18
const TL_HOUR_PX = 56
const TL_TOTAL = (TL_END - TL_START) * TL_HOUR_PX
const TL_HOURS = Array.from({ length: TL_END - TL_START + 1 }, (_, i) => TL_START + i)

function tlHourOf(iso: string): number {
  const d = new Date(iso)
  return d.getHours() + d.getMinutes() / 60
}
function tlClamp(h: number): number {
  return Math.min(Math.max(h, TL_START), TL_END)
}
function tlTop(iso: string): number {
  return (tlClamp(tlHourOf(iso)) - TL_START) * TL_HOUR_PX
}
function tlHeight(start: string, end: string): number {
  return Math.max(tlTop(end) - tlTop(start), 30)
}

function TimelineCanvas({ day, nextStop, now }: { day: JobDay; nextStop: Job | null; now: Date | null }) {
  const jobs = useMemo(() => [...day.jobs].sort((a, b) => a.order - b.order), [day.jobs])
  const nowHour = now ? now.getHours() + now.getMinutes() / 60 : null
  const nowTop = nowHour !== null && nowHour >= TL_START && nowHour <= TL_END ? (nowHour - TL_START) * TL_HOUR_PX : null

  return (
    <>
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary-light)]">
          Arrival windows
        </h2>
        <span className="text-[10px] text-[var(--text-tertiary-light)]">by time on site</span>
      </header>
      <div
        className="relative overflow-auto rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)]"
        style={{ maxHeight: 460 }}
      >
        <div className="flex">
          <div className="relative w-14 shrink-0 border-r border-[var(--border-dark)]" style={{ height: TL_TOTAL }}>
            {TL_HOURS.map((h) => (
              <div
                key={h}
                className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-[var(--text-tertiary-light)]"
                style={{ top: (h - TL_START) * TL_HOUR_PX }}
              >
                {new Date(0, 0, 0, h).toLocaleTimeString(undefined, { hour: "numeric" })}
              </div>
            ))}
          </div>
          <div className="relative flex-1" style={{ height: TL_TOTAL }}>
            {TL_HOURS.map((h) => (
              <div
                key={h}
                aria-hidden="true"
                className="absolute inset-x-0 border-t border-[var(--border-dark)]/50"
                style={{ top: (h - TL_START) * TL_HOUR_PX }}
              />
            ))}
            {jobs.map((job) => {
              const st = STATUS_STYLE[job.status]
              return (
                <div
                  key={job.id}
                  className="absolute inset-x-3 overflow-hidden rounded-lg border px-3 py-1.5"
                  style={{ top: tlTop(job.start), height: tlHeight(job.start, job.end), background: st.bg, borderColor: st.border }}
                  title={`${job.clientName} · ${job.jobType} · ${fmtWindow(job.start, job.end)}`}
                >
                  <p className="truncate text-[12px] font-semibold text-[var(--text-primary-light)]">{job.clientName}</p>
                  <p className="truncate text-[11px]" style={{ color: st.text }}>
                    {job.jobType} · {fmtWindow(job.start, job.end)}
                  </p>
                </div>
              )
            })}
            {nowTop !== null ? (
              <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: nowTop }} aria-hidden="true">
                <div className="relative h-px w-full" style={{ background: "var(--accent-primary)" }}>
                  <span className="absolute -left-0.5 -top-[3px] h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent-primary)" }} />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
      {nextStop ? <NextStopStrip job={nextStop} /> : null}
    </>
  )
}

// ── Project-sites canvas (not a route) ──

function siteProgress(status: JobStatus): number {
  switch (status) {
    case "completed": return 100
    case "in_progress": return 60
    case "arrived": return 45
    case "on_the_way": return 25
    default: return 12
  }
}

function ProjectSitesCanvas({ day }: { day: JobDay }) {
  const sites = useMemo(() => [...day.jobs].sort((a, b) => a.order - b.order), [day.jobs])
  return (
    <>
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-tertiary-light)]">
          Active sites
        </h2>
        <span className="text-[10px] text-[var(--text-tertiary-light)]">long planning lives in Projects</span>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        {sites.map((site) => {
          const st = STATUS_STYLE[site.status]
          const risk = site.risks?.[0]
          const progress = siteProgress(site.status)
          return (
            <article
              key={site.id}
              className="flex flex-col gap-2.5 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-[var(--text-primary-light)]">{site.clientName}</p>
                  <p className="mt-0.5 flex items-center gap-1 text-[11px] text-[var(--text-tertiary-light)]">
                    <MapPin size={11} strokeWidth={2} aria-hidden="true" />
                    {site.address}
                  </p>
                </div>
                <span
                  className="shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold"
                  style={{ background: st.bg, color: st.text, borderColor: st.border }}
                >
                  {st.label}
                </span>
              </div>
              <p className="text-[12px] text-[var(--text-secondary-light)]">{site.jobType}</p>
              <div>
                <div className="flex items-center justify-between text-[10px] text-[var(--text-tertiary-light)]">
                  <span>Progress</span>
                  <span className="tabular-nums">{progress}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--app-surface-dark-elevated)" }}>
                  <div className="h-full rounded-full" style={{ width: `${progress}%`, background: "var(--accent-primary)" }} />
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-[var(--border-dark)] pt-2">
                <span className="flex items-center gap-1 text-[10px] text-[var(--text-tertiary-light)]">
                  <span
                    aria-hidden="true"
                    className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-semibold"
                    style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
                  >
                    {initials(site.crewName)}
                  </span>
                  {site.crewName}
                </span>
                {site.evidenceNeeded ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--inbox-lead)" }}>
                    <Camera size={10} strokeWidth={2} aria-hidden="true" /> Evidence
                  </span>
                ) : null}
                {risk ? (
                  <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-medium" style={{ color: "var(--inbox-lead)" }}>
                    <AlertTriangle size={10} strokeWidth={2} aria-hidden="true" /> {risk.label}
                  </span>
                ) : null}
              </div>
            </article>
          )
        })}
      </div>
    </>
  )
}

// ─── Fanny flow rail (right) ───────────────────────────────────────────────────

interface FlowItem {
  id: string
  title: string
  meta: string
  action: { icon: typeof Send; label: string }
}

function FannyFlowRail({ day }: { day: JobDay }) {
  // Each section reads off the jobs; every item is a card + ONE Fanny action.
  const routeRisks: FlowItem[] = day.jobs
    .filter((j) => j.risks?.some((r) => r.type === "client_not_home" || r.type === "no_access" || r.type === "missing_materials" || r.type === "weather"))
    .map((j) => {
      const r = j.risks!.find((x) => x.type !== "running_late") ?? j.risks![0]
      const noAccess = r.type === "client_not_home" || r.type === "no_access"
      return {
        id: j.id,
        title: `${j.clientName} · ${r.label.toLowerCase()}`,
        meta: noAccess ? `${j.crewName} arrives ${fmtTime(j.start)} — confirm access` : `${j.jobType} · ${j.crewName}`,
        action: noAccess ? { icon: KeyRound, label: "Ask for access" } : { icon: Send, label: "Notify crew" },
      }
    })

  const delayed: FlowItem[] = day.jobs
    .filter((j) => j.risks?.some((r) => r.type === "running_late"))
    .map((j) => ({
      id: j.id,
      title: `${j.crewName} running behind`,
      meta: `${j.clientName} · ETA slips to ${fmtTime(j.end)}`,
      action: { icon: Send, label: "Notify delay" },
    }))

  const payments: FlowItem[] = day.jobs
    .filter((j) => j.paymentStatus === "unpaid" && (j.status === "completed" || j.status === "arrived"))
    .map((j) => ({
      id: j.id,
      title: `${j.clientName}${typeof j.price === "number" ? ` · $${j.price}` : ""}`,
      meta: `${j.jobType} · unpaid`,
      action: { icon: Receipt, label: "Draft invoice" },
    }))

  const evidence: FlowItem[] = day.jobs
    .filter((j) => j.evidenceNeeded)
    .map((j) => ({
      id: j.id,
      title: `${j.clientName} · before/after`,
      meta: "job done — photos missing",
      action: { icon: Camera, label: "Request photo" },
    }))

  const followUps: FlowItem[] = day.jobs
    .filter((j) => j.jobType.toLowerCase().includes("recurring") || j.jobType.toLowerCase().includes("move-out"))
    .slice(0, 2)
    .map((j) => ({
      id: j.id,
      title: `Rebook ${j.clientName}`,
      meta: "recurring — keep the slot",
      action: { icon: MessageSquare, label: "Draft message" },
    }))

  const total = routeRisks.length + delayed.length + payments.length + evidence.length + followUps.length

  return (
    <aside className="flex flex-col gap-4 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4">
      <div className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-lg"
          style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
        >
          <Sparkles size={14} />
        </span>
        <div>
          <p className="text-[12px] font-semibold text-[var(--text-primary-light)]">Today&apos;s flow</p>
          <p className="text-[10px] text-[var(--text-tertiary-light)]">Fanny keeps the day moving</p>
        </div>
      </div>

      {total === 0 ? (
        <p className="rounded-xl border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-4 py-6 text-[11px] text-[var(--text-tertiary-light)]">
          Nothing needs attention right now.
        </p>
      ) : (
        <>
          <FlowSection label="Route risks" tone="urgency" items={routeRisks} />
          <FlowSection label="Delayed" tone="lead" items={delayed} />
          <FlowSection label="Payment pending" tone="lead" items={payments} />
          <FlowSection label="Evidence needed" tone="info" items={evidence} />
          <FlowSection label="Follow-ups" tone="info" items={followUps} />
        </>
      )}
      <p className="text-[9px] text-[var(--text-tertiary-light)]/70">
        Proposed by Fanny · actions activate once field actions are connected
      </p>
    </aside>
  )
}

function FlowSection({
  label,
  tone,
  items,
}: {
  label: string
  tone: "urgency" | "lead" | "info"
  items: FlowItem[]
}) {
  if (items.length === 0) return null
  const color = tone === "urgency" ? "var(--inbox-urgency)" : tone === "lead" ? "var(--inbox-lead)" : "var(--inbox-info)"
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} aria-hidden="true" />
        <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color }}>
          {label}
        </span>
        <span className="text-[10px] tabular-nums text-[var(--text-tertiary-light)]">{items.length}</span>
      </div>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <div key={`${label}-${item.id}`} className="rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] p-3">
            <p className="truncate text-[12px] font-semibold text-[var(--text-primary-light)]">{item.title}</p>
            <p className="mt-0.5 truncate text-[11px] text-[var(--text-tertiary-light)]">{item.meta}</p>
            <FieldActionButton icon={item.action.icon} label={item.action.label} />
          </div>
        ))}
      </div>
    </section>
  )
}

/**
 * Field action affordance. Disabled until the field-service backend lands —
 * never simulates a write (honours the no-fake-product rule). `prominent` keeps
 * the next-stop "Send arrival" visually primary while still inert.
 */
function FieldActionButton({
  icon: Icon,
  label,
  prominent = false,
}: {
  icon: typeof Send
  label: string
  prominent?: boolean
}) {
  return (
    <button
      type="button"
      disabled
      title="Available once field actions are connected"
      className={cn(
        "mt-2 inline-flex cursor-not-allowed items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium opacity-80",
        prominent
          ? "mt-0 border-[var(--accent-muted-border)] bg-[var(--accent-muted)] text-[var(--accent-on-dark)]"
          : "border-[var(--border-dark)] bg-[var(--app-surface-hover)] text-[var(--text-secondary-light)]",
      )}
    >
      <Icon size={11} strokeWidth={2} aria-hidden="true" />
      {label}
    </button>
  )
}
