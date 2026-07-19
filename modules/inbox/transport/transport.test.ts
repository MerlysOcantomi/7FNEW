import assert from "node:assert/strict"
import test from "node:test"
import { ensureBuiltInTransportsRegistered } from "./index"
import {
  registerChannelTransport,
  resolveChannelTransport,
  unregisterChannelTransportForTests,
} from "./registry"
import {
  buildConnectionSenderFromRecord,
  buildEmailSendArgs,
  mapEmailSendResult,
  resolveOpenTrackingEnabled,
} from "./email-transport"
import {
  buildEmailThreadingFromMetadata,
  normalizeRfcMessageId,
  shouldBuildReplyThreading,
} from "./email-threading"
import type { ChannelSendInput, ChannelTransport } from "./contracts"

ensureBuiltInTransportsRegistered()

const FAKE_WHATSAPP: ChannelTransport = {
  channel: "whatsapp",
  provider: "meta",
  send: async () => ({
    accepted: true,
    externalMessageId: "wamid.1",
    provider: "meta",
    initialDeliveryStatus: "sent",
    sentAt: new Date(),
    errorCode: null,
    retryable: false,
  }),
}

// ─── Registry ───────────────────────────────────────────────────────────────

test("email transports resolve for both providers", () => {
  for (const provider of ["resend", "imap_smtp"]) {
    const res = resolveChannelTransport({ channel: "email", provider })
    assert.ok(res.ok, provider)
  }
})

test("duplicate registration is rejected", () => {
  registerChannelTransport(FAKE_WHATSAPP)
  try {
    assert.throws(() => registerChannelTransport(FAKE_WHATSAPP), /already registered/)
  } finally {
    unregisterChannelTransportForTests("whatsapp", "meta")
  }
})

test("unknown channel is distinguished from missing transport", () => {
  const unknown = resolveChannelTransport({ channel: "telegram", provider: "x" })
  assert.deepEqual(unknown, { ok: false, reason: "unknown_channel" })
  // whatsapp CAN send per capabilities, but no adapter is registered.
  const missing = resolveChannelTransport({ channel: "whatsapp", provider: "meta" })
  assert.deepEqual(missing, { ok: false, reason: "transport_not_registered" })
})

test("channels whose capabilities forbid outbound are blocked before lookup", () => {
  // manual is an internal record — outbound: false in the channel registry.
  const res = resolveChannelTransport({ channel: "manual", provider: "resend" })
  assert.deepEqual(res, { ok: false, reason: "channel_not_outbound" })
})

test("provider mismatch does not resolve another provider's transport", () => {
  const res = resolveChannelTransport({ channel: "email", provider: "meta" })
  assert.deepEqual(res, { ok: false, reason: "transport_not_registered" })
})

// ─── Connection sender mapping ──────────────────────────────────────────────

test("resend connection maps fromEmail/fromName without SMTP config", () => {
  const sender = buildConnectionSenderFromRecord({
    provider: "resend",
    config: JSON.stringify({ fromEmail: "inbox@studio.com", fromName: "Studio" }),
    credentials: null,
    externalAccountId: "inbox@studio.com",
  })
  assert.deepEqual(sender, { fromEmail: "inbox@studio.com", fromName: "Studio", provider: "resend" })
})

test("imap_smtp connection attaches SMTP config and encrypted credentials", () => {
  const sender = buildConnectionSenderFromRecord({
    provider: "imap_smtp",
    config: JSON.stringify({
      fromEmail: "inbox@studio.com",
      smtpHost: "smtp.studio.com",
      smtpPort: "587",
      smtpSecure: "false",
    }),
    credentials: "encrypted-blob",
    externalAccountId: null,
  })
  assert.ok(sender)
  assert.equal(sender.provider, "imap_smtp")
  assert.equal(sender.encryptedCredentials, "encrypted-blob")
  assert.deepEqual(sender.smtpConfig, {
    smtpHost: "smtp.studio.com",
    smtpPort: 587,
    smtpSecure: false,
    fromEmail: "inbox@studio.com",
    fromName: null,
  })
})

test("connections without a usable sender or with broken config resolve to null", () => {
  assert.equal(
    buildConnectionSenderFromRecord({ provider: "resend", config: null, credentials: null, externalAccountId: null }),
    null,
  )
  assert.equal(
    buildConnectionSenderFromRecord({ provider: "resend", config: "{broken", credentials: null, externalAccountId: null }),
    null,
  )
  assert.equal(buildConnectionSenderFromRecord(null), null)
})

// ─── Send-args mapping ──────────────────────────────────────────────────────

const BASE_INPUT: ChannelSendInput = {
  workspaceId: "ws1",
  conversationId: "conv1",
  messageId: "msg1",
  connectionId: "conn1",
  to: { address: "client@example.com" },
  text: "Hola",
}

test("neutral input maps to email args with defaults preserved", () => {
  const args = buildEmailSendArgs(BASE_INPUT, {
    workspaceName: "Studio",
    workspaceConfig: null,
    conversationSubject: "Booking",
    connectionSender: null,
    threading: null,
  })
  assert.equal(args.contactEmail, "client@example.com")
  assert.equal(args.subject, "Booking")
  assert.equal(args.mode, "reply")
  assert.equal(args.tracking?.enabled, true)
  assert.equal(args.tracking?.askConfirm, false)
  assert.equal(args.attachments, undefined)
  assert.equal(args.threading, undefined)
})

