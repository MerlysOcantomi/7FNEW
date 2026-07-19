import assert from "node:assert/strict"
import test from "node:test"
import {
  isKnownWebhookProvider,
  resolveWebhookRouting,
} from "./webhooks"

test("known providers are exactly the skeleton set", () => {
  for (const provider of ["meta", "twilio", "tiktok"]) {
    assert.ok(isKnownWebhookProvider(provider), provider)
  }
  assert.ok(!isKnownWebhookProvider("resend"))
  assert.ok(!isKnownWebhookProvider(""))
})

test("unknown providers are rejected before payload inspection", () => {
  assert.deepEqual(resolveWebhookRouting("smoke-signals", { providerAccountId: "x" }), {
    ok: false,
    reason: "unknown_provider",
  })
})

test("meta routes by entry id (Messenger/IG envelope)", () => {
  assert.deepEqual(resolveWebhookRouting("meta", { entry: [{ id: "page_123" }] }), {
    ok: true,
    providerAccountId: "page_123",
  })
})

test("meta WhatsApp Cloud payloads route by phone_number_id", () => {
  const body = {
    entry: [
      {
        changes: [{ value: { metadata: { phone_number_id: "phone_777" } } }],
      },
    ],
  }
  assert.deepEqual(resolveWebhookRouting("meta", body), {
    ok: true,
    providerAccountId: "phone_777",
  })
})

test("twilio routes by AccountSid; tiktok by client_key", () => {
  assert.deepEqual(resolveWebhookRouting("twilio", { AccountSid: "AC123" }), {
    ok: true,
    providerAccountId: "AC123",
  })
  assert.deepEqual(resolveWebhookRouting("tiktok", { client_key: "tk_9" }), {
    ok: true,
    providerAccountId: "tk_9",
  })
})

test("explicit providerAccountId works for any known provider (manual probes)", () => {
  assert.deepEqual(resolveWebhookRouting("twilio", { providerAccountId: " AC9 " }), {
    ok: true,
    providerAccountId: "AC9",
  })
})

test("malformed or unroutable payloads are flagged, never guessed", () => {
  for (const body of [null, "string", 42, {}, { entry: [] }, { entry: [{}] }, { AccountSid: "" }]) {
    const result = resolveWebhookRouting("meta", body)
    assert.equal(result.ok, false)
  }
  assert.deepEqual(resolveWebhookRouting("twilio", {}), { ok: false, reason: "unroutable_payload" })
})
