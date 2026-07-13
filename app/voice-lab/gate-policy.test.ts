import assert from "node:assert/strict"
import test from "node:test"
import { decideLabGate, isVoiceLabEnabled, type LabGateSignals } from "./gate-policy"

const ALL_OK: LabGateSignals = {
  flagEnabled: true,
  authenticated: true,
  platformAuthorized: true,
  workspaceValid: true,
}

test("all signals true → allowed", () => {
  assert.deepEqual(decideLabGate(ALL_OK), { allowed: true })
})

test("flag off → 404 (hide the lab)", () => {
  assert.deepEqual(decideLabGate({ ...ALL_OK, flagEnabled: false }), {
    allowed: false,
    status: 404,
  })
})

test("unauthenticated → 404", () => {
  assert.deepEqual(decideLabGate({ ...ALL_OK, authenticated: false }), {
    allowed: false,
    status: 404,
  })
})

test("not a platform admin → 404 (do not reveal existence)", () => {
  assert.deepEqual(decideLabGate({ ...ALL_OK, platformAuthorized: false }), {
    allowed: false,
    status: 404,
  })
})

test("admin but invalid workspace → 403", () => {
  assert.deepEqual(decideLabGate({ ...ALL_OK, workspaceValid: false }), {
    allowed: false,
    status: 403,
  })
})

test("isVoiceLabEnabled is false unless the flag is exactly 'true'", () => {
  const prev = process.env.VOICE_LAB_ENABLED
  try {
    delete process.env.VOICE_LAB_ENABLED
    assert.equal(isVoiceLabEnabled(), false)
    process.env.VOICE_LAB_ENABLED = "1"
    assert.equal(isVoiceLabEnabled(), false)
    process.env.VOICE_LAB_ENABLED = "false"
    assert.equal(isVoiceLabEnabled(), false)
    process.env.VOICE_LAB_ENABLED = "true"
    assert.equal(isVoiceLabEnabled(), true)
  } finally {
    if (prev === undefined) delete process.env.VOICE_LAB_ENABLED
    else process.env.VOICE_LAB_ENABLED = prev
  }
})
