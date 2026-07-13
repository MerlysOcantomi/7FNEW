import assert from "node:assert/strict"
import test from "node:test"
import {
  resolveConfirmation,
  type ActionProposal,
  type ActionConfirmation,
  type ConfirmationContext,
} from "./confirmation"

const T0 = "2026-01-01T12:00:00.000Z" // "now" for most cases
const EXPIRES = "2026-01-01T12:05:00.000Z" // 5 min after T0

const PROPOSAL: ActionProposal = {
  id: "prop_1",
  workspaceId: "ws_1",
  toolName: "create_appointment",
  args: { clienta: "Camila", hora: "16:00", servicio: { nombre: "Manicura", precio: 25 } },
  summary: {
    spoken: "Voy a crear una cita con Camila a las 16:00. ¿Confirmas?",
    written: "Crear cita · Camila · 16:00",
  },
  effect: "write",
  expiresAt: EXPIRES,
}

const FRESH: ConfirmationContext = { now: T0, alreadyResolved: false }
const confirm: ActionConfirmation = { proposalId: "prop_1", decision: "confirm", via: "voice" }
const cancel: ActionConfirmation = { proposalId: "prop_1", decision: "cancel", via: "tap" }

// ─── JSON serialization (adjustment 1) ───────────────────────────────────────

test("ActionProposal.args accepts nested JSON and round-trips through JSON", () => {
  // `args` is typed JsonObject, so this nested structure is valid at compile time
  // and — because there are no functions/classes/Dates — survives serialization.
  const roundTrip = JSON.parse(JSON.stringify(PROPOSAL.args))
  assert.deepEqual(roundTrip, PROPOSAL.args)
  assert.equal((PROPOSAL.args.servicio as { precio: number }).precio, 25)
})

// ─── Confirmation resolution + precedence (adjustments 3 & 4) ────────────────

test("valid confirmation → execute (controlled)", () => {
  const outcome = resolveConfirmation(PROPOSAL, confirm, FRESH)
  assert.equal(outcome.kind, "execute")
  if (outcome.kind === "execute") {
    assert.equal(outcome.route, "controlled")
    assert.equal(outcome.proposal.id, "prop_1")
  }
})

test("user cancel → rejected(declined)", () => {
  const outcome = resolveConfirmation(PROPOSAL, cancel, FRESH)
  assert.deepEqual(outcome, { kind: "rejected", proposalId: "prop_1", reason: "declined" })
})

test("wrong proposalId → rejected(invalid), NOT declined", () => {
  const wrong: ActionConfirmation = { proposalId: "prop_OTHER", decision: "confirm", via: "text" }
  const outcome = resolveConfirmation(PROPOSAL, wrong, FRESH)
  assert.equal(outcome.kind, "rejected")
  if (outcome.kind === "rejected") assert.equal(outcome.reason, "invalid")
})

test("expired proposal → rejected(expired)", () => {
  const late: ConfirmationContext = { now: "2026-01-01T12:06:00.000Z", alreadyResolved: false }
  const outcome = resolveConfirmation(PROPOSAL, confirm, late)
  assert.equal(outcome.kind, "rejected")
  if (outcome.kind === "rejected") assert.equal(outcome.reason, "expired")
})

test("already resolved → rejected(already_resolved)", () => {
  const resolved: ConfirmationContext = { now: T0, alreadyResolved: true }
  const outcome = resolveConfirmation(PROPOSAL, confirm, resolved)
  assert.equal(outcome.kind, "rejected")
  if (outcome.kind === "rejected") assert.equal(outcome.reason, "already_resolved")
})

// ─── Precedence: no path to execute for any blocking condition ───────────────

test("precedence: invalid > already_resolved > expired > declined; none execute", () => {
  // All blocking conditions active at once + a valid-looking confirm.
  const late = "2026-01-01T12:06:00.000Z"

  // 1. Wrong id wins even when everything else would also block.
  const wrong: ActionConfirmation = { proposalId: "nope", decision: "confirm", via: "voice" }
  assert.equal(
    (resolveConfirmation(PROPOSAL, wrong, { now: late, alreadyResolved: true }) as { reason: string }).reason,
    "invalid",
  )

  // 2. Matching id + resolved + expired → already_resolved (beats expired).
  assert.equal(
    (resolveConfirmation(PROPOSAL, confirm, { now: late, alreadyResolved: true }) as { reason: string }).reason,
    "already_resolved",
  )

  // 3. Matching id + not resolved + expired → expired (beats the cancel/confirm decision).
  assert.equal(
    (resolveConfirmation(PROPOSAL, cancel, { now: late, alreadyResolved: false }) as { reason: string }).reason,
    "expired",
  )

  // Not one of these blocking cases ever returns "execute".
  for (const ctx of [
    { now: late, alreadyResolved: true },
    { now: late, alreadyResolved: false },
    { now: T0, alreadyResolved: true },
  ] satisfies ConfirmationContext[]) {
    assert.notEqual(resolveConfirmation(PROPOSAL, confirm, ctx).kind, "execute")
  }
})

test("time is injected — the same inputs are deterministic regardless of the clock", () => {
  const a = resolveConfirmation(PROPOSAL, confirm, { now: T0, alreadyResolved: false })
  const b = resolveConfirmation(PROPOSAL, confirm, { now: T0, alreadyResolved: false })
  assert.deepEqual(a, b)
  assert.equal(a.kind, "execute")
})
