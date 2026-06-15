"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Radio,
  Sparkles,
  Zap,
} from "lucide-react"
import { useFetch } from "@/hooks/use-fetch"
import { cn } from "@/lib/utils"
import type {
  AgentActivityItem,
  AgentsActivityLane,
  AgentsActivityLanes,
  AgentsActivityPayload,
} from "@modules/agents/types"
import {
  AGENT_ROSTER,
  SPECIALIST_ROSTER,
  autonomyLabel,
  projectAgentLiveStates,
  type AgentLiveState,
  type AgentRosterEntry,
} from "@modules/agents/roster"
import { ACCENT, agentIcon, fmtClock, relativeTime, statusVisual } from "./agent-visuals"
import { AgentDetailDrawer } from "./agent-detail-drawer"

/**
 * Agents — the AI Team Control Center. An agent-centric LIVE view built ON TOP
 * of the existing read-only projection (`/api/agents/activity`): Francis leads
 * from a hero, the six specialists show what they're doing right now, a stream
 * shows what executed, and a decision rail surfaces what needs you.
 *
 * Honest by construction: only Fanny is wired today, so only Fanny shows real
 * working/waiting state — the rest are "coming online" from the registry (see
 * `projectAgentLiveStates`). No writes: Approve/Dismiss/Adjust autonomy are
 * disabled; "View context" / "Open in {section}" are real navigation only.
 */

const EMPTY_LANES: AgentsActivityLanes = {
  automated: [],
  needs_review: [],
  executed: [],
  attention: [],
}

export function AgentsActivityBoard() {
  const { data, loading, error } = useFetch<AgentsActivityPayload>("/api/agents/activity")
  const [openId, setOpenId] = useState<string | null>(null)
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    setNow(new Date())
    const id = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(id)
  }, [])

  const lanes = useMemo(() => data?.lanes ?? EMPTY_LANES, [data?.lanes])
  const counts = useMemo(
    () =>
      data?.counts ?? { automated: 0, needs_review: 0, executed: 0, attention: 0 },
    [data?.counts],
  )
  const liveStates = useMemo(() => projectAgentLiveStates(lanes), [lanes])
  const workingNow = useMemo(
    () => SPECIALIST_ROSTER.filter((e) => liveStates[e.id]?.status === "working").length,
    [liveStates],
  )

  const openEntry = openId ? AGENT_ROSTER.find((a) => a.id === openId) ?? null : null

  const scrollToRail = useCallback(() => {
    document.getElementById("agents-decision-rail")?.scrollIntoView({ behavior: "smooth", block: "start" })
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20" role="status" aria-label="Loading Agents">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--text-secondary-light)]" />
      </div>
    )
  }

  if (error) {
    return (
      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-8 text-center">
        <AlertTriangle className="mx-auto mb-3 h-8 w-8 text-destructive" strokeWidth={1.5} />
        <p className="text-sm font-medium text-destructive">{error}</p>
        <p className="mt-1 text-xs text-destructive/80">Agents could not be loaded.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <SummaryBar counts={counts} workingNow={workingNow} />
      <FrancisHero counts={counts} workingNow={workingNow} onReview={scrollToRail} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-6">
          <RosterGrid liveStates={liveStates} now={now} onOpen={setOpenId} onReview={scrollToRail} />
          <LiveActivity items={lanes.executed} now={now} />
        </div>
        <DecisionRail lanes={lanes} counts={counts} />
      </div>

      {openEntry ? (
        <AgentDetailDrawer
          entry={openEntry}
          live={liveStates[openEntry.id] ?? FALLBACK_LIVE}
          onClose={() => setOpenId(null)}
        />
      ) : null}
    </div>
  )
}

const FALLBACK_LIVE: AgentLiveState = {
  status: "coming_online",
  statusLabel: "Coming online",
  activity: null,
  items: [],
  handledToday: 0,
  needsReview: 0,
  lastTimestamp: null,
}

