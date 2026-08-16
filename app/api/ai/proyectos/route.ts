import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { askMotorIA } from "@/lib/ai"
import {
  promptAnalisisProyecto,
  promptDetectarRetrasos,
  promptSiguientesPasos,
} from "@/lib/ai"

type ProyectoAction = "analisis" | "retrasos" | "siguientes_pasos"
const VALID_ACTIONS: ProyectoAction[] = ["analisis", "retrasos", "siguientes_pasos"]

export async function POST(request: NextRequest) {
  try {
    // CORE-02B (F-AUTH-05): require a valid session + workspace membership
    // in-handler, before reading the body or contacting any AI provider.
    await requireReadAccess(request)

    const body = await request.json()
    const { action, data } = body as { action?: string; data?: Record<string, unknown> }

    if (!action || !VALID_ACTIONS.includes(action as ProyectoAction)) {
      return errorResponse("VALIDATION_ERROR", `action debe ser: ${VALID_ACTIONS.join(", ")}`)
    }

    if (!data) {
      return errorResponse("VALIDATION_ERROR", "data es obligatorio")
    }

    let prompt: string

    switch (action as ProyectoAction) {
      case "analisis":
        prompt = promptAnalisisProyecto({
          nombre: String(data.nombre ?? ""),
          estado: String(data.estado ?? ""),
          tareasPendientes: Number(data.tareasPendientes ?? 0),
          tareasCompletadas: Number(data.tareasCompletadas ?? 0),
          presupuesto: data.presupuesto ? Number(data.presupuesto) : undefined,
          gastoActual: data.gastoActual ? Number(data.gastoActual) : undefined,
        })
        break
      case "retrasos":
        prompt = promptDetectarRetrasos({
          nombre: String(data.nombre ?? ""),
          fechaInicio: String(data.fechaInicio ?? ""),
          fechaFin: data.fechaFin ? String(data.fechaFin) : undefined,
          porcentajeAvance: Number(data.porcentajeAvance ?? 0),
        })
        break
      case "siguientes_pasos":
        prompt = promptSiguientesPasos({
          nombre: String(data.nombre ?? ""),
          estado: String(data.estado ?? ""),
          descripcion: data.descripcion ? String(data.descripcion) : undefined,
        })
        break
      default:
        return errorResponse("VALIDATION_ERROR", "Accion no reconocida")
    }

    const result = await askMotorIA(prompt, "operativo")
    return successResponse({ result, action })
  } catch (error) {
    return handleError(error, "ProyectosAI")
  }
}
