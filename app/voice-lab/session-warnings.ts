/**
 * Voice Lab soft warnings (CORE-VOICE-0B.1.2) — pure, deterministic.
 *
 * Non-blocking heads-up BEFORE the hard limits in `metrics.ts`:
 *   - at minute 4 of 5 (time is running out);
 *   - at turn 17 of 20 (turns are running out);
 *   - when the per-active-minute cost alert trips (lab spend guidance ONLY —
 *     never presented as a guaranteed global budget cap).
 *
 * These NEVER disconnect. The hard caps in `evaluateSessionLimits` still own the
 * actual disconnect. Each warning is emitted with a stable `kind` so the UI can
 * show it once instead of repeating every tick.
 */

export type SessionWarningKind = "time" | "turns" | "cost"

export interface SessionWarning {
  kind: SessionWarningKind
  message: string
}

/** Minute-4 heads-up (4 of 5 minutes). */
export const WARN_TIME_MS = 4 * 60 * 1000
/** Turn-17 heads-up (17 of 20 turns). */
export const WARN_TURNS = 17

export interface WarningInput {
  elapsedMs: number
  turns: number
  /** From `evaluateSessionLimits(...).costAlert` — per-active-minute alert. */
  costAlert: boolean
}

/**
 * Which soft warnings currently apply. Time/turns warnings only fire once their
 * threshold is crossed AND before the hard cap; the caller is responsible for
 * showing each `kind` a single time.
 */
export function sessionWarnings(input: WarningInput): SessionWarning[] {
  const out: SessionWarning[] = []
  if (input.elapsedMs >= WARN_TIME_MS) {
    out.push({ kind: "time", message: "Queda ~1 minuto de sesión de laboratorio." })
  }
  if (input.turns >= WARN_TURNS) {
    out.push({ kind: "turns", message: "Quedan pocos turnos en esta sesión de laboratorio." })
  }
  if (input.costAlert) {
    out.push({
      kind: "cost",
      message:
        "Aviso de coste del laboratorio: el gasto por minuto es alto. Es una estimación, no un límite global garantizado.",
    })
  }
  return out
}
