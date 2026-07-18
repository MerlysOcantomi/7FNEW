"use client"

import Link from "next/link"
import {
  ArrowUpRight,
  FolderKanban,
  Inbox,
  ListTodo,
  Loader2,
  Send,
  Sparkles,
  UserRound,
} from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { toIntlLocale } from "@core/i18n/format"
import type { UIMessages } from "@core/i18n/ui"
import type { TodayItem, TodayPriority } from "@modules/today/types"
import { getTodayLane } from "@modules/today/lanes"

type WorkboardRowMessages = UIMessages["today"]["workboard"]["row"]

/**
 * One row in a Today bucket. Used for any task-shaped item in the payload
 * regardless of upstream origin — the difference is purely the source chip
 * ("From Inbox", "From <project>", or a generic "Task" for manual rows). We
 * deliberately do NOT expose "InboxTodo" or "WorkspaceTask" anywhere in the
 * UI; the operator sees a uniform "task" everywhere in Today.
 *
 * Click on the row body navigates to the source's detail surface. The row
 * exposes lane-aware affordances on the trailing edge:
 *
 *   - "My work" task → "Send to AI" button (moves the row to the AI lane).
 *   - "AI work" task, not proposed → "Take over" button (moves the row to
 *     the My-work lane).
 *   - "AI work" task, status="proposed" → a static "Proposed" pill; the
 *     operator approves / dismisses these from the Inbox / Smart Hub. We
 *     intentionally do NOT show Take-over on proposals in this PR — that
 *     escape hatch may land later once the Approve/Dismiss copy is unified.
 *
 * The actions are only rendered for canonical `WorkspaceTask` rows (id
 * prefix `task:`). Events and legacy `Tarea` fallback rows (`tarea:`,
 * `evento:`) keep the row purely navigational because the PATCH endpoint
 * only knows how to update WorkspaceTask.
 */
