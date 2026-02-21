import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
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
    console.error("[7F Motor IA] Proyectos AI error:", error)
    const message = error instanceof Error ? error.message : "Error del Motor IA"
    return errorResponse("AI_ERROR", message, 500)
  }
}
