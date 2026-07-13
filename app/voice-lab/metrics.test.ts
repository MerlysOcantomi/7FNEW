import assert from "node:assert/strict"
import test from "node:test"
import {
  percentile,
  summarizeChannel,
  estimateTurnCostUsd,
  evaluateSessionLimits,
  type TurnUsage,
} from "./metrics"
import { LAB_PRICING } from "./config"

test("percentile: empty → 0; p50/p95 nearest-rank", () => {
  assert.equal(percentile([], 50), 0)
  assert.equal(percentile([10], 95), 10)
  assert.equal(percentile([1, 2, 3, 4], 50), 2)
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10)
})

test("summarizeChannel reports count/p50/p95", () => {
  assert.deepEqual(summarizeChannel([100, 200, 300]), { count: 3, p50: 200, p95: 300 })
})

test("estimateTurnCostUsd: keeps transcription cost separate and sums correctly", () => {
  const usage: TurnUsage = {
    audioInputTokens: 1_000_000,
    cachedAudioInputTokens: 0,
    audioOutputTokens: 1_000_000,
    textInputTokens: 0,
    textOutputTokens: 0,
    transcribedInputSeconds: 60,
  }
  const cost = estimateTurnCostUsd(usage, LAB_PRICING["gpt-realtime-2.1"], 0.003)
  // 1M audio in @ $32/M + 1M audio out @ $64/M = 96; transcription 1 min @ $0.003.
  assert.equal(cost.realtimeUsd, 96)
  assert.equal(Math.round(cost.transcriptionUsd * 1000) / 1000, 0.003)
  assert.equal(cost.totalUsd, 96.003)
})

test("mini model is cheaper than the flagship for identical usage", () => {
  const usage: TurnUsage = {
    audioInputTokens: 1_000_000,
    cachedAudioInputTokens: 0,
    audioOutputTokens: 1_000_000,
    textInputTokens: 0,
    textOutputTokens: 0,
    transcribedInputSeconds: 0,
  }
  const full = estimateTurnCostUsd(usage, LAB_PRICING["gpt-realtime-2.1"], 0).totalUsd
  const mini = estimateTurnCostUsd(usage, LAB_PRICING["gpt-realtime-2.1-mini"], 0).totalUsd
  assert.ok(mini < full)
})

test("session limits: time cap forces disconnect", () => {
  const s = evaluateSessionLimits(
    { elapsedMs: 5 * 60 * 1000, turns: 3, estimatedCostUsd: 1, activeMinutes: 2 },
    0.15,
  )
  assert.equal(s.timeExceeded, true)
  assert.equal(s.shouldDisconnect, true)
})

test("session limits: turn cap forces disconnect", () => {
  const s = evaluateSessionLimits(
    { elapsedMs: 1000, turns: 20, estimatedCostUsd: 0.1, activeMinutes: 0.5 },
    0.15,
  )
  assert.equal(s.turnsExceeded, true)
  assert.equal(s.shouldDisconnect, true)
})

test("session limits: budget cap forces disconnect", () => {
  const s = evaluateSessionLimits(
    { elapsedMs: 1000, turns: 1, estimatedCostUsd: 25, activeMinutes: 1 },
    0.15,
  )
  assert.equal(s.budgetExceeded, true)
  assert.equal(s.shouldDisconnect, true)
})

test("session limits: cost alert fires without forcing disconnect", () => {
  const s = evaluateSessionLimits(
    { elapsedMs: 1000, turns: 1, estimatedCostUsd: 0.5, activeMinutes: 1 },
    0.15,
  )
  assert.equal(s.costAlert, true)
  assert.equal(s.shouldDisconnect, false)
})

test("session limits: within all caps → no disconnect, no alert", () => {
  const s = evaluateSessionLimits(
    { elapsedMs: 1000, turns: 2, estimatedCostUsd: 0.05, activeMinutes: 1 },
    0.15,
  )
  assert.equal(s.shouldDisconnect, false)
  assert.equal(s.costAlert, false)
})
