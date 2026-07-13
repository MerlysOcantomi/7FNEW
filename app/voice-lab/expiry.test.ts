import assert from "node:assert/strict"
import test from "node:test"
import { expiryView, EXPIRED_LABEL } from "./expiry"

const ISO_RE = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/

test("active proposal shows a human countdown, never a raw ISO string", () => {
  const now = Date.parse("2026-01-01T12:00:00.000Z")
  const v = expiryView("2026-01-01T12:00:45.000Z", now)
  assert.equal(v.status, "active")
  assert.equal(v.secondsLeft, 45)
  assert.equal(v.label, "Expira en 45 s")
  assert.ok(!ISO_RE.test(v.label), "label must not contain an ISO timestamp")
})

test("rounds up remaining seconds", () => {
  const now = Date.parse("2026-01-01T12:00:00.000Z")
  const v = expiryView("2026-01-01T12:00:00.500Z", now)
  assert.equal(v.secondsLeft, 1)
  assert.equal(v.label, "Expira en 1 s")
})

test("at or past expiry → expired state", () => {
  const now = Date.parse("2026-01-01T12:00:00.000Z")
  assert.equal(expiryView("2026-01-01T12:00:00.000Z", now).status, "expired")
  assert.equal(expiryView("2026-01-01T11:59:59.000Z", now).label, EXPIRED_LABEL)
})

test("invalid instant → expired (never renders ISO)", () => {
  const v = expiryView("not-a-date", Date.now())
  assert.equal(v.status, "expired")
  assert.ok(!ISO_RE.test(v.label))
})
