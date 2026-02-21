import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { askMotorIA } from "@/lib/ai"
import { promptResumenFacturacion, promptExplicarVencimiento } from "@/lib/ai"

type FacturacionAction = "resumen" | "vencimiento"
const VALID_ACTIONS: FacturacionAction[] = ["resumen", "vencimiento"]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body as { action?: string; data?: Record<string, unknown> }

    if (!action || !VALID_ACTIONS.includes(action as FacturacionAction)) {
      return errorResponse("VALIDATION_ERROR", `action debe ser: ${VALID_ACTIONS.join(", ")}`)
    }

    if (!data) {
      return errorResponse("VALIDATION_ERROR", "data es obligatorio")
    }

    let prompt: string
    let mode: "operativo" | "editorial"

    switch (action as FacturacionAction) {
      case "resumen":
        prompt = promptResumenFacturacion({
          totalPendiente: Number(data.totalPendiente ?? 0),
          totalVencidas: Number(data.totalVencidas ?? 0),
          cantidadFacturas: Number(data.cantidadFacturas ?? 0),
        })
        mode = "operativo"
        break
      case "vencimiento":
        prompt = promptExplicarVencimiento({
          numero: String(data.numero ?? ""),
          cliente: String(data.cliente ?? ""),
          monto: Number(data.monto ?? 0),
          vencimiento: String(data.vencimiento ?? ""),
          diasVencida: Number(data.diasVencida ?? 0),
        })
        mode = "editorial"
        break
      default:
        return errorResponse("VALIDATION_ERROR", "Accion no reconocida")
    }

    const result = await askMotorIA(prompt, mode)
    return successResponse({ result, action })
  } catch (error) {
    console.error("[7F Motor IA] Facturacion AI error:", error)
    const message = error instanceof Error ? error.message : "Error del Motor IA"
    return errorResponse("AI_ERROR", message, 500)
  }
}
