/**
 * Voice Lab gate — pure policy (CORE-VOICE-0B.1).
 *
 * No imports of the auth stack or DB so it is trivially testable. The async
 * wiring to the real auth helpers lives in `gate.ts`.
 *
 * BOTH `/voice-lab` and `POST /api/voice/realtime-token` require:
 *   VOICE_LAB_ENABLED === "true" · authenticated · platform admin/dev · valid
 *   workspace with membership.
 *
 * Flag-off / unauthenticated / non-admin → 404 (do not reveal the lab exists).
 * Authenticated admin without a valid workspace → 403.
 */

export type LabGateDecision = { allowed: true } | { allowed: false; status: 403 | 404 }

export interface LabGateSignals {
  flagEnabled: boolean
  authenticated: boolean
  platformAuthorized: boolean
  workspaceValid: boolean
}

export function decideLabGate(signals: LabGateSignals): LabGateDecision {
  if (!signals.flagEnabled) return { allowed: false, status: 404 }
  if (!signals.authenticated) return { allowed: false, status: 404 }
  if (!signals.platformAuthorized) return { allowed: false, status: 404 }
  if (!signals.workspaceValid) return { allowed: false, status: 403 }
  return { allowed: true }
}

/** The feature flag is OFF unless explicitly set to the string "true". */
export function isVoiceLabEnabled(): boolean {
  return process.env.VOICE_LAB_ENABLED === "true"
}
