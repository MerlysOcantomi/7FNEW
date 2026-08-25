import { getMode, type AIModeName, VALID_MODES } from "./modes"
import {
  executeAI,
  NEUTRAL_TASK_SYSTEM_PROMPT,
} from "./execution"
import type { AIChatMessage, AIExecutionRequest } from "./execution-contract"

export type AIMode = AIModeName
export { VALID_MODES }

// FOUND-02b: the usage-preserving execution foundation. New AI call sites
// use `executeAI` directly and MUST NOT discard the returned usage
// semantics; `askMotorIA`/`askMotorIAWithHistory` below are thin
// compatibility wrappers that keep the legacy string-only behavior for
// existing callers while routing through the same foundation.
export { executeAI, NEUTRAL_TASK_SYSTEM_PROMPT, resolveProviderForRequest } from "./execution"
export {
  AIExecutionError,
  AI_PROVIDERS,
  AI_EXECUTION_ERROR_CODES,
  type AIChatMessage,
  type AIExecutionAttribution,
  type AIExecutionErrorCode,
  type AIExecutionRequest,
  type AIExecutionResult,
  type AIProviderKey,
  type AIUsage,
} from "./execution-contract"

/**
 * Pure request assembly for the legacy single-prompt entry point. Exact
 * legacy semantics: "operativo" → DeepSeek with the neutral task system
 * prompt and DeepSeek sampling defaults; any other mode → OpenAI with that
 * mode's system prompt, temperature and maxTokens.
 */
export function buildMotorIARequest(prompt: string, mode: AIMode): AIExecutionRequest {
  if (mode === "operativo") {
    return {
      mode,
      messages: [
        { role: "system", content: NEUTRAL_TASK_SYSTEM_PROMPT },
        { role: "user", content: prompt },
      ],
    }
  }
  const modeConfig = getMode(mode)
  return {
    mode,
    messages: [
      { role: "system", content: modeConfig.systemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: modeConfig.temperature,
    maxTokens: modeConfig.maxTokens,
  }
}

export async function askMotorIA(prompt: string, mode: AIMode): Promise<string> {
  const result = await executeAI(buildMotorIARequest(prompt, mode))
  return result.output
}

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

/**
 * Pure request assembly for the legacy history entry point. Preserves the
 * legacy quirks exactly: "operativo" sends ONLY the last user message (with
 * the neutral system prompt); other modes prepend the mode system prompt
 * and drop caller-provided system messages.
 */
export function buildMotorIAHistoryRequest(
  messages: readonly ChatMessage[],
  mode: AIMode,
): AIExecutionRequest {
  if (mode === "operativo") {
    const last = messages.filter((m) => m.role === "user").pop()
    return {
      mode,
      messages: [
        { role: "system", content: NEUTRAL_TASK_SYSTEM_PROMPT },
        { role: "user", content: last?.content ?? "" },
      ],
    }
  }
  const modeConfig = getMode(mode)
  const fullMessages: AIChatMessage[] = [
    { role: "system", content: modeConfig.systemPrompt },
    ...messages.filter((m) => m.role !== "system"),
  ]
  return {
    mode,
    messages: fullMessages,
    temperature: modeConfig.temperature,
    maxTokens: modeConfig.maxTokens,
  }
}

export async function askMotorIAWithHistory(
  messages: ChatMessage[],
  mode: AIMode,
): Promise<string> {
  const result = await executeAI(buildMotorIAHistoryRequest(messages, mode))
  return result.output
}

export {
  promptSugerirPrioridad,
  promptDetectarRiesgos,
  promptGenerarSubtareas,
  promptResumirNotas,
  promptAnalisisProyecto,
  promptDetectarRetrasos,
  promptSiguientesPasos,
  promptResumenCliente,
  promptComunicacionCliente,
  promptAnalisisFinanciero,
  promptDetectarAnomalias,
  promptResumenFacturacion,
  promptExplicarVencimiento,
} from "./prompts"
