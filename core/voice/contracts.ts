/**
 * CORE-VOICE-0A — Governed voice contracts.
 *
 * Pure TypeScript: frozen enums + interfaces only. No runtime side effects, no
 * I/O, no OpenAI SDK, no React, no `@core/db`. Safe on client, server and in
 * tests. These contracts are shared by BOTH voice routes — the Realtime
 * (speech-to-speech) path and the controlled/chained pipeline — so the payloads
 * never drift between them.
 *
 * Governance rules encoded here:
 *   - A transcript describes ONLY what was spoken/transcribed. Where a 7F
 *     ANSWER's knowledge comes from is a separate concern (`KnowledgeProvenance`
 *     / `ResponseMetadata`) attached to assistant turns, never to transcripts.
 *   - A tool's `effect` spans read · navigate · draft · propose · write, and its
 *     execution policy (immediate · controlled · confirmation_required) governs
 *     whether it may run inline or must go through the controlled pipeline +
 *     confirmation. The mapping lives in `routing.ts` (pure).
 *   - The ephemeral OpenAI credential is NEVER trusted to carry the tenant.
 *     `VoiceSessionBinding` is the server-authoritative mapping 7F holds and
 *     re-validates on every tool call.
 */

/** BCP-47 language tag, e.g. "es-ES", "de-DE" (Hochdeutsch), "de-CH". */
export type BCP47 = string

/**
 * JSON-serializable value types. These are a COMPILE-TIME guard so payloads
 * that cross the client/server boundary (tool args, tool parameter schemas)
 * cannot statically hold functions, class instances, `Date`, `Map`, `Set`,
 * `undefined`, etc. They do NOT replace the runtime validation still required at
 * every trust boundary (a later concern — not implemented here, no validator
 * dependency added).
 */
export type JsonPrimitive = string | number | boolean | null
export type JsonObject = { [key: string]: JsonValue }
export type JsonValue = JsonPrimitive | JsonValue[] | JsonObject

// ─── Session states (adjustment 2 — at least these seven) ────────────────────

export const VOICE_STATES = [
  "idle",
  "connecting",
  "listening",
  "thinking",
  "speaking",
  "interrupted",
  "error",
] as const
export type VoiceState = (typeof VOICE_STATES)[number]

export interface VoiceError {
  code: string
  message: string
}

export interface VoiceStatus {
  state: VoiceState
  /** ISO 8601 timestamp of the last transition. */
  since: string
  /** Present only when `state === "error"`. */
  error?: VoiceError
}

// ─── Transcript (only what was spoken/transcribed — adjustment 1) ────────────

export const TRANSCRIPT_STATUSES = ["partial", "final", "unavailable"] as const
export type TranscriptStatus = (typeof TRANSCRIPT_STATUSES)[number]

/**
 * One transcribed slice of speech. `text` may be incomplete while
 * `status === "partial"`; the final experience shows audio + text, but the text
 * is NOT required to be final from the start of a turn. There is deliberately no
 * knowledge-provenance field here — see `ResponseMetadata`.
 */
export interface TranscriptSegment {
  turnId: string
  text: string
  status: TranscriptStatus
  /** Present only when `status === "unavailable"`. */
  error?: VoiceError
  /** ISO 8601 timestamp. */
  ts: string
}

// ─── Knowledge provenance (attached to 7F ANSWERS, not to transcripts) ───────

export const KNOWLEDGE_PROVENANCE = [
  "workspace_data",
  "known",
  "inferred",
  "researched",
] as const
export type KnowledgeProvenance = (typeof KNOWLEDGE_PROVENANCE)[number]

/**
 * Honesty metadata for a 7F answer/assertion. Kept separate from the transcript
 * so the spoken/written words and the *provenance of the claims* never conflate.
 */
export interface ResponseMetadata {
  /** Where the claims in this answer come from. */
  provenance: KnowledgeProvenance
  /** When `provenance === "researched"`: the research source (e.g. "fathom"). */
  researchSource?: string
  /** True when the answer asserts current/external facts (freshness honesty). */
  assertsCurrentFacts?: boolean
}

/** Alias kept for call sites that read "voice answer metadata". */
export type VoiceAnswerMetadata = ResponseMetadata

// ─── Turns ───────────────────────────────────────────────────────────────────

export const VOICE_ROUTES = ["realtime", "controlled"] as const
export type VoiceRoute = (typeof VOICE_ROUTES)[number]

export type VoiceTurnRole = "user" | "assistant"
export type VoiceTurnStatus = "in_progress" | "final" | "interrupted" | "error"

export interface VoiceTurn {
  id: string
  role: VoiceTurnRole
  /** Audio and text coexist; text may arrive partial (see `TranscriptSegment`). */
  hasAudio: boolean
  source: VoiceRoute
  lang: { input?: BCP47; output?: BCP47 }
  status: VoiceTurnStatus
  startedAt: string
  completedAt?: string
  /** Only assistant turns carry answer/provenance metadata. */
  meta?: ResponseMetadata
}

// ─── Tools (adjustment 3 — five effects, three execution policies) ───────────

export const TOOL_EFFECTS = ["read", "navigate", "draft", "propose", "write"] as const
export type ToolEffect = (typeof TOOL_EFFECTS)[number]

export const TOOL_EXECUTION_POLICIES = [
  "immediate",
  "controlled",
  "confirmation_required",
] as const
export type ToolExecutionPolicy = (typeof TOOL_EXECUTION_POLICIES)[number]

export interface VoiceToolDef {
  name: string
  description: string
  /** JSON-Schema for the tool's parameters — a plain JSON object (serializable). */
  parameters: JsonObject
  effect: ToolEffect
  /**
   * Execution policy. Derivable from `effect` via `resolveToolExecution` in
   * `routing.ts`; stored on the def so a tool can be inspected without the
   * resolver and so a future tool may override the default mapping explicitly.
   */
  execution: ToolExecutionPolicy
}

// ─── Language (three separate axes) ──────────────────────────────────────────

export interface VoiceLocaleConfig {
  /** Interface language (existing i18n) — independent of the spoken axes. */
  uiLocale: string
  /** Spoken input language, e.g. "es-ES", "de-CH" (Schweizerdeutsch understood). */
  inputSpeech: BCP47
  /** Spoken output language, e.g. "de-DE" (Hochdeutsch) for a de-CH input. */
  outputSpeech: BCP47
}

// ─── Multi-tenant session binding (security contract — 0A defines the shape) ──

/**
 * Server-authoritative association between an OpenAI Realtime session and the 7F
 * tenant. The ephemeral OpenAI credential NEVER carries this as trusted metadata:
 * 7F owns the mapping and re-validates workspace, permissions and arguments on
 * every server-side tool call. `safetyId` is an anonymized OpenAI safety
 * identifier (a stable hash), never PII, never the raw email/userId.
 */
export interface VoiceSessionBinding {
  sessionId: string
  userId: string
  workspaceId: string
  safetyId: string
  createdAt: string
  expiresAt: string
}
