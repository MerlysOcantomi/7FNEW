const DEEPSEEK_API_URL = "https://api.deepseek.com/v1/chat/completions"
const DEEPSEEK_MODEL = "deepseek-reasoner"

const DEFAULT_SYSTEM_PROMPT =
  "Eres el motor operativo de 7F, una plataforma de gestion empresarial. " +
  "Respondes con analisis claros, logicos y accionables. " +
  "Usas formato estructurado cuando es util. Responde siempre en español."

export async function askDeepSeek(
  prompt: string,
  systemPrompt: string = DEFAULT_SYSTEM_PROMPT,
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey) {
    throw new Error("DEEPSEEK_API_KEY no configurada en variables de entorno")
  }

  console.log("[7F Motor IA] DeepSeek request →", prompt.slice(0, 80), "...")

  const res = await fetch(DEEPSEEK_API_URL, {
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
  })

  if (!res.ok) {
    const errorBody = await res.text()
    console.error("[7F Motor IA] DeepSeek error:", res.status, errorBody)
    throw new Error(`DeepSeek API error (${res.status}): ${errorBody}`)
  }

  const json = await res.json()
  const content = json.choices?.[0]?.message?.content?.trim()

  if (!content) {
    throw new Error("DeepSeek devolvio una respuesta vacia")
  }

  console.log("[7F Motor IA] DeepSeek response ✓", content.slice(0, 80), "...")
  return content
}
