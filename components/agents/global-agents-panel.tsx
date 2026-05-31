"use client"

import Link from "next/link"
import {
  AlertTriangle,
  Bot,
  ClipboardCheck,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  AgentActivityItem,
  AgentsActivityLane,
  AgentsActivityLanes,
  AgentSummary,
} from "@modules/agents/types"

/**
 * Tone variants supported by the compact Agents quick view — same
 * vocabulary as `TodayQuickTone`:
 *
 *   - `"canvas"` — dark shell tokens (AppShell + mobile vaul drawer).
 *   - `"light"`  — light slate tokens (ContextShell top chrome).
 */
export type AgentsQuickTone = "canvas" | "light"

/**
 * Pure presentational body of the compact Agents panel.
 *
 * Shared by `GlobalAgentsDesktopChrome` and `AgentsMobileDrawer`. It does
 * NOT own the fetch lifecycle (that lives in `use-agents-activity-data.ts`)
 * nor the chrome around it (title / close / "Open full Agents" link) —
 * each surface owns its own chrome, identical to the Today split.
 *
 * It intentionally renders a COMPACT subset of the full `/agents` board:
 * three operator-relevant lanes (Needs review, Automated, Attention) with
 * a capped number of rows. The full four-lane board (incl. Executed)
 * stays on `/agents`. No approve/dismiss controls — read-only, like the
 * board, until a later PR.
 */

/** Lanes surfaced in the compact panel, in priority order. */
const PANEL_LANES: {
  key: Exclude<AgentsActivityLane, "executed">
  title: string
  icon: React.ReactNode
  empty: string
}[] = [
  {
    key: "needs_review",
    title: "Needs review",
    icon: <ClipboardCheck size={16} strokeWidth={2} aria-hidden="true" />,
    empty: "No proposals waiting.",
  },
  {
    key: "automated",
    title: "Automated",
    icon: <Zap size={16} strokeWidth={2} aria-hidden="true" />,
    empty: "Nothing automated yet.",
  },
  {
    key: "attention",
    title: "Attention",
    icon: <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />,
    empty: "Nothing needs attention.",
  },
]

/** Max rows rendered per lane in the compact panel. */
const MAX_ROWS = 4

interface AgentsQuickTokens {
  laneTitle: string
  laneCount: string
  /** Section-header icon halo — same shape language as the New action
   *  items (rounded-lg + border + soft surface) so the lane labels read
   *  as part of the global action family. */
  laneIconHalo: string
  laneIconColor: string
  cardBorder: string
  cardBg: string
  cardHover: string
  cardTitle: string
  cardSubtitle: string
  chipBg: string
  chipText: string
  emptyText: string
  spinner: string
  agentChipBorder: string
  agentChipBg: string
  agentChipText: string
  emptyIconHalo: string
  emptyHeading: string
  emptyBody: string
}

function tokens(tone: AgentsQuickTone): AgentsQuickTokens {
  if (tone === "light") {
    return {
      laneTitle: "text-[#0F172A]",
      laneCount: "text-[#94A3B8]",
      laneIconHalo: "border-[#E2E8F0] bg-white shadow-sm",
      laneIconColor: "text-[#2563EB]",
      cardBorder: "border-[#E2E8F0]",
      cardBg: "bg-white",
      cardHover: "hover:bg-[#F1F5F9]",
      cardTitle: "text-[#0F172A]",
      cardSubtitle: "text-[#64748B]",
      chipBg: "bg-[#F1F5F9]",
      chipText: "text-[#64748B]",
      emptyText: "text-[#94A3B8]",
      spinner: "text-[#94A3B8]",
      agentChipBorder: "border-[#E2E8F0]",
      agentChipBg: "bg-white",
      agentChipText: "text-[#334155]",
      emptyIconHalo: "bg-[#EEF2FF] text-[#4F46E5]",
      emptyHeading: "text-[#0F172A]",
      emptyBody: "text-[#64748B]",
    }
  }
  return {
    laneTitle: "text-[var(--text-primary-light)]",
    laneCount: "text-[var(--text-secondary-light)]/80",
    laneIconHalo: "border-[var(--border-dark)] bg-white/[0.06]",
    laneIconColor: "text-[var(--accent-primary)]",
    cardBorder: "border-[var(--border-dark)]",
    cardBg: "bg-[var(--app-surface-dark)]",
    cardHover: "hover:bg-white/[0.04]",
    cardTitle: "text-[var(--text-primary-light)]",
    cardSubtitle: "text-[var(--text-secondary-light)]",
    chipBg: "bg-white/[0.06]",
    chipText: "text-[var(--text-secondary-light)]",
    emptyText: "text-[var(--text-secondary-light)]",
    spinner: "text-[var(--text-secondary-light)]",
    agentChipBorder: "border-[var(--border-dark)]",
    agentChipBg: "bg-[var(--app-surface-dark)]",
    agentChipText: "text-[var(--text-primary-light)]",
    emptyIconHalo:
      "bg-[linear-gradient(135deg,rgba(47,128,237,0.20),rgba(139,92,246,0.20),rgba(236,72,153,0.20))] text-[var(--text-primary-light)]",
    emptyHeading: "text-[var(--text-primary-light)]",
    emptyBody: "text-[var(--text-secondary-light)]",
  }
}

