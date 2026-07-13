import assert from "node:assert/strict"
import test from "node:test"
import {
  IDLE_ACTIVITY,
  reduceVoiceActivity,
  stateIndicator,
  canCutResponse,
  interruptRecovery,
  isNearBottom,
  transcriptLineView,
  UNAVAILABLE_TEXT,
  type VoiceActivity,
} from "./lab-view"
import type { VoiceState } from "@core/voice/contracts"
import type { TranscriptEntry } from "./transcript"

// ─── Voice activity sub-state ─────────────────────────────────────────────────

test("user_speech_started activates local voice feedback while mic is open", () => {
  const live = reduceVoiceActivity(IDLE_ACTIVITY, { type: "session_live" })
  assert.equal(live.micOpen, true)
  const speaking = reduceVoiceActivity(live, { type: "user_speech_started" })
  assert.equal(speaking.userSpeaking, true)
  assert.equal(stateIndicator("listening", speaking).voiceDetected, true)
  assert.equal(stateIndicator("listening", speaking).label, "Te escucho…")
})

test("user_speech_stopped clears the voice feedback", () => {
  let a: VoiceActivity = { micOpen: true, userSpeaking: true }
  a = reduceVoiceActivity(a, { type: "user_speech_stopped" })
  assert.equal(a.userSpeaking, false)
  assert.equal(stateIndicator("listening", a).voiceDetected, false)
})

test("speech_started is ignored when the mic is not open", () => {
  const a = reduceVoiceActivity(IDLE_ACTIVITY, { type: "user_speech_started" })
  assert.equal(a.userSpeaking, false)
})

test("session_ended resets activity", () => {
  const a = reduceVoiceActivity({ micOpen: true, userSpeaking: true }, { type: "session_ended" })
  assert.deepEqual(a, IDLE_ACTIVITY)
})

// ─── State indicator distinctness (never color alone) ────────────────────────

test("all seven states are visually distinguishable by shape + label", () => {
  const states: VoiceState[] = [
    "idle",
    "connecting",
    "listening",
    "thinking",
    "speaking",
    "interrupted",
    "error",
  ]
  const shapes = states.map((s) => stateIndicator(s, IDLE_ACTIVITY).shape)
  const labels = states.map((s) => stateIndicator(s, IDLE_ACTIVITY).label)
  assert.equal(new Set(shapes).size, states.length, "each state has a distinct shape")
  assert.equal(new Set(labels).size, states.length, "each state has a distinct label")
})

test("thinking and speaking animate; idle and interrupted do not", () => {
  assert.equal(stateIndicator("thinking", IDLE_ACTIVITY).animate, true)
  assert.equal(stateIndicator("speaking", IDLE_ACTIVITY).animate, true)
  assert.equal(stateIndicator("idle", IDLE_ACTIVITY).animate, false)
  assert.equal(stateIndicator("interrupted", IDLE_ACTIVITY).animate, false)
})

// ─── Cut response only while speaking ────────────────────────────────────────

test("Cortar respuesta is enabled only when state === speaking", () => {
  assert.equal(canCutResponse("speaking"), true)
  for (const s of ["idle", "connecting", "listening", "thinking", "interrupted", "error"] as VoiceState[]) {
    assert.equal(canCutResponse(s), false, `${s} must not allow cut`)
  }
})

// ─── Interrupt recovery ──────────────────────────────────────────────────────

test("after interruption the lab returns to listening", () => {
  const r = interruptRecovery()
  assert.equal(r.to, "listening")
  assert.ok(r.delayMs > 0)
})

// ─── Transcript scroll ───────────────────────────────────────────────────────

test("isNearBottom: at bottom sticks, scrolled up does not", () => {
  assert.equal(isNearBottom({ scrollTop: 480, clientHeight: 120, scrollHeight: 600 }), true)
  assert.equal(isNearBottom({ scrollTop: 0, clientHeight: 120, scrollHeight: 600 }), false)
})

// ─── Transcript line presentation ────────────────────────────────────────────

function entry(p: Partial<TranscriptEntry>): TranscriptEntry {
  return { id: "i", role: "assistant", text: "t", status: "final", ...p }
}

test("partial and final are visually differentiated", () => {
  const partial = transcriptLineView(entry({ status: "partial", text: "ho" }), "7F")
  const final = transcriptLineView(entry({ status: "final", text: "hola" }), "7F")
  assert.equal(partial.isPartial, true)
  assert.equal(final.isPartial, false)
  assert.notEqual(partial.marker, final.marker)
  assert.match(partial.marker ?? "", /transcribiendo/i)
})

test("unavailable is clearly visible with a placeholder", () => {
  const v = transcriptLineView(entry({ status: "unavailable", text: "" }), "7F")
  assert.equal(v.isUnavailable, true)
  assert.equal(v.text, UNAVAILABLE_TEXT)
})

test("interrupted assistant line is marked", () => {
  const v = transcriptLineView(entry({ status: "final", interrupted: true }), "7F")
  assert.equal(v.isInterrupted, true)
  assert.equal(v.tone, "interrupted")
  assert.match(v.marker ?? "", /interrumpido/i)
})

test("user vs assistant speaker labels", () => {
  assert.equal(transcriptLineView(entry({ role: "user" }), "7F").speaker, "Tú")
  assert.equal(transcriptLineView(entry({ role: "assistant" }), "7F").speaker, "7F")
})
