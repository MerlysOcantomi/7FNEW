/**
 * FOUND-02b (AI-01/AI-03) — Shared AI execution contract.
 *
 * Provider-agnostic request/result types for model execution. Pure types +
 * one error class: no SDK, no fetch, no secrets, no React, no DB. This is
 * the contract ARCH-03 §13 mandates: the execution layer ALWAYS returns
 * normalized usage when the provider reports it, and represents missing
 * usage explicitly — never as silent zeros.
 *
 * Not in this contract (later phases): tool execution, capability
 * enforcement, streaming, cost calculation, usage persistence. The
 * attribution fields exist so the future Usage Meter can attach as a sink
 * without redesign (ARCH-03 §14).
 */

import type { ActivityKey } from "@core/platform/activities"
import type { CapabilityKey } from "@core/platform/capabilities"
import type { ProductKey } from "@core/platform/products"

/** Providers the foundation knows today. Extend by appending. */
export const AI_PROVIDERS = ["openai", "deepseek"] as const
export type AIProviderKey = (typeof AI_PROVIDERS)[number]

export interface AIChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

/**
 * Where this execution should be attributed (ARCH-02 §9 / FOUND-01 keys).
 * All optional today — legacy callers cannot always know them — but new
 * call sites should provide `workspaceId` and `activity` whenever possible.
 * No parallel namespace: keys come from `core/platform`.
 */
export interface AIExecutionAttribution {
  workspaceId?: string
  product?: ProductKey
  capability?: CapabilityKey
  /** Canonical tool key when the execution serves a platform tool. */
  tool?: string
  experience?: string
}

export interface AIExecutionRequest {
  /** Messages sent verbatim to the provider — callers assemble prompts. */
  messages: readonly AIChatMessage[]
  /**
   * Existing mode policy (`engines/ai/modes.ts`): selects provider and
   * sampling defaults exactly as `askMotorIA` always has ("operativo" →
   * DeepSeek, otherwise OpenAI). Provider/model stay separate from
   * business capability/activity (ARCH-03 §12).
   */
  mode?: string
  /** Explicit provider override (wins over mode routing). */
  provider?: AIProviderKey
  /** Explicit model override (otherwise the provider's default). */
  model?: string
  temperature?: number
  maxTokens?: number
  /** Canonical usage-attribution key for this execution, when known. */
  activity?: ActivityKey
  attribution?: AIExecutionAttribution
  requestMetadata?: {
    requestId?: string
    /** Free-form caller label for diagnostics (e.g. "inbox.short-intent"). */
    caller?: string
  }
}

/**
 * Normalized usage. `reported` carries only the numbers the provider
 * actually returned — a missing number stays `undefined`, NEVER 0, because
 * absent and zero mean different things to the future Usage Meter.
 * `unavailable` is the explicit representation of "the provider gave us
 * nothing" (the legacy paths silently discarded even that distinction).
 * Future units (audio durations, image units) extend this shape additively.
 */
export type AIUsage =
  | {
      status: "reported"
      inputTokens?: number
      outputTokens?: number
      totalTokens?: number
      cachedInputTokens?: number
      reasoningTokens?: number
      requestCount: number
    }
  | { status: "unavailable"; requestCount: number }

export interface AIExecutionResult<T = string> {
  output: T
  provider: AIProviderKey
  /** The model that actually served the request (provider echo preferred). */
  model: string
  usage: AIUsage
  latencyMs: number
  /** Provider request id when safely available (response header). */
  providerRequestId?: string
  finishReason?: string
  /** Echoed for downstream sinks; never used for authorization. */
  activity?: ActivityKey
  attribution?: AIExecutionAttribution
}

export const AI_EXECUTION_ERROR_CODES = [
  "provider_unavailable",
  "provider_rate_limited",
  "provider_error",
  "invalid_output",
] as const
export type AIExecutionErrorCode = (typeof AI_EXECUTION_ERROR_CODES)[number]

/**
 * Normalized execution failure. `message` must never contain API keys or
 * auth headers; provider response bodies are included only where the legacy
 * behavior already did (DeepSeek) — status codes otherwise. Extends `Error`
 * so every existing generic `catch` keeps working unchanged.
 */
export class AIExecutionError extends Error {
  readonly code: AIExecutionErrorCode
  readonly provider: AIProviderKey
  readonly status?: number

  constructor(input: {
    code: AIExecutionErrorCode
    provider: AIProviderKey
    message: string
    status?: number
  }) {
    super(input.message)
    this.name = "AIExecutionError"
    this.code = input.code
    this.provider = input.provider
    this.status = input.status
  }
}
