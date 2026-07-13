import assert from "node:assert/strict"
import test from "node:test"
import {
  EMPTY_PROPOSAL_QUEUE,
  receiveProposal,
  clearActiveProposal,
} from "./proposal-queue"
import type { ActionProposal } from "@core/voice/confirmation"

function proposal(id: string): ActionProposal {
  return {
    id,
    workspaceId: "voice-lab",
    toolName: "create_appointment",
    args: {},
    summary: { spoken: "s", written: "w" },
    effect: "write",
    expiresAt: "2026-01-01T12:01:00.000Z",
    risk: "low",
  }
}

test("first proposal becomes active", () => {
  const s = receiveProposal(EMPTY_PROPOSAL_QUEUE, proposal("a"))
  assert.equal(s.active?.id, "a")
  assert.equal(s.hasBlockedIncoming, false)
})

test("a new proposal does NOT silently replace an active one", () => {
  let s = receiveProposal(EMPTY_PROPOSAL_QUEUE, proposal("a"))
  s = receiveProposal(s, proposal("b"))
  assert.equal(s.active?.id, "a", "the first proposal is kept")
  assert.equal(s.hasBlockedIncoming, true, "a pending-proposal warning is raised")
})

test("clearing returns to empty and re-opens the queue", () => {
  let s = receiveProposal(EMPTY_PROPOSAL_QUEUE, proposal("a"))
  s = clearActiveProposal()
  assert.equal(s.active, null)
  assert.equal(s.hasBlockedIncoming, false)
  s = receiveProposal(s, proposal("c"))
  assert.equal(s.active?.id, "c")
})
