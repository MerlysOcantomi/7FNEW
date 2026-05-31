"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
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
export function TodayPageClient() {
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

  if (totalItems === 0) {
    return <TodayEmptyState />
  }

  return (
    <div className="flex flex-col gap-6">
      <TodayWorkboardHeader counts={counts} />

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
 * Workboard header. Renders the page title, a short caption, and a
 * compact stat strip with the four counts the operator cares about
 * most: My work, AI work, Schedule, and Waiting / Blocked.
 *
 * Waiting count surfaces even when zero so the absence of blockers
 * itself is informative — many operators ask "is anything stuck?"
 * before they pick up a row.
 */
function TodayWorkboardHeader({
  counts,
}: {
  counts: { mine: number; ai: number; schedule: number; waiting: number }
}) {
  return (
    <header className="flex flex-col gap-3 rounded-2xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)]/40 p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
        >
          <Sun size={16} strokeWidth={1.9} />
        </span>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary-light)]">
            Today
          </h1>
          <p className="text-xs leading-relaxed text-[var(--text-secondary-light)]">
            Your daily workboard. Hand work to AI, take work back, see what&apos;s on the calendar.
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatTile
          label="My work"
          value={counts.mine}
          icon={<UserRound size={12} strokeWidth={2} aria-hidden="true" />}
        />
        <StatTile
          label="AI work"
          value={counts.ai}
          icon={<Sparkles size={12} strokeWidth={2} aria-hidden="true" />}
          tone="ai"
        />
        <StatTile
          label="Schedule"
          value={counts.schedule}
          icon={<CalendarClock size={12} strokeWidth={2} aria-hidden="true" />}
        />
        <StatTile
          label="Waiting"
          value={counts.waiting}
          icon={<PauseCircle size={12} strokeWidth={2} aria-hidden="true" />}
          tone={counts.waiting > 0 ? "warning" : "default"}
        />
      </dl>
    </header>
  )
}

function StatTile({
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
        "flex items-center justify-between gap-2 rounded-xl border px-3 py-2",
        tone === "ai"
          ? "border-[var(--border-dark)] bg-[linear-gradient(135deg,rgba(47,128,237,0.10),rgba(139,92,246,0.10),rgba(236,72,153,0.10))]"
          : tone === "warning"
            ? "border-[var(--status-warning-text)]/30 bg-[var(--status-warning-bg)]/40"
            : "border-[var(--border-dark)] bg-[var(--app-surface-dark)]",
      )}
    >
      <div className="flex items-center gap-1.5 text-[var(--text-secondary-light)]">
        <span aria-hidden="true">{icon}</span>
        <dt className="text-[10px] font-semibold uppercase tracking-widest">{label}</dt>
      </div>
      <dd className="text-base font-semibold tabular-nums text-[var(--text-primary-light)]">
        {value}
      </dd>
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
      className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)]/40 p-4"
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
          className="flex flex-col items-start gap-1 rounded-xl border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-6"
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
        "relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)]/40 p-4",
      )}
    >
      {accent === "ai" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-[linear-gradient(135deg,#2f80ed,#8b5cf6,#ec4899)]"
        />
      ) : null}

      <header className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className={cn(
              "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
              accent === "ai"
                ? "bg-[linear-gradient(135deg,rgba(47,128,237,0.20),rgba(139,92,246,0.20),rgba(236,72,153,0.20))] text-[var(--text-primary-light)]"
                : "bg-white/[0.06] text-[var(--text-primary-light)]",
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
          className="flex flex-col items-start gap-1 rounded-xl border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-6"
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
            tone="warning"
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
            items={buckets.waiting}
            onLaneMove={onLaneMove}
            onLegacyHandoff={onLegacyHandoff}
          />
          <TodaySection
            id={`${idPrefix}-no-date`}
            title="No date"
            items={buckets.undated}
            onLaneMove={onLaneMove}
            onLegacyHandoff={onLegacyHandoff}
          />
        </div>
      )}
    </section>
  )
}
