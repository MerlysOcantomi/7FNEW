import assert from "node:assert/strict"
import test from "node:test"
import {
  simulateConfirmation,
  SIM_CONFIRMED_MESSAGE,
  SIM_CANCELLED_MESSAGE,
} from "./confirmation-sim"
import type { ActionProposal } from "@core/voice/confirmation"

const NOW = "2026-01-01T12:00:00.000Z"

function proposal(expiresAt = "2026-01-01T12:05:00.000Z"): ActionProposal {
  return {
    id: "sim_1",
    workspaceId: "voice-lab",
    toolName: "create_appointment",
    args: {},
    summary: { spoken: "Crear cita con Camila", written: "Crear cita · Camila · 16:00" },
    effect: "write",
    expiresAt,
    risk: "low",
  }
}

test("confirm → confirmed copy, and NOTHING is executed", () => {
  const r = simulateConfirmation(proposal(), "confirm", NOW)
  assert.equal(r.executed, false)
  assert.equal(r.outcomeKind, "execute")
  assert.equal(r.message, SIM_CONFIRMED_MESSAGE)
})

test("cancel → cancelled copy, nothing executed", () => {
  const r = simulateConfirmation(proposal(), "cancel", NOW)
  assert.equal(r.executed, false)
  assert.equal(r.message, SIM_CANCELLED_MESSAGE)
})

test("confirm on an expired proposal → still nothing executed, cancelled copy", () => {
  const r = simulateConfirmation(proposal("2026-01-01T11:00:00.000Z"), "confirm", NOW)
  assert.equal(r.executed, false)
  assert.equal(r.outcomeKind, "rejected")
  assert.equal(r.message, SIM_CANCELLED_MESSAGE)
})
