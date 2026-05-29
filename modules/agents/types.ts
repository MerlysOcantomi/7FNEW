/**
 * Global Agents activity — public types (PR 1).
 *
 * `Agents` is the read-only operational surface that shows what the
 * workspace's AI agents (today only Fanny; the other 7F agents land
 * later) have been doing: what they automated, what is waiting for a
 * human decision, what already executed, and what needs human
 * intervention.
 *
 * Sibling of New (create) / Today (execute) / Search (find): Agents is
 * the visibility + decision plane over AI work. It does NOT own a new
 * persistence model — every item is projected from existing records
 * (`WorkspaceTask`, `ConversationAction`). See `activity-aggregator.ts`.
 *
 * The contract lives in its own module so the API route, the
 * aggregator, the pure classifier, and the client board all import the
 * SAME shape — drift between server payload and client expectations is
 * a recurring source of bugs in this codebase (mirrors the rationale in
 * `modules/today/types.ts`).
 */

/**
 * The four operator-facing columns of the Agents surface.
 *
 *   - `automated`     — work the agent created and executed on its own
 *                       (e.g. `WorkspaceTask.sourceType === "fanny_auto"`).
 *   - `needs_review`  — an AI proposal still awaiting a human decision
 *                       (`WorkspaceTask.status === "proposed"` +
 *                       `sourceType === "fanny_suggestion"`).
 *   - `executed`      — an agent action that has already run
 *                       (`ConversationAction.status === "executed"`).
 *   - `attention`     — something the human must look at: a suggested
 *                       action awaiting a decision, or an action that
 *                       errored (`ConversationAction.status === "suggested"`
 *                       or `errorMessage != null`).
 */
export type AgentsActivityLane =
  | "automated"
  | "needs_review"
  | "executed"
  | "attention"

/**
 * Which underlying record an activity item was projected from. Lets the
 * client branch on provenance (and future PRs add per-kind controls)
 * without re-querying.
 */
export type AgentActivityItemKind = "task" | "action"

/**
 * Provenance chip + click target for an activity item. `href` is always
 * a relative in-app path (never an absolute URL) so the client can
 * render a `<Link>` without sanitisation — same boundary rule as
 * `TodaySource` in Today.
 */
export interface AgentActivitySource {
  kind: "inbox" | "task" | "none"
  /** Set when the item traces back to a Smart Inbox conversation. */
  conversationId: string | null
  /** Relative path, or `null` when there is no meaningful destination yet. */
  href: string | null
}

/**
 * One displayable item in the Agents surface.
 *
 * `id` is prefixed with the source kind (`"task:<id>"` for a
 * `WorkspaceTask`, `"action:<id>"` for a `ConversationAction`) so React
 * keys never collide across sources.
 */
export interface AgentActivityItem {
  id: string
  kind: AgentActivityItemKind
  lane: AgentsActivityLane
  title: string
  /** Short secondary line (raw status, automation reason, etc.). */
  subtitle: string | null
  /** Human label of the agent credited with the item (e.g. "Fanny"). */
  agentName: string
  /** Raw underlying status, surfaced for a small pill in the UI. */
  status: string
  source: AgentActivitySource
  /** ISO 8601 timestamp used for stable ordering (updatedAt ?? createdAt). */
  timestamp: string
}

/**
 * Compact view of a registered agent, projected from the registry's
 * `AgentManifest`. Used only to render the surface header / legend —
 * NOT to drive any automation.
 */
export interface AgentSummary {
  id: string
  name: string
  description: string
  /** `AgentManifest.policy.maxAutonomyLevel` (e.g. `"suggest"`). */
  maxAutonomyLevel: string
}

/** Items grouped by lane, in the column order the UI renders. */
export interface AgentsActivityLanes {
  automated: AgentActivityItem[]
  needs_review: AgentActivityItem[]
  executed: AgentActivityItem[]
  attention: AgentActivityItem[]
}

export interface AgentsActivityPayload {
  /** Agents known to the workspace (from the registry), for the header. */
  agents: AgentSummary[]
  lanes: AgentsActivityLanes
  /** Per-lane item counts (cheap for the client to read for the header). */
  counts: Record<AgentsActivityLane, number>
  /** Server-side ISO timestamp at which the snapshot was computed. */
  generatedAt: string
}
