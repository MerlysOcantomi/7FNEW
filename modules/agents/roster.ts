import type { AgentActivityItem, AgentsActivityLanes } from "./types"
import {
  resolveVerticalSpecialist,
  VERTICAL_SPECIALISTS,
  type VerticalSpecialistAgent,
} from "@core/vertical-packs/specialists"

/**
 * Agent roster — the static 7F AI team registry that the live `/agents`
 * surface renders against.
 *
 * This is DISPLAY/registry metadata only: no persistence, no automation, no
 * writes. It names the seven 7F agents, their function, identity accent,
 * product-facing autonomy, the 7F section their work lives in, and what each
 * conceptually watches. Live state (working / waiting / idle) is PROJECTED from
 * the existing `AgentsActivityPayload` lanes — see `projectAgentLiveStates`.
 *
 * Honesty rule: today only Fanny is truly wired (she has the `automated` /
 * `needs_review` / `executed` items the aggregator projects). Every other agent
 * is `active: false` — present in the registry and "coming online", never shown
 * as if it were really executing. The projection enforces this.
 */

/** Per-agent identity accent (maps to design tokens in the layout, never hex). */
export type AgentAccent = "accent" | "info" | "lead" | "success" | "teal" | "rose"

/** Product-facing autonomy. `null` for Francis (the lead, not a worker). */
export type AgentAutonomy = "auto" | "suggest"

export interface AgentSection {
  /** Human label for the "Open in {section}" button. */
  label: string
  /** Relative in-app route (must exist). `null` entries render disabled. */
  href: string
}

export interface AgentRosterEntry {
  id: string
  name: string
  /** Short subtitle, e.g. "Verticals · Module architect". */
  role: string
  description: string
  accent: AgentAccent
  autonomy: AgentAutonomy | null
  /** Where this agent's work lives; `null` when no route exists yet. */
  section: AgentSection | null
  /** Only Fanny is truly wired today; the rest are registry / coming online. */
  active: boolean
  /** Francis leads from the hero — not shown in the specialist grid. */
  isLead: boolean
  /** What this agent conceptually monitors (drawer "Watching"). */
  watching: string[]
  /** Static collaboration note (drawer "Works with the team"). */
  collaborationNote: string
  /**
   * Set only for a VERTICAL SPECIALIST (e.g. Finesse for beauty) — never on the
   * 7 core agents. The specialist is layered in per workspace vertical, not part
   * of `AGENT_ROSTER`.
   */
  verticalKey?: string
  /**
   * True for a vertical specialist that LEADS its vertical (distinct from
   * `isLead`, which is Francis, the global lead).
   */
  isVerticalLead?: boolean
}

export const AGENT_ROSTER: readonly AgentRosterEntry[] = [
  {
    id: "francis",
    name: "Francis",
    role: "CEO · Leads the team",
    description: "Leads the AI team and keeps the operation on track.",
    accent: "accent",
    autonomy: null,
    section: null,
    active: false,
    isLead: true,
    watching: ["The whole operation", "What needs your decision", "How the team is doing"],
    collaborationNote:
      "Francis conducts the team — routing work to the right agent and surfacing only what needs you.",
  },
  {
    id: "forte",
    name: "Mr. Forte",
    role: "Verticals · Module architect",
    description: "Proposes which module or vertical adaptation would help your business.",
    accent: "accent",
    autonomy: "suggest",
    section: { label: "Forte", href: "/forte" },
    active: false,
    isLead: false,
    watching: ["Repeated business patterns", "Missing modules", "Vertical fit", "Your operating model"],
    collaborationNote: "Mr. Forte leans on Freya for module design and listens to Fathom's vertical trends.",
  },
  {
    id: "fanny",
    name: "Fanny",
    role: "Conversations · Inbox",
    description: "Handles your inbox — triage, drafts, follow-ups and replies.",
    accent: "info",
    autonomy: "auto",
    section: { label: "Inbox", href: "/inbox" },
    active: true,
    isLead: false,
    watching: ["Unread client replies", "Waiting conversations", "Follow-ups due today", "Urgent messages"],
    collaborationNote: "When a message asks for an invoice, Fanny hands it to Felix; new contacts sync to Fiona.",
  },
  {
    id: "freya",
    name: "Freya",
    role: "Content · Marketing",
    description: "Content, campaigns and design support.",
    accent: "rose",
    autonomy: "suggest",
    section: { label: "Content", href: "/contenido" },
    active: false,
    isLead: false,
    watching: ["Content deadlines", "Campaign tasks", "Module & design support"],
    collaborationNote: "Freya designs alongside Mr. Forte and turns Fathom's trends into content.",
  },
  {
    id: "fiona",
    name: "Fiona",
    role: "Relationships · CRM",
    description: "Clients, relationships and follow-up gaps.",
    accent: "teal",
    autonomy: "auto",
    section: { label: "Clients", href: "/clientes" },
    active: false,
    isLead: false,
    watching: ["Quiet clients", "Follow-up gaps", "Relationship risks"],
    collaborationNote: "Fiona syncs notes from Fanny's threads and flags relationship risks for you.",
  },
  {
    id: "felix",
    name: "Felix",
    role: "Finance · Invoices",
    description: "Payments, invoices and finance risks.",
    accent: "lead",
    autonomy: "suggest",
    section: { label: "Finance", href: "/finanzas" },
    active: false,
    isLead: false,
    watching: ["Unpaid invoices", "Deposits", "Overdue payments", "Finance risk"],
    collaborationNote: "Felix prepares invoices from the requests Fanny hands over.",
  },
  {
    id: "fathom",
    name: "Fathom",
    role: "Research · Vertical trends",
    description: "Research, vertical trends and product/market insights.",
    accent: "success",
    autonomy: "suggest",
    section: null,
    active: false,
    isLead: false,
    watching: ["Market trends", "Vertical opportunities", "Competitor & product signals"],
    collaborationNote: "Fathom feeds vertical trends to Mr. Forte and content angles to Freya.",
  },
]

