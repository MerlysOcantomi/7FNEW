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
import { useI18n } from "@/components/i18n-provider"
import type { AgentsMessages } from "@core/i18n/ui"
import type {
  AgentActivityItem,
  AgentsActivityLane,
  AgentsActivityLanes,
  AgentSummary,
} from "@modules/agents/types"

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

/**
 * Lanes surfaced in the compact panel, in priority order. Copy resolves from
 * the `agents` i18n namespace by `msgKey` at render time — only IDENTITY and
 * icon live here.
 */
const PANEL_LANES: {
  key: Exclude<AgentsActivityLane, "executed">
  msgKey: keyof AgentsMessages["lanes"]
  icon: React.ReactNode
}[] = [
  {
    key: "needs_review",
    msgKey: "needsReview",
    icon: <ClipboardCheck size={16} strokeWidth={2} aria-hidden="true" />,
  },
  {
    key: "automated",
    msgKey: "automated",
    icon: <Zap size={16} strokeWidth={2} aria-hidden="true" />,
  },
  {
    key: "attention",
    msgKey: "attention",
    icon: <AlertTriangle size={16} strokeWidth={2} aria-hidden="true" />,
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

function tokens(): AgentsQuickTokens {
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
      "bg-[var(--accent-muted)] text-[var(--accent-on-dark)]",
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
  onRowNavigate,
}: {
  loading: boolean
  error: string | null
  agents: AgentSummary[]
  lanes: AgentsActivityLanes
  totalItems: number
  onRowNavigate?: () => void
}) {
  const t = tokens()
  const { messages } = useI18n()
  const copy = messages.agents

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-12"
        role="status"
        aria-label={copy.loadingAria}
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
          {copy.loadErrorNote}
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
          {copy.empty.title}
        </p>
        <p className={cn("max-w-xs text-[11px] leading-relaxed", t.emptyBody)}>
          {copy.empty.body}
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
          title={copy.lanes[lane.msgKey].title}
          icon={lane.icon}
          empty={copy.lanes[lane.msgKey].empty}
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
  const { messages } = useI18n()
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
              {messages.agents.moreOnFullPage(overflow)}
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
  const { messages } = useI18n()
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
          <span className={cn("text-[9px]", t.cardSubtitle)}>{messages.agents.fromInbox}</span>
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
