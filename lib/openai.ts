const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
const DEFAULT_MODEL = "gpt-4.1"

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

function getApiKey(): string {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error("OPENAI_API_KEY no configurada")
  return key
}

export async function chatCompletion(
  messages: ChatMessage[],
  options: OpenAIOptions = {},
): Promise<string> {
  const {
    model = DEFAULT_MODEL,
    temperature = 0.7,
    maxTokens = 4096,
  } = options

  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    console.error("[OpenAI] Error:", res.status, body)
    throw new Error(`OpenAI API error (${res.status})`)
  }

  const json = await res.json()
  const content = json.choices?.[0]?.message?.content?.trim()
  if (!content) throw new Error("OpenAI devolvio respuesta vacia")

  return content
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
