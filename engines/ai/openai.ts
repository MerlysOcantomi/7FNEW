/**
 * Legacy OpenAI entry points, preserved as thin delegates over the
 * FOUND-02b execution foundation (`execution.ts` + `chat-adapter.ts`).
 * The duplicated raw fetch that used to live here — and silently discarded
 * the provider `usage` object — is gone; signatures and observable behavior
 * (defaults, error strings) are unchanged for existing callers.
 */

import { executeAI } from "./execution"

interface ChatMessage {
  role: "system" | "user" | "assistant"
  content: string
}

interface OpenAIOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  systemPrompt?: string
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: OpenAIOptions = {},
): Promise<string> {
  const result = await executeAI({
    provider: "openai",
    messages,
    model: options.model,
    temperature: options.temperature,
    maxTokens: options.maxTokens,
  })
  return result.output
}

export async function askWithMode(
  prompt: string,
  systemPrompt: string,
  options: OpenAIOptions = {},
): Promise<string> {
  return chatCompletion(
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
    options,
  )
}
