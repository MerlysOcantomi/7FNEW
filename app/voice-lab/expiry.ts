/**
 * Voice Lab proposal expiry view (CORE-VOICE-0B.1.2) — pure, injected clock.
 *
 * The card must NEVER render the raw ISO `expiresAt`. This turns an ISO instant
 * plus an injected `nowMs` into a human countdown ("Expira en 45 s") and an
 * explicit expired state. No system clock is read here so it stays deterministic.
 */

export type ExpiryStatus = "active" | "expired"

export interface ExpiryView {
  status: ExpiryStatus
  /** Whole seconds remaining, clamped to >= 0. */
  secondsLeft: number
  /** Human label — "Expira en N s" or "Propuesta expirada". Never an ISO string. */
  label: string
}

export const EXPIRED_LABEL = "Propuesta expirada"

/**
 * Compute the expiry view. A missing/invalid instant or a `nowMs` at-or-past
 * `expiresAt` is treated as expired. `nowMs` is injected (epoch ms).
 */
export function expiryView(expiresAtIso: string, nowMs: number): ExpiryView {
  const expiresAtMs = Date.parse(expiresAtIso)
  if (Number.isNaN(expiresAtMs) || nowMs >= expiresAtMs) {
    return { status: "expired", secondsLeft: 0, label: EXPIRED_LABEL }
  }
  const secondsLeft = Math.max(0, Math.ceil((expiresAtMs - nowMs) / 1000))
  return { status: "active", secondsLeft, label: `Expira en ${secondsLeft} s` }
}