/** The six specialists shown in the live grid (Francis leads from the hero). */
export const SPECIALIST_ROSTER: readonly AgentRosterEntry[] = AGENT_ROSTER.filter((a) => !a.isLead)

export function getRosterEntry(id: string): AgentRosterEntry | undefined {
  return AGENT_ROSTER.find((a) => a.id === id)
}

// ─── Vertical specialists (additive — the 7 core agents above never change) ───

/**
 * Map a vertical specialist spec (data owned by `core/vertical-packs`) into a
 * roster entry so the agents surface can render it alongside — but separate
 * from — the 7 core agents. `isVerticalLead` marks it as the leader of its
 * vertical without touching the global lead (Francis) or `AGENT_ROSTER`.
 */
function specialistToRosterEntry(spec: VerticalSpecialistAgent): AgentRosterEntry {
  return {
    id: spec.id,
    name: spec.name,
    role: spec.shortLabel,
    description: spec.description,
    accent: spec.accent as AgentAccent,
    autonomy: "suggest",
    section: { label: "Hoy", href: "/today" },
    active: false,
    isLead: false,
    isVerticalLead: true,
    verticalKey: spec.verticalKey,
    watching: ["El día del negocio", "Qué necesita tu atención", "Coordinación con el equipo"],
    collaborationNote: spec.description,
  }
}

/**
 * Vertical specialist roster entries keyed by canonical verticalKey. Built from
 * the `VERTICAL_SPECIALISTS` registry; adding a vertical there surfaces its
 * specialist here with no change to the core roster.
 */
export const VERTICAL_SPECIALIST_ROSTER: Record<string, AgentRosterEntry[]> = Object.fromEntries(
  Object.entries(VERTICAL_SPECIALISTS).map(([key, spec]) => [key, [specialistToRosterEntry(spec)]]),
)

/**
 * The vertical specialists to show for a workspace's vertical (alias-aware, e.g.
 * salon/nails → Finesse), or `[]` when the vertical has none.
 */
export function getVerticalSpecialists(verticalKey: string | null | undefined): AgentRosterEntry[] {
  const spec = resolveVerticalSpecialist(verticalKey)
  return spec ? [specialistToRosterEntry(spec)] : []
}

/** Product-facing autonomy chip label. */
export function autonomyLabel(a: AgentAutonomy): string {
  return a === "auto" ? "Auto" : "Suggests"
}

// ─── Live-state projection (from existing lanes — no new data) ────────────────

export type AgentLiveStatus = "working" | "waiting" | "idle" | "coming_online"

export interface AgentLiveState {
  status: AgentLiveStatus
  statusLabel: string
  /** Honest one-line "doing now" for the card/drawer (null = nothing to show). */
  activity: string | null
  /** This agent's items across all lanes, newest first (drawer "Today"). */
  items: AgentActivityItem[]
  /** Count credited to the agent today (executed + automated). */
  handledToday: number
  /** Proposals from this agent awaiting your review. */
  needsReview: number
  lastTimestamp: string | null
}

export function statusLabel(s: AgentLiveStatus): string {
  switch (s) {
    case "working": return "Working"
    case "waiting": return "Waiting for you"
    case "idle": return "Idle"
    case "coming_online": return "Coming online"
  }
}

/** Resolve an item's `agentName` to a roster id (case-insensitive, Forte alias). */
function resolveAgentId(agentName: string): string | null {
  const n = agentName.trim().toLowerCase()
  for (const entry of AGENT_ROSTER) {
    if (entry.name.toLowerCase() === n) return entry.id
    if (n.includes(entry.id)) return entry.id // "Mr. Forte" → "forte"
  }
  return null
}

/**
 * Project per-agent live state from the existing lanes. Pure: no I/O, no clock.
 * Only agents with real items get a working/waiting/idle status; everyone else
 * (today: everyone but Fanny) stays "coming online" — the surface never implies
 * an agent is executing when it isn't.
 */
export function projectAgentLiveStates(
  lanes: AgentsActivityLanes,
): Record<string, AgentLiveState> {
  const all: AgentActivityItem[] = [
    ...lanes.automated,
    ...lanes.needs_review,
    ...lanes.executed,
    ...lanes.attention,
  ]

  const byAgent = new Map<string, AgentActivityItem[]>()
  for (const item of all) {
    const id = resolveAgentId(item.agentName)
    if (!id) continue
    const list = byAgent.get(id) ?? []
    list.push(item)
    byAgent.set(id, list)
  }

  const out: Record<string, AgentLiveState> = {}
  for (const entry of SPECIALIST_ROSTER) {
    const items = (byAgent.get(entry.id) ?? []).slice().sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    )
    const needsReviewItems = items.filter((i) => i.lane === "needs_review")
    const ranItems = items.filter((i) => i.lane === "executed" || i.lane === "automated")

    let status: AgentLiveStatus
    let activity: string | null = null
    if (items.length === 0) {
      status = entry.active ? "idle" : "coming_online"
    } else if (needsReviewItems.length > 0) {
      status = "waiting"
      activity = needsReviewItems[0].title
    } else if (ranItems.length > 0) {
      status = "working"
      activity = ranItems[0].title
    } else {
      status = "idle"
      activity = items[0].title
    }

    out[entry.id] = {
      status,
      statusLabel: statusLabel(status),
      activity,
      items,
      handledToday: ranItems.length,
      needsReview: needsReviewItems.length,
      lastTimestamp: items[0]?.timestamp ?? null,
    }
  }
  return out
}
