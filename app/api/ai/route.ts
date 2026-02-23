import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { askMotorIA, VALID_MODES, type AIMode } from "@/lib/ai"

const MAX_INPUT_LENGTH = 15000

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, text, mode, options } = body as {
      prompt?: string
      text?: string
      mode?: string
      options?: { idioma?: string; tono?: string; longitud?: string }
    }

    const input = (prompt || text || "").trim()

    if (!input || input.length === 0) {
      return errorResponse("VALIDATION_ERROR", "El texto (prompt o text) es obligatorio")
    }

    if (input.length > MAX_INPUT_LENGTH) {
      return errorResponse("VALIDATION_ERROR", `El texto excede el limite de ${MAX_INPUT_LENGTH} caracteres`)
    }

    if (!mode || !VALID_MODES.includes(mode as AIMode)) {
      return errorResponse(
        "VALIDATION_ERROR",
        `El mode debe ser uno de: ${VALID_MODES.join(", ")}`,
      )
    }

    let finalPrompt = input
    if (options?.idioma) finalPrompt += `\n\nIdioma de respuesta: ${options.idioma}`
    if (options?.tono) finalPrompt += `\nTono: ${options.tono}`
    if (options?.longitud) finalPrompt += `\nLongitud deseada: ${options.longitud}`

    const result = await askMotorIA(finalPrompt, mode as AIMode)
    return successResponse({ result, mode })
  } catch (error) {
    console.error("[7F Motor IA] API error:", error)
    const message = error instanceof Error ? error.message : "Error interno del Motor IA"
    return errorResponse("AI_ERROR", message, 500)
  }
}
