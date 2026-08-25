/**
 * FOUND-02b (AI-02) — Provider adapter for OpenAI-compatible chat
 * completions APIs.
 *
 * One implementation serves both current providers (OpenAI and DeepSeek —
 * they share the request/response shape); each provider is an INSTANCE of
 * this factory, configured externally. The adapter hides endpoint, request
 * shape, usage extraction and error mapping from callers, and preserves the
 * exact observable behavior of the legacy per-vendor fetch wrappers
 * (messages, timeouts, log lines, error strings) so `askMotorIA` callers
 * see no change.
 *
 * Boundaries: no secrets are ever hardcoded (`getApiKey` reads env at call
 * time), no secret can reach an error message, no entitlement/billing
 * knowledge, no multi-provider fallback (later phase). `fetchImpl` is
 * injectable so tests never touch the network.
 */

import {
  AIExecutionError,
  type AIChatMessage,
  type AIProviderKey,
  type AIUsage,
} from "./execution-contract"

export interface ChatAdapterConfig {
  provider: AIProviderKey
  apiUrl: string
  /** Env var name holding the API key — read per call, never stored. */
  apiKeyEnvVar: string
  /** Thrown (verbatim, legacy-compatible) when the env var is missing. */
  missingKeyMessage: string
  defaultModel: string
  /** Human label used in error strings ("OpenAI" / "DeepSeek"). */
  errorLabel: string
  /** Legacy DeepSeek behavior includes the provider body in the message. */
  includeErrorBodyInMessage: boolean
  emptyResponseMessage: string
  /** Abort the request after this many ms (legacy: DeepSeek only). */
  timeoutMs?: number
  /** Legacy DeepSeek behavior logs request/response previews. */
  logTraffic?: boolean
  fetchImpl?: typeof fetch
}

export interface ChatAdapterInput {
  messages: readonly AIChatMessage[]
  model?: string
  temperature: number
  maxTokens: number
}

export interface ChatAdapterOutput {
  content: string
  model: string
  usage: AIUsage
  latencyMs: number
  providerRequestId?: string
  finishReason?: string
}

export interface AIProviderAdapter {
  readonly provider: AIProviderKey
  execute(input: ChatAdapterInput): Promise<ChatAdapterOutput>
}

function asCount(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined
}

/**
 * Map an OpenAI-compatible `usage` object to the normalized contract.
 * Only numbers the provider actually reported are carried; a completely
 * missing usage object becomes an explicit `unavailable`.
 */
export function normalizeChatUsage(rawUsage: unknown): AIUsage {
  if (!rawUsage || typeof rawUsage !== "object") {
    return { status: "unavailable", requestCount: 1 }
  }
  const usage = rawUsage as Record<string, unknown>
  const promptDetails = (usage.prompt_tokens_details ?? {}) as Record<string, unknown>
  const completionDetails = (usage.completion_tokens_details ?? {}) as Record<string, unknown>
  return {
    status: "reported",
    inputTokens: asCount(usage.prompt_tokens),
    outputTokens: asCount(usage.completion_tokens),
    totalTokens: asCount(usage.total_tokens),
    cachedInputTokens: asCount(promptDetails.cached_tokens),
    reasoningTokens: asCount(completionDetails.reasoning_tokens),
    requestCount: 1,
  }
}

export function createChatCompletionsAdapter(config: ChatAdapterConfig): AIProviderAdapter {
  const fetchImpl = config.fetchImpl ?? fetch

  return {
    provider: config.provider,

    async execute(input: ChatAdapterInput): Promise<ChatAdapterOutput> {
      const apiKey = process.env[config.apiKeyEnvVar]
      if (!apiKey) {
        throw new AIExecutionError({
          code: "provider_unavailable",
          provider: config.provider,
          message: config.missingKeyMessage,
        })
      }

      const model = input.model ?? config.defaultModel

      if (config.logTraffic) {
        const lastUser = [...input.messages].reverse().find((m) => m.role === "user")
        console.log(
          `[7F Motor IA] ${config.errorLabel} request →`,
          (lastUser?.content ?? "").slice(0, 80),
          "...",
        )
      }

      const controller = config.timeoutMs ? new AbortController() : null
      const timeout = controller
        ? setTimeout(() => controller.abort(), config.timeoutMs)
        : null

      const startedAt = Date.now()
      let res: Response
      try {
        res = await fetchImpl(config.apiUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            messages: input.messages,
            temperature: input.temperature,
            max_tokens: input.maxTokens,
          }),
          ...(controller ? { signal: controller.signal } : {}),
        })
      } catch (err) {
        if (timeout) clearTimeout(timeout)
        if (err instanceof Error && err.name === "AbortError") {
          throw new AIExecutionError({
            code: "provider_unavailable",
            provider: config.provider,
            message: `${config.errorLabel} request timed out after ${config.timeoutMs}ms`,
          })
        }
        throw new AIExecutionError({
          code: "provider_unavailable",
          provider: config.provider,
          message: `${config.errorLabel} request failed: ${err instanceof Error ? err.message : "network error"}`,
        })
      } finally {
        if (timeout) clearTimeout(timeout)
      }

      if (!res.ok) {
        const body = await res.text()
        console.error(`[7F Motor IA] ${config.errorLabel} error:`, res.status, body)
        const detail = config.includeErrorBodyInMessage ? `: ${body}` : ""
        throw new AIExecutionError({
          code: res.status === 429 ? "provider_rate_limited" : "provider_error",
          provider: config.provider,
          status: res.status,
          message: `${config.errorLabel} API error (${res.status})${detail}`,
        })
      }

      const json = (await res.json()) as {
        model?: unknown
        usage?: unknown
        choices?: Array<{
          message?: { content?: unknown }
          finish_reason?: unknown
        }>
      }
      const latencyMs = Date.now() - startedAt

      const choice = json.choices?.[0]
      const content =
        typeof choice?.message?.content === "string" ? choice.message.content.trim() : ""
      if (!content) {
        throw new AIExecutionError({
          code: "invalid_output",
          provider: config.provider,
          message: config.emptyResponseMessage,
        })
      }

      if (config.logTraffic) {
        console.log(`[7F Motor IA] ${config.errorLabel} response ✓`, content.slice(0, 80), "...")
      }

      const requestId = res.headers?.get?.("x-request-id") ?? undefined

      return {
        content,
        model: typeof json.model === "string" && json.model ? json.model : model,
        usage: normalizeChatUsage(json.usage),
        latencyMs,
        providerRequestId: requestId || undefined,
        finishReason:
          typeof choice?.finish_reason === "string" ? choice.finish_reason : undefined,
      }
    },
  }
}
