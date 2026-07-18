/**
 * Shared microphone/connection failure classification — pure, no I/O.
 * Extracted from `app/voice-lab/mic-errors.ts` so every voice surface
 * distinguishes the same three causes; each surface supplies its OWN copy
 * (Voice Lab keeps its lab strings; Ask Finesse resolves via the i18n runtime).
 *
 *   - permission_denied → the user blocked the microphone;
 *   - mic_unavailable   → no usable microphone device;
 *   - connection        → anything else (token/network/SDK).
 */

export type ConnectFailureKind = "permission_denied" | "mic_unavailable" | "connection"

function errorName(err: unknown): string {
  if (err && typeof err === "object") {
    const name = (err as { name?: unknown }).name
    if (typeof name === "string") return name
  }
  return ""
}

/**
 * Classify a raw connect/mic failure. The DOMException `name`s emitted by
 * `getUserMedia` drive the distinction; everything else is a generic
 * connection failure.
 */
export function classifyConnectFailure(err: unknown): ConnectFailureKind {
  const name = errorName(err)
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return "permission_denied"
  }
  if (
    name === "NotFoundError" ||
    name === "DevicesNotFoundError" ||
    name === "OverconstrainedError" ||
    name === "NotReadableError" ||
    name === "TrackStartError"
  ) {
    return "mic_unavailable"
  }
  return "connection"
}
