import assert from "node:assert/strict"
import test from "node:test"
import { provisionTestDatabase, type ProvisionedDatabase } from "@/test/support/postgres"

/**
 * NEON-03 — RFC Message-ID semantics on REAL PostgreSQL through the real
 * ingestion entry point (`ingestInboundEmail`). Pins the contract the SQLite
 * gate (`email-message-id-casing.test.ts`) documented:
 *   1. In-Reply-To threading   — case-insensitive lookup;
 *   2. References threading    — case-insensitive lookup;
 *   3. historical sourceId     — verbatim (exact) fallback;
 *   4. duplicate by Message-ID — case-insensitive lookup;
 * plus workspace isolation: the same Message-ID in another workspace is a
 * new, independent conversation.
 *
 * Real-world Message-IDs are mixed-case; ingestion persists the header as
 * received while the lookups search the lower-cased form.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
let database: ProvisionedDatabase
let db: any
let ingestInboundEmail: typeof import("./email-inbound")["ingestInboundEmail"]
let wsA: any
let wsB: any
let connA: any
let connB: any

const RAW_MESSAGE_ID = "<CAB+7Fx9KqZ_Mixed.Case@mail.Example.COM>"
const LOWER_MESSAGE_ID = "cab+7fx9kqz_mixed.case@mail.example.com"

function email(conn: any, workspaceId: string, uid: number, overrides: Record<string, unknown> = {}) {
  return {
    source: "imap",
    sourceId: `imap:${conn.id}:${uid}`,
    from: "Lola <lola@example.com>",
    to: ["inbox@a.com"],
    subject: "Mixed case",
    text: "Hola",
    html: null,
    headers: { "message-id": RAW_MESSAGE_ID },
    messageId: RAW_MESSAGE_ID,
    connectionId: conn.id,
    workspaceId,
    ...overrides,
  }
}

test.before(async () => {
  database = await provisionTestDatabase("email-message-id")
  ;({ db } = await import("@core/db"))
  ;({ ingestInboundEmail } = await import("./email-inbound"))

  wsA = await db.workspace.create({ data: { nombre: "A", slug: "ws-mid-a" } })
  wsB = await db.workspace.create({ data: { nombre: "B", slug: "ws-mid-b" } })
  connA = await db.channelConnection.create({
    data: { workspaceId: wsA.id, channelType: "email", provider: "imap_smtp", name: "Mail A", externalAccountId: "inbox@a.com" },
  })
  connB = await db.channelConnection.create({
    data: { workspaceId: wsB.id, channelType: "email", provider: "imap_smtp", name: "Mail B", externalAccountId: "inbox@b.com" },
  })
})

test.after(async () => {
  await db.$disconnect()
  await database.dispose()
})

let firstConversationId = ""

test("ingestion persists the Message-ID with its original casing (the lookups must not depend on it)", async () => {
  const first = await ingestInboundEmail(email(connA, wsA.id, 201))
  assert.equal(first.isNewConversation, true)
  firstConversationId = first.conversationId

  const stored = await db.message.findUnique({ where: { id: first.messageId }, select: { metadata: true } })
  assert.ok(stored?.metadata?.includes(RAW_MESSAGE_ID), "original casing persisted")
  assert.ok(!stored?.metadata?.includes(LOWER_MESSAGE_ID), "the lower-cased form is NOT in the metadata")
})

test("lookup 1: a reply whose In-Reply-To is the mixed-case id threads into the same conversation", async () => {
  const reply = await ingestInboundEmail(
    email(connA, wsA.id, 202, {
      messageId: "<Reply.One@mail.Example.COM>",
      headers: { "message-id": "<Reply.One@mail.Example.COM>", "in-reply-to": RAW_MESSAGE_ID },
      text: "¿El viernes?",
    }),
  )
  assert.equal(reply.conversationId, firstConversationId)
  assert.equal(reply.isNewConversation, false)
  assert.equal(reply.matchedBy, "in-reply-to")
})

test("lookup 2: a reply that only carries References (mixed case) threads into the same conversation", async () => {
  const reply = await ingestInboundEmail(
    email(connA, wsA.id, 203, {
      from: "Someone Else <else@example.org>",
      messageId: "<Reply.Two@mail.Example.COM>",
      headers: { "message-id": "<Reply.Two@mail.Example.COM>", references: `<First.Ref@Example.com> ${RAW_MESSAGE_ID}` },
      text: "Sumándome al hilo",
    }),
  )
  assert.equal(reply.conversationId, firstConversationId)
  assert.equal(reply.matchedBy, "references")
})

test("lookup 4: the same Message-ID arriving under a NEW sourceId is a duplicate (case-insensitive), not a second message", async () => {
  const before = await db.message.count({ where: { workspaceId: wsA.id, direction: "inbound" } })
  const again = await ingestInboundEmail(email(connA, wsA.id, 204))
  assert.equal(again.alreadyProcessed, true)
  assert.equal(again.conversationId, firstConversationId)
  assert.equal(await db.message.count({ where: { workspaceId: wsA.id, direction: "inbound" } }), before)
})

test("lookup 3: the historical sourceId fallback matches the persisted sourceId verbatim (exact)", async () => {
  // A row ingested before `sourceMessageId` was dual-written: only the metadata carries the id.
  const legacyConversation = await db.conversation.create({
    data: { workspaceId: wsA.id, contactId: (await db.contact.findFirst({ where: { workspaceId: wsA.id } })).id, channel: "email", status: "new" },
  })
  await db.message.create({
    data: {
      workspaceId: wsA.id,
      conversationId: legacyConversation.id,
      role: "visitor",
      direction: "inbound",
      content: "legacy",
      sourceMessageId: null,
      metadata: JSON.stringify({ source: "email", sourceId: "imap:legacy-conn:9" }),
    },
  })
  const dedup = await ingestInboundEmail(
    email(connA, wsA.id, 205, { sourceId: "imap:legacy-conn:9", messageId: "<Legacy.Nine@mail.example.com>", headers: { "message-id": "<Legacy.Nine@mail.example.com>" } }),
  )
  assert.equal(dedup.alreadyProcessed, true)
  assert.equal(dedup.conversationId, legacyConversation.id)

  // Verbatim means verbatim: a differently-cased sourceId is NOT the same source.
  const different = await ingestInboundEmail(
    email(connA, wsA.id, 206, { sourceId: "IMAP:LEGACY-CONN:9", messageId: "<Legacy.Ten@mail.example.com>", headers: { "message-id": "<Legacy.Ten@mail.example.com>" } }),
  )
  assert.notEqual(different.alreadyProcessed, true)
})

test("workspace isolation: the same Message-ID in another workspace is a new conversation there", async () => {
  const inB = await ingestInboundEmail(email(connB, wsB.id, 301, { to: ["inbox@b.com"] }))
  assert.equal(inB.isNewConversation, true)
  assert.notEqual(inB.conversationId, firstConversationId)
  assert.notEqual(inB.alreadyProcessed, true)
  const conversationB = await db.conversation.findUnique({ where: { id: inB.conversationId }, select: { workspaceId: true } })
  assert.equal(conversationB.workspaceId, wsB.id)
})
