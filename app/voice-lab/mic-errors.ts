/**
 * Voice Lab connection/mic error copy (CORE-VOICE-0B.1.2) — pure, no I/O.
 *
 * Maps a raw failure (a `getUserMedia`/WebRTC error, a bad token response, or an
 * unknown throw) to a short, human message. Raw technical errors NEVER reach the
 * screen. Three distinguishable causes:
 *   - permission_denied → the user blocked the microphone;
 *   - mic_unavailable   → no usable microphone device;
 *   - connection        → anything else (token/network/SDK).
 */

export type ConnectFailureKind = "permission_denied" | "mic_unavailable" | "connection"

export interface ConnectFailure {
  kind: ConnectFailureKind
  message: string
}

const COPY: Record<ConnectFailureKind, string> = {
  permission_denied:
    "No pudimos usar el micrófono porque el permiso está bloqueado. Actívalo en tu navegador y vuelve a conectar.",
  mic_unavailable:
    "No encontramos un micrófono disponible. Conecta uno y vuelve a intentarlo.",
  connection:
    "No se pudo iniciar la sesión de voz. Revisa tu conexión e inténtalo de nuevo.",
}

/** Copy for a known failure kind. */
export function connectFailureCopy(kind: ConnectFailureKind): string {
  return COPY[kind]
}

function errorName(err: unknown): string {
  if (err && typeof err === "object") {
    const name = (err as { name?: unknown }).name
    if (typeof name === "string") return name
  }
  return ""
}

/**
 * Classify a raw connect/mic failure into a human `ConnectFailure`. The DOMException
 * `name`s emitted by `getUserMedia` drive the distinction; everything else is a
 * generic connection failure.
 */
export function describeConnectFailure(err: unknown): ConnectFailure {
  const name = errorName(err)
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return { kind: "permission_denied", message: COPY.permission_denied }
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError" || name === "NotReadableError" || name === "TrackStartError") {
    return { kind: "mic_unavailable", message: COPY.mic_unavailable }
  }
  return { kind: "connection", message: COPY.connection }
}