export function GlobalAgentsPanel({
  loading,
  error,
  agents,
  lanes,
  totalItems,
  tone = "canvas",
  onRowNavigate,
}: {
  loading: boolean
  error: string | null
  agents: AgentSummary[]
  lanes: AgentsActivityLanes
  totalItems: number
  tone?: AgentsQuickTone
  onRowNavigate?: () => void
}) {
  const t = tokens(tone)

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-12"
        role="status"
        aria-label="Loading Agents activity"
      >
        <Loader2 className={cn("h-6 w-6 animate-spin", t.spinner)} />
      </div>
    )
  }

  if (error) {
    return (
      <div
        role="alert"
        className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center"
      >
        <AlertTriangle
          className="mx-auto mb-2 h-6 w-6 text-destructive"
          strokeWidth={1.5}
        />
        <p className="text-xs font-medium text-destructive">{error}</p>
        <p className="mt-1 text-[11px] text-destructive/80">
          Agents activity could not be loaded.
        </p>
      </div>
    )
  }

  if (totalItems === 0) {
    return (
      <div
        role="status"
        className="flex flex-col items-center gap-2 px-4 py-10 text-center"
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl",
            t.emptyIconHalo,
          )}
        >
          <Sparkles size={16} strokeWidth={1.9} />
        </span>
        <p className={cn("text-sm font-medium", t.emptyHeading)}>
          No agent activity yet
        </p>
        <p className={cn("max-w-xs text-[11px] leading-relaxed", t.emptyBody)}>
          When Fanny automates work, proposes a task, or runs an action, it
          will show up here — grouped by what needs review, what was
          automated, and what needs your attention.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {agents.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {agents.map((agent) => (
            <li
              key={agent.id}
              title={agent.description}
              className={cn(
                "flex items-center gap-1.5 rounded-lg border px-2 py-1",
                t.agentChipBorder,
                t.agentChipBg,
              )}
            >
              <Bot
                size={11}
                strokeWidth={2}
                aria-hidden="true"
                className={t.chipText}
              />
              <span className={cn("text-[11px] font-medium", t.agentChipText)}>
                {agent.name}
              </span>
            </li>
          ))}
        </ul>
      ) : null}

      {PANEL_LANES.map((lane) => (
        <AgentsPanelLane
          key={lane.key}
          title={lane.title}
          icon={lane.icon}
          empty={lane.empty}
          items={lanes[lane.key]}
          t={t}
          onRowNavigate={onRowNavigate}
        />
      ))}
    </div>
  )
}

function AgentsPanelLane({
  title,
  icon,
  empty,
  items,
  t,
  onRowNavigate,
}: {
  title: string
  icon: React.ReactNode
  empty: string
  items: AgentActivityItem[]
  t: AgentsQuickTokens
  onRowNavigate?: () => void
}) {
  const visible = items.slice(0, MAX_ROWS)
  const overflow = items.length - visible.length

  return (
    <section aria-label={title} className="flex flex-col gap-2">
      <header className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
            t.laneIconHalo,
            t.laneIconColor,
          )}
        >
          {icon}
        </span>
        <h3 className={cn("text-xs font-semibold tracking-tight", t.laneTitle)}>
          {title}
        </h3>
        <span className={cn("text-[10px] tabular-nums", t.laneCount)}>
          {items.length}
        </span>
      </header>

      {items.length === 0 ? (
        <p className={cn("pl-10 text-[11px] leading-relaxed", t.emptyText)}>{empty}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {visible.map((item) => (
            <AgentsPanelRow
              key={item.id}
              item={item}
              t={t}
              onRowNavigate={onRowNavigate}
            />
          ))}
          {overflow > 0 ? (
            <li className={cn("pl-1 text-[10px]", t.emptyText)}>
              +{overflow} more on the full Agents page
            </li>
          ) : null}
        </ul>
      )}
    </section>
  )
}

function AgentsPanelRow({
  item,
  t,
  onRowNavigate,
}: {
  item: AgentActivityItem
  t: AgentsQuickTokens
  onRowNavigate?: () => void
}) {
  const interactive = Boolean(item.source.href)

  const body = (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border px-2.5 py-2 transition-colors",
        t.cardBorder,
        t.cardBg,
        interactive && t.cardHover,
      )}
    >
      <p className={cn("text-[11px] font-medium leading-snug", t.cardTitle)}>
        {item.title}
      </p>
      {item.subtitle ? (
        <p className={cn("text-[10px] leading-snug", t.cardSubtitle)}>
          {item.subtitle}
        </p>
      ) : null}
      <div className="flex items-center gap-1.5 pt-0.5">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[9px] font-semibold",
            t.chipBg,
            t.chipText,
          )}
        >
          <Bot size={8} strokeWidth={2} aria-hidden="true" />
          {item.agentName}
        </span>
        {item.source.kind === "inbox" ? (
          <span className={cn("text-[9px]", t.cardSubtitle)}>From Inbox</span>
        ) : null}
      </div>
    </div>
  )

  if (item.source.href) {
    return (
      <li>
        <Link href={item.source.href} className="block" onClick={onRowNavigate}>
          {body}
        </Link>
      </li>
    )
  }

  return <li>{body}</li>
}
