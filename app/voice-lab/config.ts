/**
 * Voice Lab configuration — allowlists, session limits and a pricing table.
 *
 * CORE-VOICE-0B.1: this is an ISOLATED technical spike. Nothing here is wired
 * into the product. Pure data + pure guards (no I/O, no SDK), so it is shared by
 * the client, the token endpoint and tests.
 */

// ─── Identity (7F is the product interface; Finesse is the product, not a persona) ──

/** Agent name — 7F, never "Finesse". */
export const LAB_AGENT_NAME = "7F Voice Lab"
/** On-screen speaker label for assistant turns. */
export const LAB_SPEAKER_LABEL = "7F"

// ─── Model allowlist (validated server-side; the browser cannot pick others) ──

export const LAB_MODELS = ["gpt-realtime-2.1", "gpt-realtime-2.1-mini"] as const
export type LabModel = (typeof LAB_MODELS)[number]
export const DEFAULT_LAB_MODEL: LabModel = "gpt-realtime-2.1"

export function isLabModel(value: unknown): value is LabModel {
  return typeof value === "string" && (LAB_MODELS as readonly string[]).includes(value)
}
/** Resolve a client-supplied model to an allowlisted one, or `null` if invalid. */
export function resolveLabModel(value: unknown): LabModel | null {
  return isLabModel(value) ? value : null
}

// ─── Voice allowlist (any configurable voice is also allowlisted) ─────────────

export const LAB_VOICES = ["marin", "cedar", "alloy"] as const
export type LabVoice = (typeof LAB_VOICES)[number]
export const DEFAULT_LAB_VOICE: LabVoice = "marin"

export function isLabVoice(value: unknown): value is LabVoice {
  return typeof value === "string" && (LAB_VOICES as readonly string[]).includes(value)
}
export function resolveLabVoice(value: unknown): LabVoice | null {
  return isLabVoice(value) ? value : null
}

/**
 * Validate a client-supplied model/voice. ABSENT values fall back to the
 * defaults; values that are PRESENT but not allowlisted are rejected (the
 * endpoint answers 400) instead of being silently replaced with a default.
 */
export type ModelVoiceValidation =
  | { ok: true; model: LabModel; voice: LabVoice }
  | { ok: false }

export function validateModelVoice(payload: {
  model?: unknown
  voice?: unknown
}): ModelVoiceValidation {
  let model: LabModel = DEFAULT_LAB_MODEL
  if (payload.model !== undefined && payload.model !== null) {
    const resolved = resolveLabModel(payload.model)
    if (!resolved) return { ok: false }
    model = resolved
  }

  let voice: LabVoice = DEFAULT_LAB_VOICE
  if (payload.voice !== undefined && payload.voice !== null) {
    const resolved = resolveLabVoice(payload.voice)
    if (!resolved) return { ok: false }
    voice = resolved
  }

  return { ok: true, model, voice }
}

// ─── Input-audio transcription (explicitly configured) ────────────────────────

/** First-choice input transcription model (see adjustment 4). */
export const LAB_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe" as const
export type LabTranscriptionModel = typeof LAB_TRANSCRIPTION_MODEL

// ─── Session limits (the ephemeral TTL does NOT bound a live session) ─────────

export const LAB_LIMITS = {
  /** Ephemeral client-secret TTL (30–60 s). Only bounds the time to connect. */
  ephemeralTtlSeconds: 45,
  /** Hard cap on a live lab session. */
  sessionMaxMs: 5 * 60 * 1000,
  /** Initial cap on conversational turns. */
  sessionMaxTurns: 20,
  /** Operational budget for the whole experiment (NOT a client-guaranteed cap). */
  experimentBudgetUsd: 25,
} as const

// ─── Pricing table (USD per 1M tokens unless noted) ───────────────────────────
//
// Audio-token encoding is duration-based: user 1 token / 100 ms, assistant
// 1 token / 50 ms. Audio in/out figures are the published flagship/mini numbers;
// text/cached/transcription values are ESTIMATES to confirm against the live
// pricing page during the spike — the arithmetic in `metrics.ts` is what tests
// assert, never these constants.

export interface ModelPricing {
  audioInputPerMTok: number
  audioOutputPerMTok: number
  cachedAudioInputPerMTok: number
  textInputPerMTok: number
  textOutputPerMTok: number
}

export const LAB_PRICING: Record<LabModel, ModelPricing> = {
  "gpt-realtime-2.1": {
    audioInputPerMTok: 32,
    audioOutputPerMTok: 64,
    cachedAudioInputPerMTok: 0.4,
    textInputPerMTok: 4, // estimate — confirm
    textOutputPerMTok: 16, // estimate — confirm
  },
  "gpt-realtime-2.1-mini": {
    audioInputPerMTok: 10,
    audioOutputPerMTok: 20,
    cachedAudioInputPerMTok: 0.3,
    textInputPerMTok: 0.6, // estimate — confirm
    textOutputPerMTok: 2.4, // estimate — confirm
  },
}

/** Input-transcription cost, USD per minute of transcribed audio (estimate). */
export const LAB_TRANSCRIPTION_USD_PER_MIN = 0.003 // estimate — confirm

/** Per-model alert thresholds (USD per active minute) for the budget guard. */
export const LAB_COST_ALERT_PER_ACTIVE_MIN: Record<LabModel, number> = {
  "gpt-realtime-2.1": 0.15,
  "gpt-realtime-2.1-mini": 0.06,
}
