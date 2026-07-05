"use client"

import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Loader2,
  PauseCircle,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react"
import { useFetch } from "@/hooks/use-fetch"
import { useToast } from "@/components/toast-provider"
import {
  sendToAI as sendToAIRequest,
  takeOver as takeOverRequest,
  sendLegacyTareaToAI as sendLegacyTareaToAIRequest,
} from "@/lib/today/lane-client"
import type { TodayBuckets, TodayPayload } from "@modules/today/types"
import {
  countLane,
  countWaitingAcrossLanes,
  getScheduleItems,
  splitBucketsByLane,
  type TodayLaneBuckets,
} from "@modules/today/lanes"
import { TodaySection } from "./today-section"
import { TodayEmptyState } from "./today-empty-state"
import { TodayEventCard } from "./today-event-card"
import { cn } from "@/lib/utils"
import { useSearchParams } from "next/navigation"
import { useActiveWorkspace } from "@/hooks/use-active-workspace"
import { resolveTodayLayoutMode } from "@modules/today/today-layout-mode"
import { resolveBeautyTodayConfig } from "@modules/today/beauty-today"
import { resolveWorkspaceExperience } from "@core/vertical-packs/experience"
import { TodayAppointmentLayout } from "./today-appointment-layout"
import { BeautyStudioOverview } from "./beauty-studio-overview"
import { TodayJobRouteLayout } from "./today-job-route-layout"
import { TodaySessionLayout } from "./today-session-layout"
import { TodayBriefing } from "./today-briefing"
import { TodayStartHere } from "./today-start-here"
import {
  buildBriefingLine,
  getPartOfDay,
  pickProtagonist,
} from "@modules/today/briefing"

/**
 * Today page entry — resolves the workspace's layout mode and renders the
 * matching Today. Default is the work-first workboard; appointment-first,
 * job-route (field-service) and session-first (classes / 1:1 / care) are gated
 * behind an internal override (`?todayLayout=…`) and run on demo data until real
 * sources exist, so production is unaffected. The user never sees a mode name —
 * Mr. Forte sets the operating model during onboarding and Today simply adapts.
 *
 * `work_first_v2` is an additional override-only preview: the same work-first
 * workboard on the same real data, with a Fanny morning briefing + "Start Here"
 * protagonist hero mounted above it. Reachable solely via
 * `?todayLayout=work_first_v2`; the production default stays `work_first`.
 */
export function TodayPageClient() {
  const searchParams = useSearchParams()
  const { workspace } = useActiveWorkspace()

  // Beauty is the first vertical with a visible verticalized Today. The REAL
  // source of truth is the workspace: `workspace.verticalKey` →
  // `resolveWorkspaceExperience(...)` (the foundation from PR #17). When its
  // declared `todayMode` is "appointment_first" (only Beauty today), Today
  // renders the Spanish, Finesse-branded Beauty "Hoy" over DEMO data (marked
  // with a "Vista previa · datos de ejemplo" chip). Every other vertical stays
  // on work_first — Today normal is unchanged.
  //
  // `?vertical=beauty` is a preview/dev-only helper (clearly isolated) so the
  // screen is demoable on a Vercel preview without flipping a workspace first;
  // production behavior derives solely from the workspace's verticalKey.
  const forcedBeauty = searchParams.get("vertical") === "beauty"
  const effectiveVerticalKey = forcedBeauty ? "beauty" : workspace?.verticalKey
  const experience = resolveWorkspaceExperience(effectiveVerticalKey)
  const beauty =
    experience.todayMode === "appointment_first"
      ? resolveBeautyTodayConfig(effectiveVerticalKey)
      : null
  const mode = resolveTodayLayoutMode({
    override: searchParams.get("todayLayout"),
    verticalKey: effectiveVerticalKey,
    enableVerticalAutoSwitch: !!beauty,
  })

  if (mode === "appointment_first") {
    // Beauty renders the native Finesse "Studio" overview (product-app layout);
    // every other appointment vertical keeps the generic English preview.
    return beauty ? (
      <BeautyStudioOverview businessName={workspace?.nombre ?? null} beauty={beauty} />
    ) : (
      <TodayAppointmentLayout businessName={workspace?.nombre ?? null} beauty={null} />
    )
  }
  if (mode === "job_route") {
    return <TodayJobRouteLayout businessName={workspace?.nombre ?? null} />
  }
  if (mode === "session_first") {
    return <TodaySessionLayout businessName={workspace?.nombre ?? null} />
  }
  if (mode === "work_first_v2") {
    return <TodayWorkboardLayout showHero />
  }
  return <TodayWorkboardLayout />
}

