import { db } from "@core/db"
import { pilotAgentManifests } from "@core/registry"
import {
  classifyConversationAction,
  classifyWorkspaceTask,
} from "./activity-classify"
import type {
  AgentActivityItem,
  AgentsActivityLane,
  AgentsActivityLanes,
  AgentsActivityPayload,
  AgentSummary,
} from "./types"

/**
 * Agents activity aggregator (PR 1) — server-side, read-only.
 *
 * Projects existing workspace-scoped records into the four Agents lanes
 * (automated / needs_review / executed / attention). It introduces NO
 * new persistence and performs NO writes, NO AI calls, and holds NO
 * global state. Modeled on `modules/today/aggregator.ts`:
 *
 *   - every query filters by `workspaceId` exact-match (multi-tenant
 *     safety is non-negotiable);
 *   - hard TAKE caps protect the DB from runaway tenants;
 *   - the two sources are pulled in parallel with `Promise.all`;
 *   - lane membership is decided by the PURE classifier in
 *     `activity-classify.ts`, never inline here.
 *
 * Sources:
 *   1. `WorkspaceTask` — Fanny auto-created work (`sourceType="fanny_auto"`)
 *      and proposals awaiting review (`status="proposed"` +
 *      `sourceType="fanny_suggestion"`). These are the only task rows the
 *      Agents surface cares about; the OR predicate keeps the query tight.
 *   2. `ConversationAction` — agent actions that executed
 *      (`status="executed"`), are suggested and awaiting a decision
 *      (`status="suggested"`), or errored (`errorMessage != null`).
 *
 * Out of scope for PR 1: writes, approve/dismiss from this surface,
 * pagination, real-time updates, the global trigger/panel, and the full
 * 7-agent runtime.
 */

/** Hard upper bounds — protect the DB from "tenant with 50k rows" runaway queries. */
const TASKS_TAKE = 100
const ACTIONS_TAKE = 100

export interface AggregateAgentsActivityInput {
  workspaceId: string
  /** Allows tests/callers to inject a fixed `now`; defaults to `new Date()`. */
  now?: Date
}

