"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import {
  AlertTriangle,
  CalendarClock,
  Loader2,
  PauseCircle,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react"
import { useFetch } from "@/hooks/use-fetch"
import { useToast } from "@/components/toast-provider"
import { sendToAI as sendToAIRequest, takeOver as takeOverRequest } from "@/lib/today/lane-client"
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

      {scheduleItems.length > 0 ? (
        <TodayScheduleStrip items={scheduleItems} />
      ) : null}

      {/*
        Workboard grid — desktop wants My work / AI work side by side.
        We use `lg:grid-cols-2` (≥1024px) instead of `md:` (≥768px) on
        purpose: between 768 and 1024 the AppShell sidebar (224px expanded)
        leaves only ~544–800px for the content column, which makes two
        lane columns feel cramped and unreadable. From `lg` upward there
        is real breathing room for the four sub-buckets in each lane.
        Mobile keeps the single-column stack — operators on phones don't
        try to scan two columns side by side anyway.
      */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TodayLaneColumn
          idPrefix="today-mine"
          title="My work"
          subtitle="Yours, your team's, and anything not yet handed to AI"
          icon={<UserRound size={13} strokeWidth={2} aria-hidden="true" />}
          buckets={lanes.mine}
          emptyTitle="No work for you today"
          emptyDescription="Tasks you create or take over will land here."
          onLaneMove={handleLaneMove}
          accent="mine"
        />
        <TodayLaneColumn
          idPrefix="today-ai"
          title="AI work"
          subtitle="Proposals from Fanny and anything you handed off to AI"
          icon={<Sparkles size={13} strokeWidth={2} aria-hidden="true" />}
          buckets={lanes.ai}
          emptyTitle="No AI work yet"
          emptyDescription="AI work will appear here when Fanny proposes or starts work."
          onLaneMove={handleLaneMove}
          accent="ai"
        />
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

// ─── Schedule strip ────────────────────────────────────────────────────────

/**
 * Schedule section. Displays today's calendar events above the
 * workboard so the day's time-anchored commitments are visible
 * before the operator dives into the lanes. Reuses the existing
 * `TodayEventCard` so style stays consistent with the drawer.
 *
 * Conscious choice: events render in a single-column stack on
 * desktop too (no horizontal carousel). Most workspaces have 0–5
 * events on any given day; a horizontal strip would feel empty most
 * of the time and would require its own a11y / overflow handling.
 */
function TodayScheduleStrip({ items }: { items: TodayPayload["buckets"]["today"] }) {
  return (
    <section
      aria-label="Schedule"
      className="flex flex-col gap-3 rounded-2xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)]/40 p-4"
    >
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 items-center justify-center rounded-md bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
          >
            <CalendarClock size={13} strokeWidth={2} />
          </span>
          <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary-light)]">
            Schedule
          </h2>
        </div>
        <span className="text-[10px] tabular-nums text-[var(--text-secondary-light)]/80">
          {items.length}
        </span>
      </header>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <TodayEventCard key={item.id} item={item} />
        ))}
      </div>
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
  onLaneMove,
  accent,
}: {
  idPrefix: string
  title: string
  subtitle: string
  icon: React.ReactNode
  buckets: TodayLaneBuckets
  emptyTitle: string
  emptyDescription: string
  onLaneMove: (taskId: string, to: "user" | "ai") => void | Promise<void>
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
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <TodaySection
            id={`${idPrefix}-overdue`}
            title="Overdue"
            tone="warning"
            items={buckets.overdue}
            onLaneMove={onLaneMove}
          />
          <TodaySection
            id={`${idPrefix}-due-today`}
            title="Due today"
            items={buckets.today}
            onLaneMove={onLaneMove}
          />
          <TodaySection
            id={`${idPrefix}-waiting`}
            title="Waiting / Blocked"
            items={buckets.waiting}
            onLaneMove={onLaneMove}
          />
          <TodaySection
            id={`${idPrefix}-no-date`}
            title="No date"
            items={buckets.undated}
            onLaneMove={onLaneMove}
          />
        </div>
      )}
    </section>
  )
}
