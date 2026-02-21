import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { askMotorIA, type AIMode } from "@/lib/ai"

const VALID_MODES: AIMode[] = ["operativo", "editorial"]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { prompt, mode } = body as { prompt?: string; mode?: string }

    if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "El prompt es obligatorio")
    }

    if (!mode || !VALID_MODES.includes(mode as AIMode)) {
      return errorResponse(
        "VALIDATION_ERROR",
        `El mode debe ser uno de: ${VALID_MODES.join(", ")}`
      )
    }

    const result = await askMotorIA(prompt.trim(), mode as AIMode)
    return successResponse({ result, mode })
  } catch (error) {
    console.error("[7F Motor IA] API error:", error)
    const message =
      error instanceof Error ? error.message : "Error interno del Motor IA"
    return errorResponse("AI_ERROR", message, 500)
  }
}
