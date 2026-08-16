import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { askMotorIA } from "@/lib/ai"
import {
  promptSugerirPrioridad,
  promptDetectarRiesgos,
  promptGenerarSubtareas,
  promptResumirNotas,
} from "@/lib/ai"

type TareaAction = "prioridad" | "riesgos" | "subtareas" | "resumir_notas"
const VALID_ACTIONS: TareaAction[] = ["prioridad", "riesgos", "subtareas", "resumir_notas"]

export async function POST(request: NextRequest) {
  try {
    // CORE-02B (F-AUTH-05): require a valid session + workspace membership
    // in-handler, before reading the body or contacting any AI provider.
    await requireReadAccess(request)

    const body = await request.json()
    const { action, data } = body as { action?: string; data?: Record<string, unknown> }

    if (!action || !VALID_ACTIONS.includes(action as TareaAction)) {
      return errorResponse("VALIDATION_ERROR", `action debe ser: ${VALID_ACTIONS.join(", ")}`)
    }

    if (!data) {
      return errorResponse("VALIDATION_ERROR", "data es obligatorio")
    }

    let prompt: string

    switch (action as TareaAction) {
      case "prioridad":
        prompt = promptSugerirPrioridad({
          titulo: String(data.titulo ?? ""),
          descripcion: data.descripcion ? String(data.descripcion) : undefined,
          fechaLimite: data.fechaLimite ? String(data.fechaLimite) : undefined,
        })
        break
      case "riesgos":
        prompt = promptDetectarRiesgos({
          titulo: String(data.titulo ?? ""),
          descripcion: data.descripcion ? String(data.descripcion) : undefined,
          estado: String(data.estado ?? "pendiente"),
          fechaLimite: data.fechaLimite ? String(data.fechaLimite) : undefined,
        })
        break
      case "subtareas":
        prompt = promptGenerarSubtareas({
          titulo: String(data.titulo ?? ""),
          descripcion: data.descripcion ? String(data.descripcion) : undefined,
        })
        break
      case "resumir_notas":
        prompt = promptResumirNotas(String(data.notas ?? ""))
        break
      default:
        return errorResponse("VALIDATION_ERROR", "Accion no reconocida")
    }

    const result = await askMotorIA(prompt, "operativo")
    return successResponse({ result, action })
  } catch (error) {
    return handleError(error, "TareasAI")
  }
}
