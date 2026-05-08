import Link from "next/link"
import { ArrowUpRight, Inbox, FolderKanban, ListTodo } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TodayItem, TodayPriority } from "@modules/today/types"

/**
 * One row in a Today bucket. Used for any task-shaped item in the payload
 * regardless of upstream origin — the difference is purely the source chip
 * ("From Inbox", "From <project>", or a generic "Task" for manual rows). We
 * deliberately do NOT expose "InboxTodo" or "WorkspaceTask" anywhere in the
 * UI; the operator sees a uniform "task" everywhere in Today.
 *
 * Click navigates to the source's detail surface (or stays on /today for
 * manual rows that have no upstream surface yet). Today remains read-only:
 * there is no inline complete/dismiss/assign control here. Those affordances
 * belong to a later PR once `WorkspaceTask` owns the writes.
 */
export function TodayTaskRow({ item }: { item: TodayItem }) {
  if (item.kind !== "task") {
    /** Defensive — events go through TodayEventCard, not this row component. */
    return null
  }

  const priorityChip = renderPriorityChip(item.priority)
  const dueChip = renderDueChip(item.dueAt)
  const sourceChip = renderSourceChip(item)

  /** Build the screen-reader label up front so the link has a single coherent description. */
  const ariaLabel = [
    "Task",
    item.title,
    item.priority ? `priority ${item.priority}` : null,
    item.dueAt ? `due ${formatDueForA11y(item.dueAt)}` : "no due date",
    sourceChip.ariaSuffix,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <Link
      href={item.source.href}
      aria-label={ariaLabel}
      className={cn(
        "group flex items-start gap-3 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-3 transition-all",
        "hover:bg-[var(--app-surface-dark-elevated)] hover:shadow-[var(--app-shadow-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40",
      )}
    >
      {/**
       * Priority dot — colored circle on the leading edge so the operator can
       * scan urgency without reading the chip. We always render the dot so
       * row alignment stays uniform; "no priority" gets a muted dot.
       */}
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full",
          priorityDotClass(item.priority),
        )}
      />

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-[var(--text-primary-light)] truncate max-w-full">
            {item.title}
          </p>
          {priorityChip}
        </div>
        {item.description ? (
          <p className="mt-0.5 line-clamp-1 text-[11px] leading-snug text-[var(--text-secondary-light)]">
            {item.description}
          </p>
        ) : null}
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary-light)]">
          {sourceChip.node}
          {dueChip}
          {item.assignee?.isCurrentUser ? (
            <span className="inline-flex items-center rounded-full bg-[var(--accent-primary)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-primary)]">
              Assigned to me
            </span>
          ) : null}
        </div>
      </div>

      <ArrowUpRight
        size={13}
        className="shrink-0 text-[var(--text-secondary-light)]/70 transition-colors group-hover:text-[var(--text-primary-light)]"
        aria-hidden="true"
      />
    </Link>
  )
}

// ─── Chips ────────────────────────────────────────────────────────────────────

function renderPriorityChip(priority: TodayPriority | null) {
  if (!priority || priority === "normal") return null
  const tone = priorityChipClass(priority)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        tone,
      )}
    >
      {priorityLabel(priority)}
    </span>
  )
}

function renderDueChip(dueIso: string | null) {
  if (!dueIso) return null
  return (
    <span
      className="inline-flex items-center rounded-md bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary-light)]"
      suppressHydrationWarning
    >
      {formatDueShort(dueIso)}
    </span>
  )
}

function renderSourceChip(item: TodayItem): { node: React.ReactNode; ariaSuffix: string } {
  if (item.source.kind === "inbox") {
    return {
      node: (
        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary-light)]">
          <Inbox size={10} className="shrink-0" aria-hidden="true" />
          From Inbox
        </span>
      ),
      ariaSuffix: "from Inbox",
    }
  }
  if (item.source.kind === "project") {
    const label = item.source.projectName ?? "Project"
    return {
      node: (
        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary-light)]">
          <FolderKanban size={10} className="shrink-0" aria-hidden="true" />
          From {label}
        </span>
      ),
      ariaSuffix: `from project ${label}`,
    }
  }
  if (item.source.kind === "manual") {
    /**
     * Generic "Task" chip for WorkspaceTask rows that have no upstream
     * link (manual capture from the New dropdown, or a future direct
     * write that doesn't reference a conversation/project). Keeps the
     * row visually consistent with the others without lying about a
     * source it doesn't have.
     */
    return {
      node: (
        <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary-light)]">
          <ListTodo size={10} className="shrink-0" aria-hidden="true" />
          Task
        </span>
      ),
      ariaSuffix: "manual task",
    }
  }
  /** Calendar source on a task row would be unusual — keep a fallback so future sources don't crash. */
  return { node: null, ariaSuffix: "" }
}

// ─── Style + label helpers ────────────────────────────────────────────────────

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

function priorityChipClass(priority: TodayPriority): string {
  switch (priority) {
    case "critical":
      return "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]"
    case "high":
      return "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]"
    case "low":
      return "bg-white/[0.08] text-[var(--text-secondary-light)]"
    case "normal":
    default:
      return "bg-[var(--status-info-bg)] text-[var(--status-info-text)]"
  }
}

function priorityLabel(priority: TodayPriority): string {
  switch (priority) {
    case "critical":
      return "Urgent"
    case "high":
      return "High"
    case "low":
      return "Low"
    case "normal":
      return "Normal"
  }
}

/**
 * Compact, locale-aware due chip. We render relative when the date is in the
 * recent past or very near future; otherwise fall back to a short month/day.
 * Hydration-safe: the parent wraps with `suppressHydrationWarning` because
 * the formatting depends on the client locale and timezone, which can differ
 * from the server's during the first paint.
 */
function formatDueShort(iso: string): string {
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

function formatDueForA11y(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}