// ─── Summary bar ──────────────────────────────────────────────────────────────

function SummaryBar({
  counts,
  workingNow,
}: {
  counts: Record<AgentsActivityLane, number>
  workingNow: number
}) {
  return (
    <header className="flex flex-col gap-3 rounded-[18px] border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
          style={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)", boxShadow: "inset 0 0 0 1px var(--accent-muted-border)" }}
        >
          <Sparkles size={18} strokeWidth={1.9} />
        </span>
        <div className="min-w-0">
          <div className="flex items-baseline gap-2.5">
            <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary-light)]">Agents</h1>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--inbox-success)]">
              <span className="h-[7px] w-[7px] animate-pulse rounded-full bg-[var(--inbox-success)]" aria-hidden="true" />
              Live
            </span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-[var(--text-secondary-light)]" aria-live="polite">
            7 agents ·{" "}
            <span style={{ color: "var(--agent-teal)" }}>{workingNow} working now</span> ·{" "}
            <span style={counts.needs_review > 0 ? { color: "var(--inbox-lead)" } : undefined}>
              {counts.needs_review} awaiting you
            </span>
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <KpiPill label="Working now" value={workingNow} tone="teal" icon={<Radio size={12} strokeWidth={2} aria-hidden="true" />} />
        <KpiPill label="Needs review" value={counts.needs_review} tone={counts.needs_review > 0 ? "accent" : "default"} icon={<ClipboardCheck size={12} strokeWidth={2} aria-hidden="true" />} />
        <KpiPill label="Automated today" value={counts.automated} tone="default" icon={<Zap size={12} strokeWidth={2} aria-hidden="true" />} />
        <KpiPill label="Attention" value={counts.attention} tone={counts.attention > 0 ? "urgency" : "default"} icon={<AlertTriangle size={12} strokeWidth={2} aria-hidden="true" />} />
      </div>
    </header>
  )
}

function KpiPill({
  label,
  value,
  tone,
  icon,
}: {
  label: string
  value: number
  tone: "default" | "teal" | "accent" | "urgency"
  icon: React.ReactNode
}) {
  const color =
    tone === "teal" ? "var(--agent-teal)" : tone === "accent" ? "var(--accent-on-dark)" : tone === "urgency" ? "var(--inbox-urgency)" : null
  return (
    <div
      className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5"
      style={color
        ? { borderColor: `color-mix(in srgb, ${color} 30%, transparent)`, background: `color-mix(in srgb, ${color} 10%, transparent)` }
        : { borderColor: "var(--border-dark)", background: "var(--app-surface-dark-elevated)" }}
    >
      <span aria-hidden="true" style={{ color: color ?? "var(--text-tertiary-light)" }}>{icon}</span>
      <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-tertiary-light)]">{label}</span>
      <span className="text-[14px] font-bold tabular-nums" style={{ color: color ?? "var(--text-primary-light)" }}>{value}</span>
    </div>
  )
}

// ─── Francis hero ──────────────────────────────────────────────────────────────

function francisBriefing(counts: Record<AgentsActivityLane, number>, workingNow: number): string {
  const needs: string[] = []
  if (counts.needs_review > 0) needs.push(`${counts.needs_review} proposal${counts.needs_review === 1 ? "" : "s"} waiting`)
  if (counts.attention > 0) needs.push(`${counts.attention} need${counts.attention === 1 ? "s" : ""} attention`)
  const opening = workingNow > 0 ? "Fanny is on your inbox" : "your inbox is calm"
  const middle = needs.length ? ` — ${needs.join(" and ")} for you` : " — nothing is waiting on you"
  return `Right now: ${opening}${middle}. The rest of your team is coming online.`
}

