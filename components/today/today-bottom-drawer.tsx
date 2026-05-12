"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Loader2,
  Sparkles,
  Sun,
  UserRound,
  X,
} from "lucide-react"
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerTitle,
} from "@/components/ui/drawer"
import { useFetch } from "@/hooks/use-fetch"
import type { TodayBuckets, TodayItem, TodayPayload, TodayPriority } from "@modules/today/types"
import {
  countLane,
  getScheduleItems,
  splitBucketsByLane,
  type TodayLaneBuckets,
} from "@modules/today/lanes"
import { cn } from "@/lib/utils"

/**
 * Global bottom Today drawer.
 *
 * Compact two-column preview of the full `/today` workboard. The drawer
 * shares the same lane vocabulary (My work / AI work / Schedule) but
 * uses tighter rows and a smaller height budget so it reads as a
 * peek, not a duplicated page.
 *
 * Layout:
 *   - Desktop (md+): Schedule strip above (when events exist), then
 *     My work | AI work side by side.
 *   - Mobile: same blocks stacked vertically.
 *
 * Decisions specific to the drawer (NOT shared with `/today` full page):
 *   - Rows are single-line + a metadata row underneath. No description
 *     line, no priority chip text, no priority dot box-out — only the
 *     bare minimum so the drawer doesn't grow tall.
 *   - Send to AI / Take over are intentionally HIDDEN inside the drawer.
 *     The compact rows would feel noisy with action buttons; operators
 *     who want to move work between lanes can click through to /today.
 *     This keeps the drawer feeling like a glance, not a control panel.
 *   - AI accent is a subtle 2px gradient top hairline + tinted icon halo,
 *     identical to the full page but on a smaller surface.
 *   - Max height capped at 70vh (full page surface is the canonical
 *     deep-dive; drawer should feel lighter).
 *
 * Behaviour:
 *   - Lazy fetch: data is only requested once the drawer is `open`.
 *   - Closing the drawer leaves the cached payload in memory; reopening
 *     reuses it. The full `/today` page is the canonical source of
 *     truth, so any drift between the two surfaces resolves naturally
 *     when the operator navigates there.
 *
 * Multi-tenancy: the fetch goes through `requireReadAccess` in the
 * route, which ALWAYS scopes to the active workspace. No client-side
 * workspace juggling here.
 */
export function TodayBottomDrawer({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (next: boolean) => void
}) {
  const [timezone, setTimezone] = useState<string | null>(null)

  useEffect(() => {
    /**
     * Defer TZ detection to client mount so SSR never bakes the server zone
     * into the URL. Identical to the `/today` page client; we duplicate the
     * five lines on purpose to keep the drawer self-contained — pulling a
     * shared hook just for this would invite incidental coupling between
     * surfaces that may evolve independently.
     */
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
      setTimezone(tz && typeof tz === "string" ? tz : "UTC")
    } catch {
      setTimezone("UTC")
    }
  }, [])

  /**
   * Lazy fetch: only build the URL once the drawer is actually open. Closing
   * the drawer suspends the request lifecycle without unmounting state, so
   * `<TodayBottomLauncher>` can stay mounted globally without paying the cost
   * of an idle Today fetch on every route.
   */
  const url = open && timezone ? `/api/today?tz=${encodeURIComponent(timezone)}` : null
  const { data, loading, error } = useFetch<TodayPayload>(url)

  const buckets: TodayBuckets = useMemo(
    () => data?.buckets ?? { overdue: [], today: [], undated: [] },
    [data?.buckets],
  )
  const lanes = useMemo(() => splitBucketsByLane(buckets), [buckets])
  const scheduleItems = useMemo(() => getScheduleItems(lanes), [lanes])
  const totalItems = useMemo(
    () => countLane(lanes.mine) + countLane(lanes.ai) + scheduleItems.length,
    [lanes.mine, lanes.ai, scheduleItems.length],
  )

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent
        /**
         * Override the default `bg-background` so the drawer adopts the app's
         * dark surface tokens — consistent with `app-shell.tsx` and the Today
         * page chrome. `max-h-[70vh]` keeps the panel intentionally lighter
         * than the full `/today` page; the body owns its own scrollport below.
         */
        className={cn(
          "bg-[var(--app-shell-bg)] text-[var(--text-primary-light)]",
          "data-[vaul-drawer-direction=bottom]:max-h-[70vh]",
        )}
      >
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--border-dark)] px-5 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
            >
              <Sun size={14} strokeWidth={1.9} />
            </span>
            <div className="min-w-0">
              <DrawerTitle className="text-sm font-semibold tracking-tight text-[var(--text-primary-light)]">
                Today
              </DrawerTitle>
              <DrawerDescription className="text-[11px] leading-tight text-[var(--text-secondary-light)]">
                Daily overview · workspace-wide
              </DrawerDescription>
            </div>
            {!loading && !error && totalItems > 0 ? (
              <span className="ml-1 inline-flex shrink-0 items-center rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium tabular-nums text-[var(--text-secondary-light)]">
                {totalItems}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <Link
              href="/today"
              onClick={() => onOpenChange(false)}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-[var(--accent-primary)] transition-colors hover:bg-white/[0.06]"
            >
              Open full Today
              <ArrowUpRight size={11} strokeWidth={2} className="shrink-0" />
            </Link>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label="Close Today drawer"
              className="rounded-md p-1 text-[var(--text-secondary-light)] transition-colors hover:bg-white/[0.06] hover:text-[var(--text-primary-light)]"
            >
              <X size={14} strokeWidth={2} />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <TodayDrawerBody
            loading={loading}
            error={error}
            lanes={lanes}
            scheduleItems={scheduleItems}
            totalItems={totalItems}
          />
        </div>
      </DrawerContent>
    </Drawer>
  )
}

