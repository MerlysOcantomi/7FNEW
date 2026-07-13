import assert from "node:assert/strict"
import test from "node:test"
import { describeConnectFailure, connectFailureCopy } from "./mic-errors"

test("denied microphone permission → specific copy", () => {
  const f = describeConnectFailure({ name: "NotAllowedError" })
  assert.equal(f.kind, "permission_denied")
  assert.match(f.message, /permiso/i)
  assert.equal(f.message, connectFailureCopy("permission_denied"))
})

test("SecurityError is also treated as a permission problem", () => {
  assert.equal(describeConnectFailure({ name: "SecurityError" }).kind, "permission_denied")
})

test("no usable microphone → mic-unavailable copy", () => {
  const f = describeConnectFailure({ name: "NotFoundError" })
  assert.equal(f.kind, "mic_unavailable")
  assert.match(f.message, /micrófono/i)
})

test("anything else → generic connection failure (no raw error shown)", () => {
  const f = describeConnectFailure(new Error("wss handshake 502 blah stack"))
  assert.equal(f.kind, "connection")
  assert.match(f.message, /conexión/i)
  assert.ok(!/502|wss|stack/.test(f.message), "raw technical detail must not leak")
})

test("non-object throw still classified as connection", () => {
  assert.equal(describeConnectFailure("boom").kind, "connection")
})