/**
 * Today page body — the daily workboard.
 *
 * Layout:
 *
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │ Header: title + caption + counts (My / AI / Schedule / Waiting) │
 *   ├─────────────────────────────────────────────────────────────────┤
 *   │ Schedule strip (only when events exist)                         │
 *   ├──────────────────────────────┬──────────────────────────────────┤
 *   │ My work                      │ AI work (gradient accent line)   │
 *   │  - Overdue                   │  - Overdue                       │
 *   │  - Due today                 │  - Due today                     │
 *   │  - Waiting / Blocked         │  - Waiting / Blocked             │
 *   │  - No date                   │  - No date                       │
 *   └──────────────────────────────┴──────────────────────────────────┘
 *
 * Lane classification lives in `@modules/today/lanes`:
 *   - `assigneeType === "ai"` → AI work column.
 *   - `kind === "event"` → Schedule strip.
 *   - everything else task-shaped → My work column (includes user, team,
 *     unassigned, and legacy `Tarea` fallback rows so nothing important
 *     disappears just because the ownership label is fuzzy).
 *
 * Writes (Send to AI / Take over) keep refetch-on-success + toast-on-
 * error semantics. No optimistic state, per the previous PR's brief.
 */
function TodayWorkboardLayout({ showHero = false }: { showHero?: boolean }) {
  const [timezone, setTimezone] = useState<string | null>(null)
  const { addToast } = useToast()

  useEffect(() => {
    /**
     * Defer TZ detection to client mount so SSR doesn't accidentally bake the
     * server's timezone into the URL. `Intl.DateTimeFormat` is universally
     * available in the browser; the try/catch is just paranoia for very old
     * runtimes that might throw on `resolvedOptions()`.
     */
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setTimezone(tz && typeof tz === "string" ? tz : "UTC")
    } catch {
      setTimezone("UTC")
    }
  }, [])

  const url = timezone ? `/api/today?tz=${encodeURIComponent(timezone)}` : null
  const { data, loading, error, refetch } = useFetch<TodayPayload>(url)

  const handleLaneMove = useCallback(
    async (taskId: string, to: "user" | "ai") => {
      try {
        if (to === "ai") await sendToAIRequest(taskId)
        else await takeOverRequest(taskId)
        refetch()
      } catch (err) {
        addToast({
          type: "error",
          title: to === "ai" ? "Could not send to AI" : "Could not take over",
          description:
            err instanceof Error && err.message
              ? err.message
              : "Please try again in a moment.",
        })
      }
    },
    [addToast, refetch],
  )

  /**
   * Legacy `Tarea` rows have no WorkspaceTask mirror, so "Send to AI"
   * goes through the conversion endpoint (mirror Tarea → WorkspaceTask
   * assigned to AI). On success we refetch — the aggregator dedups the
   * Tarea via `tareaId`, so the `tarea:` row disappears from My work and
   * the new `task:` row appears in AI work.
   */
  const handleLegacyHandoff = useCallback(
    async (tareaId: string) => {
      try {
        await sendLegacyTareaToAIRequest(tareaId)
        refetch()
      } catch (err) {
        addToast({
          type: "error",
          title: "Could not send to AI",
          description:
            err instanceof Error && err.message
              ? err.message
              : "Please try again in a moment.",
        })
      }
    },
    [addToast, refetch],
  )

  /**
   * `loading` is true while either (a) we haven't resolved the TZ yet, or
   * (b) the fetch is in flight. Both produce the same spinner so the user
   * sees a single calm state instead of "no fetch yet → fetching → done".
   */
  const showSpinner = loading || timezone === null

  const buckets: TodayBuckets = useMemo(
    () => data?.buckets ?? { overdue: [], today: [], undated: [] },
    [data?.buckets],
  )
  const lanes = useMemo(() => splitBucketsByLane(buckets), [buckets])
  const scheduleItems = useMemo(() => getScheduleItems(lanes), [lanes])
  const counts = useMemo(
    () => ({
      mine: countLane(lanes.mine),
      ai: countLane(lanes.ai),
      schedule: scheduleItems.length,
      waiting: countWaitingAcrossLanes(lanes),
    }),
    [lanes, scheduleItems.length],
  )
  const totalItems = counts.mine + counts.ai + counts.schedule

  if (showSpinner) {
    return (
      <div className="flex items-center justify-center py-20" role="status" aria-label="Loading Today">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-secondary-light)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center"
      >
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" strokeWidth={1.5} />
        <p className="text-sm font-medium text-destructive">{error}</p>
        <p className="mt-1 text-xs text-destructive/80">Today could not be loaded.</p>
      </div>
    )
  }

  /**
   * Preview hero (work_first_v2 only) — a Fanny morning briefing + "Start
   * Here" protagonist mounted ABOVE the unchanged workboard. It reuses the
   * data already fetched and derived above (no extra request) and is built
   * only when `showHero` is set, so the default work_first path renders
   * exactly as before.
   */
  let hero: ReactNode = null
  if (showHero) {
    const briefingCounts = {
      overdue: lanes.mine.overdue.length + lanes.ai.overdue.length,
      dueToday: lanes.mine.today.length + lanes.ai.today.length,
      waiting: counts.waiting,
      schedule: counts.schedule,
      ai: counts.ai,
    }
    const partOfDay = getPartOfDay(new Date())
    const protagonist = pickProtagonist(lanes)

    // Reuse the EXISTING Send-to-AI handlers: canonical `task:` rows go
    // through the lane-move endpoint, legacy `tarea:` rows through the
    // conversion endpoint. Anything else hides the button and leaves
    // "Open task" as the only action.
    let onSendToAI: (() => void | Promise<void>) | undefined
    const protagonistId = protagonist?.item.id
    if (protagonistId?.startsWith("task:")) {
      const canonicalId = protagonistId.slice("task:".length)
      onSendToAI = () => handleLaneMove(canonicalId, "ai")
    } else if (protagonistId?.startsWith("tarea:")) {
      const tareaId = protagonistId.slice("tarea:".length)
      onSendToAI = () => handleLegacyHandoff(tareaId)
    }

    hero = (
      <section aria-label="Today briefing" className="grid gap-5 lg:grid-cols-2">
        <TodayBriefing
          line={buildBriefingLine(briefingCounts, partOfDay)}
          partOfDay={partOfDay}
        />
        <TodayStartHere protagonist={protagonist} onSendToAI={onSendToAI} />
      </section>
    )
  }

  if (totalItems === 0) {
    // Default Today keeps its calm empty state; the v2 preview shows the hero
    // (briefing + "you're all clear" Start Here) so it still reads as a full,
    // intentional surface with zero work.
    return showHero ? (
      <div className="flex flex-col gap-6">{hero}</div>
    ) : (
      <TodayEmptyState />
    )
  }

  const overdueCount = lanes.mine.overdue.length + lanes.ai.overdue.length
  const todayCount = lanes.mine.today.length + lanes.ai.today.length

  return (
    <div className="flex flex-col gap-6">
      {hero}
      <TodaySummaryBar counts={counts} overdueCount={overdueCount} todayCount={todayCount} />

      {/*
        Workboard grid — three equal columns on desktop:

          ┌──────────────┬──────────────┬──────────────┐
          │ My work      │ AI work      │ Schedule     │
          ├──────────────┼──────────────┼──────────────┤
          │ Overdue      │ Overdue      │ 09:00 ...    │
          │ Due today    │ Due today    │ 12:30 ...    │
          │ Waiting      │ Waiting      │ 16:00 ...    │
          │ No date      │ No date      │              │
          └──────────────┴──────────────┴──────────────┘

        Schedule used to live as a horizontal strip ABOVE the lanes;
        promoting it to a third column matches the operator's mental
        model — work, AI work, time-anchored commitments are three
        equal lanes of the daily plan.

        Breakpoints:
          - mobile / small (<lg): single-column stack, schedule LAST
            so the operator sees their work first and the calendar
            after a swipe (matches phone scanning patterns).
          - lg (≥1024px): three columns. On the AppShell (sidebar
            ~224px) at `max-w-7xl` the content column is ~1056px,
            giving each lane ~336px — comfortable for the four
            sub-buckets / event cards.

        The Schedule column is ALWAYS rendered (even with zero events)
        so the workboard reads as a stable three-lane plan and the
        operator never wonders where the calendar went. When empty it
        shows a calm "No events today" placeholder instead of
        collapsing the grid.
      */}
      <div className="grid gap-6 lg:grid-cols-3">
        <TodayLaneColumn
          idPrefix="today-mine"
          title="My work"
          subtitle="Yours, your team's, and anything not yet handed to AI"
          icon={<UserRound size={13} strokeWidth={2} aria-hidden="true" />}
          buckets={lanes.mine}
          emptyTitle="No work for you today"
          emptyDescription="Tasks you create or take over will land here."
          onLaneMove={handleLaneMove}
          onLegacyHandoff={handleLegacyHandoff}
          accent="mine"
        />
        <TodayLaneColumn
          idPrefix="today-ai"
          title="AI work"
          subtitle="Proposals from Fanny and anything you handed off to AI"
          icon={<Sparkles size={13} strokeWidth={2} aria-hidden="true" />}
          buckets={lanes.ai}
          emptyTitle="No AI work yet"
          emptyDescription="AI work shows up when Fanny proposes work, or when you hand a task off with “Send to AI” on a My work item."
          emptyAction={{ href: "/agents", label: "Review Agents" }}
          onLaneMove={handleLaneMove}
          accent="ai"
        />
        <TodayScheduleColumn items={scheduleItems} />
      </div>
    </div>
  )
}

