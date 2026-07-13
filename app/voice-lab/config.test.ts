import assert from "node:assert/strict"
import test from "node:test"
import {
  LAB_MODELS,
  LAB_VOICES,
  resolveLabModel,
  resolveLabVoice,
  LAB_TRANSCRIPTION_MODEL,
  LAB_LIMITS,
} from "./config"

test("model allowlist is exactly the two Realtime models", () => {
  assert.deepEqual(LAB_MODELS, ["gpt-realtime-2.1", "gpt-realtime-2.1-mini"])
})

test("resolveLabModel accepts only allowlisted models", () => {
  assert.equal(resolveLabModel("gpt-realtime-2.1"), "gpt-realtime-2.1")
  assert.equal(resolveLabModel("gpt-realtime-2.1-mini"), "gpt-realtime-2.1-mini")
  assert.equal(resolveLabModel("gpt-4o"), null)
  assert.equal(resolveLabModel("gpt-realtime-2.1; drop table"), null)
  assert.equal(resolveLabModel(""), null)
  assert.equal(resolveLabModel(undefined), null)
  assert.equal(resolveLabModel(123), null)
})

test("resolveLabVoice accepts only allowlisted voices", () => {
  for (const v of LAB_VOICES) assert.equal(resolveLabVoice(v), v)
  assert.equal(resolveLabVoice("darth-vader"), null)
  assert.equal(resolveLabVoice(null), null)
})

test("input transcription model is explicitly configured", () => {
  assert.equal(LAB_TRANSCRIPTION_MODEL, "gpt-4o-mini-transcribe")
})

test("session limits: TTL short, 5 min session, 20 turns, USD 25 budget", () => {
  assert.ok(LAB_LIMITS.ephemeralTtlSeconds >= 30 && LAB_LIMITS.ephemeralTtlSeconds <= 60)
  assert.equal(LAB_LIMITS.sessionMaxMs, 5 * 60 * 1000)
  assert.equal(LAB_LIMITS.sessionMaxTurns, 20)
  assert.equal(LAB_LIMITS.experimentBudgetUsd, 25)
})
