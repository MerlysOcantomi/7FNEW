/**
 * Voice Lab view model (CORE-VOICE-0B.1.2) — pure, no React, no SDK.
 *
 * Turns the governed `VoiceState` plus a LOCAL voice-activity sub-state into
 * display descriptors. The seven core states stay untouched (see
 * `core/voice/contracts`); voice detection ("te escucho") is a lab-only visual
 * sub-state derived from the already-normalized `user_speech_started` /
 * `user_speech_stopped` events — it does NOT add a state to the contract.
 *
 * Every indicator carries a NON-COLOR cue (`shape` + visible `label`) so nothing
 * depends on color alone.
 */

import type { VoiceState } from "@core/voice/contracts"
import type { TranscriptEntry } from "./transcript"

// ─── Localized state labels (single source for UI + tests) ───────────────────

export const STATE_LABEL: Record<VoiceState, string> = {
  idle: "Inactivo",
  connecting: "Conectando…",
  listening: "Escuchando",
  thinking: "Pensando…",
  speaking: "Hablando",
  interrupted: "Interrumpido",
  error: "Error",
}

// ─── Local voice-activity sub-state ──────────────────────────────────────────

export interface VoiceActivity {
  /** Microphone is capturing (a live session exists). */
  micOpen: boolean
  /** The user is currently speaking (`speech_started` seen, no `stopped` yet). */
  userSpeaking: boolean
}

export const IDLE_ACTIVITY: VoiceActivity = { micOpen: false, userSpeaking: false }

export type VoiceActivityEvent =
  | { type: "session_live" }
  | { type: "session_ended" }
  | { type: "user_speech_started" }
  | { type: "user_speech_stopped" }

/** Reduce one activity event. `user_speech_started` only counts with the mic open. */
export function reduceVoiceActivity(
  activity: VoiceActivity,
  event: VoiceActivityEvent,
): VoiceActivity {
  switch (event.type) {
    case "session_live":
      return { micOpen: true, userSpeaking: false }
    case "session_ended":
      return IDLE_ACTIVITY
    case "user_speech_started":
      return activity.micOpen ? { micOpen: true, userSpeaking: true } : activity
    case "user_speech_stopped":
      return { ...activity, userSpeaking: false }
  }
}

// ─── State indicator (color + shape + label + animation) ─────────────────────

export type StateTone =
  | "idle"
  | "connecting"
  | "listening"
  | "hearing"
  | "thinking"
  | "speaking"
  | "interrupted"
  | "error"

/** A distinct non-color shape per tone, so state never reads by color alone. */
export type StateShape =
  | "dot"
  | "spinner"
  | "ring"
  | "bars"
  | "ellipsis"
  | "wave"
  | "square"
  | "cross"

export interface StateIndicator {
  label: string
  tone: StateTone
  shape: StateShape
  animate: boolean
  /** True while the user's voice is being detected ("te escucho"). */
  voiceDetected: boolean
}

/**
 * The visible indicator for a state + local activity. While `listening` and the
 * user is speaking, it switches to the "Te escucho…" hearing indicator (distinct
 * shape + animation), which is the visible "voice detected" feedback.
 */
export function stateIndicator(state: VoiceState, activity: VoiceActivity): StateIndicator {
  const voiceDetected = activity.userSpeaking && state === "listening"
  if (voiceDetected) {
    return { label: "Te escucho…", tone: "hearing", shape: "bars", animate: true, voiceDetected: true }
  }
  switch (state) {
    case "idle":
      return { label: STATE_LABEL.idle, tone: "idle", shape: "dot", animate: false, voiceDetected: false }
    case "connecting":
      return { label: STATE_LABEL.connecting, tone: "connecting", shape: "spinner", animate: true, voiceDetected: false }
    case "listening":
      return { label: STATE_LABEL.listening, tone: "listening", shape: "ring", animate: false, voiceDetected: false }
    case "thinking":
      return { label: STATE_LABEL.thinking, tone: "thinking", shape: "ellipsis", animate: true, voiceDetected: false }
    case "speaking":
      return { label: STATE_LABEL.speaking, tone: "speaking", shape: "wave", animate: true, voiceDetected: false }
    case "interrupted":
      return { label: STATE_LABEL.interrupted, tone: "interrupted", shape: "square", animate: false, voiceDetected: false }
    case "error":
      return { label: STATE_LABEL.error, tone: "error", shape: "cross", animate: false, voiceDetected: false }
  }
}

// ─── Interruption ────────────────────────────────────────────────────────────

/** "Cortar respuesta" is only meaningful while 7F is actually speaking. */
export function canCutResponse(state: VoiceState): boolean {
  return state === "speaking"
}

/**
 * After `audio_interrupted` the lab shows "Interrumpido" briefly, then returns to
 * "Escuchando" on its own. This is the recovery plan (the client schedules it).
 */
export const INTERRUPTED_RECOVERY_MS = 1200
export const POST_INTERRUPT_STATE: VoiceState = "listening"

export interface InterruptRecovery {
  to: VoiceState
  delayMs: number
}

export function interruptRecovery(): InterruptRecovery {
  return { to: POST_INTERRUPT_STATE, delayMs: INTERRUPTED_RECOVERY_MS }
}

// ─── Transcript scroll ───────────────────────────────────────────────────────

export interface ScrollMetrics {
  scrollTop: number
  clientHeight: number
  scrollHeight: number
}

/**
 * Is the transcript scrolled to (near) the bottom? Used to auto-stick to the
 * newest turn WITHOUT yanking the view when the user scrolled up to read history.
 */
export function isNearBottom(m: ScrollMetrics, thresholdPx = 32): boolean {
  return m.scrollHeight - (m.scrollTop + m.clientHeight) <= thresholdPx
}

// ─── Transcript line presentation (partial / final / unavailable / interrupted) ─

export type LineTone = "user" | "assistant" | "muted" | "interrupted"

export interface TranscriptLineView {
  id: string
  speaker: string
  /** Text to render (may be the "unavailable" placeholder). */
  text: string
  tone: LineTone
  /** Visually distinct treatment for partials (still transcribing). */
  isPartial: boolean
  isUnavailable: boolean
  isInterrupted: boolean
  /** Small status marker, e.g. "· transcribiendo", "· interrumpido". */
  marker: string | null
}

export const UNAVAILABLE_TEXT = "(transcripción no disponible)"

/**
 * Presentation for one transcript entry. Partial, final, unavailable and
 * interrupted are each visually distinct (never differentiated by color alone —
 * a text marker/placeholder carries the meaning too).
 */
export function transcriptLineView(
  entry: TranscriptEntry,
  assistantLabel: string,
): TranscriptLineView {
  const speaker = entry.role === "user" ? "Tú" : assistantLabel
  if (entry.status === "unavailable") {
    return {
      id: entry.id,
      speaker,
      text: UNAVAILABLE_TEXT,
      tone: "muted",
      isPartial: false,
      isUnavailable: true,
      isInterrupted: Boolean(entry.interrupted),
      marker: null,
    }
  }
  const isInterrupted = Boolean(entry.interrupted)
  const isPartial = entry.status === "partial"
  return {
    id: entry.id,
    speaker,
    text: entry.text,
    tone: isInterrupted ? "interrupted" : entry.role,
    isPartial,
    isUnavailable: false,
    isInterrupted,
    marker: isInterrupted ? "· interrumpido" : isPartial ? "· transcribiendo…" : null,
  }
}
