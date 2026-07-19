import assert from "node:assert/strict"
import test from "node:test"
import {
  EMPTY_DELIVERY_STATE,
  projectDeliveryEvent,
  type DeliveryState,
} from "./delivery-projection"

const T0 = new Date("2026-07-19T10:00:00Z")
const T1 = new Date("2026-07-19T10:01:00Z")
const T2 = new Date("2026-07-19T10:02:00Z")

function state(partial: Partial<DeliveryState>): DeliveryState {
  return { ...EMPTY_DELIVERY_STATE, ...partial }
}

// ─── Monotonic progression ──────────────────────────────────────────────────

test("normal progression: queued → sent → delivered → read", () => {
  let s: DeliveryState = { ...EMPTY_DELIVERY_STATE }
  s = projectDeliveryEvent(s, { type: "queued", at: T0 })!
  assert.equal(s.deliveryStatus, "queued")
  s = projectDeliveryEvent(s, { type: "sent", at: T0 })!
  assert.equal(s.deliveryStatus, "sent")
  assert.equal(s.sentAt, T0)
  s = projectDeliveryEvent(s, { type: "delivered", at: T1 })!
  assert.equal(s.deliveryStatus, "delivered")
  s = projectDeliveryEvent(s, { type: "read", at: T2, readSource: "provider_receipt" })!
  assert.equal(s.deliveryStatus, "read")
  assert.equal(s.readAt, T2)
  assert.equal(s.readSource, "provider_receipt")
})

test("status never downgrades: late 'delivered' after 'read' fills the timestamp only", () => {
  const current = state({ deliveryStatus: "read", sentAt: T0, readAt: T2, readSource: "provider_receipt" })
  const next = projectDeliveryEvent(current, { type: "delivered", at: T1 })!
  assert.equal(next.deliveryStatus, "read") // no downgrade
  assert.equal(next.deliveredAt, T1) // timestamp still recorded
  assert.equal(next.readAt, T2)
})

test("duplicate events are no-ops (null)", () => {
  const current = state({ deliveryStatus: "sent", sentAt: T0 })
  assert.equal(projectDeliveryEvent(current, { type: "sent", at: T1 }), null)
  const read = state({ deliveryStatus: "read", sentAt: T0, readAt: T1, readSource: "manual" })
  assert.equal(
    projectDeliveryEvent(read, { type: "read", at: T2, readSource: "tracking_pixel" }),
    null,
  )
})

// ─── Failure states ─────────────────────────────────────────────────────────

test("failure is terminal and only reachable pre-delivered", () => {
  const sent = state({ deliveryStatus: "sent", sentAt: T0 })
  const failed = projectDeliveryEvent(sent, { type: "failed", at: T1, failureCode: "email_send_failed" })!
  assert.equal(failed.deliveryStatus, "failed")
  assert.equal(failed.failureCode, "email_send_failed")
  assert.equal(failed.failedAt, T1)
  // Already delivered → failure rejected.
  const delivered = state({ deliveryStatus: "delivered", deliveredAt: T1 })
  assert.equal(projectDeliveryEvent(delivered, { type: "failed", at: T2 }), null)
  // Double failure → no-op.
  assert.equal(projectDeliveryEvent(failed, { type: "undeliverable", at: T2 }), null)
})

test("a successful re-send supersedes a previous failure", () => {
  const failed = state({ deliveryStatus: "failed", failedAt: T1, failureCode: "email_send_failed" })
  const resent = projectDeliveryEvent(failed, { type: "sent", at: T2 })!
  assert.equal(resent.deliveryStatus, "sent")
  assert.equal(resent.sentAt, T2)
  // Read receipts on a failed message stay ignored.
  assert.equal(
    projectDeliveryEvent(failed, { type: "read", at: T2, readSource: "provider_receipt" }),
    null,
  )
})

// ─── readSource strength ────────────────────────────────────────────────────

test("pixel sets read; provider receipt upgrades provenance", () => {
  let s = state({ deliveryStatus: "sent", sentAt: T0 })
  s = projectDeliveryEvent(s, { type: "read", at: T2, readSource: "tracking_pixel" })!
  assert.equal(s.readSource, "tracking_pixel")
  const upgraded = projectDeliveryEvent(s, { type: "read", at: T1, readSource: "provider_receipt" })!
  assert.equal(upgraded.readSource, "provider_receipt")
  // Earlier, stronger evidence moves readAt back.
  assert.equal(upgraded.readAt, T1)
})

test("a weaker source never downgrades a stronger one", () => {
  const manual = state({ deliveryStatus: "read", readAt: T1, readSource: "manual" })
  assert.equal(projectDeliveryEvent(manual, { type: "read", at: T0, readSource: "tracking_pixel" }), null)
})

test("read events without a source are invalid", () => {
  assert.equal(projectDeliveryEvent({ ...EMPTY_DELIVERY_STATE }, { type: "read", at: T0 }), null)
})

// ─── Out-of-order callbacks ─────────────────────────────────────────────────

test("read arriving before delivered still progresses; delivered fills later", () => {
  let s = state({ deliveryStatus: "sent", sentAt: T0 })
  s = projectDeliveryEvent(s, { type: "read", at: T1, readSource: "provider_receipt" })!
  assert.equal(s.deliveryStatus, "read")
  const next = projectDeliveryEvent(s, { type: "delivered", at: T2 })!
  assert.equal(next.deliveryStatus, "read")
  assert.equal(next.deliveredAt, T2)
})