/**
 * Inner body of the Today drawer. Renders Schedule (when events
 * exist), then the My-work / AI-work mini workboard. On desktop the
 * two lanes sit side by side (md:grid-cols-2); on mobile they stack.
 */
function TodayDrawerBody({
  loading,
  error,
  lanes,
  scheduleItems,
  totalItems,
}: {
  loading: boolean
  error: string | null
  lanes: ReturnType<typeof splitBucketsByLane>
  scheduleItems: TodayItem[]
  totalItems: number
}) {
  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading Today"
        className="flex items-center justify-center py-10"
      >
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-secondary-light)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        className="flex flex-col items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center"
      >
        <AlertTriangle className="h-6 w-6 text-destructive" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-xs font-medium text-destructive">{error}</p>
        <p className="text-[11px] text-destructive/80">Today could not be loaded.</p>
      </div>
    )
  }

  if (totalItems === 0) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-6 text-center"
      >
        <Sun
          className="h-5 w-5 text-[var(--accent-primary)]/80"
          strokeWidth={1.5}
          aria-hidden="true"
        />
        <p className="text-xs font-medium text-[var(--text-primary-light)]">
          Nothing pending. Nice.
        </p>
        <p className="text-[11px] leading-relaxed text-[var(--text-secondary-light)]">
          Anything that needs your attention will show up here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {scheduleItems.length > 0 ? (
        <TodayDrawerSchedule items={scheduleItems} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <TodayDrawerLane
          idPrefix="today-drawer-mine"
          title="My work"
          icon={<UserRound size={12} strokeWidth={2} aria-hidden="true" />}
          buckets={lanes.mine}
          emptyLabel="No work for you today."
          accent="mine"
        />
        <TodayDrawerLane
          idPrefix="today-drawer-ai"
          title="AI work"
          icon={<Sparkles size={12} strokeWidth={2} aria-hidden="true" />}
          buckets={lanes.ai}
          emptyLabel="No AI work yet."
          accent="ai"
        />
      </div>
    </div>
  )
}

// ─── Schedule (compact) ────────────────────────────────────────────────────

/**
 * Compact Schedule block at the top of the drawer. One row per event
 * with a small time chip and a truncated title — events almost always
 * read fine in this single-line shape.
 */
function TodayDrawerSchedule({ items }: { items: TodayItem[] }) {
  return (
    <section aria-label="Schedule" className="flex flex-col gap-2">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="flex h-5 w-5 items-center justify-center rounded-md bg-[var(--accent-primary)]/15 text-[var(--accent-primary)]"
          >
            <CalendarClock size={11} strokeWidth={2} />
          </span>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary-light)]">
            Schedule
          </h3>
        </div>
        <span className="text-[10px] tabular-nums text-[var(--text-secondary-light)]/80">
          {items.length}
        </span>
      </header>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <CompactEventRow item={item} />
          </li>
        ))}
      </ul>
    </section>
  )
}

