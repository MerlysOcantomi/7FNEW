import assert from "node:assert/strict"
import test from "node:test"
import {
  resolveConfirmation,
  type ActionProposal,
  type ActionConfirmation,
} from "./confirmation"

const PROPOSAL: ActionProposal = {
  id: "prop_1",
  workspaceId: "ws_1",
  toolName: "create_appointment",
  args: { clienta: "Camila", hora: "16:00" },
  summary: {
    spoken: "Voy a crear una cita con Camila a las 16:00. ¿Confirmas?",
    written: "Crear cita · Camila · 16:00",
  },
  effect: "write",
  risk: "low",
}

test("confirm → execute through the controlled pipeline", () => {
  const c: ActionConfirmation = { proposalId: "prop_1", decision: "confirm", via: "voice" }
  const outcome = resolveConfirmation(PROPOSAL, c)
  assert.equal(outcome.kind, "execute")
  if (outcome.kind === "execute") {
    assert.equal(outcome.route, "controlled")
    assert.equal(outcome.proposal.id, "prop_1")
  }
})

test("cancel → cancelled (declined)", () => {
  const c: ActionConfirmation = { proposalId: "prop_1", decision: "cancel", via: "tap" }
  const outcome = resolveConfirmation(PROPOSAL, c)
  assert.equal(outcome.kind, "cancelled")
  if (outcome.kind === "cancelled") {
    assert.equal(outcome.reason, "declined")
    assert.equal(outcome.proposalId, "prop_1")
  }
})

test("mismatched proposalId is treated as cancel, never execute (defence in depth)", () => {
  const c: ActionConfirmation = { proposalId: "prop_OTHER", decision: "confirm", via: "text" }
  const outcome = resolveConfirmation(PROPOSAL, c)
  assert.equal(outcome.kind, "cancelled")
  if (outcome.kind === "cancelled") {
    assert.equal(outcome.reason, "mismatch")
  }
})
