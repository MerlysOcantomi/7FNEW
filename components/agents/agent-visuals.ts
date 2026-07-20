import {
  Boxes,
  DollarSign,
  Gem,
  type LucideIcon,
  MessageSquare,
  Megaphone,
  Sparkles,
  Telescope,
  Users,
} from "lucide-react"
import type { AgentsMessages } from "@core/i18n/ui"
import type {
  AgentAutonomy,
  AgentAccent,
  AgentLiveStatus,
  AgentRosterEntry,
} from "@modules/agents/roster"

/**
 * Shared presentation helpers for the Agents surface (board + detail drawer).
 *
 * Agent identity colors come ONLY from tokens — no off-brand blue→pink
 * gradient, no raw hex. `teal`/`rose` resolve to the `--agent-*` tokens added
 * to globals.css; the rest reuse the semantic inbox/accent palette.
 */

export interface AccentTokens {
  fg: string
  soft: string
  border: string
}

export const ACCENT: Record<AgentAccent, AccentTokens> = {
  accent: {
    fg: "var(--accent-on-dark)",
    soft: "var(--accent-muted)",
    border: "var(--accent-muted-border)",
  },
  info: {
    fg: "var(--inbox-info)",
    soft: "var(--inbox-info-soft)",
    border: "color-mix(in srgb, var(--inbox-info) 30%, transparent)",
  },
  lead: {
    fg: "var(--inbox-lead)",
    soft: "var(--inbox-lead-soft)",
    border: "color-mix(in srgb, var(--inbox-lead) 30%, transparent)",
  },
  success: {
    fg: "var(--inbox-success)",
    soft: "var(--inbox-success-soft)",
    border: "color-mix(in srgb, var(--inbox-success) 30%, transparent)",
  },
  teal: {
    fg: "var(--agent-teal)",
    soft: "var(--agent-teal-soft)",
    border: "color-mix(in srgb, var(--agent-teal) 30%, transparent)",
  },
  rose: {
    fg: "var(--agent-rose)",
    soft: "var(--agent-rose-soft)",
    border: "color-mix(in srgb, var(--agent-rose) 30%, transparent)",
  },
}

export const AGENT_ICON: Record<string, LucideIcon> = {
  francis: Sparkles,
  forte: Boxes,
  fanny: MessageSquare,
  freya: Megaphone,
  fiona: Users,
  felix: DollarSign,
  fathom: Telescope,
  // Vertical specialists
  finesse: Gem,
}

export function agentIcon(id: string): LucideIcon {
  return AGENT_ICON[id] ?? Sparkles
}

export interface StatusVisual {
  /** Token color for the dot + label. */
  color: string
  /** Whether the status dot should pulse (only true "working"/live states). */
  pulse: boolean
}

export function statusVisual(status: AgentLiveStatus): StatusVisual {
  switch (status) {
    case "working":
      return { color: "var(--agent-teal)", pulse: true }
    case "waiting":
      return { color: "var(--inbox-lead)", pulse: false }
    case "idle":
    case "coming_online":
      return { color: "var(--text-tertiary-light)", pulse: false }
  }
}

/** "9:12" local time from an ISO string. */
export function fmtClock(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
}

/**
 * "now" / "5m ago" / "2h ago" / "9:12" — locale-aware, needs a client `now`
 * (post-mount) and the `agents.time` catalog. The clock fallback stays
 * locale-neutral (Intl formats it by the browser locale).
 */
export function relativeTime(
  iso: string | null,
  now: Date | null,
  time: AgentsMessages["time"],
): string {
  if (!iso || !now) return ""
  const diffMs = now.getTime() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60_000)
  if (mins < 1) return time.now
  if (mins < 60) return time.minutesAgo(mins)
  const hours = Math.round(mins / 60)
  if (hours < 24) return time.hoursAgo(hours)
  return fmtClock(iso)
}

/**
 * Visible status label for a canonical `AgentLiveStatus`. The technical value
 * still drives colors/logic (see `statusVisual`); only this label localizes.
 */
export function agentStatusLabel(status: AgentLiveStatus, a: AgentsMessages): string {
  return status === "coming_online" ? a.states.comingOnline : a.states[status]
}

/** Visible autonomy chip label for a canonical `AgentAutonomy` value. */
export function agentAutonomyLabel(autonomy: AgentAutonomy, a: AgentsMessages): string {
  return autonomy === "auto" ? a.autonomyLabels.auto : a.autonomyLabels.suggests
}

/**
 * Per-agent DISPLAY text (role / watching / collaboration note) resolved from
 * the catalog by roster id, falling back to the roster entry's own
 * canonical-English literals for any agent not present in the catalog (e.g. a
 * future vertical specialist before its keys land).
 */
export function rosterText(
  entry: AgentRosterEntry,
  a: AgentsMessages,
): { role: string; watching: string[]; collaborationNote: string } {
  return (
    a.roster[entry.id] ?? {
      role: entry.role,
      watching: entry.watching,
      collaborationNote: entry.collaborationNote,
    }
  )
}
