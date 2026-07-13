/**
 * Voice Lab event parsing (CORE-VOICE-0B.1.1) — defensive, pure.
 *
 * Parses the RAW transport events emitted by @openai/agents@0.3.0 into a small
 * normalized union. The payload shapes are read defensively (every field is
 * optional / type-guarded) because we must not assume a newer version's shape —
 * the event `type` strings below were verified against 0.3.0's type defs, and
 * fixtures in the tests pin the expected payloads.
 *
 * We deliberately do NOT forward whole raw events anywhere they could be logged:
 * only the extracted, non-sensitive fields (token counts, item ids, statuses,
 * and — for on-screen transcript — text) leave this module.
 */

import type { TurnUsage } from "./metrics"
import type { TranscriptStatus } from "./transcript"

export type LabEvent =
  | { kind: "user_speech_started" }
  | { kind: "user_speech_stopped" }
  | { kind: "model_audio_delta" }
  | { kind: "response_done"; responseId: string; usage: TurnUsage }
  | { kind: "input_transcript"; itemId: string; text: string; status: TranscriptStatus }
  | { kind: "output_transcript"; itemId: string; text: string; status: TranscriptStatus }
  | { kind: "transcription_seconds"; seconds: number }

function rec(v: unknown): Record<string, unknown> {
  return typeof v === "object" && v !== null ? (v as Record<string, unknown>) : {}
}
function str(v: unknown): string {
  return typeof v === "string" ? v : ""
}
function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0
}

/** The transport event's `type`, tolerating a possible `{ event: {...} }` wrap. */
function eventType(raw: unknown): { type: string; body: Record<string, unknown> } {
  const r = rec(raw)
  if (typeof r.type === "string") return { type: r.type, body: r }
  const inner = rec(r.event)
  if (typeof inner.type === "string") return { type: inner.type, body: inner }
  return { type: "", body: r }
}

/**
 * Convert a Realtime `response.usage` object to `TurnUsage`. `audioInputTokens`
 * is the NON-cached portion (audio_tokens − cached_tokens) so cached tokens are
 * not billed twice against the flagship rate.
 */
export function toTurnUsage(usage: unknown): TurnUsage {
  const u = rec(usage)
  const inD = rec(u.input_token_details)
  const outD = rec(u.output_token_details)
  const audioIn = num(inD.audio_tokens)
  const cached = num(inD.cached_tokens)
  return {
    audioInputTokens: Math.max(0, audioIn - cached),
    cachedAudioInputTokens: cached,
    audioOutputTokens: num(outD.audio_tokens),
    textInputTokens: num(inD.text_tokens),
    textOutputTokens: num(outD.text_tokens),
    transcribedInputSeconds: 0,
  }
}

/** Extract transcription seconds from a completed input-transcription event, if billed by duration. */
function transcriptionSeconds(usage: unknown): number {
  const u = rec(usage)
  // Duration-billed variant exposes `seconds`; token-billed variants do not.
  return num(u.seconds)
}

/** Parse one raw transport event into 0..n normalized `LabEvent`s. */
export function parseLabEvent(raw: unknown): LabEvent[] {
  const { type, body } = eventType(raw)
  switch (type) {
    case "input_audio_buffer.speech_started":
      return [{ kind: "user_speech_started" }]
    case "input_audio_buffer.speech_stopped":
      return [{ kind: "user_speech_stopped" }]
    case "response.output_audio.delta":
      return [{ kind: "model_audio_delta" }]
    case "response.done": {
      const response = rec(body.response)
      const responseId = str(response.id)
      if (!responseId) return []
      return [{ kind: "response_done", responseId, usage: toTurnUsage(response.usage) }]
    }
    case "conversation.item.input_audio_transcription.delta":
      return [
        { kind: "input_transcript", itemId: str(body.item_id), text: str(body.delta), status: "partial" },
      ]
    case "conversation.item.input_audio_transcription.completed": {
      const out: LabEvent[] = [
        { kind: "input_transcript", itemId: str(body.item_id), text: str(body.transcript), status: "final" },
      ]
      const seconds = transcriptionSeconds(body.usage)
      if (seconds > 0) out.push({ kind: "transcription_seconds", seconds })
      return out
    }
    case "conversation.item.input_audio_transcription.failed":
      return [
        { kind: "input_transcript", itemId: str(body.item_id), text: "", status: "unavailable" },
      ]
    case "response.output_audio_transcript.delta":
      return [
        { kind: "output_transcript", itemId: str(body.item_id), text: str(body.delta), status: "partial" },
      ]
    case "response.output_audio_transcript.done":
      return [
        { kind: "output_transcript", itemId: str(body.item_id), text: str(body.transcript), status: "final" },
      ]
    default:
      return []
  }
}
