import assert from "node:assert/strict"
import test from "node:test"
import {
  SESSION_LIVE_INITIAL,
  nextSessionLive,
  lifecycleView,
} from "./session-lifecycle"
import type { VoiceState } from "@core/voice/contracts"

// ─── sessionLive transitions ─────────────────────────────────────────────────

test("sessionLive starts false", () => {
  assert.equal(SESSION_LIVE_INITIAL, false)
})

test("only start_succeeded makes the session live", () => {
  assert.equal(nextSessionLive(false, { type: "start_succeeded" }), true)
})

test("requesting the token does not make the session live", () => {
  assert.equal(nextSessionLive(false, { type: "connect_requested" }), false)
})

test("a start failure never implies a live session (even from a live prev)", () => {
  assert.equal(nextSessionLive(true, { type: "connect_failed" }), false)
  assert.equal(nextSessionLive(false, { type: "connect_failed" }), false)
})

test("teardown always clears sessionLive", () => {
  assert.equal(nextSessionLive(true, { type: "teardown" }), false)
  assert.equal(nextSessionLive(false, { type: "teardown" }), false)
})

test("disconnect clears sessionLive", () => {
  assert.equal(nextSessionLive(true, { type: "disconnected" }), false)
})

// ─── Derived control state ───────────────────────────────────────────────────

test("error with a closed session reads as NOT connected → shows Connect, re-enables selectors", () => {
  const v = lifecycleView("error", false)
  assert.equal(v.sessionLive, false)
  assert.equal(v.primaryAction, "connect")
  assert.equal(v.selectorsDisabled, false, "model/voice selectable again after a failure")
  assert.equal(v.connectDisabled, false, "can reconnect")
  assert.equal(v.showMic, false, "no fake mic chip when the session is closed")
})

test("connecting locks a second connect attempt and the selectors", () => {
  const v = lifecycleView("connecting", false)
  assert.equal(v.connecting, true)
  assert.equal(v.controlsLocked, true)
  assert.equal(v.connectDisabled, true, "Conectar cannot be triggered twice while connecting")
  assert.equal(v.selectorsDisabled, true)
  assert.equal(v.primaryAction, "connect")
})

test("a live session shows Disconnect and the mic chip", () => {
  for (const s of ["listening", "thinking", "speaking", "interrupted"] as VoiceState[]) {
    const v = lifecycleView(s, true)
    assert.equal(v.primaryAction, "disconnect")
    assert.equal(v.showMic, true)
    assert.equal(v.selectorsDisabled, true)
  }
})