export async function aggregateAgentsActivity(
  input: AggregateAgentsActivityInput,
): Promise<AgentsActivityPayload> {
  if (!input.workspaceId) {
    /**
     * Refuse to run with a falsy workspaceId. Defence-in-depth: callers
     * go through `requireReadAccess`, but this keeps the aggregator safe
     * even if reused later from a worker or script.
     */
    throw new Error("aggregateAgentsActivity requires a workspaceId")
  }

  const now = input.now ?? new Date()

  /** Stage 1 — pull both sources in parallel, scoped to the workspace. */
  const [tasks, actions] = await Promise.all([
    db.workspaceTask.findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: [
          { sourceType: "fanny_auto" },
          { status: "proposed", sourceType: "fanny_suggestion" },
        ],
      },
      select: {
        id: true,
        title: true,
        status: true,
        sourceType: true,
        conversationId: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: TASKS_TAKE,
    }),
    db.conversationAction.findMany({
      where: {
        workspaceId: input.workspaceId,
        OR: [
          { status: { in: ["suggested", "executed"] } },
          { errorMessage: { not: null } },
        ],
      },
      select: {
        id: true,
        type: true,
        status: true,
        source: true,
        errorMessage: true,
        conversationId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: ACTIONS_TAKE,
    }),
  ])

  /** Registry-driven header. Today this is just Fanny (the inbox agent). */
  const agents = buildAgentSummaries()
  const defaultAgentName = resolveInboxAgentName(agents)

  /** Stage 2 — classify + normalise each row to `AgentActivityItem`. */
  const lanes: AgentsActivityLanes = {
    automated: [],
    needs_review: [],
    executed: [],
    attention: [],
  }

  for (const task of tasks) {
    const lane = classifyWorkspaceTask({
      status: task.status,
      sourceType: task.sourceType,
    })
    if (!lane) continue
    lanes[lane].push({
      id: `task:${task.id}`,
      kind: "task",
      lane,
      title: task.title,
      subtitle: humaniseTaskStatus(task.status),
      /** All Agents activity in PR 1 is Fanny-originated (inbox agent). */
      agentName: defaultAgentName,
      status: task.status,
      source: buildTaskSource(task.conversationId),
      timestamp: (task.updatedAt ?? task.createdAt).toISOString(),
    })
  }

  for (const action of actions) {
    const lane = classifyConversationAction({
      status: action.status,
      errorMessage: action.errorMessage,
    })
    if (!lane) continue
    lanes[lane].push({
      id: `action:${action.id}`,
      kind: "action",
      lane,
      title: humaniseActionType(action.type),
      subtitle: action.errorMessage?.trim() || humaniseActionStatus(action.status),
      agentName: defaultAgentName,
      status: action.status,
      source: buildActionSource(action.conversationId),
      timestamp: action.createdAt.toISOString(),
    })
  }

  /** Stage 3 — stable sort each lane by timestamp desc, id asc as tiebreaker. */
  for (const key of Object.keys(lanes) as AgentsActivityLane[]) {
    lanes[key].sort(compareActivityItems)
  }

  return {
    agents,
    lanes,
    counts: {
      automated: lanes.automated.length,
      needs_review: lanes.needs_review.length,
      executed: lanes.executed.length,
      attention: lanes.attention.length,
    },
    generatedAt: now.toISOString(),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function compareActivityItems(a: AgentActivityItem, b: AgentActivityItem): number {
  const ta = new Date(a.timestamp).getTime()
  const tb = new Date(b.timestamp).getTime()
  if (ta !== tb) return tb - ta
  return a.id.localeCompare(b.id)
}

/**
 * Project the registry's `AgentManifest`s into the compact header shape.
 * Pure read of the static pilot manifests — no automation, no DB.
 */
function buildAgentSummaries(): AgentSummary[] {
  return pilotAgentManifests.map((manifest) => ({
    id: manifest.id,
    name: manifest.name,
    description: manifest.description,
    /** `maxAutonomyLevel` is optional on the manifest; fall back to a
     *  neutral label so the header pill always renders something. */
    maxAutonomyLevel: manifest.policy.maxAutonomyLevel ?? "n/a",
  }))
}

/**
 * All Agents activity in PR 1 originates from the Smart Inbox agent
 * (Fanny). Resolve its display name from the registry so attribution
 * follows the manifest rather than a hard-coded string; fall back to
 * the first registered agent, then a neutral label.
 */
function resolveInboxAgentName(agents: AgentSummary[]): string {
  return agents.find((a) => a.id === "fanny")?.name ?? agents[0]?.name ?? "Agent"
}

function buildTaskSource(conversationId: string | null): AgentActivityItem["source"] {
  if (conversationId) {
    return {
      kind: "inbox",
      conversationId,
      href: `/inbox?id=${encodeURIComponent(conversationId)}`,
    }
  }
  /** No global task detail page yet — point at Today as a soft landing. */
  return { kind: "task", conversationId: null, href: "/today" }
}

function buildActionSource(conversationId: string | null): AgentActivityItem["source"] {
  if (conversationId) {
    return {
      kind: "inbox",
      conversationId,
      href: `/inbox?id=${encodeURIComponent(conversationId)}`,
    }
  }
  return { kind: "none", conversationId: null, href: null }
}

/** Turn a snake_case action type into a short Title Case label. */
function humaniseActionType(type: string): string {
  const cleaned = type.replace(/[_-]+/g, " ").trim()
  if (!cleaned) return "Action"
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

function humaniseActionStatus(status: string): string {
  switch (status) {
    case "suggested":
      return "Awaiting your decision"
    case "executed":
      return "Executed by agent"
    default:
      return status
  }
}

function humaniseTaskStatus(status: string): string {
  switch (status) {
    case "proposed":
      return "Proposed — awaiting review"
    case "open":
      return "Open"
    case "in_progress":
      return "In progress"
    case "waiting":
      return "Waiting"
    case "done":
      return "Done"
    case "dismissed":
      return "Dismissed"
    default:
      return status
  }
}
