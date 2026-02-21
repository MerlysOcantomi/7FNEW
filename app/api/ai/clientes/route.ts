import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { askMotorIA } from "@/lib/ai"
import { promptResumenCliente, promptComunicacionCliente } from "@/lib/ai"

type ClienteAction = "resumen" | "comunicacion"
const VALID_ACTIONS: ClienteAction[] = ["resumen", "comunicacion"]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, data } = body as { action?: string; data?: Record<string, unknown> }

    if (!action || !VALID_ACTIONS.includes(action as ClienteAction)) {
      return errorResponse("VALIDATION_ERROR", `action debe ser: ${VALID_ACTIONS.join(", ")}`)
    }

    if (!data) {
      return errorResponse("VALIDATION_ERROR", "data es obligatorio")
    }

    let prompt: string
    let mode: "operativo" | "editorial"

    switch (action as ClienteAction) {
      case "resumen":
        prompt = promptResumenCliente({
          nombre: String(data.nombre ?? ""),
          empresa: data.empresa ? String(data.empresa) : undefined,
          proyectos: Number(data.proyectos ?? 0),
          facturasAbiertas: Number(data.facturasAbiertas ?? 0),
          estado: String(data.estado ?? "activo"),
        })
        mode = "operativo"
        break
      case "comunicacion":
        prompt = promptComunicacionCliente(
          { nombre: String(data.nombre ?? "") },
          String(data.contexto ?? "")
        )
        mode = "editorial"
        break
      default:
        return errorResponse("VALIDATION_ERROR", "Accion no reconocida")
    }

    const result = await askMotorIA(prompt, mode)
    return successResponse({ result, action })
  } catch (error) {
    console.error("[7F Motor IA] Clientes AI error:", error)
    const message = error instanceof Error ? error.message : "Error del Motor IA"
    return errorResponse("AI_ERROR", message, 500)
  }
}
