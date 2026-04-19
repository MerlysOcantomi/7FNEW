const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
const DEEPSEEK_MODEL = "deepseek-reasoner"
const DEEPSEEK_TIMEOUT_MS = 45_000

/**
 * Language-neutral default: output language and format must follow the user message
 * (no imposed locale). Used for `operativo` / inbox intelligence and other DeepSeek tasks.
 */
export const NEUTRAL_TASK_SYSTEM_PROMPT =
  "You are a precise execution layer for business operations. " +
  "Follow the user's instructions exactly. " +
  "Match the response language, format, and constraints specified in the user message. " +
  "Do not impose a reply language unless the instructions require one."

const DEFAULT_SYSTEM_PROMPT = NEUTRAL_TASK_SYSTEM_PROMPT

export async function askDeepSeek(
  prompt: string,
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY is not set in environment variables")
  }

  console.log("[7F Motor IA] DeepSeek request →", prompt.slice(0, 80), "...")

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), DEEPSEEK_TIMEOUT_MS)

  let res: Response
  try {
    res = await fetch(DEEPSEEK_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      }),
      signal: controller.signal,
    })
  } catch (err) {
    clearTimeout(timeout)
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`DeepSeek request timed out after ${DEEPSEEK_TIMEOUT_MS}ms`)
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  if (!res.ok) {
    const errorBody = await res.text()
    console.error("[7F Motor IA] DeepSeek error:", res.status, errorBody)
    throw new Error(`DeepSeek API error (${res.status}): ${errorBody}`)
  }

  const json = await res.json()
  const content = json.choices?.[0]?.message?.content?.trim()

  if (!content) {
    throw new Error("DeepSeek returned an empty response")
  }

  console.log("[7F Motor IA] DeepSeek response ✓", content.slice(0, 80), "...")
  return content
}