function FrancisHero({
  counts,
  workingNow,
  onReview,
}: {
  counts: Record<AgentsActivityLane, number>
  workingNow: number
  onReview: () => void
}) {
  const reviewable = counts.needs_review > 0
  return (
    <section className="relative overflow-hidden rounded-[20px] border border-[var(--accent-muted-border)] bg-[var(--app-surface-dark)] p-5">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-10 -top-24 h-80 w-80 rounded-full"
        style={{ background: "radial-gradient(circle, var(--accent-muted), transparent 70%)" }}
      />
      <div className="relative flex flex-wrap items-center gap-5">
        <ConductorOrb />
        <div className="min-w-[260px] flex-1">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-[var(--accent-on-dark)]">Francis · CEO</span>
            <span className="rounded-md px-2 py-0.5 text-[9.5px] font-bold text-[var(--accent-on-dark)]" style={{ background: "var(--accent-muted)" }}>Leads the team</span>
          </div>
          <p className="max-w-[640px] text-[17px] font-medium leading-relaxed text-[var(--text-primary-light)] text-pretty">
            {francisBriefing(counts, workingNow)}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2.5">
          {reviewable ? (
            <button
              type="button"
              onClick={onReview}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--accent-primary)] px-4 py-2.5 text-[13.5px] font-semibold text-white shadow-[0_8px_22px_-6px_rgba(139,92,255,0.55)] transition-colors hover:bg-[var(--accent-primary-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/50"
            >
              <ClipboardCheck size={15} strokeWidth={2} aria-hidden="true" />
              Review {counts.needs_review} proposal{counts.needs_review === 1 ? "" : "s"}
            </button>
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-hover)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--text-tertiary-light)] opacity-80"
            >
              <ClipboardCheck size={15} strokeWidth={2} aria-hidden="true" />
              No proposals to review
            </button>
          )}
          <button
            type="button"
            disabled
            title="Autonomy settings are coming soon"
            className="inline-flex cursor-not-allowed items-center justify-center gap-2 rounded-xl border border-[var(--border-dark-strong)] bg-[var(--app-surface-subtle)] px-4 py-2 text-[13px] font-medium text-[var(--text-secondary-light)] opacity-80"
          >
            Adjust autonomy
          </button>
        </div>
      </div>
    </section>
  )
}

/** Decorative conductor presence — token-only orb + equalizer (no rainbow). */
function ConductorOrb() {
  return (
    <div className="relative grid h-[78px] w-[78px] shrink-0 place-items-center" aria-hidden="true">
      <span className="absolute inset-0 animate-ping rounded-full border border-[var(--accent-muted-border)]" />
      <span
        className="relative grid h-14 w-14 place-items-center rounded-full"
        style={{
          background: "radial-gradient(circle at 35% 30%, var(--accent-on-dark), var(--accent-primary) 45%, var(--accent-rich))",
          boxShadow: "0 0 28px rgba(139,92,255,0.5), inset 0 3px 12px rgba(255,255,255,0.25)",
        }}
      >
        <span className="flex h-6 items-end gap-[2.5px]">
          {[0.5, 0.9, 0.45, 1, 0.6].map((h, i) => (
            <span
              key={i}
              className="w-[3px] animate-pulse rounded-full bg-white/90"
              style={{ height: `${h * 24}px`, animationDelay: `${i * 0.12}s`, animationDuration: "1.1s" }}
            />
          ))}
        </span>
      </span>
    </div>
  )
}

// ─── Roster grid ───────────────────────────────────────────────────────────────

function RosterGrid({
  liveStates,
  now,
  onOpen,
  onReview,
}: {
  liveStates: Record<string, AgentLiveState>
  now: Date | null
  onOpen: (id: string) => void
  onReview: () => void
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary-light)]">Your agents · live</span>
        <span className="text-[11px] text-[var(--text-tertiary-light)]">6 specialists + Francis</span>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {SPECIALIST_ROSTER.map((entry) => (
          <AgentCard
            key={entry.id}
            entry={entry}
            live={liveStates[entry.id] ?? FALLBACK_LIVE}
            now={now}
            onOpen={() => onOpen(entry.id)}
            onReview={onReview}
          />
        ))}
      </div>
    </section>
  )
}

