/**
 * Voice Lab action labels (CORE-VOICE-0B.1.2) — pure, local to the lab.
 *
 * The simulated `propose_action` card must NEVER show the raw technical
 * `toolName` (e.g. `create_appointment`) to the user. This maps known tool names
 * to short human labels; anything unknown falls back to a safe generic label.
 *
 * This is lab-only presentation copy. It does NOT touch core/voice contracts and
 * is not a source of truth for what a tool does.
 */

export const FALLBACK_ACTION_LABEL = "Acción propuesta"

const HUMAN_ACTION_LABELS: Record<string, string> = {
  create_appointment: "Crear cita",
  cancel_appointment: "Cancelar cita",
  reschedule_appointment: "Reprogramar cita",
  create_charge: "Registrar cobro",
  refund_charge: "Registrar reembolso",
  send_message: "Enviar mensaje",
  create_client: "Crear clienta",
  update_client: "Actualizar clienta",
  create_service: "Crear servicio",
  update_service: "Actualizar servicio",
  create_campaign: "Crear campaña",
}

/**
 * Human label for a proposed action. Unknown / empty tool names fall back to the
 * generic label so no raw identifier ever reaches the card.
 */
export function humanizeActionName(toolName: unknown): string {
  if (typeof toolName !== "string") return FALLBACK_ACTION_LABEL
  const key = toolName.trim().toLowerCase()
  if (!key) return FALLBACK_ACTION_LABEL
  return HUMAN_ACTION_LABELS[key] ?? FALLBACK_ACTION_LABEL
}
