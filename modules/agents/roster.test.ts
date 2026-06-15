/**
 * Unit tests for the agent roster + live-state projection.
 *
 * Locks two things that protect the "honest, no-fake-automation" rule:
 *   - the registry shape (7 agents, one lead, autonomy/section/active per spec);
 *   - the projection: only agents with REAL items get working/waiting/idle, and
 *     un-wired agents stay "coming online" — the surface never implies an agent
 *     is executing when it isn't.
 *
 * `node:test` via `tsx`. Run with:  npm run test:agents-roster
 */

import assert from "node:assert/strict"
import test from "node:test"

import {
  AGENT_ROSTER,
  SPECIALIST_ROSTER,
  autonomyLabel,
  getRosterEntry,
  projectAgentLiveStates,
} from "./roster"
import type { AgentActivityItem, AgentsActivityLanes } from "./types"

test("roster has the 7 agents with exactly one lead (Francis)", () => {
  assert.equal(AGENT_ROSTER.length, 7)
  const ids = AGENT_ROSTER.map((a) => a.id).sort()
  assert.deepEqual(ids, ["fanny", "fathom", "felix", "fiona", "forte", "francis", "freya"])
  const leads = AGENT_ROSTER.filter((a) => a.isLead)
  assert.equal(leads.length, 1)
  assert.equal(leads[0].id, "francis")
  assert.equal(SPECIALIST_ROSTER.length, 6)
  assert.ok(!SPECIALIST_ROSTER.some((a) => a.isLead))
})

test("only Fanny is active/wired today; the rest are registry-only", () => {
  for (const a of AGENT_ROSTER) {
    assert.equal(a.active, a.id === "fanny", `active flag wrong for ${a.id}`)
  }
})

test("autonomy + section mapping matches the spec and only links to real routes", () => {
  assert.equal(getRosterEntry("fanny")?.autonomy, "auto")
  assert.equal(getRosterEntry("fiona")?.autonomy, "auto")
  assert.equal(getRosterEntry("forte")?.autonomy, "suggest")
  assert.equal(getRosterEntry("francis")?.autonomy, null)

  assert.equal(getRosterEntry("fanny")?.section?.href, "/inbox")
  assert.equal(getRosterEntry("felix")?.section?.href, "/finanzas")
  assert.equal(getRosterEntry("fiona")?.section?.href, "/clientes")
  assert.equal(getRosterEntry("freya")?.section?.href, "/contenido")
  assert.equal(getRosterEntry("forte")?.section?.href, "/forte")
  // No /insights route exists yet → honest null (drawer renders it disabled).
  assert.equal(getRosterEntry("fathom")?.section, null)

  assert.equal(autonomyLabel("auto"), "Auto")
  assert.equal(autonomyLabel("suggest"), "Suggests")
})

function item(over: Partial<AgentActivityItem>): AgentActivityItem {
  return {
    id: over.id ?? "x",
    kind: over.kind ?? "task",
    lane: over.lane ?? "executed",
    title: over.title ?? "Did a thing",
    subtitle: over.subtitle ?? null,
    agentName: over.agentName ?? "Fanny",
    status: over.status ?? "done",
    source: over.source ?? { kind: "none", conversationId: null, href: null },
    timestamp: over.timestamp ?? "2026-06-15T09:00:00.000Z",
  }
}
function lanes(over: Partial<AgentsActivityLanes> = {}): AgentsActivityLanes {
  return { automated: [], needs_review: [], executed: [], attention: [], ...over }
}

test("projection: Fanny gets real status; un-wired agents stay coming online", () => {
  const states = projectAgentLiveStates(
    lanes({
      executed: [item({ id: "e1", lane: "executed", title: "Replied to 3 conversations", timestamp: "2026-06-15T09:12:00Z" })],
      automated: [item({ id: "a1", lane: "automated", title: "Auto-created a task" })],
    }),
  )
  assert.equal(states.fanny.status, "working")
  assert.equal(states.fanny.activity, "Replied to 3 conversations")
  assert.equal(states.fanny.handledToday, 2)

  // Everyone else: no items → coming online, no fabricated activity.
  for (const id of ["forte", "freya", "fiona", "felix", "fathom"]) {
    assert.equal(states[id].status, "coming_online", `${id} should be coming online`)
    assert.equal(states[id].activity, null)
    assert.equal(states[id].handledToday, 0)
  }
})

test("projection: a pending proposal makes the agent 'waiting for you'", () => {
  const states = projectAgentLiveStates(
    lanes({
      needs_review: [item({ id: "n1", lane: "needs_review", title: "Proposed a follow-up", agentName: "Fanny" })],
    }),
  )
  assert.equal(states.fanny.status, "waiting")
  assert.equal(states.fanny.needsReview, 1)
  assert.equal(states.fanny.activity, "Proposed a follow-up")
})

test("projection resolves 'Mr. Forte' via alias without inventing activity elsewhere", () => {
  const states = projectAgentLiveStates(
    lanes({ executed: [item({ id: "f1", lane: "executed", title: "Reviewed a vertical", agentName: "Mr. Forte" })] }),
  )
  assert.equal(states.forte.status, "working")
  assert.equal(states.forte.activity, "Reviewed a vertical")
  // Fanny is wired but has no items here → honest "idle" (not fabricated work,
  // and not "coming online" which is reserved for un-wired agents).
  assert.equal(states.fanny.status, "idle")
})
