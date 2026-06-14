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
 * Tone variants supported by the Today quick view.
 *
 *   - `"canvas"` — dark shell tokens (AppShell + mobile drawer).
 *   - `"light"`  — light slate tokens (ContextShell bottom chrome).
 *
 * Tone parity mirrors the Global New convention so any future shared
 * "workspace chrome" coordinator can reuse the same vocabulary.
 */
export type TodayQuickTone = "canvas" | "light"

/**
 * Pure presentational body of the Today quick view.
 *
 * Renders the Schedule strip + My-work | AI-work mini-workboard in
 * the same vocabulary as the full `/today` page but in a compact
 * shape. It does NOT own:
 *
 *   - The fetch lifecycle (data hook lives in `today-quick-data.ts`).
 *   - The chrome around it (title, close button, "Open full Today"
 *     link). Each surface (`TodayMobileDrawer`,
 *     `GlobalTodayDesktopChrome`, future stack / side-by-side
 *     wrappers) owns its own chrome.
 *
 * That split is what makes this content reusable across all the
 * future workspace-panel layouts described in
 * `components/workspace-panel/workspace-panel-types.ts`.
 *
 * Tone awareness:
 *   Surfaces that live in a DARK shell (AppShell, mobile vaul drawer)
 *   pass `tone="canvas"`. Surfaces that live in a LIGHT shell
 *   (ContextShell's bottom chrome) pass `tone="light"`. The component
 *   switches every dark token to its slate equivalent so the rows are
 *   readable on `#F8FAFC` without bespoke shell-specific code paths.
 *
 *   Mobile keeps `tone="canvas"` regardless of host shell because the
 *   vaul drawer surface itself is dark (`bg-[var(--app-shell-bg)]`)
 *   and would clash with light-tone content.
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
  tone = "canvas",
  className,
}: {
  loading: boolean
  error: string | null
  lanes: TodayBucketsByLane
  scheduleItems: TodayItem[]
  totalItems: number
  /**
   * Called when the user clicks a row link / event link. Lets the
   * surrounding surface (mobile drawer, bottom chrome) close itself
   * as the user navigates away. Optional — the rows still navigate
   * even if the surface doesn't react.
   */
  onRowNavigate?: () => void
  tone?: TodayQuickTone
  className?: string
}) {
  const t = toneTokens(tone)

  if (loading) {
    return (
      <div
        role="status"
        aria-label="Loading Today"
        className={cn("flex items-center justify-center py-10", className)}
      >
        <Loader2 className={cn("h-6 w-6 animate-spin", t.textMuted)} />
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
          "flex flex-col items-center gap-1.5 rounded-lg border border-dashed px-4 py-6 text-center",
          t.surfaceMuted,
          t.borderMuted,
          className,
        )}
      >
        <Sun className={cn("h-5 w-5", t.accentDim)} strokeWidth={1.5} aria-hidden="true" />
        <p className={cn("text-xs font-medium", t.text)}>Nothing pending. Nice.</p>
        <p className={cn("text-[11px] leading-relaxed", t.textMuted)}>
          Anything that needs your attention will show up here.
        </p>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {scheduleItems.length > 0 ? (
        <TodayQuickSchedule items={scheduleItems} onRowNavigate={onRowNavigate} tone={tone} />
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <TodayQuickLane
          idPrefix="today-quick-mine"
          title="My work"
          icon={<UserRound size={16} strokeWidth={2} aria-hidden="true" />}
          buckets={lanes.mine}
          emptyLabel="No work for you today."
          accent="mine"
          tone={tone}
          onRowNavigate={onRowNavigate}
        />
        <TodayQuickLane
          idPrefix="today-quick-ai"
          title="AI work"
          icon={<Sparkles size={16} strokeWidth={2} aria-hidden="true" />}
          buckets={lanes.ai}
          emptyLabel="No AI work yet."
          accent="ai"
          tone={tone}
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
  tone,
}: {
  items: TodayItem[]
  onRowNavigate?: () => void
  tone: TodayQuickTone
}) {
  const t = toneTokens(tone)
  return (
    <section aria-label="Schedule" className="flex flex-col gap-2">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border",
              t.iconHalo,
              t.accent,
            )}
          >
            <CalendarClock size={16} strokeWidth={2} />
          </span>
          <h3 className={cn("text-[11px] font-semibold uppercase tracking-widest", t.textMuted)}>
            Schedule
          </h3>
        </div>
        <span className={cn("text-[10px] tabular-nums", t.textDim)}>{items.length}</span>
      </header>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id}>
            <CompactEventRow item={item} onRowNavigate={onRowNavigate} tone={tone} />
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
  tone,
  onRowNavigate,
}: {
  idPrefix: string
  title: string
  icon: React.ReactNode
  buckets: TodayLaneBuckets
  emptyLabel: string
  accent: "mine" | "ai"
  tone: TodayQuickTone
  onRowNavigate?: () => void
}) {
  const t = toneTokens(tone)
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
          className="pointer-events-none absolute inset-x-0 -top-1 h-[2px] rounded-full bg-[linear-gradient(135deg,var(--accent-primary),var(--accent-on-dark))]"
        />
      ) : null}

      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {/*
            Section-icon halo aligned with the New action items
            (rounded-lg + border + soft surface + accent icon). The AI
            lane keeps its own accent via the gradient hairline above
            (`-top-1`), so the icon halo itself stays neutral and the
            whole family reads with one icon language.
          */}
          <span
            aria-hidden="true"
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg border",
              t.iconHalo,
              t.accent,
            )}
          >
            {icon}
          </span>
          <h3 className={cn("text-[11px] font-semibold uppercase tracking-widest", t.textMuted)}>
            {title}
          </h3>
        </div>
        <span className={cn("text-[10px] tabular-nums", t.textDim)}>{count}</span>
      </header>

      {count === 0 ? (
        <p
          role="status"
          aria-live="polite"
          className={cn(
            "rounded-md border border-dashed px-2.5 py-2 text-[11px]",
            t.surfaceMuted,
            t.borderMuted,
            t.textMuted,
          )}
        >
          {emptyLabel}
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {flat.map((item) => (
            <li key={item.id}>
              <CompactTaskRow item={item} onRowNavigate={onRowNavigate} tone={tone} />
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
  tone,
}: {
  item: TodayItem
  onRowNavigate?: () => void
  tone: TodayQuickTone
}) {
  if (item.kind !== "task") return null
  const t = toneTokens(tone)

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
        t.rowHover,
        t.focusRing,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full",
          priorityDotClass(item.priority, tone),
        )}
      />

      <div className="min-w-0 flex-1">
        <p className={cn("truncate text-[12px] font-medium", t.text)}>{item.title}</p>
        <div className={cn("flex flex-wrap items-center gap-1 text-[10px]", t.textMuted)}>
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
              <span className={cn("font-medium", t.accent)}>Proposed</span>
            </>
          ) : null}
          {item.isWaiting ? (
            <>
              <span aria-hidden="true">·</span>
              <span className={cn("font-medium", t.warningText)}>Waiting</span>
            </>
          ) : null}
        </div>
      </div>

      <ArrowUpRight
        size={11}
        className={cn("mt-1.5 shrink-0 transition-colors", t.textDim, t.rowHoverText)}
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
  tone,
}: {
  item: TodayItem
  onRowNavigate?: () => void
  tone: TodayQuickTone
}) {
  if (item.kind !== "event" || item.source.kind !== "calendar") return null
  const t = toneTokens(tone)
  const time = formatEventTimeCompact(item.dueAt)

  return (
    <Link
      href={item.source.href}
      onClick={onRowNavigate}
      aria-label={["Event", item.title, time ? `at ${time}` : null, "from Calendar"]
        .filter(Boolean)
        .join(", ")}
      className={cn(
        "group flex items-center gap-2 rounded-md border border-transparent border-l-2 px-2 py-1.5 transition-colors",
        tone === "canvas" ? "border-l-[var(--accent-primary)]/60" : "border-l-[#2563EB]/60",
        t.rowHover,
        tone === "canvas"
          ? "hover:border-l-[var(--accent-primary)]"
          : "hover:border-l-[#2563EB]",
        t.focusRing,
      )}
    >
      {time ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
            t.chipBg,
            t.textMuted,
          )}
          suppressHydrationWarning
        >
          {time}
        </span>
      ) : null}
      <p className={cn("min-w-0 flex-1 truncate text-[12px] font-medium", t.text)}>{item.title}</p>
      <ArrowUpRight
        size={11}
        className={cn("shrink-0 transition-colors", t.textDim, t.rowHoverText)}
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

