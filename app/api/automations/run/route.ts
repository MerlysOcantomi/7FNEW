import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import {
  detectarRetrasos,
  sugerirReprogramacion,
  generarSubtareas,
  resumenDiario,
} from "@modules/automatizaciones/tasks"
import {
  detectarBloqueos,
  sugerirSiguientesPasos,
} from "@modules/automatizaciones/projects"
import {
  detectarVencimientos,
  generarRecordatorios,
} from "@modules/automatizaciones/invoices"

const VALID_ACTIONS = [
  "detectar_retrasos",
  "sugerir_reprogramacion",
  "generar_subtareas",
  "resumen_diario",
  "detectar_bloqueos",
  "sugerir_siguientes_pasos",
  "detectar_vencimientos",
  "generar_recordatorios",
  "analisis_diario",
  "analisis_semanal",
] as const

type AutomationAction = (typeof VALID_ACTIONS)[number]

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body as { action?: string }

    if (!action || !VALID_ACTIONS.includes(action as AutomationAction)) {
      return errorResponse(
        "VALIDATION_ERROR",
        `action debe ser: ${VALID_ACTIONS.join(", ")}`
      )
    }

    console.log(`[7F Automations] Running: ${action}`)
    const startTime = Date.now()

    let result: unknown

    switch (action as AutomationAction) {
      case "detectar_retrasos":
        result = await detectarRetrasos()
        break
      case "sugerir_reprogramacion":
        result = await sugerirReprogramacion()
        break
      case "generar_subtareas":
        result = await generarSubtareas()
        break
      case "resumen_diario":
        result = await resumenDiario()
        break
      case "detectar_bloqueos":
        result = await detectarBloqueos()
        break
      case "sugerir_siguientes_pasos":
        result = await sugerirSiguientesPasos()
        break
      case "detectar_vencimientos":
        result = await detectarVencimientos()
        break
      case "generar_recordatorios":
        result = await generarRecordatorios()
        break
      case "analisis_diario":
        result = {
          tareas: await detectarRetrasos(),
          resumen: await resumenDiario(),
          facturas: await detectarVencimientos(),
        }
        break
      case "analisis_semanal":
        result = {
          tareas: await detectarRetrasos(),
          proyectos: await detectarBloqueos(),
          facturas: await detectarVencimientos(),
          pasos: await sugerirSiguientesPasos(),
        }
        break
    }

    const elapsed = Date.now() - startTime
    console.log(`[7F Automations] Completed: ${action} in ${elapsed}ms`)

    return successResponse({ action, elapsed, ...result as Record<string, unknown> })
  } catch (error) {
    console.error("[7F Automations] Error:", error)
    const message = error instanceof Error ? error.message : "Error en automatizacion"
    return errorResponse("AUTOMATION_ERROR", message, 500)
  }
}
