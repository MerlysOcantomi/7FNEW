import { askDeepSeek } from "./deepseek"
import { askWithMode, chatCompletion } from "./openai"
import { getMode, type AIModeName, VALID_MODES } from "./modes"

export type AIMode = AIModeName
export { VALID_MODES }

export async function askMotorIA(prompt: string, mode: AIMode): Promise<string> {
  if (mode === "operativo") {
    return askDeepSeek(prompt)
  }

  const modeConfig = getMode(mode)
  return askWithMode(prompt, modeConfig.systemPrompt, {
    temperature: modeConfig.temperature,
    maxTokens: modeConfig.maxTokens,
  })
}

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

export async function askMotorIAWithHistory(
  messages: ChatMessage[],
  mode: AIMode,
): Promise<string> {
  if (mode === "operativo") {
    const last = messages.filter((m) => m.role === "user").pop()
    return askDeepSeek(last?.content ?? "")
  }

  const modeConfig = getMode(mode)
  const fullMessages: ChatMessage[] = [
    { role: "system", content: modeConfig.systemPrompt },
    ...messages.filter((m) => m.role !== "system"),
  ]

  return chatCompletion(fullMessages, {
    temperature: modeConfig.temperature,
    maxTokens: modeConfig.maxTokens,
  })
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
