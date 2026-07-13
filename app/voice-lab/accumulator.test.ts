import assert from "node:assert/strict"
import test from "node:test"
import {
  SessionAccumulator,
  LatencyTracker,
  summarizeLatency,
  PERCEIVED_INTERRUPTION_AVAILABLE,
} from "./accumulator"
import { evaluateSessionLimits, type TurnUsage } from "./metrics"
import { LAB_PRICING } from "./config"

const USAGE: TurnUsage = {
  audioInputTokens: 1_000_000,
  cachedAudioInputTokens: 0,
  audioOutputTokens: 1_000_000,
  textInputTokens: 0,
  textOutputTokens: 0,
  transcribedInputSeconds: 0,
}
const PRICING = LAB_PRICING["gpt-realtime-2.1"]

test("response.done is counted once: turn + cost", () => {
  const acc = new SessionAccumulator()
  const first = acc.recordResponseDone("resp_1", USAGE, PRICING)
  assert.equal(first, true)
  assert.equal(acc.turns, 1)
  assert.equal(acc.realtimeCostUsd, 96) // 32 + 64
  assert.equal(acc.estimatedCostUsd, 96)
})

test("duplicate response id does NOT double turns or cost", () => {
  const acc = new SessionAccumulator()
  acc.recordResponseDone("resp_1", USAGE, PRICING)
  const second = acc.recordResponseDone("resp_1", USAGE, PRICING)
  assert.equal(second, false)
  assert.equal(acc.turns, 1)
  assert.equal(acc.realtimeCostUsd, 96)
})

test("empty response id is ignored", () => {
  const acc = new SessionAccumulator()
  assert.equal(acc.recordResponseDone("", USAGE, PRICING), false)
  assert.equal(acc.turns, 0)
})

test("transcription cost stays separate and folds into estimatedCostUsd", () => {
  const acc = new SessionAccumulator()
  acc.recordResponseDone("r1", USAGE, PRICING)
  acc.recordTranscriptionSeconds(120, 0.003) // 2 min @ $0.003
  assert.equal(acc.transcriptionCostUsd, 0.006)
  assert.equal(acc.estimatedCostUsd, 96.006)
})

test("estimatedCostUsd reaches the limit evaluator and can trip the budget", () => {
  const acc = new SessionAccumulator()
  // A very expensive fabricated turn to exceed the USD 25 budget.
  acc.recordResponseDone("r1", USAGE, PRICING) // $96
  const status = evaluateSessionLimits(
    { elapsedMs: 1000, turns: acc.turns, estimatedCostUsd: acc.estimatedCostUsd, activeMinutes: 0.5 },
    0.15,
  )
  assert.equal(status.budgetExceeded, true)
  assert.equal(status.shouldDisconnect, true)
})

// ─── Latency ─────────────────────────────────────────────────────────────────

test("LatencyTracker: model + audible TTFA measured from end-of-turn", () => {
  const t = new LatencyTracker()
  t.onEndOfTurn(1000)
  t.onModelAudioDelta(1300) // 300 ms
  t.onAudibleStart(1450) // 450 ms
  assert.deepEqual(t.modelTtfaMs, [300])
  assert.deepEqual(t.audibleTtfaMs, [450])
})

test("LatencyTracker: only the first audio delta after a turn counts", () => {
  const t = new LatencyTracker()
  t.onEndOfTurn(0)
  t.onModelAudioDelta(200)
  t.onModelAudioDelta(250) // ignored (already recorded for this turn)
  assert.deepEqual(t.modelTtfaMs, [200])
})

test("LatencyTracker: SDK interruption measured from barge-in", () => {
  const t = new LatencyTracker()
  t.onBargeIn(500)
  t.onInterrupted(720) // 220 ms
  assert.deepEqual(t.sdkInterruptionMs, [220])
})

test("perceived interruption is UNAVAILABLE in 0.3.0 (not approximated)", () => {
  assert.equal(PERCEIVED_INTERRUPTION_AVAILABLE, false)
  const summary = summarizeLatency([], PERCEIVED_INTERRUPTION_AVAILABLE)
  assert.equal(summary.available, false)
  assert.equal(summary.count, 0)
})

test("summarizeLatency: available channel reports percentiles", () => {
  assert.deepEqual(summarizeLatency([100, 200, 300], true), {
    available: true,
    count: 3,
    p50: 200,
    p95: 300,
  })
})
