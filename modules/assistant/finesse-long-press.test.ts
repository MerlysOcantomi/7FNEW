import assert from "node:assert/strict"
import test from "node:test"

import {
  LONG_PRESS_DELAY_MS,
  LongPressGesture,
  VOICE_HINT_MAX_SHOWS,
  shouldShowVoiceHint,
  type LongPressTimer,
} from "./finesse-long-press"

/** Deterministic manual timer. */
function fakeTimer() {
  let next = 0
  const pending = new Map<number, () => void>()
  const timer: LongPressTimer = {
    schedule: (fn) => {
      next += 1
      pending.set(next, fn)
      return next
    },
    cancel: (handle) => {
      pending.delete(handle as number)
    },
  }
  return {
    timer,
    fire: () => {
      for (const [id, fn] of [...pending]) {
        pending.delete(id)
        fn()
      }
    },
    pendingCount: () => pending.size,
  }
}

function harness() {
  const events: string[] = []
  const t = fakeTimer()
  const gesture = new LongPressGesture(
    { onLongPress: () => events.push("long-press"), onClick: () => events.push("click") },
    t.timer,
  )
  return { gesture, events, ...t }
}

// ─── Click vs hold ───────────────────────────────────────────────────────────

test("short tap: pointer up before the delay → normal click only", () => {
  const h = harness()
  h.gesture.pointerDown(10, 10, true)
  h.gesture.pointerUp()
  h.gesture.clickIntercepted()
  assert.deepEqual(h.events, ["click"])
  assert.equal(h.pendingCount(), 0)
})

test("long press fires once and the ensuing click is swallowed", () => {
  const h = harness()
  h.gesture.pointerDown(10, 10, true)
  h.fire() // delay elapsed
  h.gesture.pointerUp()
  const swallowed = h.gesture.clickIntercepted()
  assert.equal(swallowed, true)
  assert.deepEqual(h.events, ["long-press"], "no click after a completed hold")
})

test("only ONE click after a long press is swallowed — the next tap clicks", () => {
  const h = harness()
  h.gesture.pointerDown(0, 0, true)
  h.fire()
  h.gesture.pointerUp()
  h.gesture.clickIntercepted() // swallowed
  h.gesture.pointerDown(0, 0, true)
  h.gesture.pointerUp()
  h.gesture.clickIntercepted()
  assert.deepEqual(h.events, ["long-press", "click"])
})

test("fine pointers (mouse) never long-press — click only", () => {
  const h = harness()
  h.gesture.pointerDown(10, 10, false)
  assert.equal(h.pendingCount(), 0, "no timer for fine pointers")
  h.fire()
  h.gesture.pointerUp()
  h.gesture.clickIntercepted()
  assert.deepEqual(h.events, ["click"])
})

// ─── Movement / cancel ───────────────────────────────────────────────────────

test("moving beyond the tolerance cancels the timer (scroll intent)", () => {
  const h = harness()
  h.gesture.pointerDown(10, 10, true)
  h.gesture.pointerMove(40, 10) // 30px > tolerance
  assert.equal(h.pendingCount(), 0)
  h.fire()
  h.gesture.pointerUp()
  h.gesture.clickIntercepted()
  assert.deepEqual(h.events, ["click"], "cancelled hold degrades to a normal click")
})

test("movement within tolerance keeps the timer alive", () => {
  const h = harness()
  h.gesture.pointerDown(10, 10, true)
  h.gesture.pointerMove(14, 12)
  assert.equal(h.pendingCount(), 1)
  h.fire()
  assert.deepEqual(h.events, ["long-press"])
})

test("pointerCancel cleans the timer and suppresses nothing afterwards", () => {
  const h = harness()
  h.gesture.pointerDown(10, 10, true)
  h.gesture.pointerCancel()
  assert.equal(h.pendingCount(), 0)
  h.gesture.clickIntercepted()
  assert.deepEqual(h.events, ["click"])
})

test("keyboard activation (click without pointerdown) runs the normal click", () => {
  const h = harness()
  h.gesture.clickIntercepted()
  assert.deepEqual(h.events, ["click"])
})

test("delay default is within the 450–550ms mission window", () => {
  assert.ok(LONG_PRESS_DELAY_MS >= 450 && LONG_PRESS_DELAY_MS <= 550)
})

// ─── Hold-to-talk hint eligibility ───────────────────────────────────────────

const HINT_OK = {
  voiceSupported: true,
  touchCapable: true,
  entitled: true,
  everConnected: true,
  shownCount: 0,
}

test("hint: only when voice genuinely works on a touch device", () => {
  assert.equal(shouldShowVoiceHint(HINT_OK), true)
  assert.equal(shouldShowVoiceHint({ ...HINT_OK, voiceSupported: false }), false)
  assert.equal(shouldShowVoiceHint({ ...HINT_OK, touchCapable: false }), false)
  assert.equal(shouldShowVoiceHint({ ...HINT_OK, entitled: false }), false)
  assert.equal(shouldShowVoiceHint({ ...HINT_OK, everConnected: false }), false)
})

test("hint: capped at the max show count (persisted learning flag)", () => {
  assert.equal(shouldShowVoiceHint({ ...HINT_OK, shownCount: VOICE_HINT_MAX_SHOWS - 1 }), true)
  assert.equal(shouldShowVoiceHint({ ...HINT_OK, shownCount: VOICE_HINT_MAX_SHOWS }), false)
  assert.equal(shouldShowVoiceHint({ ...HINT_OK, shownCount: 99 }), false)
})
