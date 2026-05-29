"use client"

import { useMemo } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Sparkles,
  Zap,
} from "lucide-react"
import { useFetch } from "@/hooks/use-fetch"
import { cn } from "@/lib/utils"
import type {
  AgentActivityItem,
  AgentsActivityLane,
  AgentsActivityPayload,
} from "@modules/agents/types"

/**
 * Agents activity board (PR 1) — read-only client surface.
 *
 * Fetches `/api/agents/activity` (workspace resolved server-side) and
 * renders the four lanes: Automated / Needs review / Executed /
 * Attention. Handles loading / error / empty states. No writes, no
 * approve/dismiss controls yet — those land with the global panel in a
 * later PR. Visual language follows the AppShell dark canvas tokens used
 * by Today, without trying to redesign New/Today/Search.
 */

interface LaneMeta {
  key: AgentsActivityLane
  title: string
  subtitle: string
  icon: React.ReactNode
  emptyTitle: string
  emptyDescription: string
  accent: "automated" | "review" | "executed" | "attention"
}

const LANES: LaneMeta[] = [
  {
    key: "automated",
    title: "Automated",
    subtitle: "Work agents created and ran on their own",
    icon: <Zap size={13} strokeWidth={2} aria-hidden="true" />,
    emptyTitle: "Nothing automated yet",
    emptyDescription: "Low-risk work Fanny handles automatically will show up here.",
    accent: "automated",
  },
  {
    key: "needs_review",
    title: "Needs review",
    subtitle: "Proposals waiting for your decision",
    icon: <ClipboardCheck size={13} strokeWidth={2} aria-hidden="true" />,
    emptyTitle: "No proposals to review",
    emptyDescription: "When Fanny proposes work, it waits here for your approval.",
    accent: "review",
  },
  {
    key: "executed",
    title: "Executed",
    subtitle: "Agent actions that already ran",
    icon: <CheckCircle2 size={13} strokeWidth={2} aria-hidden="true" />,
    emptyTitle: "No executed actions",
    emptyDescription: "Completed agent actions will be listed here.",
    accent: "executed",
  },
  {
    key: "attention",
    title: "Attention",
    subtitle: "Suggestions and errors that need a human",
    icon: <AlertTriangle size={13} strokeWidth={2} aria-hidden="true" />,
    emptyTitle: "Nothing needs attention",
    emptyDescription: "Suggested actions and failures will surface here.",
    accent: "attention",
  },
]