function priorityDotClass(priority: TodayPriority | null, tone: TodayQuickTone): string {
  if (tone === "light") {
    switch (priority) {
      case "critical":
        return "bg-[#DC2626]"
      case "high":
        return "bg-[#D97706]"
      case "low":
        return "bg-[#94A3B8]/40"
      case "normal":
      default:
        return "bg-[#94A3B8]/60"
    }
  }
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

// ─── Tone token map ────────────────────────────────────────────────────────

/**
 * Map of named class strings per tone.
 *
 * Lives in the component file (vs. a separate module) because the
 * mapping is intimately coupled to the row / lane / header layout
 * decisions made above — pulling it into a shared utility would
 * invite reuse for surfaces with different layout needs and
 * eventually drift. Kept close, kept honest.
 */
interface ToneTokens {
  /** Primary text colour (titles, row titles, empty-state heading). */
  text: string
  /** Secondary text colour (headers, metadata). */
  textMuted: string
  /** Dim text colour (count badges, trailing chevrons). */
  textDim: string
  /** Accent text (Proposed pill, accent icons). */
  accent: string
  /** Accent text in a "calm" state for empty-state Sun icon. */
  accentDim: string
  /** Accent halo for icon wrappers — `bg-<accent>/15`-ish. */
  accentHalo: string
  /** Section-header icon halo (border + soft surface) — same shape
   *  language as the New action items so Today/Agents/New section icons
   *  read as one family. */
  iconHalo: string
  /** Warning emphasis text ("Waiting" pill). */
  warningText: string
  /** Subtle surface used for icon wrappers and chips. */
  surfaceSubtle: string
  /** Muted surface for empty-state cards. */
  surfaceMuted: string
  /** Muted border for empty-state cards. */
  borderMuted: string
  /** Background for time chips. */
  chipBg: string
  /** Row hover state: border + bg. */
  rowHover: string
  /** Row hover state: trailing chevron colour shift on hover. */
  rowHoverText: string
  /** Focus ring for row links. */
  focusRing: string
}

function toneTokens(tone: TodayQuickTone): ToneTokens {
  if (tone === "light") {
    return {
      text: "text-[#0F172A]",
      textMuted: "text-[#64748B]",
      textDim: "text-[#94A3B8]",
      accent: "text-[#2563EB]",
      accentDim: "text-[#2563EB]/80",
      accentHalo: "bg-[#DBEAFE]",
      iconHalo: "border-[#E2E8F0] bg-white shadow-sm",
      warningText: "text-[#B45309]",
      surfaceSubtle: "bg-[#F1F5F9]",
      surfaceMuted: "bg-white",
      borderMuted: "border-[#E2E8F0]",
      chipBg: "bg-[#F1F5F9]",
      rowHover:
        "hover:border-[#E2E8F0] hover:bg-[#F1F5F9]",
      rowHoverText: "group-hover:text-[#0F172A]",
      focusRing:
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3B82F6]/35",
    }
  }
  return {
    text: "text-[var(--text-primary-light)]",
    textMuted: "text-[var(--text-secondary-light)]",
    textDim: "text-[var(--text-secondary-light)]/80",
    accent: "text-[var(--accent-primary)]",
    accentDim: "text-[var(--accent-primary)]/80",
    accentHalo: "bg-[var(--accent-primary)]/15",
    iconHalo: "border-[var(--border-dark)] bg-white/[0.06]",
    warningText: "text-[var(--status-warning-text)]",
    surfaceSubtle: "bg-white/[0.06]",
    surfaceMuted: "bg-[var(--app-surface-dark)]",
    borderMuted: "border-[var(--border-dark)]",
    chipBg: "bg-white/[0.06]",
    rowHover:
      "hover:border-[var(--border-dark)] hover:bg-[var(--app-surface-dark)]",
    rowHoverText: "group-hover:text-[var(--text-primary-light)]",
    focusRing:
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40",
  }
}
