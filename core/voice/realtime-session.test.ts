import assert from "node:assert/strict"
import test from "node:test"

import {
  RealtimeVoiceSession,
  type RealtimeSessionLike,
  type RealtimeVoiceStartOptions,
} from "./realtime-session"
import { classifyConnectFailure } from "./microphone"
import { evaluateVoiceSupport, type VoiceEnvironment } from "./capabilities"
import type { VoiceState } from "./contracts"

// ─── Fake SDK session (test seam via the injectable factory) ─────────────────

class FakeSession implements RealtimeSessionLike {
  handlers = new Map<string, Array<(...args: unknown[]) => void>>()
  connectCalls: Array<{ apiKey: string; model: string }> = []
  interruptCalls = 0
  muteCalls: boolean[] = []
  closeCalls = 0
  failConnect: Error | null = null

  on(event: string, handler: (...args: unknown[]) => void): void {
    const list = this.handlers.get(event) ?? []
    list.push(handler)
    this.handlers.set(event, list)
  }
  emit(event: string, ...args: unknown[]): void {
    for (const h of this.handlers.get(event) ?? []) h(...args)
  }
  async connect(options: { apiKey: string; model: string }): Promise<void> {
    this.connectCalls.push(options)
    if (this.failConnect) throw this.failConnect
  }
  interrupt(): void {
    this.interruptCalls += 1
  }
  mute(muted: boolean): void {
    this.muteCalls.push(muted)
  }
  close(): void {
    this.closeCalls += 1
  }
}

const OPTS: RealtimeVoiceStartOptions = {
  clientSecret: "ek_test",
  model: "gpt-realtime-2.1",
  voice: "marin",
  transcriptionModel: "gpt-4o-mini-transcribe",
  agentName: "Test Agent",
  instructions: "test instructions",
}

function harness(fake: FakeSession) {
  const states: VoiceState[] = []
  const errors: string[] = []
  const rawEvents: unknown[] = []
  let capturedOptions: RealtimeVoiceStartOptions | null = null
  const session = new RealtimeVoiceSession(
    {
      onState: (s) => states.push(s),
      onError: (m) => errors.push(m),
      onRawEvent: (e) => rawEvents.push(e),
    },
    (opts) => {
      capturedOptions = opts
      return fake
    },
  )
  return { session, states, errors, rawEvents, options: () => capturedOptions }
}

// ─── Connect success / state transitions ─────────────────────────────────────

test("start: connecting → listening, factory receives full configuration", async () => {
  const fake = new FakeSession()
  const h = harness(fake)

  await h.session.start(OPTS)
  assert.deepEqual(h.states, ["connecting", "listening"])
  assert.equal(h.session.live, true)
  assert.deepEqual(fake.connectCalls, [{ apiKey: "ek_test", model: "gpt-realtime-2.1" }])
  assert.equal(h.options()?.instructions, "test instructions")
  assert.equal(h.options()?.agentName, "Test Agent")
  assert.equal(h.options()?.transcriptionModel, "gpt-4o-mini-transcribe")
})

test("SDK events map to governed states; raw events are forwarded", async () => {
  const fake = new FakeSession()
  const h = harness(fake)
  await h.session.start(OPTS)

  fake.emit("agent_start")
  fake.emit("audio_start")
  fake.emit("audio_stopped")
  fake.emit("audio_interrupted")
  fake.emit("transport_event", { type: "response.done" })

  assert.deepEqual(h.states, [
    "connecting",
    "listening",
    "thinking",
    "speaking",
    "listening",
    "interrupted",
  ])
  assert.deepEqual(h.rawEvents, [{ type: "response.done" }])
})

test("SDK error event → error state + normalized message", async () => {
  const fake = new FakeSession()
  const h = harness(fake)
  await h.session.start(OPTS)

  fake.emit("error", new Error("boom"))
  assert.equal(h.states.at(-1), "error")
  assert.deepEqual(h.errors, ["boom"])

  fake.emit("error", "plain string")
  assert.deepEqual(h.errors, ["boom", "plain string"])

  fake.emit("error", { odd: true })
  assert.equal(h.errors.at(-1), "realtime error")
})

