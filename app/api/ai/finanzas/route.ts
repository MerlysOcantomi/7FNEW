import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { askMotorIA } from "@/lib/ai"
import { promptAnalisisFinanciero, promptDetectarAnomalias } from "@/lib/ai"

type FinanzasAction = "analisis" | "anomalias"
const VALID_ACTIONS: FinanzasAction[] = ["analisis", "anomalias"]

export async function POST(request: NextRequest) {
  try {
    // CORE-02B (F-AUTH-05): require a valid session + workspace membership
    // in-handler, before reading the body or contacting any AI provider.
    await requireReadAccess(request)

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
    return handleError(error, "FinanzasAI")
  }
}