// ─── Header ────────────────────────────────────────────────────────────────

/**
 * Slim summary bar — the workboard's single header. The page no longer renders
 * a SectionPage title, so "Today" is shown once here. Left: Sun halo + "Today" +
 * the date + a one-line status (overdue / due today / waiting). Right: four
 * compact count pills; Waiting turns amber when there are blockers.
 */
function TodaySummaryBar({
  counts,
  overdueCount,
  todayCount,
}: {
  counts: { mine: number; ai: number; schedule: number; waiting: number }
  overdueCount: number
  todayCount: number
}) {
  const dateLabel = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  })
  const waitingText = counts.waiting > 0 ? `${counts.waiting} waiting` : "nothing waiting"

  return (
    <header className="flex flex-col gap-3 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
          style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }}
        >
          <Sun size={16} strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-2">
            <h1 className="text-base font-semibold tracking-tight text-[var(--text-primary-light)]">Today</h1>
            <span suppressHydrationWarning className="text-[12px] text-[var(--text-secondary-light)]">
              {dateLabel}
            </span>
          </div>
          <p className="mt-0.5 text-[12px] text-[var(--text-secondary-light)]">
            <span style={overdueCount > 0 ? { color: "var(--inbox-urgency)" } : undefined}>
              {overdueCount} overdue
            </span>{" "}
            · {todayCount} due today · {waitingText}{" "}
            · <span className="text-[var(--text-tertiary-light)]">your daily workboard</span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <CountPill label="My work" value={counts.mine} icon={<UserRound size={12} strokeWidth={2} aria-hidden="true" />} />
        <CountPill label="AI work" value={counts.ai} icon={<Sparkles size={12} strokeWidth={2} aria-hidden="true" />} tone="ai" />
        <CountPill label="Schedule" value={counts.schedule} icon={<CalendarClock size={12} strokeWidth={2} aria-hidden="true" />} />
        <CountPill
          label="Waiting"
          value={counts.waiting}
          icon={<PauseCircle size={12} strokeWidth={2} aria-hidden="true" />}
          tone={counts.waiting > 0 ? "warning" : "default"}
        />
      </div>
    </header>
  )
}

