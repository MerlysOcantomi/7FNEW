import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { askMotorIAWithHistory, type AIMode } from "@/lib/ai"

const MAX_HISTORY = 20
const MAX_MESSAGE_LENGTH = 10000
const CHAT_MODES: AIMode[] = ["skina", "7f", "general"]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { mode, message, history } = body as {
      mode?: string
      message?: string
      history?: Array<{ role: "user" | "assistant"; content: string }>
    }

    if (!message || message.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "El mensaje es obligatorio")
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return errorResponse("VALIDATION_ERROR", `El mensaje excede ${MAX_MESSAGE_LENGTH} caracteres`)
    }

    if (!mode || !CHAT_MODES.includes(mode as AIMode)) {
      return errorResponse(
        "VALIDATION_ERROR",
        `El mode debe ser uno de: ${CHAT_MODES.join(", ")}`,
      )
    }

    const cleanHistory = (history ?? [])
      .filter(
        (m) =>
          (m.role === "user" || m.role === "assistant") &&
          typeof m.content === "string" &&
          m.content.trim().length > 0,
      )
      .slice(-MAX_HISTORY)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content.slice(0, MAX_MESSAGE_LENGTH),
      }))

    const messages = [
      ...cleanHistory,
      { role: "user" as const, content: message.trim() },
    ]

    const result = await askMotorIAWithHistory(messages, mode as AIMode)

    return successResponse({
      result,
      mode,
    })
  } catch (error) {
    console.error("[7F AI Chat] Error:", error)
    const message = error instanceof Error ? error.message : "Error en el chat"
    return errorResponse("AI_ERROR", message, 500)
  }
}
