/**
 * Integration tests for the common outbound service (INBOX-TRANSPORT-05C)
 * against a real pushed-schema SQLite db, using a FAKE WhatsApp transport to
 * exercise the neutral flow without any external API. The email path runs
 * the real EmailTransport, which fails safely without provider credentials —
 * exactly the honest failure the service must surface.
 */

import assert from "node:assert/strict"
import test from "node:test"
import { execSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const dir = mkdtempSync(join(tmpdir(), "inbox-outbound-"))
const dbUrl = `file:${join(dir, "test.db")}`
process.env.DATABASE_URL = dbUrl
delete process.env.RESEND_API_KEY

/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any
let sendConversationMessage: any
let registerChannelTransport: any
let unregisterChannelTransportForTests: any
let ws: any
let contact: any
let contactNoPhone: any

async function makeConversation(channel: string, contactId: string) {
  const conv = await db.conversation.create({
    data: { workspaceId: ws.id, contactId, channel },
  })
  const msg = await db.message.create({
    data: {
      workspaceId: ws.id,
      conversationId: conv.id,
      role: "operator",
      direction: "outbound",
      content: "Hola!",
    },
  })
  return { conversationId: conv.id, messageId: msg.id }
}

const fakeWhatsApp = {
  channel: "whatsapp" as const,
  provider: "meta",
  send: async (input: any) => ({
    accepted: true,
    externalMessageId: `wamid.sent.${input.messageId}`,
    provider: "meta",
    initialDeliveryStatus: "sent" as const,
    sentAt: new Date(),
    errorCode: null,
    retryable: false,
  }),
}

test.before(async () => {
  execSync(`npx prisma db push --accept-data-loss --url "${dbUrl}"`, {
    stdio: "ignore",
    cwd: process.cwd(),
  })
  ;({ db } = await import("@core/db"))
  ;({ sendConversationMessage } = await import("./outbound-service"))
  ;({ registerChannelTransport, unregisterChannelTransportForTests } = await import(
    "./transport/registry"
  ))
  ws = await db.workspace.create({ data: { nombre: "Out", slug: "ws-out" } })
  const conn = await db.channelConnection.create({
    data: { workspaceId: ws.id, channelType: "whatsapp", provider: "meta", name: "WA" },
  })
  void conn
  contact = await db.contact.create({
    data: { workspaceId: ws.id, nombre: "Ana", telefono: "+34600111222", email: "ana@x.com" },
  })
  contactNoPhone = await db.contact.create({ data: { workspaceId: ws.id, nombre: "SinDatos" } })
})

test.after(() => {
  rmSync(dir, { recursive: true, force: true })
})

test("a registered transport sends: projection + sourceMessageId, no email metadata pollution", async () => {
  registerChannelTransport(fakeWhatsApp)
  try {
    // Attach the whatsapp connection so provider resolution finds "meta".
    const conv = await db.conversation.create({
      data: {
        workspaceId: ws.id,
        contactId: contact.id,
        channel: "whatsapp",
        connectionId: (await db.channelConnection.findFirst({ where: { workspaceId: ws.id } })).id,
      },
    })
    const msg = await db.message.create({
      data: { workspaceId: ws.id, conversationId: conv.id, role: "operator", direction: "outbound", content: "Hola" },
    })
    const outcome = await sendConversationMessage({
      workspaceId: ws.id,
      conversationId: conv.id,
      messageId: msg.id,
      content: "Hola",
    })
    assert.equal(outcome.status, "sent")
    const updated = await db.message.findUnique({ where: { id: msg.id } })
    assert.equal(updated.deliveryStatus, "sent")
    assert.equal(updated.sourceMessageId, `wamid.sent.${msg.id}`)
    assert.equal(updated.metadata, null) // legacy email keys are email-only
  } finally {
    unregisterChannelTransportForTests("whatsapp", "meta")
  }
})

test("enabled channel without a transport fails honestly (transport_not_registered)", async () => {
  const conn = await db.channelConnection.findFirst({ where: { workspaceId: ws.id } })
  const conv = await db.conversation.create({
    data: { workspaceId: ws.id, contactId: contact.id, channel: "whatsapp", connectionId: conn.id },
  })
  const msg = await db.message.create({
    data: { workspaceId: ws.id, conversationId: conv.id, role: "operator", direction: "outbound", content: "Hola" },
  })
  const outcome = await sendConversationMessage({
    workspaceId: ws.id,
    conversationId: conv.id,
    messageId: msg.id,
    content: "Hola",
  })
  assert.deepEqual(
    { status: outcome.status, errorCode: outcome.errorCode },
    { status: "skipped", errorCode: "transport_not_registered" },
  )
  const updated = await db.message.findUnique({ where: { id: msg.id } })
  assert.equal(updated.deliveryStatus, "failed")
  assert.equal(updated.failureCode, "transport_not_registered")
})

test("a retry through the same service supersedes the failure once a transport exists", async () => {
  // The message failed in the previous test; the integration comes online.
  const failed = await db.message.findFirst({
    where: { workspaceId: ws.id, failureCode: "transport_not_registered" },
  })
  registerChannelTransport(fakeWhatsApp)
  try {
    const outcome = await sendConversationMessage({
      workspaceId: ws.id,
      conversationId: failed.conversationId,
      messageId: failed.id,
      content: "Hola",
      isRetry: true,
    })
    assert.equal(outcome.status, "sent")
    const updated = await db.message.findUnique({ where: { id: failed.id } })
    assert.equal(updated.deliveryStatus, "sent") // monotonic supersede
    assert.equal(updated.sourceMessageId, `wamid.sent.${failed.id}`) // new external id
  } finally {
    unregisterChannelTransportForTests("whatsapp", "meta")
  }
})

test("channels without outbound capability are skipped before transport lookup", async () => {
  const { conversationId, messageId } = await makeConversation("manual", contact.id)
  const outcome = await sendConversationMessage({
    workspaceId: ws.id,
    conversationId,
    messageId,
    content: "x",
  })
  assert.deepEqual(
    { status: outcome.status, errorCode: outcome.errorCode },
    { status: "skipped", errorCode: "channel_not_outbound" },
  )
  const updated = await db.message.findUnique({ where: { id: messageId } })
  assert.equal(updated.deliveryStatus, "none") // no projection on skips
})

test("missing recipient skips without attempting or projecting", async () => {
  registerChannelTransport(fakeWhatsApp)
  try {
    const conn = await db.channelConnection.findFirst({ where: { workspaceId: ws.id } })
    const conv = await db.conversation.create({
      data: { workspaceId: ws.id, contactId: contactNoPhone.id, channel: "whatsapp", connectionId: conn.id },
    })
    const msg = await db.message.create({
      data: { workspaceId: ws.id, conversationId: conv.id, role: "operator", direction: "outbound", content: "x" },
    })
    const outcome = await sendConversationMessage({
      workspaceId: ws.id,
      conversationId: conv.id,
      messageId: msg.id,
      content: "x",
    })
    assert.deepEqual(
      { status: outcome.status, errorCode: outcome.errorCode },
      { status: "skipped", errorCode: "missing_recipient" },
    )
    const updated = await db.message.findUnique({ where: { id: msg.id } })
    assert.equal(updated.deliveryStatus, "none")
  } finally {
    unregisterChannelTransportForTests("whatsapp", "meta")
  }
})

test("email flows through the real EmailTransport and fails safely without credentials", async () => {
  const { conversationId, messageId } = await makeConversation("email", contact.id)
  const outcome = await sendConversationMessage({
    workspaceId: ws.id,
    conversationId,
    messageId,
    content: "Hola por email",
    mode: "reply",
  })
  assert.equal(outcome.status, "failed")
  assert.equal(outcome.errorCode, "email_send_failed")
  assert.equal(outcome.retryable, true)
  const updated = await db.message.findUnique({ where: { id: messageId } })
  assert.equal(updated.deliveryStatus, "failed")
  // Legacy dual-write present for email.
  const meta = JSON.parse(updated.metadata)
  assert.equal(meta.emailStatus, "failed")
  assert.ok(meta.emailAttemptedAt)
})
