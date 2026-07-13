/**
 * Voice Lab fake tools (CORE-VOICE-0B.1) — read-only / simulated, NEVER write.
 *
 * `get_today_summary`: canned, isolated data, no DB.
 * `propose_action`: produces a core/voice `ActionProposal` and NEVER executes.
 *   Even though the confirmation contract can yield `kind: "execute"`, the UI
 *   shows: "Simulación: confirmación recibida. No se realizó ningún cambio."
 */

import { tool } from "@openai/agents/realtime"
import { z } from "zod"
import type { ActionProposal } from "@core/voice/confirmation"

export const SIMULATION_MESSAGE =
  "Simulación: confirmación recibida. No se realizó ningún cambio."

export const getTodaySummary = tool({
  name: "get_today_summary",
  description:
    "Resumen de ejemplo del día del salón (datos canned, solo lectura, sin base de datos).",
  parameters: z.object({}),
  execute: async () => ({
    date: "hoy",
    appointments: [
      { time: "10:00", clienta: "María", servicio: "Manicura semipermanente", precio: 25 },
      { time: "12:30", clienta: "Camila", servicio: "Lifting de pestañas", precio: 45 },
    ],
    note: "Datos de ejemplo del laboratorio — no proceden de la base de datos.",
  }),
})

export interface SimulatedProposeResult {
  simulated: true
  proposal: ActionProposal
  message: string
}

export const proposeAction = tool({
  name: "propose_action",
  description:
    "Prepara (SIMULACIÓN) una acción con efectos para revisión. Nunca ejecuta ni escribe nada.",
  parameters: z.object({
    toolName: z.string().describe("Acción propuesta, p. ej. create_appointment"),
    spokenSummary: z.string().describe("Resumen para leer en voz alta"),
    writtenSummary: z.string().describe("Resumen para mostrar como texto"),
  }),
  execute: async (input): Promise<SimulatedProposeResult> => {
    const proposal: ActionProposal = {
      id: `sim_${Date.now()}`,
      workspaceId: "voice-lab",
      toolName: input.toolName,
      args: {},
      summary: { spoken: input.spokenSummary, written: input.writtenSummary },
      effect: "write",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      risk: "low",
    }
    // NEVER executes. The proposal is returned for display + simulated confirm.
    return { simulated: true, proposal, message: SIMULATION_MESSAGE }
  },
})

export const LAB_TOOLS = [getTodaySummary, proposeAction]
