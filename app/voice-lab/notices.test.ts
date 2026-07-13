import assert from "node:assert/strict"
import test from "node:test"
import {
  EMPTY_NOTICES,
  withSessionNotice,
  withConfirmationResult,
  withError,
} from "./notices"

test("channels are independent — one does not clobber the others", () => {
  let n = EMPTY_NOTICES
  n = withSessionNotice(n, "Queda ~1 minuto.")
  n = withError(n, "No se pudo conectar.")
  n = withConfirmationResult(n, { kind: "confirmed", message: "ok" })

  assert.equal(n.session, "Queda ~1 minuto.")
  assert.equal(n.error, "No se pudo conectar.")
  assert.deepEqual(n.confirmation, { kind: "confirmed", message: "ok" })
})

test("updating one channel leaves the rest intact", () => {
  let n = withConfirmationResult(withSessionNotice(EMPTY_NOTICES, "s"), {
    kind: "expired",
    message: "expiró",
  })
  n = withError(n, "err")
  assert.equal(n.session, "s")
  assert.equal(n.confirmation?.kind, "expired")
  assert.equal(n.error, "err")
})

test("a channel can be cleared individually", () => {
  let n = withSessionNotice(EMPTY_NOTICES, "s")
  n = withConfirmationResult(n, { kind: "cancelled", message: "c" })
  n = withConfirmationResult(n, null)
  assert.equal(n.confirmation, null)
  assert.equal(n.session, "s")
})
