/**
 * Voice Lab session accumulator (CORE-VOICE-0B.1.1) — pure, deterministic.
 *
 * Turn counting and cost accumulation are DEDUPLICATED by response id: a
 * duplicate `response.done` never double-counts a turn or its cost. Latency is
 * measured from injected timestamps (no clock here), and channels with no
 * reliable event in 0.3.0 are reported as unavailable rather than approximated.
 */

import type { ModelPricing } from "./config"
import { estimateTurnCostUsd, percentile, type TurnUsage } from "./metrics"

// ─── Turn + cost accumulation ────────────────────────────────────────────────

export class SessionAccumulator {
  private readonly seenResponses = new Set<string>()
  turns = 0
  realtimeCostUsd = 0
  transcriptionCostUsd = 0
  lastTurnCostUsd = 0

  get estimatedCostUsd(): number {
    return this.realtimeCostUsd + this.transcriptionCostUsd
  }

  /**
   * Record a finished response. Returns `false` (and changes nothing) if this
   * response id was already seen — the single source of truth for a turn.
   */
  recordResponseDone(responseId: string, usage: TurnUsage, pricing: ModelPricing): boolean {
    if (!responseId || this.seenResponses.has(responseId)) return false
    this.seenResponses.add(responseId)
    this.turns += 1
    const cost = estimateTurnCostUsd(usage, pricing, 0)
    this.realtimeCostUsd += cost.realtimeUsd
    this.lastTurnCostUsd = cost.realtimeUsd
    return true
  }

  /** Input-transcription cost, kept separate from the realtime cost. */
  recordTranscriptionSeconds(seconds: number, usdPerMin: number): void {
    if (seconds <= 0) return
    this.transcriptionCostUsd += (seconds / 60) * usdPerMin
  }
}

// ─── Latency channels ────────────────────────────────────────────────────────

/**
 * 0.3.0 exposes no reliable "playback actually stopped" event, so the
 * perceived-interruption channel is structurally UNAVAILABLE (never
 * approximated with another signal — adjustment 3).
 */
export const PERCEIVED_INTERRUPTION_AVAILABLE = false as const

export interface LatencySummary {
  available: boolean
  count: number
  p50: number
  p95: number
}

export function summarizeLatency(samples: readonly number[], available: boolean): LatencySummary {
  return {
    available,
    count: samples.length,
    p50: percentile(samples, 50),
    p95: percentile(samples, 95),
  }
}

/**
 * Accumulates latency samples from injected timestamps. Channels:
 *   - modelTtfaMs: end-of-turn (speech_stopped) → first model audio delta
 *   - audibleTtfaMs: end-of-turn → audible playback start (SDK `audio_start`)
 *   - sdkInterruptionMs: barge-in (speech_started) → `audio_interrupted`
 *   - perceivedInterruptionMs: UNAVAILABLE in 0.3.0 (see constant above)
 */
export class LatencyTracker {
  readonly modelTtfaMs: number[] = []
  readonly audibleTtfaMs: number[] = []
  readonly sdkInterruptionMs: number[] = []

  private endOfTurnAt: number | null = null
  private awaitingModelAudio = false
  private awaitingAudible = false
  private bargeInAt: number | null = null

  onEndOfTurn(now: number): void {
    this.endOfTurnAt = now
    this.awaitingModelAudio = true
    this.awaitingAudible = true
  }

  onModelAudioDelta(now: number): void {
    if (this.awaitingModelAudio && this.endOfTurnAt != null) {
      this.modelTtfaMs.push(now - this.endOfTurnAt)
      this.awaitingModelAudio = false
    }
  }

  onAudibleStart(now: number): void {
    if (this.awaitingAudible && this.endOfTurnAt != null) {
      this.audibleTtfaMs.push(now - this.endOfTurnAt)
      this.awaitingAudible = false
    }
  }

  onBargeIn(now: number): void {
    this.bargeInAt = now
  }

  onInterrupted(now: number): void {
    if (this.bargeInAt != null) {
      this.sdkInterruptionMs.push(now - this.bargeInAt)
      this.bargeInAt = null
    }
  }
}