function AgentCard({
  entry,
  live,
  now,
  onOpen,
  onReview,
}: {
  entry: AgentRosterEntry
  live: AgentLiveState
  now: Date | null
  onOpen: () => void
  onReview: () => void
}) {
  const tokens = ACCENT[entry.accent]
  const Icon = agentIcon(entry.id)
  const sv = statusVisual(live.status)
  const working = live.status === "working"

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault()
          onOpen()
        }
      }}
      aria-label={`${entry.name} — ${live.statusLabel}. Open details`}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-[15px] border p-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-primary)]/40",
        working ? "bg-[var(--app-surface-dark-hover)]" : "bg-[var(--app-surface-dark)] hover:bg-[var(--app-surface-dark-elevated)]",
      )}
      style={{ borderColor: working ? tokens.border : "var(--border-dark)" }}
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-[2px]" style={{ background: tokens.fg, opacity: working ? 0.9 : 0.35 }} />

      <div className="flex items-start gap-3">
        <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px]" style={{ background: tokens.soft, color: tokens.fg }}>
          <Icon size={18} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[14px] font-bold text-[var(--text-primary-light)]">{entry.name}</p>
            {entry.autonomy ? (
              <span className="shrink-0 rounded-[5px] px-1.5 py-0.5 text-[9px] font-bold" style={{ background: tokens.soft, color: tokens.fg }}>
                {autonomyLabel(entry.autonomy)}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 truncate text-[11px] text-[var(--text-tertiary-light)]">{entry.role}</p>
        </div>
        <span
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold"
          style={{ background: `color-mix(in srgb, ${sv.color} 14%, transparent)`, color: sv.color }}
        >
          <span className={cn("h-[5px] w-[5px] rounded-full", sv.pulse && "animate-pulse")} style={{ background: sv.color }} aria-hidden="true" />
          {live.statusLabel}
        </span>
      </div>

      <div className="mt-3 min-h-[34px] border-t border-[var(--border-dark)] pt-3">
        {live.status === "waiting" ? (
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] leading-snug text-[var(--inbox-lead)]">{live.activity}</p>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onReview() }}
              className="shrink-0 text-[11px] font-semibold text-[var(--accent-on-dark)] hover:underline"
            >
              Review →
            </button>
          </div>
        ) : working ? (
          <div className="flex items-center gap-2">
            <p className="text-[12px] leading-snug text-[var(--text-primary-light)]">{live.activity}</p>
            <span className="inline-flex shrink-0 gap-[2px]" aria-hidden="true">
              {[0, 0.2, 0.4].map((d) => (
                <span key={d} className="h-1 w-1 animate-pulse rounded-full" style={{ background: tokens.fg, animationDelay: `${d}s`, animationDuration: "1.1s" }} />
              ))}
            </span>
          </div>
        ) : (
          <p className="text-[12px] leading-snug text-[var(--text-tertiary-light)]">
            {live.activity ?? (entry.active ? "Up to date — watching for new work." : "Ready in your registry — coming online.")}
          </p>
        )}
      </div>

      <div className="mt-2.5 flex items-center justify-between">
        <span className="text-[10.5px] text-[var(--text-tertiary-light)]">
          {live.handledToday > 0 ? `${live.handledToday} done today` : entry.active ? "Watching" : "Coming online"}
        </span>
        <span suppressHydrationWarning className="text-[10.5px] text-[var(--text-tertiary-light)]">
          {relativeTime(live.lastTimestamp, now)}
        </span>
      </div>
    </article>
  )
}

// ─── Live activity ───────────────────────────────────────────────────────────

