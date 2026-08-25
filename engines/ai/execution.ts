/**
 * FOUND-02b (AI-01/AI-03) — Shared execution entry point.
 *
 * `executeAI()` is the usage-preserving way to run a model call. It routes
 * to a provider adapter (mode policy preserved from `askMotorIA`:
 * "operativo" → DeepSeek, otherwise OpenAI; explicit `provider`/`model`
 * override wins), executes, and returns the normalized
 * `AIExecutionResult<string>` — output, provider, model actually used,
 * usage (or explicit `unavailable`), latency and attribution echo.
 *
 * STRATEGIC RULE (ARCH-03 §25): no new AI path after FOUND-02b may discard
 * usage — new call sites call `executeAI` directly. Legacy callers keep
 * using `askMotorIA` (now a thin wrapper over this function) and migrate
 * incrementally.
 *
 * Not here (later phases): tool execution, capability enforcement,
 * streaming, provider fallback, usage persistence.
 */

import {
  createChatCompletionsAdapter,
  type AIProviderAdapter,
} from "./chat-adapter"
import type {
  AIExecutionRequest,
  AIExecutionResult,
  AIProviderKey,
} from "./execution-contract"

/**
 * Language-neutral default system prompt for `operativo` executions
 * (moved verbatim from the legacy `deepseek.ts`; re-exported there).
 */
export const NEUTRAL_TASK_SYSTEM_PROMPT =
  "You are a precise execution layer for business operations. " +
  "Follow the user's instructions exactly. " +
  "Match the response language, format, and constraints specified in the user message. " +
  "Do not impose a reply language unless the instructions require one."

const OPENAI_DEFAULTS = { temperature: 0.7, maxTokens: 4096 }
const DEEPSEEK_DEFAULTS = { temperature: 0.3, maxTokens: 2048 }

function buildAdapters(fetchImpl?: typeof fetch): Record<AIProviderKey, AIProviderAdapter> {
  return {
    openai: createChatCompletionsAdapter({
      provider: "openai",
      apiUrl: "https://api.openai.com/v1/chat/completions",
      apiKeyEnvVar: "OPENAI_API_KEY",
      missingKeyMessage: "OPENAI_API_KEY no configurada",
      defaultModel: "gpt-4.1",
      errorLabel: "OpenAI",
      includeErrorBodyInMessage: false,
      emptyResponseMessage: "OpenAI devolvio respuesta vacia",
      fetchImpl,
    }),
    deepseek: createChatCompletionsAdapter({
      provider: "deepseek",
      apiUrl: "https://api.deepseek.com/v1/chat/completions",
      apiKeyEnvVar: "DEEPSEEK_API_KEY",
      missingKeyMessage: "DEEPSEEK_API_KEY is not set in environment variables",
      defaultModel: "deepseek-reasoner",
      errorLabel: "DeepSeek",
      includeErrorBodyInMessage: true,
      emptyResponseMessage: "DeepSeek returned an empty response",
      timeoutMs: 45_000,
      logTraffic: true,
      fetchImpl,
    }),
  }
}

const DEFAULT_ADAPTERS = buildAdapters()

/** Mode → provider policy, preserved exactly from the legacy `askMotorIA`. */
export function resolveProviderForRequest(request: AIExecutionRequest): AIProviderKey {
  if (request.provider) return request.provider
  return request.mode === "operativo" ? "deepseek" : "openai"
}

/**
 * Execute a model call and return the normalized, usage-preserving result.
 * `deps.fetchImpl` exists for tests only — production callers omit it.
 */
export async function executeAI(
  request: AIExecutionRequest,
  deps?: { fetchImpl?: typeof fetch },
): Promise<AIExecutionResult<string>> {
  const provider = resolveProviderForRequest(request)
  const adapters = deps?.fetchImpl ? buildAdapters(deps.fetchImpl) : DEFAULT_ADAPTERS
  const adapter = adapters[provider]
  const defaults = provider === "deepseek" ? DEEPSEEK_DEFAULTS : OPENAI_DEFAULTS

  const executed = await adapter.execute({
    messages: request.messages,
    model: request.model,
    temperature: request.temperature ?? defaults.temperature,
    maxTokens: request.maxTokens ?? defaults.maxTokens,
  })

  return {
    output: executed.content,
    provider,
    model: executed.model,
    usage: executed.usage,
    latencyMs: executed.latencyMs,
    providerRequestId: executed.providerRequestId,
    finishReason: executed.finishReason,
    activity: request.activity,
    attribution: request.attribution,
  }
}
