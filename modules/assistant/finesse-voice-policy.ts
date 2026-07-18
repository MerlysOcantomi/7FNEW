/**
 * Ask Finesse voice — entitlement policy, allowlists and cost-limit constants.
 * Pure and DB-free (mirrors `core/vertical-packs` resolvers) so the token
 * route, the client and the tests share ONE source of truth.
 *
 * Rollout model (mission §8/§21): a global feature flag, an optional
 * workspace-id allowlist, the Beauty vertical requirement, and authenticated
 * read access (asserted by the route before consulting this policy). Plan- or
 * credit-based rules are future work: the `plan_not_supported` reason exists
 * in the contract but nothing emits it yet — no invented billing logic.
 * Never gate by user email in product logic.
 */

import { mapVerticalKeyToBusinessType } from "@core/personalization"

// ─── Entitlement ─────────────────────────────────────────────────────────────

export type FinesseVoiceEntitlementReason =
  | "enabled"
  | "feature_disabled"
  | "workspace_not_allowed"
  | "vertical_not_supported"
  | "plan_not_supported"
  | "permission_denied"

export interface FinesseVoiceEntitlement {
  enabled: boolean
  reason: FinesseVoiceEntitlementReason
}

export interface FinesseVoicePolicyInput {
  /** Raw `FINESSE_VOICE_ENABLED` env value; only the string "true" enables. */
  featureFlag: string | undefined
  /**
   * Raw `FINESSE_VOICE_WORKSPACES` env value — optional comma-separated
   * workspace-id allowlist for staged rollout. Empty/absent = every Beauty
   * workspace (flag permitting).
   */
  workspaceAllowlist: string | undefined
  /** Server-resolved active workspace id (never from the browser). */
  workspaceId: string
  /** Server-resolved vertical key (never from the browser). */
  verticalKey: string | null | undefined
  /** The route already asserted authenticated read access. */
  hasReadAccess: boolean
}

/** Parse the CSV allowlist; whitespace-tolerant, empty entries dropped. */
export function parseWorkspaceAllowlist(raw: string | undefined): string[] {
  if (!raw) return []
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

export function resolveFinesseVoiceEntitlement(
  input: FinesseVoicePolicyInput,
): FinesseVoiceEntitlement {
  if (input.featureFlag !== "true") {
    return { enabled: false, reason: "feature_disabled" }
  }
  if (!input.hasReadAccess) {
    return { enabled: false, reason: "permission_denied" }
  }
  if (mapVerticalKeyToBusinessType(input.verticalKey ?? "") !== "beauty") {
    return { enabled: false, reason: "vertical_not_supported" }
  }
  const allowlist = parseWorkspaceAllowlist(input.workspaceAllowlist)
  if (allowlist.length > 0 && !allowlist.includes(input.workspaceId)) {
    return { enabled: false, reason: "workspace_not_allowed" }
  }
  return { enabled: true, reason: "enabled" }
}

// ─── Model / voice allowlists (validated server-side) ────────────────────────

export const FINESSE_VOICE_MODELS = ["gpt-realtime-2.1-mini", "gpt-realtime-2.1"] as const
export type FinesseVoiceModel = (typeof FINESSE_VOICE_MODELS)[number]
/** Cost-conscious production default: the mini realtime model. */
export const DEFAULT_FINESSE_VOICE_MODEL: FinesseVoiceModel = "gpt-realtime-2.1-mini"

export const FINESSE_VOICE_VOICES = ["marin", "cedar"] as const
export type FinesseVoiceVoice = (typeof FINESSE_VOICE_VOICES)[number]
export const DEFAULT_FINESSE_VOICE_VOICE: FinesseVoiceVoice = "marin"

export const FINESSE_TRANSCRIPTION_MODEL = "gpt-4o-mini-transcribe" as const

export type FinesseModelVoiceValidation =
  | { ok: true; model: FinesseVoiceModel; voice: FinesseVoiceVoice }
  | { ok: false }

/**
 * Absent values fall back to defaults; PRESENT but non-allowlisted values are
 * rejected (route answers 400) — never silently replaced (Voice Lab rule).
 */
export function validateFinesseModelVoice(payload: {
  model?: unknown
  voice?: unknown
}): FinesseModelVoiceValidation {
  let model: FinesseVoiceModel = DEFAULT_FINESSE_VOICE_MODEL
  if (payload.model !== undefined && payload.model !== null) {
    if (!(FINESSE_VOICE_MODELS as readonly string[]).includes(payload.model as string)) {
      return { ok: false }
    }
    model = payload.model as FinesseVoiceModel
  }
  let voice: FinesseVoiceVoice = DEFAULT_FINESSE_VOICE_VOICE
  if (payload.voice !== undefined && payload.voice !== null) {
    if (!(FINESSE_VOICE_VOICES as readonly string[]).includes(payload.voice as string)) {
      return { ok: false }
    }
    voice = payload.voice as FinesseVoiceVoice
  }
  return { ok: true, model, voice }
}

// ─── Session / cost limits (central, tested — mission §21) ───────────────────

export const FINESSE_VOICE_LIMITS = {
  /** Ephemeral client-secret TTL — only bounds the time to connect. */
  ephemeralTtlSeconds: 45,
  /** Hard cap on a live voice session. */
  sessionMaxMs: 5 * 60 * 1000,
  /** Auto-stop after this long without any user/assistant speech activity. */
  inactivityMs: 90 * 1000,
  /** Token mints allowed per user+workspace per window. */
  mintMax: 6,
  mintWindowMs: 60 * 1000,
  /** Max characters of prior-conversation summary sent to a voice session. */
  conversationSummaryMaxChars: 600,
} as const

// ─── Token-mint rate limiter (interface + best-effort in-memory impl) ────────

/** Seam for a future durable store (KV/Upstash); pure and clock-injected. */
export interface TokenMintLimiter {
  /** Record a hit; true when the key is now over its window budget. */
  limited(key: string, nowMs: number): boolean
}

/**
 * BEST-EFFORT in-memory limiter: on serverless every instance has its own
 * memory, so this is not a durable global limit (same documented trade-off as
 * the Voice Lab endpoint). Swap via the interface when a shared store lands.
 */
export function createInMemoryMintLimiter(
  { max, windowMs }: { max: number; windowMs: number } = {
    max: FINESSE_VOICE_LIMITS.mintMax,
    windowMs: FINESSE_VOICE_LIMITS.mintWindowMs,
  },
): TokenMintLimiter {
  const hits = new Map<string, number[]>()
  return {
    limited(key: string, nowMs: number): boolean {
      const recent = (hits.get(key) ?? []).filter((t) => nowMs - t < windowMs)
      recent.push(nowMs)
      hits.set(key, recent)
      return recent.length > max
    },
  }
}