function CountPill({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string
  value: number
  icon: React.ReactNode
  tone?: "default" | "ai" | "warning"
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5",
        tone === "warning"
          ? "border-[var(--status-warning-text)]/30 bg-[var(--status-warning-bg)]"
          : "border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)]",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          tone === "ai"
            ? "text-[var(--accent-on-dark)]"
            : tone === "warning"
              ? "text-[var(--status-warning-text)]"
              : "text-[var(--text-secondary-light)]",
        )}
      >
        {icon}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary-light)]">
        {label}
      </span>
      <span className="text-[13px] font-bold tabular-nums text-[var(--text-primary-light)]">{value}</span>
    </div>
  )
}

// ─── Schedule column ───────────────────────────────────────────────────────

/**
 * Schedule lane. Renders today's calendar events as the third column
 * of the workboard grid (same visual shell as `TodayLaneColumn` so
 * the three lanes read as siblings rather than a strip + two cards).
 *
 * The events stack vertically inside the column so the visual
 * pattern matches My work / AI work — short list of event cards
 * mirroring the short list of sub-buckets the lanes show. Reuses
 * `TodayEventCard` so the row style stays in lock-step with the
 * mobile drawer and the bottom chrome.
 *
 * Always rendered by the parent — when there are no events for today
 * it shows a friendly empty state instead of disappearing, so the
 * three-lane workboard stays stable.
 */
function TodayScheduleColumn({ items }: { items: TodayPayload["buckets"]["today"] }) {
  return (
    <section
      aria-label="Schedule"
      className="relative flex flex-col gap-4 overflow-hidden rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
          >
            <CalendarClock size={13} strokeWidth={2} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary-light)]">
              Schedule
            </h2>
            <p className="text-[11px] leading-snug text-[var(--text-secondary-light)]">
              Calendar events anchored to today
            </p>
          </div>
        </div>
        <span className="text-[10px] tabular-nums text-[var(--text-secondary-light)]/80">
          {items.length}
        </span>
      </header>
      {items.length === 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-start gap-1 rounded-xl border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-4 py-6"
        >
          <p className="text-xs font-medium text-[var(--text-primary-light)]">No events today</p>
          <p className="text-[11px] leading-relaxed text-[var(--text-secondary-light)]">
            Scheduled items will appear here.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item) => (
            <TodayEventCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  )
}

