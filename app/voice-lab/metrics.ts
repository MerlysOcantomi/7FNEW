/**
 * Voice Lab metrics — pure latency + cost math (CORE-VOICE-0B.1).
 *
 * No DOM, no I/O, no clock: every value is passed in so this is deterministic
 * and testable. The browser records raw timings/usage and feeds them here.
 */

import type { ModelPricing } from "./config"
import { LAB_LIMITS } from "./config"

// ─── Latency channels (adjustment 7 — recorded separately) ───────────────────

export interface LatencySamples {
  /** end-of-turn → first audio token from the model (event time). */
  modelTtfaMs: number[]
  /** end-of-turn → first audible playback in the browser. */
  audibleTtfaMs: number[]
  /** user barge-in → SDK `audio_interrupted` event. */
  sdkInterruptionMs: number[]
  /** user barge-in → playback actually stops (perceived). */
  perceivedInterruptionMs: number[]
  /** `connect()` called → session ready. */
  connectionMs: number[]
}

/** Inclusive-nearest-rank percentile. Returns 0 for an empty sample. */
export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const clamped = Math.min(100, Math.max(0, p))
  const rank = Math.ceil((clamped / 100) * sorted.length)
  const idx = Math.min(sorted.length - 1, Math.max(0, rank - 1))
  return sorted[idx]
}

export interface LatencySummaryChannel {
  count: number
  p50: number
  p95: number
}

export function summarizeChannel(values: readonly number[]): LatencySummaryChannel {
  return { count: values.length, p50: percentile(values, 50), p95: percentile(values, 95) }
}

// ─── Cost (from response.done usage + input transcription usage) ─────────────

// Promoted to the shared voice layer; re-exported to keep the lab import path.
import type { TurnUsage } from "@core/voice/realtime-events"
export type { TurnUsage } from "@core/voice/realtime-events"

const PER_M = 1_000_000

/**
 * Cost of one turn in USD, broken out so the transcription cost stays separate
 * (adjustment 4). Pure arithmetic over the injected pricing table.
 */
export function estimateTurnCostUsd(
  usage: TurnUsage,
  pricing: ModelPricing,
  transcriptionUsdPerMin: number,
): { realtimeUsd: number; transcriptionUsd: number; totalUsd: number } {
  const realtimeUsd =
    (usage.audioInputTokens * pricing.audioInputPerMTok) / PER_M +
    (usage.cachedAudioInputTokens * pricing.cachedAudioInputPerMTok) / PER_M +
    (usage.audioOutputTokens * pricing.audioOutputPerMTok) / PER_M +
    (usage.textInputTokens * pricing.textInputPerMTok) / PER_M +
    (usage.textOutputTokens * pricing.textOutputPerMTok) / PER_M
  const transcriptionUsd = (usage.transcribedInputSeconds / 60) * transcriptionUsdPerMin
  return { realtimeUsd, transcriptionUsd, totalUsd: realtimeUsd + transcriptionUsd }
}

// ─── Session limits (duration / turns / estimated spend) ─────────────────────

export interface SessionState {
  elapsedMs: number
  turns: number
  estimatedCostUsd: number
  activeMinutes: number
}

export interface SessionLimitStatus {
  timeExceeded: boolean
  turnsExceeded: boolean
  budgetExceeded: boolean
  /** True when any hard limit is hit → the client must auto-disconnect. */
  shouldDisconnect: boolean
  /** Per-active-minute cost alert (does not force disconnect). */
  costAlert: boolean
}

export function evaluateSessionLimits(
  state: SessionState,
  costAlertPerActiveMin: number,
  limits: typeof LAB_LIMITS = LAB_LIMITS,
): SessionLimitStatus {
  const timeExceeded = state.elapsedMs >= limits.sessionMaxMs
  const turnsExceeded = state.turns >= limits.sessionMaxTurns
  const budgetExceeded = state.estimatedCostUsd >= limits.experimentBudgetUsd
  const perActiveMin =
    state.activeMinutes > 0 ? state.estimatedCostUsd / state.activeMinutes : 0
  return {
    timeExceeded,
    turnsExceeded,
    budgetExceeded,
    shouldDisconnect: timeExceeded || turnsExceeded || budgetExceeded,
    costAlert: perActiveMin > costAlertPerActiveMin,
  }
}
