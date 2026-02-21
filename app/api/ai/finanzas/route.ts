import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { askMotorIA } from "@/lib/ai"
import { promptAnalisisFinanciero, promptDetectarAnomalias } from "@/lib/ai"

type FinanzasAction = "analisis" | "anomalias"
const VALID_ACTIONS: FinanzasAction[] = ["analisis", "anomalias"]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body as { action?: string; data?: Record<string, unknown> }

    if (!action || !VALID_ACTIONS.includes(action as FinanzasAction)) {
      return errorResponse("VALIDATION_ERROR", `action debe ser: ${VALID_ACTIONS.join(", ")}`)
    }

    if (!data) {
      return errorResponse("VALIDATION_ERROR", "data es obligatorio")
    }

    let prompt: string

    switch (action as FinanzasAction) {
      case "analisis":
        prompt = promptAnalisisFinanciero({
          ingresosMes: Number(data.ingresosMes ?? 0),
          gastosMes: Number(data.gastosMes ?? 0),
          margen: Number(data.margen ?? 0),
          tendencia: String(data.tendencia ?? "estable"),
        })
        break
      case "anomalias":
        prompt = promptDetectarAnomalias(String(data.transacciones ?? ""))
        break
      default:
        return errorResponse("VALIDATION_ERROR", "Accion no reconocida")
    }

    const result = await askMotorIA(prompt, "operativo")
    return successResponse({ result, action })
  } catch (error) {
    console.error("[7F Motor IA] Finanzas AI error:", error)
    const message = error instanceof Error ? error.message : "Error del Motor IA"
    return errorResponse("AI_ERROR", message, 500)
  }
}
