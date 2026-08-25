/**
 * Legacy DeepSeek entry point, preserved as a thin delegate over the
 * FOUND-02b execution foundation. The raw fetch (45s timeout, traffic
 * logs, error strings) now lives in `chat-adapter.ts` with identical
 * observable behavior — and no longer discards the provider `usage`.
 */

import { executeAI, NEUTRAL_TASK_SYSTEM_PROMPT } from "./execution"

export { NEUTRAL_TASK_SYSTEM_PROMPT }

export async function askDeepSeek(
  prompt: string,
  systemPrompt: string = NEUTRAL_TASK_SYSTEM_PROMPT,
): Promise<string> {
  const result = await executeAI({
    provider: "deepseek",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: prompt },
    ],
  })
  return result.output
}