test("attachments, recipients, mode and threading map through", () => {
  const args = buildEmailSendArgs(
    {
      ...BASE_INPUT,
      subject: "Re: Booking",
      cc: ["cc@example.com"],
      bcc: ["bcc@example.com"],
      extraRecipients: ["fwd@example.com"],
      attachments: [{ filename: "a.pdf", url: "https://blob/a.pdf", contentType: "application/pdf" }],
      channelData: { mode: "reply_all", requestConfirmation: true },
    },
    {
      workspaceName: "Studio",
      workspaceConfig: JSON.stringify({ email: { openTracking: { enabled: false } } }),
      conversationSubject: "Booking",
      connectionSender: null,
      threading: { inReplyTo: "<a@x>", references: ["<a@x>"] },
    },
  )
  assert.equal(args.mode, "reply_all")
  assert.deepEqual(args.cc, ["cc@example.com"])
  assert.deepEqual(args.bcc, ["bcc@example.com"])
  assert.deepEqual(args.to, ["fwd@example.com"])
  assert.deepEqual(args.attachments, [
    { filename: "a.pdf", url: "https://blob/a.pdf", contentType: "application/pdf" },
  ])
  assert.equal(args.tracking?.enabled, false)
  assert.equal(args.tracking?.askConfirm, true)
  assert.deepEqual(args.threading, { inReplyTo: "<a@x>", references: ["<a@x>"] })
})

test("open tracking defaults on and survives malformed config", () => {
  assert.equal(resolveOpenTrackingEnabled(null), true)
  assert.equal(resolveOpenTrackingEnabled("{broken"), true)
  assert.equal(
    resolveOpenTrackingEnabled(JSON.stringify({ email: { openTracking: { enabled: false } } })),
    false,
  )
})

// ─── Result mapping ─────────────────────────────────────────────────────────

const AT = new Date("2026-07-19T10:00:00Z")

test("success maps to accepted/sent with the provider message id", () => {
  const result = mapEmailSendResult({ ok: true, id: "re_9" }, "resend", AT)
  assert.equal(result.accepted, true)
  assert.equal(result.externalMessageId, "re_9")
  assert.equal(result.initialDeliveryStatus, "sent")
  assert.equal(result.sentAt, AT)
  assert.equal(result.retryable, false)
})

test("failure maps to a retryable email_send_failed", () => {
  const result = mapEmailSendResult({ ok: false, error: "provider 500" }, "imap_smtp", AT)
  assert.equal(result.accepted, false)
  assert.equal(result.initialDeliveryStatus, "failed")
  assert.equal(result.errorCode, "email_send_failed")
  assert.equal(result.retryable, true)
  assert.equal(result.externalMessageId, null)
})

// ─── RFC threading ──────────────────────────────────────────────────────────

test("message ids normalize to <...> form and reject garbage", () => {
  assert.equal(normalizeRfcMessageId("abc@mail.example"), "<abc@mail.example>")
  assert.equal(normalizeRfcMessageId("<abc@mail.example>"), "<abc@mail.example>")
  assert.equal(normalizeRfcMessageId("no-at-sign"), null)
  assert.equal(normalizeRfcMessageId("has spaces@x"), null)
  assert.equal(normalizeRfcMessageId(""), null)
  assert.equal(normalizeRfcMessageId(42), null)
})

test("reply threading extends the parent's references chain", () => {
  const headers = buildEmailThreadingFromMetadata(
    JSON.stringify({
      emailMessageId: "<msg3@mail>",
      references: ["<msg1@mail>", "msg2@mail"],
    }),
  )
  assert.deepEqual(headers, {
    inReplyTo: "<msg3@mail>",
    references: ["<msg1@mail>", "<msg2@mail>", "<msg3@mail>"],
  })
})

test("string-form references and duplicates are handled", () => {
  const headers = buildEmailThreadingFromMetadata({
    emailMessageId: "msg2@mail",
    references: "<msg1@mail> <msg2@mail>",
  })
  assert.deepEqual(headers, {
    inReplyTo: "<msg2@mail>",
    references: ["<msg1@mail>", "<msg2@mail>"],
  })
})

test("messages without a usable parent id produce no headers (unthreaded send)", () => {
  assert.equal(buildEmailThreadingFromMetadata(null), null)
  assert.equal(buildEmailThreadingFromMetadata("{broken"), null)
  assert.equal(buildEmailThreadingFromMetadata(JSON.stringify({ references: ["<a@x>"] })), null)
  // Historically imported conversations with malformed ids stay unthreaded.
  assert.equal(
    buildEmailThreadingFromMetadata(JSON.stringify({ emailMessageId: "not a message id" })),
    null,
  )
})

test("replies and reply-alls thread; forwards start a new thread", () => {
  assert.equal(shouldBuildReplyThreading("reply"), true)
  assert.equal(shouldBuildReplyThreading("reply_all"), true)
  assert.equal(shouldBuildReplyThreading(undefined), true)
  assert.equal(shouldBuildReplyThreading("forward"), false)
})
