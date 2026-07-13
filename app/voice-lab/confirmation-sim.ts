/**
 * Voice Lab simulated confirmation (CORE-VOICE-0B.1.1) — pure, never executes.
 *
 * Drives the propose_action card through the REAL `resolveConfirmation` from
 * core/voice (with injected time), but no matter the outcome nothing runs — this
 * is a simulation. The messages are fixed copy.
 */

import {
  resolveConfirmation,
  type ActionProposal,
  type ActionConfirmation,
} from "@core/voice/confirmation"

export const SIM_CONFIRMED_MESSAGE =
  "Simulación: confirmación recibida. No se realizó ningún cambio."
export const SIM_CANCELLED_MESSAGE = "Simulación cancelada. No se realizó ningún cambio."

export interface SimulatedConfirmationResult {
  /** What the real contract decided — for display/telemetry only. */
  outcomeKind: "execute" | "rejected"
  /** Whether anything was executed. ALWAYS false: this is a simulation. */
  executed: false
  message: string
}

/**
 * Resolve a simulated confirmation. `now` is injected. Cancel → cancelled copy.
 * Confirm → the contract may say `execute`, but we NEVER execute; we show the
 * "confirmation received, nothing changed" copy.
 */
export function simulateConfirmation(
  proposal: ActionProposal,
  decision: "confirm" | "cancel",
  now: string,
  via: ActionConfirmation["via"] = "tap",
): SimulatedConfirmationResult {
  const outcome = resolveConfirmation(
    proposal,
    { proposalId: proposal.id, decision, via },
    { now, alreadyResolved: false },
  )

  if (decision === "cancel") {
    return { outcomeKind: outcome.kind, executed: false, message: SIM_CANCELLED_MESSAGE }
  }
  // Confirm: outcome may be "execute" (fresh) or "rejected" (e.g. expired) —
  // either way nothing runs. Confirmed copy only when the contract would execute.
  return {
    outcomeKind: outcome.kind,
    executed: false,
    message: outcome.kind === "execute" ? SIM_CONFIRMED_MESSAGE : SIM_CANCELLED_MESSAGE,
  }
}