export function TodayTaskRow({
  item,
  onLaneMove,
  onLegacyHandoff,
}: {
  item: TodayItem
  /**
   * Optional callback fired AFTER an optimistic UI update. Receives the
   * canonical `WorkspaceTask.id` (id prefix stripped) and the target
   * lane. The parent owns the actual mutation + rollback so the row
   * stays presentational. When omitted, the row hides the actions
   * entirely.
   */
  onLaneMove?: (taskId: string, to: "user" | "ai") => void | Promise<void>
  /**
   * Optional callback for handing a LEGACY `Tarea` row off to AI.
   * Receives the canonical `Tarea.id` (id prefix stripped). The parent
   * calls the conversion endpoint (mirror Tarea → WorkspaceTask assigned
   * to AI) and refetches Today. When omitted, legacy rows stay purely
   * navigational. Only relevant for `tarea:` rows in the "mine" lane.
   */
  onLegacyHandoff?: (tareaId: string) => void | Promise<void>
}) {
  const [pending, setPending] = useState(false)
  const { t, locale } = useI18n()
  const row = t.today.workboard.row
  const intlLocale = toIntlLocale(locale)

  if (item.kind !== "task") {
    /** Defensive — events go through TodayEventCard, not this row component. */
    return null
  }

  const priorityChip = renderPriorityChip(item.priority, row)
  const dueChip = renderDueChip(item.dueAt, row, intlLocale)
  const sourceChip = renderSourceChip(item, row)
  const lane = getTodayLane(item)
  /**
   * The aggregator prefixes ids by source kind, so we branch on that
   * without re-querying the row's origin:
   *   - `task:`  → canonical WorkspaceTask. Supports Send to AI /
   *                Take over directly via the lane-move endpoint.
   *   - `tarea:` → legacy Tarea with no mirror yet. "Send to AI"
   *                converts it into a WorkspaceTask first (the parent
   *                owns that call); Take over is never offered here
   *                because a legacy Tarea always classifies into the
   *                "mine" lane.
   *   - `evento:`→ events render via TodayEventCard, not this row.
   */
  const canonicalTaskId = item.id.startsWith("task:") ? item.id.slice("task:".length) : null
  const legacyTareaId = item.id.startsWith("tarea:") ? item.id.slice("tarea:".length) : null

  const canMoveWorkspaceTask = Boolean(onLaneMove) && canonicalTaskId !== null
  const canHandoffLegacyTarea =
    Boolean(onLegacyHandoff) && legacyTareaId !== null && lane === "mine"
  const showActions = canMoveWorkspaceTask || canHandoffLegacyTarea

  const handleAction = async (to: "user" | "ai") => {
    if (!onLaneMove || !canonicalTaskId || pending) return
    setPending(true)
    try {
      await onLaneMove(canonicalTaskId, to)
    } finally {
      setPending(false)
    }
  }

  const handleLegacyHandoff = async () => {
    if (!onLegacyHandoff || !legacyTareaId || pending) return
    setPending(true)
    try {
      await onLegacyHandoff(legacyTareaId)
    } finally {
      setPending(false)
    }
  }

  /** Build the screen-reader label up front so the link has a single coherent description. */
  const ariaLabel = [
    row.a11y.task,
    item.title,
    item.priority ? `${row.a11y.priorityPrefix} ${item.priority}` : null,
    item.dueAt
      ? `${row.a11y.duePrefix} ${formatDueForA11y(item.dueAt, intlLocale)}`
      : row.a11y.noDueDate,
    sourceChip.ariaSuffix,
    lane === "ai" ? row.a11y.inAiLane : lane === "mine" ? row.a11y.inMyLane : null,
    item.isProposed ? row.proposedByAi : null,
  ]
    .filter(Boolean)
    .join(", ")

  return (
    <div
      className={cn(
        "group flex items-start gap-2 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-3 transition-all",
        "hover:bg-[var(--app-surface-dark-elevated)] hover:shadow-[var(--app-shadow-subtle)] focus-within:ring-2 focus-within:ring-[var(--accent-primary)]/40",
      )}
    >
      <Link
        href={item.source.href}
        aria-label={ariaLabel}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-md focus-visible:outline-none"
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
            <p className="text-sm font-semibold text-[var(--text-primary-light)] truncate max-w-full">
              {item.title}
            </p>
            {priorityChip}
            {item.isProposed ? (
              <span
                className="inline-flex items-center gap-1 rounded-full bg-[var(--accent-primary)]/15 px-1.5 py-0.5 text-[10px] font-medium text-[var(--accent-primary)]"
                aria-label={row.proposedByAi}
              >
                <Sparkles size={10} strokeWidth={2} className="shrink-0" aria-hidden="true" />
                {row.proposed}
              </span>
            ) : null}
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
                {row.assignedToMe}
              </span>
            ) : null}
          </div>
        </div>

        <ArrowUpRight
          size={13}
          className="mt-1 shrink-0 text-[var(--text-secondary-light)]/70 transition-colors group-hover:text-[var(--text-primary-light)]"
          aria-hidden="true"
        />
      </Link>

      {showActions ? (
        <div className="flex shrink-0 items-start pt-0.5">
          {canMoveWorkspaceTask && lane === "mine" ? (
            <LaneActionButton
              label={row.sendToAi}
              icon={<Send size={11} strokeWidth={2} aria-hidden="true" />}
              pending={pending}
              onClick={() => handleAction("ai")}
              tone="ai"
            />
          ) : null}
          {canHandoffLegacyTarea ? (
            <LaneActionButton
              label={row.sendToAi}
              icon={<Send size={11} strokeWidth={2} aria-hidden="true" />}
              pending={pending}
              onClick={handleLegacyHandoff}
              tone="ai"
            />
          ) : null}
          {canMoveWorkspaceTask && lane === "ai" && !item.isProposed ? (
            <LaneActionButton
              label={row.takeOver}
              icon={<UserRound size={11} strokeWidth={2} aria-hidden="true" />}
              pending={pending}
              onClick={() => handleAction("user")}
              tone="mine"
            />
          ) : null}
          {/**
           * Proposed AI rows intentionally render no action button here —
           * Approve / Dismiss is the right vocabulary, and lives in the
           * Inbox / Smart Hub. The "Proposed" pill upstairs already tells
           * the operator the row is read-only.
           */}
        </div>
      ) : null}
    </div>
  )
}

