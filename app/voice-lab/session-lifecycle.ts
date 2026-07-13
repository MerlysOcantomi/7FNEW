/**
 * Voice Lab session lifecycle (CORE-VOICE-0B.1.2a) — pure, deterministic.
 *
 * `state !== "idle"` is NOT a reliable "a session is live" signal: `error`
 * (after a failed `start`) also satisfies it, which made the UI look connected
 * while the transport was already closed. The truth is an explicit `sessionLive`
 * boolean that is ONLY true between a successful `session.start()` and teardown.
 *
 * These helpers model the transitions and the derived control-lock/button state
 * so the client and the tests share one source of truth. The `VoiceState`
 * contract is untouched.
 */

import type { VoiceState } from "@core/voice/contracts"

export const SESSION_LIVE_INITIAL = false as const

export type LifecycleEvent =
  | { type: "connect_requested" } // token request begins (still not live)
  | { type: "start_succeeded" } // session.start() resolved
  | { type: "connect_failed" } // any failure before/at start
  | { type: "disconnected" } // user pressed Desconectar
  | { type: "teardown" } // unmount / hard-limit / cleanup

/**
 * Next `sessionLive`. Only `start_succeeded` sets it true; every other lifecycle
 * event (request, failure, disconnect, teardown) forces it back to false.
 */
export function nextSessionLive(_prev: boolean, event: LifecycleEvent): boolean {
  return event.type === "start_succeeded"
}

export interface LifecycleView {
  connecting: boolean
  sessionLive: boolean
  /** Selectors + a second connect must be locked while connecting or live. */
  controlsLocked: boolean
  /** Which primary button to show. */
  primaryAction: "connect" | "disconnect"
  /** Connect is disabled while connecting so it cannot be triggered twice. */
  connectDisabled: boolean
  /** Model/voice selectors disabled. */
  selectorsDisabled: boolean
  /** Mic open/closed chip is only meaningful for a live session. */
  showMic: boolean
}

/**
 * Derive the render-facing lifecycle from the governed `state` plus the explicit
 * `sessionLive`. `error` with a closed session reads as NOT connected: it shows
 * Connect again and re-enables the selectors, without faking a live session.
 */
export function lifecycleView(state: VoiceState, sessionLive: boolean): LifecycleView {
  const connecting = state === "connecting"
  const controlsLocked = connecting || sessionLive
  return {
    connecting,
    sessionLive,
    controlsLocked,
    primaryAction: sessionLive ? "disconnect" : "connect",
    connectDisabled: connecting,
    selectorsDisabled: controlsLocked,
    showMic: sessionLive,
  }
}
