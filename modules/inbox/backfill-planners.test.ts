import assert from "node:assert/strict"
import test from "node:test"
import {
  planAttachmentBackfillForMessage,
  planDeliveryBackfillForMessage,
  planIdentityBackfillForContact,
} from "./backfill-planners"

const CREATED = new Date("2026-07-01T10:00:00Z")

// ─── Identity plans ─────────────────────────────────────────────────────────

test("contact email and phone become identity plans; phone stays conservative", () => {
  const plans = planIdentityBackfillForContact({
    email: " Lola@Example.com ",
    telefono: "612 34 56 78",
    nombre: "Lola",
  })
  assert.equal(plans.length, 2)
  assert.deepEqual(plans[0].descriptor, {
    channel: "email",
    provider: "unknown",
    scopeKey: "",
    kind: "email",
    externalKey: "lola@example.com",
  })
  // No country context → digits-only + partial-normalization marker.
  assert.equal(plans[1].descriptor.externalKey, "612345678")
  assert.deepEqual(plans[1].metadata, { normalization: "partial" })
})

test("E.164-ready phones carry no partial marker; empty contacts plan nothing", () => {
  const plans = planIdentityBackfillForContact({ telefono: "+34 612 345 678" })
  assert.equal(plans.length, 1)
  assert.equal(plans[0].descriptor.externalKey, "+34612345678")
  assert.equal(plans[0].metadata, null)
  assert.deepEqual(planIdentityBackfillForContact({}), [])
  assert.deepEqual(planIdentityBackfillForContact({ email: "not-an-email" }), [])
})

// ─── Delivery plans ─────────────────────────────────────────────────────────

test("sent + opened metadata projects sent and pixel read", () => {
  const plan = planDeliveryBackfillForMessage({
    direction: "outbound",
    isInternal: false,
    createdAt: CREATED,
    sourceMessageId: null,
    metadata: JSON.stringify({
      emailStatus: "sent",
      emailAttemptedAt: "2026-07-01T10:05:00Z",
      openedAt: "2026-07-01T11:00:00Z",
      resendId: "re_123",
    }),
  })
  assert.equal(plan.events.length, 2)
  assert.equal(plan.events[0].type, "sent")
  assert.equal(plan.events[0].at.toISOString(), "2026-07-01T10:05:00.000Z")
  assert.equal(plan.events[1].type, "read")
  assert.equal(plan.events[1].readSource, "tracking_pixel")
  assert.equal(plan.sourceMessageId, "re_123")
})

test("manual confirmation plans a manual read on top of the pixel", () => {
  const plan = planDeliveryBackfillForMessage({
    direction: "outbound",
    isInternal: false,
    createdAt: CREATED,
    metadata: JSON.stringify({
      emailStatus: "sent",
      openedAt: "2026-07-01T11:00:00Z",
      confirmedReadAt: "2026-07-01T12:00:00Z",
    }),
  })
  assert.deepEqual(
    plan.events.map((e) => e.type),
    ["sent", "read", "read"],
  )
  assert.equal(plan.events[2].readSource, "manual")
})

test("failed and pending map conservatively; inbound/internal/no-signal plan nothing", () => {
  const failed = planDeliveryBackfillForMessage({
    direction: "outbound",
    isInternal: false,
    createdAt: CREATED,
    metadata: JSON.stringify({ emailStatus: "failed" }),
  })
  assert.equal(failed.events[0].type, "failed")
  assert.equal(failed.events[0].failureCode, "email_send_failed")

  const pending = planDeliveryBackfillForMessage({
    direction: "outbound",
    isInternal: false,
    createdAt: CREATED,
    metadata: JSON.stringify({ emailStatus: "pending" }),
  })
  assert.equal(pending.events[0].type, "queued")

  for (const message of [
    { direction: "inbound", isInternal: false, createdAt: CREATED, metadata: JSON.stringify({ emailStatus: "sent" }) },
    { direction: "outbound", isInternal: true, createdAt: CREATED, metadata: JSON.stringify({ emailStatus: "sent" }) },
    { direction: "outbound", isInternal: false, createdAt: CREATED, metadata: null },
    { direction: "outbound", isInternal: false, createdAt: CREATED, metadata: "{broken" },
  ]) {
    assert.deepEqual(planDeliveryBackfillForMessage(message).events, [])
  }
})

test("sourceMessageId only projects when the column is still empty", () => {
  const plan = planDeliveryBackfillForMessage({
    direction: "outbound",
    isInternal: false,
    createdAt: CREATED,
    sourceMessageId: "already-set",
    metadata: JSON.stringify({ emailStatus: "sent", resendId: "re_123" }),
  })
  assert.equal(plan.sourceMessageId, null)
})

// ─── Attachment plans ───────────────────────────────────────────────────────

test("metadata attachment arrays become stored inputs; URL-less refs are skipped", () => {
  const plan = planAttachmentBackfillForMessage({
    metadata: JSON.stringify({
      attachments: [
        { filename: "a.pdf", url: "https://blob/a.pdf", contentType: "application/pdf", size: 123 },
        { filename: "ghost.png" }, // no URL → unrecoverable, never invented
        "garbage",
      ],
    }),
  })
  assert.equal(plan.length, 1)
  assert.deepEqual(plan[0], {
    filename: "a.pdf",
    url: "https://blob/a.pdf",
    contentType: "application/pdf",
    size: 123,
    status: "stored",
  })
})

test("messages without attachment metadata plan nothing", () => {
  assert.deepEqual(planAttachmentBackfillForMessage({ metadata: null }), [])
  assert.deepEqual(planAttachmentBackfillForMessage({ metadata: JSON.stringify({}) }), [])
  assert.deepEqual(planAttachmentBackfillForMessage({ metadata: "{broken" }), [])
})
