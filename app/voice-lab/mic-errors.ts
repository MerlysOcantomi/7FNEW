/**
 * Voice Lab connection/mic error copy (CORE-VOICE-0B.1.2) — pure, no I/O.
 *
 * The DOMException classification was promoted to `@core/voice/microphone`
 * during the shared-voice extraction; this module keeps the LAB's Spanish
 * copy on top (each surface owns its own strings — Ask Finesse resolves its
 * copy through the i18n runtime instead). Raw technical errors NEVER reach
 * the screen.
 */

import { classifyConnectFailure, type ConnectFailureKind } from "@core/voice/microphone"

export type { ConnectFailureKind } from "@core/voice/microphone"

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

/** Classify a raw connect/mic failure into a human `ConnectFailure`. */
export function describeConnectFailure(err: unknown): ConnectFailure {
  const kind = classifyConnectFailure(err)
  return { kind, message: COPY[kind] }
}