// ─── Lane column ───────────────────────────────────────────────────────────

/**
 * One lane column. Renders the four sub-buckets (Overdue / Due today /
 * Waiting-Blocked / No date) via `TodaySection`, which gracefully
 * no-ops when a sub-bucket is empty. Falls back to a friendly
 * empty state when the entire lane is empty.
 *
 * `accent="ai"` paints a subtle gradient top line and a gradient halo
 * on the icon — the only place the AI accent gradient surfaces, per
 * the PR brief. Kept calm so the workboard doesn't read as noisy.
 */
function TodayLaneColumn({
  idPrefix,
  title,
  subtitle,
  icon,
  buckets,
  emptyTitle,
  emptyDescription,
  emptyAction,
  onLaneMove,
  onLegacyHandoff,
  accent,
}: {
  idPrefix: string
  title: string
  subtitle: string
  icon: React.ReactNode
  buckets: TodayLaneBuckets
  emptyTitle: string
  emptyDescription: string
  /**
   * Optional CTA rendered in the empty state — e.g. the AI lane points
   * the operator at the Agents surface so an empty "AI work" lane still
   * teaches where AI activity lives.
   */
  emptyAction?: { href: string; label: string }
  onLaneMove: (taskId: string, to: "user" | "ai") => void | Promise<void>
  /** Forwarded to rows for legacy `Tarea` → AI conversion (My work lane). */
  onLegacyHandoff?: (tareaId: string) => void | Promise<void>
  accent: "mine" | "ai"
}) {
  const count = countLane(buckets)

  return (
    <section
      aria-label={title}
      className={cn(
        "relative flex flex-col gap-4 overflow-hidden rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4",
      )}
    >
      {accent === "ai" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(135deg,var(--accent-primary),var(--accent-on-dark))]"
        />
      ) : null}

      <header className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
              accent === "ai"
                ? "bg-[var(--accent-muted)] text-[var(--accent-on-dark)]"
                : "bg-[var(--app-surface-hover)] text-[var(--text-primary-light)]",
            )}
          >
            {icon}
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary-light)]">
              {title}
            </h2>
            <p className="text-[11px] leading-snug text-[var(--text-secondary-light)]">
              {subtitle}
            </p>
          </div>
        </div>
        <span className="text-[10px] tabular-nums text-[var(--text-secondary-light)]/80">
          {count}
        </span>
      </header>

      {count === 0 ? (
        <div
          role="status"
          aria-live="polite"
          className="flex flex-col items-start gap-1 rounded-xl border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] px-4 py-6"
        >
          <p className="text-xs font-medium text-[var(--text-primary-light)]">{emptyTitle}</p>
          <p className="text-[11px] leading-relaxed text-[var(--text-secondary-light)]">
            {emptyDescription}
          </p>
          {emptyAction ? (
            <Link
              href={emptyAction.href}
              className="mt-2 inline-flex items-center gap-1 rounded-md border border-[var(--accent-primary)]/30 px-2 py-1 text-[11px] font-medium text-[var(--accent-primary)] transition-colors hover:bg-[var(--accent-primary)]/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40"
            >
              {emptyAction.label}
              <ArrowUpRight size={11} strokeWidth={2} className="shrink-0" aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <TodaySection
            id={`${idPrefix}-overdue`}
            title="Overdue"
            tone="urgency"
            items={buckets.overdue}
            onLaneMove={onLaneMove}
            onLegacyHandoff={onLegacyHandoff}
          />
          <TodaySection
            id={`${idPrefix}-due-today`}
            title="Due today"
            items={buckets.today}
            onLaneMove={onLaneMove}
            onLegacyHandoff={onLegacyHandoff}
          />
          <TodaySection
            id={`${idPrefix}-waiting`}
            title="Waiting / Blocked"
            tone="warning"
            items={buckets.waiting}
            onLaneMove={onLaneMove}
            onLegacyHandoff={onLegacyHandoff}
          />
          <TodaySection
            id={`${idPrefix}-no-date`}
            title="No date"
            tone="muted"
            items={buckets.undated}
            onLaneMove={onLaneMove}
            onLegacyHandoff={onLegacyHandoff}
          />
        </div>
      )}
    </section>
  )
}
