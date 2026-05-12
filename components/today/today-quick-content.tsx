"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  Loader2,
  Sparkles,
  Sun,
  UserRound,
} from "lucide-react"
import type { TodayItem, TodayPriority } from "@modules/today/types"
import {
  countLane,
  type TodayBucketsByLane,
  type TodayLaneBuckets,
} from "@modules/today/lanes"
import { cn } from "@/lib/utils"

/**
 * Pure presentational body of the Today quick view.
 *
 * Renders the Schedule strip + My-work | AI-work mini-workboard with
 * the same vocabulary as the full `/today` page but in a compact
 * shape. It does NOT own:
 *
 *   - The fetch lifecycle (data hook lives in `today-quick-data.ts`).
 *   - The chrome around it (title, close button, "Open full Today"
 *     link). Each surface (`TodayMobileDrawer`, `TodayDesktopInlay`,
 *     future stack / side-by-side wrappers) owns its own chrome.
 *
 * That split is what makes this content reusable across all the
 * future workspace-panel layouts described in
 * `components/workspace-panel/workspace-panel-types.ts`.
 *
 * Layout:
 *   - On `md+`: Schedule strip (if events exist) above a 2-column
 *     `My work | AI work` grid.
 *   - On mobile: same blocks stacked vertically — the mobile drawer
 *     wrapper is narrow enough that side-by-side wouldn't fit, and
 *     stacking matches the existing mobile UX.
 *
 * Rows are deliberately compact (single line + metadata row, no
 * inline Send-to-AI / Take-over buttons). Operators who want to act
 * on the assignment lane navigate to `/today` via "Open full Today".
 */
export function TodayQuickContent({
  loading,
  error,
  lanes,
  scheduleItems,
  totalItems,
  onRowNavigate,
  className,
}: {
  loading: boolean
  error: string | null
  lanes: TodayBucketsByLane
  scheduleItems: TodayItem[]
  totalItems: number
  /**
   * Called when the user clicks a row link / event link. Lets the
   * surrounding surface (mobile drawer, desktop inlay) close itself
   * as the user navigates away. Optional — the rows still navigate
   * even if the surface doesn't react.
   */
  onRowNavigate?: () => void
  className?: string
}) {
  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading Today"
        className={cn("flex items-center justify-center py-10", className)}
      >
        <Loader2 className="h-6 w-6 animate-spin text-[var(--text-secondary-light)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        className={cn(
          "flex flex-col items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-6 text-center",
          className,
        )}
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
        className={cn(
          "flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-6 text-center",
          className,
        )}
      >
        <Sun className="h-5 w-5 text-[var(--accent-primary)]/80" strokeWidth={1.5} aria-hidden="true" />
        <p className="text-xs font-medium text-[var(--text-primary-light)]">Nothing pending. Nice.</p>
        <p className="text-[11px] leading-relaxed text-[var(--text-secondary-light)]">
          Anything that needs your attention will show up here.
        </p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {scheduleItems.length > 0 ? (
        <TodayQuickSchedule items={scheduleItems} onRowNavigate={onRowNavigate} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <TodayQuickLane
          idPrefix="today-quick-mine"
          title="My work"
          icon={<UserRound size={12} strokeWidth={2} aria-hidden="true" />}
          buckets={lanes.mine}
          emptyLabel="No work for you today."
          accent="mine"
          onRowNavigate={onRowNavigate}
        />
        <TodayQuickLane
          idPrefix="today-quick-ai"
          title="AI work"
          icon={<Sparkles size={12} strokeWidth={2} aria-hidden="true" />}
          buckets={lanes.ai}
          emptyLabel="No AI work yet."
          accent="ai"
          onRowNavigate={onRowNavigate}
        />
      </div>
    </div>
  )
}

// ─── Schedule (compact) ────────────────────────────────────────────────────

/**
 * Compact Schedule block. One row per event with a small time chip
 * and a truncated title — events almost always read fine in this
 * single-line shape.
 */
function TodayQuickSchedule({
  items,
  onRowNavigate,
}: {
  items: TodayItem[]
  onRowNavigate?: () => void
}) {
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
        <span className="text-[10px] tabular-nums text-[var(--text-secondary-light)]/80">{items.length}</span>
      </header>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <CompactEventRow item={item} onRowNavigate={onRowNavigate} />
          </li>
        ))}
      </ul>
    </section>
  )
}

// ─── Lane block (compact) ──────────────────────────────────────────────────

/**
 * One compact lane block. The AI variant carries a subtle gradient
 * hairline on the top edge and a tinted icon halo — the only places
 * the AI accent surfaces inside the compact content.
 *
 * Rows are flattened across the four sub-buckets (Overdue → Due
 * today → Waiting → No date) into one stream so the compact surface
 * doesn't grow four sub-headers per lane. Per-row metadata still
 * reads "Yesterday" / "Today 4:00 PM" / "Waiting", so the user
 * doesn't lose status information.
 */
function TodayQuickLane({
  idPrefix,
  title,
  icon,
  buckets,
  emptyLabel,
  accent,
  onRowNavigate,
}: {
  idPrefix: string
  title: string
  icon: React.ReactNode
  buckets: TodayLaneBuckets
  emptyLabel: string
  accent: "mine" | "ai"
  onRowNavigate?: () => void
}) {
  const count = countLane(buckets)
  const flat: TodayItem[] = useMemo(
    () => [...buckets.overdue, ...buckets.today, ...buckets.waiting, ...buckets.undated],
    [buckets.overdue, buckets.today, buckets.waiting, buckets.undated],
  )

  return (
    <section aria-label={title} id={idPrefix} className="relative flex flex-col gap-2">
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
        <span className="text-[10px] tabular-nums text-[var(--text-secondary-light)]/80">{count}</span>
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
              <CompactTaskRow item={item} onRowNavigate={onRowNavigate} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

// ─── Compact rows ──────────────────────────────────────────────────────────

/**
 * Compact task row. Single navigable line: priority dot · title ·
 * trailing chevron, with a small metadata row beneath (due / source
 * / status). No inline actions — Send to AI / Take over live on the
 * full `/today` page.
 */
function CompactTaskRow({
  item,
  onRowNavigate,
}: {
  item: TodayItem
  onRowNavigate?: () => void
}) {
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
      onClick={onRowNavigate}
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
        <p className="truncate text-[12px] font-medium text-[var(--text-primary-light)]">{item.title}</p>
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
function CompactEventRow({
  item,
  onRowNavigate,
}: {
  item: TodayItem
  onRowNavigate?: () => void
}) {
  if (item.kind !== "event" || item.source.kind !== "calendar") return null
  const time = formatEventTimeCompact(item.dueAt)

  return (
    <Link
      href={item.source.href}
      onClick={onRowNavigate}
      aria-label={["Event", item.title, time ? `at ${time}` : null, "from Calendar"]
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
      <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-[var(--text-primary-light)]">{item.title}</p>
      <ArrowUpRight
        size={11}
        className="shrink-0 text-[var(--text-secondary-light)]/70 transition-colors group-hover:text-[var(--text-primary-light)]"
        aria-hidden="true"
      />
    </Link>
  )
}

// ─── Compact format helpers ────────────────────────────────────────────────

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

function formatEventTimeCompact(iso: string | null): string {
  if (!iso) return ""
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

function compactSourceLabel(item: TodayItem): string {
  if (item.source.kind === "inbox") return "Inbox"
  if (item.source.kind === "project") {
    return item.source.projectName ? `${item.source.projectName}` : "Project"
  }
  if (item.source.kind === "manual") return "Task"
  return ""
}

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