export function AgentsActivityBoard() {
  const { data, loading, error } = useFetch<AgentsActivityPayload>(
    "/api/agents/activity",
  )

  const lanes = useMemo(
    () =>
      data?.lanes ?? {
        automated: [],
        needs_review: [],
        executed: [],
        attention: [],
      },
    [data?.lanes],
  )

  const totalItems = useMemo(
    () =>
      lanes.automated.length +
      lanes.needs_review.length +
      lanes.executed.length +
      lanes.attention.length,
    [lanes],
  )

  if (loading) {
    return (
      <div
        className="flex items-center justify-center py-20"
        role="status"
        aria-label="Loading Agents activity"
      >
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
        <AlertTriangle
          className="mx-auto mb-3 h-8 w-8 text-destructive"
          strokeWidth={1.5}
        />
        <p className="text-sm font-medium text-destructive">{error}</p>
        <p className="mt-1 text-xs text-destructive/80">
          Agents activity could not be loaded.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <AgentsHeader agents={data?.agents ?? []} totalItems={totalItems} />

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {LANES.map((lane) => (
          <AgentsLaneColumn key={lane.key} meta={lane} items={lanes[lane.key]} />
        ))}
      </div>
    </div>
  )
}

// ─── Header ────────────────────────────────────────────────────────────────

function AgentsHeader({
  agents,
  totalItems,
}: {
  agents: AgentsActivityPayload["agents"]
  totalItems: number
}) {
  return (
    <header className="flex flex-col gap-3 rounded-2xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)]/40 p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[linear-gradient(135deg,rgba(47,128,237,0.20),rgba(139,92,246,0.20),rgba(236,72,153,0.20))] text-[var(--text-primary-light)]"
        >
          <Sparkles size={16} strokeWidth={1.9} />
        </span>
        <div className="flex-1">
          <h1 className="text-lg font-semibold tracking-tight text-[var(--text-primary-light)]">
            Agent activity
          </h1>
          <p className="text-xs leading-relaxed text-[var(--text-secondary-light)]">
            {totalItems > 0
              ? `${totalItems} item${totalItems === 1 ? "" : "s"} across your agents right now.`
              : "Live view of what your AI agents are doing across the workspace."}
          </p>
        </div>
      </div>

      {agents.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {agents.map((agent) => (
            <li
              key={agent.id}
              className="flex items-center gap-2 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-3 py-1.5"
              title={agent.description}
            >
              <Bot
                size={12}
                strokeWidth={2}
                aria-hidden="true"
                className="text-[var(--text-secondary-light)]"
              />
              <span className="text-xs font-medium text-[var(--text-primary-light)]">
                {agent.name}
              </span>
              <span className="rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-secondary-light)]">
                {agent.maxAutonomyLevel}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </header>
  )
}

// ─── Lane column ─────────────────────────────────────────────────────────────

const ACCENT_BAR: Record<LaneMeta["accent"], string> = {
  automated: "bg-[linear-gradient(135deg,#2f80ed,#8b5cf6)]",
  review: "bg-[var(--accent-primary)]",
  executed: "bg-emerald-500/70",
  attention: "bg-amber-500/80",
}

function AgentsLaneColumn({
  meta,
  items,
}: {
  meta: LaneMeta
  items: AgentActivityItem[]
}) {
  return (
    <section
      aria-label={meta.title}
      className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)]/40 p-4"
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-[2px]",
          ACCENT_BAR[meta.accent],
        )}
      />

      <header className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <span
            aria-hidden="true"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-[var(--text-primary-light)]"
          >
            {meta.icon}
          </span>
          <div>
            <h2 className="text-sm font-semibold tracking-tight text-[var(--text-primary-light)]">
              {meta.title}
            </h2>
            <p className="text-[11px] leading-snug text-[var(--text-secondary-light)]">
              {meta.subtitle}
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
          className="flex flex-col items-start gap-1 rounded-xl border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-6"
        >
          <p className="text-xs font-medium text-[var(--text-primary-light)]">
            {meta.emptyTitle}
          </p>
          <p className="text-[11px] leading-relaxed text-[var(--text-secondary-light)]">
            {meta.emptyDescription}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((item) => (
            <AgentsActivityCard key={item.id} item={item} />
          ))}
        </ul>
      )}
    </section>
  )
}

// ─── Item card ───────────────────────────────────────────────────────────────

function AgentsActivityCard({ item }: { item: AgentActivityItem }) {
  const body = (
    <div className="flex flex-col gap-1.5 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-3 py-2.5 transition-colors hover:bg-white/[0.04]">
      <p className="text-xs font-medium leading-snug text-[var(--text-primary-light)]">
        {item.title}
      </p>
      {item.subtitle ? (
        <p className="text-[11px] leading-snug text-[var(--text-secondary-light)]">
          {item.subtitle}
        </p>
      ) : null}
      <div className="flex items-center gap-2 pt-0.5">
        <span className="inline-flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--text-secondary-light)]">
          <Bot size={9} strokeWidth={2} aria-hidden="true" />
          {item.agentName}
        </span>
        {item.source.kind === "inbox" ? (
          <span className="text-[10px] text-[var(--text-secondary-light)]/70">
            From Inbox
          </span>
        ) : null}
      </div>
    </div>
  )

  if (item.source.href) {
    return (
      <li>
        <Link href={item.source.href} className="block">
          {body}
        </Link>
      </li>
    )
  }

  return <li>{body}</li>
}
