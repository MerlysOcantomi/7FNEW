/**
 * Voice Lab gate — server wiring (CORE-VOICE-0B.1).
 *
 * Resolves the pure gate policy against the real auth stack. Never throws and
 * never leaks why (the caller maps 403/404 to a generic response). The
 * platform-admin and workspace checks throw on failure, so they are caught and
 * folded into the decision here — an in-memory association is NEVER used as
 * authorization; every call re-derives session + workspace from cookies.
 */

import "server-only"
import { requirePlatformAdmin } from "@core/auth/platform-auth"
import { requireReadAccess } from "@core/auth/workspace-auth"
import { decideLabGate, isVoiceLabEnabled, type LabGateDecision } from "./gate-policy"

export type { LabGateDecision } from "./gate-policy"
export { isVoiceLabEnabled } from "./gate-policy"

export async function resolveLabGate(): Promise<LabGateDecision> {
  if (!isVoiceLabEnabled()) return { allowed: false, status: 404 }

  let platformAuthorized = false
  try {
    await requirePlatformAdmin()
    platformAuthorized = true
  } catch {
    platformAuthorized = false
  }
  if (!platformAuthorized) {
    return decideLabGate({
      flagEnabled: true,
      authenticated: true,
      platformAuthorized: false,
      workspaceValid: false,
    })
  }

  let workspaceValid = false
  try {
    const auth = await requireReadAccess()
    workspaceValid = Boolean(auth?.workspaceId)
  } catch {
    workspaceValid = false
  }

  return decideLabGate({
    flagEnabled: true,
    authenticated: true,
    platformAuthorized: true,
    workspaceValid,
  })
}
