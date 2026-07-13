import assert from "node:assert/strict"
import test from "node:test"
import {
  sessionWarnings,
  WARN_TIME_MS,
  WARN_TURNS,
  type SessionWarningKind,
} from "./session-warnings"

function kinds(input: Parameters<typeof sessionWarnings>[0]): SessionWarningKind[] {
  return sessionWarnings(input).map((w) => w.kind)
}

test("minute-4 heads-up fires at 4 of 5 minutes (not before)", () => {
  assert.deepEqual(kinds({ elapsedMs: WARN_TIME_MS - 1, turns: 0, costAlert: false }), [])
  assert.deepEqual(kinds({ elapsedMs: WARN_TIME_MS, turns: 0, costAlert: false }), ["time"])
})

test("turn-17 heads-up fires at 17 of 20 turns (not before)", () => {
  assert.deepEqual(kinds({ elapsedMs: 0, turns: WARN_TURNS - 1, costAlert: false }), [])
  assert.deepEqual(kinds({ elapsedMs: 0, turns: WARN_TURNS, costAlert: false }), ["turns"])
})

test("cost alert maps to a lab cost warning", () => {
  assert.deepEqual(kinds({ elapsedMs: 0, turns: 0, costAlert: true }), ["cost"])
})

test("below all thresholds → no warnings", () => {
  assert.deepEqual(kinds({ elapsedMs: 1000, turns: 2, costAlert: false }), [])
})

test("cost warning is framed as an estimate, not a guaranteed global cap", () => {
  const w = sessionWarnings({ elapsedMs: 0, turns: 0, costAlert: true })[0]
  assert.match(w.message, /estimaci/i)
  assert.match(w.message, /no un límite global garantizado/i)
})
