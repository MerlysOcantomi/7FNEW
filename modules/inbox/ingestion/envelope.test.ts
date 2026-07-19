import assert from "node:assert/strict"
import test from "node:test"
import {
  extractThreadHintMessageIds,
  validateInboundEnvelope,
  type InboundEnvelope,
} from "./envelope"
import { sanitizeIntegrationEvent } from "../integration-events"

const VALID: InboundEnvelope = {
  channel: "whatsapp",
  provider: "meta",
  workspaceId: "ws1",
  connectionId: "conn1",
  externalMessageId: "wamid.1",
  senderIdentity: { kind: "psid", rawValue: "34600111222" },
  text: "hola",
}

test("a complete envelope validates clean", () => {
  assert.deepEqual(validateInboundEnvelope(VALID), [])
})

test("missing routing fields are reported with machine codes", () => {
  const problems = validateInboundEnvelope({
    ...VALID,
    workspaceId: " ",
    provider: "",
    externalMessageId: "",
  })
  assert.ok(problems.includes("missing_workspace"))
  assert.ok(problems.includes("missing_provider"))
  assert.ok(problems.includes("missing_external_message_id"))
})

test("a sender identity needs a raw value or an external id", () => {
  const problems = validateInboundEnvelope({
    ...VALID,
    senderIdentity: { kind: "psid", rawValue: " " },
  })
  assert.ok(problems.includes("missing_sender_identity"))
  assert.deepEqual(
    validateInboundEnvelope({
      ...VALID,
      senderIdentity: { kind: "psid", rawValue: "", externalId: "psid-9" },
    }),
    [],
  )
})

test("attachment-only messages are valid; truly empty ones are not", () => {
  assert.deepEqual(
    validateInboundEnvelope({
      ...VALID,
      text: null,
      attachments: [{ filename: "a.jpg", url: "https://blob/a.jpg", contentType: "image/jpeg" }],
    }),
    [],
  )
  const problems = validateInboundEnvelope({ ...VALID, text: "  " })
  assert.ok(problems.includes("empty_message"))
})

test("thread hints merge replyTo and externalMessageIds without duplicates", () => {
  assert.deepEqual(
    extractThreadHintMessageIds({
      ...VALID,
      replyToExternalMessageId: "wamid.parent",
      threadHints: { externalMessageIds: ["wamid.parent", " wamid.root "] },
    }),
    ["wamid.parent", "wamid.root"],
  )
  assert.deepEqual(extractThreadHintMessageIds(VALID), [])
})

// ─── Observability sanitizer (no PII in logs) ───────────────────────────────

test("integration events drop unknown keys and PII-shaped detail entries", () => {
  const sanitized = sanitizeIntegrationEvent({
    event: "duplicate_inbound",
    workspaceId: "ws1",
    provider: "meta",
    // @ts-expect-error — hostile extra key must be dropped
    senderEmail: "lola@example.com",
    detail: {
      count: 2,
      contactEmail: "lola@example.com",
      phone: "+34600111222",
      signedUrl: "https://blob/x?sig=secret",
      reason: "retry",
    },
  })
  assert.deepEqual(sanitized, {
    event: "duplicate_inbound",
    workspaceId: "ws1",
    provider: "meta",
    detail: { count: 2, reason: "retry" },
  })
})
