/**
 * DALL-E 3 image generation + Vercel Blob upload.
 */

import { uploadToStorage } from "@/lib/storage"

const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations"

type ImageSize = "1024x1024" | "1792x1024" | "1024x1792"
type ImageStyle = "vivid" | "natural"

interface GenerateResult {
  success: boolean
  imageUrl?: string
  storagePath?: string
  prompt?: string
  error?: string
  data?: any
}

export async function generateImage(
  prompt: string,
  size: ImageSize = "1024x1024",
  style: ImageStyle = "natural",
): Promise<GenerateResult> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return { success: false, error: "OPENAI_API_KEY no configurada" }

  try {
    const res = await fetch(OPENAI_IMAGES_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt,
        n: 1,
        size,
        style,
        response_format: "url",
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      console.error("[DALL-E] Error:", res.status, body)

      if (res.status === 400 && body.includes("content_policy")) {
        return { success: false, error: "El prompt fue rechazado por politicas de contenido. Intenta con otro enfoque." }
      }
      if (res.status === 429) {
        return { success: false, error: "Limite de generacion de imagenes alcanzado. Intenta en unos minutos." }
      }

      return { success: false, error: `Error de DALL-E (${res.status})` }
    }

    const json = await res.json()
    const imageUrl = json.data?.[0]?.url
    const revisedPrompt = json.data?.[0]?.revised_prompt

    if (!imageUrl) return { success: false, error: "DALL-E no devolvio una imagen" }

    let finalUrl = imageUrl
    let storagePath: string | undefined

    try {
      const imageRes = await fetch(imageUrl)
      if (imageRes.ok) {
        const buffer = Buffer.from(await imageRes.arrayBuffer())
        const timestamp = Date.now()
        storagePath = `agent-images/${timestamp}.png`

        finalUrl = await uploadToStorage(buffer, storagePath, "image/png")
      }
    } catch (uploadErr) {
      console.warn("[Agent Image] Storage upload failed, using OpenAI URL:", uploadErr)
    }

    return {
      success: true,
      imageUrl: finalUrl,
      storagePath,
      prompt: revisedPrompt || prompt,
      data: { imageUrl: finalUrl, prompt: revisedPrompt || prompt, size, style },
    }
  } catch (error) {
    console.error("[DALL-E] Exception:", error)
    return { success: false, error: error instanceof Error ? error.message : "Error al generar imagen" }
  }
}