// ─── Lane block (compact) ──────────────────────────────────────────────────

/**
 * One compact lane block inside the drawer. The AI variant carries
 * a subtle gradient hairline on the top edge and a tinted icon halo
 * — the only places the AI accent surfaces in the drawer.
 *
 * Rows are stacked tightly under a single small "count + title"
 * header. We deliberately collapse the per-date sub-buckets
 * (Overdue / Due today / Waiting / No date) into one flat stream:
 * the drawer is a glance, and four sub-headers per lane would make
 * it feel like the full page. Sub-bucket information still rides
 * along on each row's compact metadata (the due chip already says
 * "Yesterday", "Today 4:00 PM", etc., and "Waiting" rows render a
 * small status pill).
 *
 * The aggregator's overall sort order is preserved by walking the
 * sub-buckets in priority order: Overdue → Due today → Waiting →
 * No date. Within each sub-bucket the aggregator's priority / due /
 * title sort already applies.
 */
function TodayDrawerLane({
  idPrefix,
  title,
  icon,
  buckets,
  emptyLabel,
  accent,
}: {
  idPrefix: string
  title: string
  icon: React.ReactNode
  buckets: TodayLaneBuckets
  emptyLabel: string
  accent: "mine" | "ai"
}) {
  const count = countLane(buckets)
  const flat: TodayItem[] = useMemo(
    () => [
      ...buckets.overdue,
      ...buckets.today,
      ...buckets.waiting,
      ...buckets.undated,
    ],
    [buckets.overdue, buckets.today, buckets.waiting, buckets.undated],
  )

  return (
    <section
      aria-label={title}
      id={idPrefix}
      className="relative flex flex-col gap-2"
    >
      {accent === "ai" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 -top-1 h-[2px] rounded-full bg-[linear-gradient(135deg,#2f80ed,#8b5cf6,#ec4899)]"
        />
      ) : null}

      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-md text-[var(--text-primary-light)]",
              accent === "ai"
                ? "bg-[linear-gradient(135deg,rgba(47,128,237,0.20),rgba(139,92,246,0.20),rgba(236,72,153,0.20))]"
                : "bg-white/[0.06]",
            )}
          >
            {icon}
          </span>
          <h3 className="text-[11px] font-semibold uppercase tracking-widest text-[var(--text-secondary-light)]">
            {title}
          </h3>
        </div>
        <span className="text-[10px] tabular-nums text-[var(--text-secondary-light)]/80">
          {count}
        </span>
      </header>

      {count === 0 ? (
        <p
          role="status"
          aria-live="polite"
          className="rounded-md border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-2.5 py-2 text-[11px] text-[var(--text-secondary-light)]"
        >
          {emptyLabel}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {flat.map((item) => (
            <li key={item.id}>
              <CompactTaskRow item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ─── Compact rows (drawer-only) ────────────────────────────────────────────

/**
 * Compact task row used ONLY inside the drawer. Renders as a single
 * navigable line: priority dot · title · trailing chevron, with a
 * small metadata row beneath (due / source / status). No actions —
 * Send to AI / Take over live on the full `/today` page.
 *
 * Wrapped in `<Link>` so the whole row is clickable to the source
 * (the same `item.source.href` the full page uses). Closing the
 * drawer on click is handled by the framework's outside-click flow.
 */
function CompactTaskRow({ item }: { item: TodayItem }) {
  if (item.kind !== "task") return null

  const due = formatDueCompact(item.dueAt)
  const sourceLabel = compactSourceLabel(item)
  const ariaLabel = [
    "Task",
    item.title,
    item.isProposed ? "proposed by AI" : null,
    item.isWaiting ? "waiting" : null,
    due ? `due ${due}` : null,
    sourceLabel,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <Link
      href={item.source.href}
      aria-label={ariaLabel}
      className={cn(
        "group flex items-start gap-2 rounded-md border border-transparent px-2 py-1.5 transition-colors",
        "hover:border-[var(--border-dark)] hover:bg-[var(--app-surface-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
          priorityDotClass(item.priority),
        )}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[12px] font-medium text-[var(--text-primary-light)]">
          {item.title}
        </p>
        <div className="flex flex-wrap items-center gap-1 text-[10px] text-[var(--text-secondary-light)]">
          {due ? (
            <span className="tabular-nums" suppressHydrationWarning>
              {due}
            </span>
          ) : null}
          {due && sourceLabel ? <span aria-hidden="true">·</span> : null}
          {sourceLabel ? <span className="truncate">{sourceLabel}</span> : null}
          {item.isProposed ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-[var(--accent-primary)]">Proposed</span>
            </>
          ) : null}
          {item.isWaiting ? (
            <>
              <span aria-hidden="true">·</span>
              <span className="font-medium text-[var(--status-warning-text)]">Waiting</span>
            </>
          ) : null}
        </div>
      </div>

      <ArrowUpRight
        size={11}
        className="mt-1.5 shrink-0 text-[var(--text-secondary-light)]/70 transition-colors group-hover:text-[var(--text-primary-light)]"
        aria-hidden="true"
      />
    </Link>
  )
}

/**
 * Compact event row. Single line: time chip · title.
 */
function CompactEventRow({ item }: { item: TodayItem }) {
  if (item.kind !== "event" || item.source.kind !== "calendar") return null
  const time = formatEventTimeCompact(item.dueAt)

  return (
    <Link
      href={item.source.href}
      aria-label={[
        "Event",
        item.title,
        time ? `at ${time}` : null,
        "from Calendar",
      ]
        .filter(Boolean)
        .join(", ")}
      className={cn(
        "group flex items-center gap-2 rounded-md border border-transparent border-l-2 border-l-[var(--accent-primary)]/60 px-2 py-1.5 transition-colors",
        "hover:border-[var(--border-dark)] hover:border-l-[var(--accent-primary)] hover:bg-[var(--app-surface-dark)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40",
      )}
    >
      {time ? (
        <span
          className="inline-flex shrink-0 items-center rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-[var(--text-secondary-light)]"
          suppressHydrationWarning
        >
          {time}
        </span>
      ) : null}
      <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--text-primary-light)]">
        {item.title}
      </p>
      <ArrowUpRight
        size={11}
        className="shrink-0 text-[var(--text-secondary-light)]/70 transition-colors group-hover:text-[var(--text-primary-light)]"
        aria-hidden="true"
      />
    </Link>
  )
}

// ─── Compact format helpers ────────────────────────────────────────────────

/**
 * Short single-token due label. Examples:
 *   - "Today 4:00 PM"
 *   - "Yesterday"
 *   - "Tomorrow"
 *   - "3d ago"
 *   - "12 Aug"
 * Returns empty string when there is no due / it is unparseable.
 */
function formatDueCompact(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return `Today ${date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}`
  }
  if (diffDays === -1) return "Yesterday"
  if (diffDays === 1) return "Tomorrow"
  if (diffDays > -7 && diffDays < 0) return `${Math.abs(diffDays)}d ago`
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" })
}

/** "10:30 AM" style time, locale-aware. Returns empty string on bad input. */
function formatEventTimeCompact(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

/**
 * Compact source descriptor used in the drawer row. Mirrors the
 * vocabulary used by the full row (`TodayTaskRow`) but as a plain
 * string for tighter inline rendering.
 */
function compactSourceLabel(item: TodayItem): string {
  if (item.source.kind === "inbox") return "Inbox"
  if (item.source.kind === "project") {
    return item.source.projectName ? `${item.source.projectName}` : "Project"
  }
  if (item.source.kind === "manual") return "Task"
  return ""
}

/**
 * Mirrors the priority dot palette used by the full row so the
 * scanning vocabulary stays consistent across surfaces.
 */
function priorityDotClass(priority: TodayPriority | null): string {
  switch (priority) {
    case "critical":
      return "bg-[var(--status-danger-text)]"
    case "high":
      return "bg-[var(--status-warning-text)]"
    case "low":
      return "bg-[var(--text-secondary-light)]/40"
    case "normal":
    default:
      return "bg-[var(--text-secondary-light)]/60"
  }
}
