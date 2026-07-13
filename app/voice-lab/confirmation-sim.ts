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
export const SIM_EXPIRED_MESSAGE =
  "La propuesta expiró. Pídele a 7F que la prepare de nuevo."

/** How a simulated confirmation resolved — drives which copy the card shows. */
export type SimResultKind = "confirmed" | "cancelled" | "expired"

export interface SimulatedConfirmationResult {
  /** Distinct outcome so the card can show confirmed / cancelled / expired copy. */
  kind: SimResultKind
  /** What the real contract decided — for display/telemetry only. */
  outcomeKind: "execute" | "rejected"
  /** Whether anything was executed. ALWAYS false: this is a simulation. */
  executed: false
  message: string
}

/**
 * Resolve a simulated confirmation. `now` is injected — nothing ever executes.
 *   - cancel                 → cancelled copy;
 *   - confirm & would execute → confirmed copy;
 *   - confirm but expired     → expired copy (NOT "cancelled", which would lie
 *                               to a user who pressed confirm);
 *   - confirm rejected for any other reason → cancelled copy (safe default).
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
    return {
      kind: "cancelled",
      outcomeKind: outcome.kind,
      executed: false,
      message: SIM_CANCELLED_MESSAGE,
    }
  }

  if (outcome.kind === "execute") {
    return { kind: "confirmed", outcomeKind: "execute", executed: false, message: SIM_CONFIRMED_MESSAGE }
  }

  // Confirm but rejected. Distinguish an expired proposal from any other reason.
  if (outcome.reason === "expired") {
    return { kind: "expired", outcomeKind: "rejected", executed: false, message: SIM_EXPIRED_MESSAGE }
  }
  return { kind: "cancelled", outcomeKind: "rejected", executed: false, message: SIM_CANCELLED_MESSAGE }
}
