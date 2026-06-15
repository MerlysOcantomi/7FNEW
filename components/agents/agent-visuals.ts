import {
  Boxes,
  DollarSign,
  type LucideIcon,
  MessageSquare,
  Megaphone,
  Sparkles,
  Telescope,
  Users,
} from "lucide-react"
import type { AgentAccent, AgentLiveStatus } from "@modules/agents/roster"

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

/** "just now" / "5m ago" / "2h ago" / "9:12" — needs a client `now` (post-mount). */
export function relativeTime(iso: string | null, now: Date | null): string {
  if (!iso || !now) return ""
  const diffMs = now.getTime() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60_000)
  if (mins < 1) return "now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.round(mins / 60)
  if (hours < 24) return `${hours}h ago`
  return fmtClock(iso)
}