// ─── Connect failure ─────────────────────────────────────────────────────────

test("start failure: rejects, closes the half-open session, not live", async () => {
  const fake = new FakeSession()
  fake.failConnect = Object.assign(new Error("denied"), { name: "NotAllowedError" })
  const h = harness(fake)

  await assert.rejects(() => h.session.start(OPTS), /denied/)
  assert.equal(h.session.live, false)
  assert.equal(fake.closeCalls, 1)
  // A new start after failure is allowed (no stuck "already active" latch).
  fake.failConnect = null
  await h.session.start(OPTS)
  assert.equal(h.session.live, true)
})

// ─── Duplicate session guard ─────────────────────────────────────────────────

test("second start while live throws — one active session per wrapper", async () => {
  const fake = new FakeSession()
  const h = harness(fake)
  await h.session.start(OPTS)
  await assert.rejects(() => h.session.start(OPTS), /already active/)
})

// ─── Stop idempotence + interrupt/mute pass-through ──────────────────────────

test("stop is idempotent, releases the transport and returns to idle", async () => {
  const fake = new FakeSession()
  const h = harness(fake)
  await h.session.start(OPTS)

  h.session.stop()
  h.session.stop()
  assert.equal(fake.closeCalls, 1)
  assert.equal(h.session.live, false)
  assert.equal(h.states.at(-1), "idle")

  // Interrupt/mute after stop are safe no-ops.
  h.session.interrupt()
  h.session.mute(true)
  assert.equal(fake.interruptCalls, 0)
  assert.deepEqual(fake.muteCalls, [])
})

test("interrupt and mute reach the transport while live", async () => {
  const fake = new FakeSession()
  const h = harness(fake)
  await h.session.start(OPTS)
  h.session.interrupt()
  h.session.mute(true)
  h.session.mute(false)
  assert.equal(fake.interruptCalls, 1)
  assert.deepEqual(fake.muteCalls, [true, false])
})

// ─── Microphone failure classification (shared) ──────────────────────────────

test("classifyConnectFailure: permission / device / generic", () => {
  assert.equal(classifyConnectFailure({ name: "NotAllowedError" }), "permission_denied")
  assert.equal(classifyConnectFailure({ name: "SecurityError" }), "permission_denied")
  assert.equal(classifyConnectFailure({ name: "NotFoundError" }), "mic_unavailable")
  assert.equal(classifyConnectFailure({ name: "NotReadableError" }), "mic_unavailable")
  assert.equal(classifyConnectFailure(new Error("x")), "connection")
  assert.equal(classifyConnectFailure(undefined), "connection")
})

// ─── Capability evaluation (pure) ────────────────────────────────────────────

const FULL_ENV: VoiceEnvironment = {
  secureContext: true,
  hasMediaDevices: true,
  hasGetUserMedia: true,
  hasRTCPeerConnection: true,
  hasAudioPlayback: true,
  touchCapable: true,
}

test("evaluateVoiceSupport: full env supported; first missing requirement wins", () => {
  assert.deepEqual(evaluateVoiceSupport(FULL_ENV), {
    voiceSupported: true,
    touchCapable: true,
    unsupportedReason: null,
  })
  assert.equal(
    evaluateVoiceSupport({ ...FULL_ENV, secureContext: false }).unsupportedReason,
    "insecure_context",
  )
  assert.equal(
    evaluateVoiceSupport({ ...FULL_ENV, hasGetUserMedia: false }).unsupportedReason,
    "no_get_user_media",
  )
  assert.equal(
    evaluateVoiceSupport({ ...FULL_ENV, hasRTCPeerConnection: false }).voiceSupported,
    false,
  )
  // Touch capability is independent from voice support.
  const noTouch = evaluateVoiceSupport({ ...FULL_ENV, touchCapable: false })
  assert.equal(noTouch.voiceSupported, true)
  assert.equal(noTouch.touchCapable, false)
})
