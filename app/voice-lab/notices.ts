/**
 * Voice Lab notice channels (CORE-VOICE-0B.1.2) — pure, deterministic.
 *
 * A single shared `notice` used to conflate confirmations, errors, limit
 * warnings and disconnect messages, so they overwrote each other. These are now
 * SEPARATE channels that never clobber one another:
 *   - session       → soft limit / disconnect / lifecycle notes;
 *   - confirmation  → the resolved simulated-proposal result;
 *   - error         → connection / mic failures.
 */

import type { SimResultKind } from "./confirmation-sim"

export interface ConfirmationResultView {
  kind: SimResultKind
  message: string
}

export interface LabNotices {
  session: string | null
  confirmation: ConfirmationResultView | null
  error: string | null
}

export const EMPTY_NOTICES: LabNotices = {
  session: null,
  confirmation: null,
  error: null,
}

export function withSessionNotice(n: LabNotices, message: string | null): LabNotices {
  return { ...n, session: message }
}

export function withConfirmationResult(
  n: LabNotices,
  confirmation: ConfirmationResultView | null,
): LabNotices {
  return { ...n, confirmation }
}

export function withError(n: LabNotices, error: string | null): LabNotices {
  return { ...n, error }
}