function LaneActionButton({
  label,
  icon,
  pending,
  onClick,
  tone,
}: {
  label: string
  icon: React.ReactNode
  pending: boolean
  onClick: () => void
  tone: "ai" | "mine"
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-1 text-[10px] font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-60",
        tone === "ai"
          ? "border-[var(--accent-muted-border)] bg-[var(--accent-muted)] text-[var(--accent-on-dark)] hover:bg-[var(--accent-primary)]/20"
          : "border-[var(--border-dark-strong)] bg-[var(--app-surface-hover)] text-[var(--text-primary-light)] hover:bg-[var(--app-surface-active)]",
      )}
    >
      {pending ? (
        <Loader2 size={11} strokeWidth={2} className="animate-spin" aria-hidden="true" />
      ) : (
        icon
      )}
      <span>{label}</span>
    </button>
  )
}

// ─── Chips ────────────────────────────────────────────────────────────────────

function renderPriorityChip(priority: TodayPriority | null, row: WorkboardRowMessages) {
  if (!priority || priority === "normal") return null
  const tone = priorityChipClass(priority)
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium",
        tone,
      )}
    >
      {priorityLabel(priority, row)}
    </span>
  )
}

function renderDueChip(dueIso: string | null, row: WorkboardRowMessages, intlLocale: string) {
  if (!dueIso) return null
  return (
    <span
      className="inline-flex items-center rounded-md bg-[var(--app-surface-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary-light)]"
      suppressHydrationWarning
    >
      {formatDueShort(dueIso, row, intlLocale)}
    </span>
  )
}

function renderSourceChip(
  item: TodayItem,
  row: WorkboardRowMessages,
): { node: React.ReactNode; ariaSuffix: string } {
  if (item.source.kind === "inbox") {
    return {
      node: (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-surface-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary-light)]">
          <Inbox size={10} className="shrink-0" aria-hidden="true" />
          {row.fromInbox}
        </span>
      ),
      ariaSuffix: row.a11y.fromInbox,
    }
  }
  if (item.source.kind === "project") {
    const label = item.source.projectName ?? row.projectFallback
    return {
      node: (
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-surface-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary-light)]">
          <FolderKanban size={10} className="shrink-0" aria-hidden="true" />
          {row.fromProject(label)}
        </span>
      ),
      ariaSuffix: row.a11y.fromProject(label),
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
        <span className="inline-flex items-center gap-1 rounded-full bg-[var(--app-surface-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[var(--text-secondary-light)]">
          <ListTodo size={10} className="shrink-0" aria-hidden="true" />
          {row.taskChip}
        </span>
      ),
      ariaSuffix: row.a11y.manualTask,
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
      return "bg-[var(--app-surface-active)] text-[var(--text-secondary-light)]"
    case "normal":
    default:
      return "bg-[var(--status-info-bg)] text-[var(--status-info-text)]"
  }
}

function priorityLabel(priority: TodayPriority, row: WorkboardRowMessages): string {
  switch (priority) {
    case "critical":
      return row.priorities.critical
    case "high":
      return row.priorities.high
    case "low":
      return row.priorities.low
    case "normal":
      return row.priorities.normal
  }
}

/**
 * Compact, locale-aware due chip. We render relative when the date is in the
 * recent past or very near future; otherwise fall back to a short month/day.
 * Hydration-safe: the parent wraps with `suppressHydrationWarning` because
 * the formatting depends on the client locale and timezone, which can differ
 * from the server's during the first paint.
 */
function formatDueShort(iso: string, row: WorkboardRowMessages, intlLocale: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""

  const now = new Date()
  const diffMs = date.getTime() - now.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return row.due.todayAt(
      date.toLocaleTimeString(intlLocale, { hour: "numeric", minute: "2-digit" }),
    )
  }
  if (diffDays === -1) return row.due.yesterday
  if (diffDays === 1) return row.due.tomorrow
  if (diffDays > -7 && diffDays < 0) return row.due.daysAgo(Math.abs(diffDays))
  return date.toLocaleDateString(intlLocale, { day: "numeric", month: "short" })
}

function formatDueForA11y(iso: string, intlLocale: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleString(intlLocale, {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  })
}