function LiveActivity({ items, now }: { items: AgentActivityItem[]; now: Date | null }) {
  const rows = items.slice(0, 8)
  return (
    <section>
      <div className="mb-3 flex items-center gap-2.5">
        <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary-light)]">Live activity</span>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--inbox-success)]" aria-hidden="true" />
        <span className="h-px flex-1 bg-[var(--border-dark)]" aria-hidden="true" />
        <span className="text-[10.5px] text-[var(--text-tertiary-light)]">Executed today · {items.length}</span>
      </div>
      <div className="rounded-2xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-1.5">
        {rows.length === 0 ? (
          <p className="px-3 py-6 text-center text-[12px] text-[var(--text-tertiary-light)]">No actions have run yet today.</p>
        ) : (
          <ul>
            {rows.map((item) => (
              <li key={item.id} className="flex items-center gap-3 rounded-xl px-3 py-2.5">
                <span suppressHydrationWarning className="w-11 shrink-0 text-[10.5px] tabular-nums text-[var(--text-tertiary-light)]">
                  {now ? fmtClock(item.timestamp) : ""}
                </span>
                <span className="h-[7px] w-[7px] shrink-0 rounded-full" style={{ background: "var(--inbox-info)" }} aria-hidden="true" />
                <p className="min-w-0 flex-1 truncate text-[12.5px] text-[var(--text-secondary-light)]">
                  <span className="font-semibold text-[var(--text-primary-light)]">{item.agentName}</span> · {item.title}
                </p>
                {item.source.kind === "inbox" ? (
                  <span className="shrink-0 text-[10px] text-[var(--text-tertiary-light)]">From Inbox</span>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

// ─── Decision rail ─────────────────────────────────────────────────────────────

function DecisionRail({
  lanes,
  counts,
}: {
  lanes: AgentsActivityLanes
  counts: Record<AgentsActivityLane, number>
}) {
  return (
    <aside id="agents-decision-rail" className="flex flex-col gap-6 scroll-mt-4">
      <div>
        <RailHeader icon={<ClipboardCheck size={14} strokeWidth={2} aria-hidden="true" />} title="Needs your review" count={counts.needs_review} tone="accent" />
        {lanes.needs_review.length === 0 ? (
          <RailEmpty>No proposals waiting for you.</RailEmpty>
        ) : (
          <div className="flex flex-col gap-2.5">
            {lanes.needs_review.map((item) => <ProposalCard key={item.id} item={item} />)}
          </div>
        )}
      </div>

      <div>
        <RailHeader icon={<AlertTriangle size={14} strokeWidth={2} aria-hidden="true" />} title="Attention" count={counts.attention} tone="urgency" />
        {lanes.attention.length === 0 ? (
          <RailEmpty>Nothing needs your attention.</RailEmpty>
        ) : (
          <div className="flex flex-col gap-2.5">
            {lanes.attention.map((item) => <AttentionCard key={item.id} item={item} />)}
          </div>
        )}
      </div>

      <AutonomyLegend />
    </aside>
  )
}

function RailHeader({ icon, title, count, tone }: { icon: React.ReactNode; title: string; count: number; tone: "accent" | "urgency" }) {
  const color = tone === "accent" ? "var(--accent-on-dark)" : "var(--inbox-urgency)"
  return (
    <div className="mb-3 flex items-center gap-2">
      <span aria-hidden="true" style={{ color }}>{icon}</span>
      <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[var(--text-secondary-light)]">{title}</span>
      <span className="rounded-full px-2 py-0.5 text-[11px] font-bold" style={{ background: `color-mix(in srgb, ${color} 16%, transparent)`, color }}>{count}</span>
    </div>
  )
}

function RailEmpty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-5 text-[11.5px] text-[var(--text-tertiary-light)]">
      {children}
    </p>
  )
}

function ProposalCard({ item }: { item: AgentActivityItem }) {
  return (
    <div className="rounded-[14px] border border-[var(--accent-muted-border)] bg-[var(--app-surface-dark-elevated)] p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] text-[var(--text-tertiary-light)]">
          <span className="font-semibold text-[var(--text-secondary-light)]">{item.agentName}</span> proposes
        </span>
      </div>
      <p className="text-[13px] font-semibold leading-snug text-[var(--text-primary-light)]">{item.title}</p>
      {item.subtitle ? <p className="mt-1 text-[11.5px] leading-snug text-[var(--text-secondary-light)]">{item.subtitle}</p> : null}
      <div className="mt-3 flex items-center gap-2">
        <DisabledAction primary>Approve</DisabledAction>
        <DisabledAction>Dismiss</DisabledAction>
        {item.source.href ? (
          <Link
            href={item.source.href}
            className="ml-auto inline-flex items-center gap-1 text-[11px] font-medium text-[var(--accent-on-dark)] hover:underline"
          >
            View context <ArrowUpRight size={11} strokeWidth={2} aria-hidden="true" />
          </Link>
        ) : null}
      </div>
    </div>
  )
}

function AttentionCard({ item }: { item: AgentActivityItem }) {
  return (
    <div className="rounded-[14px] border p-3.5" style={{ borderColor: "color-mix(in srgb, var(--inbox-urgency) 28%, transparent)", background: "var(--inbox-urgency-soft)" }}>
      <div className="flex items-start gap-2.5">
        <span aria-hidden="true" className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg" style={{ background: "color-mix(in srgb, var(--inbox-urgency) 18%, transparent)", color: "var(--inbox-urgency)" }}>
          <AlertTriangle size={14} strokeWidth={2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] font-semibold leading-snug text-[var(--text-primary-light)]">{item.title}</p>
          {item.subtitle ? <p className="mt-1 text-[11px] leading-snug text-[var(--text-secondary-light)]">{item.subtitle}</p> : null}
          <div className="mt-2 flex items-center gap-3">
            <span className="text-[10px] text-[var(--text-tertiary-light)]">{item.agentName}</span>
            {item.source.href ? (
              <Link href={item.source.href} className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--inbox-urgency)] hover:underline">
                View <ArrowUpRight size={11} strokeWidth={2.2} aria-hidden="true" />
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}

/** Approve / Dismiss are intentionally inert — no write wiring exists yet. */
function DisabledAction({ children, primary = false }: { children: React.ReactNode; primary?: boolean }) {
  return (
    <button
      type="button"
      disabled
      title="Approve & dismiss from Agents is coming soon"
      className={cn(
        "inline-flex cursor-not-allowed items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[12px] font-semibold opacity-80",
        primary
          ? "flex-1 border border-[var(--accent-muted-border)] bg-[var(--accent-muted)] text-[var(--accent-on-dark)]"
          : "border border-[var(--border-dark)] bg-[var(--app-surface-hover)] text-[var(--text-secondary-light)]",
      )}
    >
      {primary ? <CheckCircle2 size={13} strokeWidth={2.4} aria-hidden="true" /> : null}
      {children}
    </button>
  )
}

function AutonomyLegend() {
  return (
    <div className="rounded-[14px] border border-[var(--border-dark)] bg-[var(--app-surface-subtle)] p-3.5">
      <p className="mb-2.5 text-[10px] font-bold uppercase tracking-[0.13em] text-[var(--text-tertiary-light)]">Autonomy</p>
      <div className="flex flex-col gap-2">
        <LegendRow label="Auto" labelStyle={{ background: "var(--agent-teal-soft)", color: "var(--agent-teal)" }} text="Runs low-risk work on its own" />
        <LegendRow label="Suggests" labelStyle={{ background: "var(--accent-muted)", color: "var(--accent-on-dark)" }} text="Proposes, waits for your yes" />
        <LegendRow label="Approval" labelStyle={{ background: "var(--app-surface-dark-elevated)", color: "var(--text-secondary-light)" }} text="Never acts without your approval" />
      </div>
    </div>
  )
}

function LegendRow({ label, labelStyle, text }: { label: string; labelStyle: React.CSSProperties; text: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="rounded-md px-2 py-0.5 text-[9.5px] font-bold" style={labelStyle}>{label}</span>
      <span className="text-[11.5px] text-[var(--text-secondary-light)]">{text}</span>
    </div>
  )
}
