const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"
const OPENAI_MODEL = "gpt-4.1-mini"

export async function askGPT(prompt: string): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY no configurada en variables de entorno")
  }

  console.log("[7F Motor IA] GPT request →", prompt.slice(0, 80), "...")

  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [
        {
          role: "system",
          content:
            "Eres el motor editorial de 7F, una plataforma de gestion empresarial. " +
            "Produces texto claro, profesional y bien estructurado. " +
            "Tu tono es directo pero amable. Responde siempre en español.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
      max_tokens: 2048,
    }),
  })

  if (!res.ok) {
    const errorBody = await res.text()
    console.error("[7F Motor IA] GPT error:", res.status, errorBody)
    throw new Error(`OpenAI API error (${res.status}): ${errorBody}`)
  }

  const json = await res.json()
  const content = json.choices?.[0]?.message?.content?.trim()

  if (!content) {
    throw new Error("GPT devolvio una respuesta vacia")
  }

  console.log("[7F Motor IA] GPT response ✓", content.slice(0, 80), "...")
  return content
}
