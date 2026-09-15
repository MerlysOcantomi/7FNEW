/**
 * Integration tests for the common ingestion pipeline (INBOX-TRANSPORT-05B)
 * against a REAL disposable PostgreSQL database built from the migration
 * history (test/support/postgres.ts). Covers the behaviours that pure tests cannot: dedup,
 * identity resolution/ambiguity, provisional-contact reuse, conversation
 * matching, attachment rows, workspace isolation and the email adapter.
 */

import assert from "node:assert/strict"
import test from "node:test"
import { blockedOutboundAttempts, isMissingProviderKeyError, provisionTestDatabase, settleBackgroundTasks, type ProvisionedDatabase } from "@/test/support/postgres"

let database: ProvisionedDatabase

/* eslint-disable @typescript-eslint/no-explicit-any */
// Wired in test.before (tsx compiles tests as CJS — no top-level await).
let db: any
let ingestInboundEnvelope: any
let ingestInboundEmail: any
let recordInboundIdentity: any
let buildIdentityDescriptor: any
let wsA: any
let wsB: any
let connA: any
let emailConnA: any

test.before(async () => {
  database = await provisionTestDatabase("inbox-ingest")
  ;({ db } = await import("@core/db"))
  ;({ ingestInboundEnvelope } = await import("./pipeline"))
  ;({ ingestInboundEmail } = await import("../email-inbound"))
  ;({ recordInboundIdentity } = await import("../identity-service"))
  ;({ buildIdentityDescriptor } = await import("../identity-resolution"))

  wsA = await db.workspace.create({ data: { nombre: "A", slug: "ws-a" } })
  wsB = await db.workspace.create({ data: { nombre: "B", slug: "ws-b" } })
  connA = await db.channelConnection.create({
    data: {
      workspaceId: wsA.id,
      channelType: "whatsapp",
      provider: "meta",
      name: "WA A",
      providerAccountId: "phone_A",
    },
  })
  emailConnA = await db.channelConnection.create({
    data: {
      workspaceId: wsA.id,
      channelType: "email",
      provider: "imap_smtp",
      name: "Mail A",
      externalAccountId: "inbox@a.com",
    },
  })
})

test.after(async () => {
  // Every fire-and-forget task started by the ingestions above must be
  // settled and accounted for BEFORE the client disconnects and the database
  // is dropped; the helper fails the file on any unexpected rejection.
  await settleBackgroundTasks({ aiDisabled: true })
  await db.$disconnect()
  await database.dispose()
})

function waEnvelope(overrides: Record<string, unknown> = {}) {
  return {
    channel: "whatsapp" as const,
    provider: "meta",
    workspaceId: wsA.id,
    connectionId: connA.id,
    providerAccountId: "phone_A",
    externalMessageId: "wamid.001",
    senderIdentity: { kind: "psid" as const, rawValue: "34600111222", externalId: "34600111222", displayName: "Ana WA" },
    text: "Hola, quiero cita",
    attachments: [
      { filename: "nail.jpg", url: "https://blob/nail.jpg", contentType: "image/jpeg", size: 100 },
    ],
    ...overrides,
  }
}

test("new inbound envelope creates identity, provisional contact, conversation, message and attachments", async () => {
  const result = await ingestInboundEnvelope(waEnvelope())
  assert.equal(result.isNewConversation, true)
  assert.equal(result.matchedBy, "new")

  const message = await db.message.findUnique({
    where: { id: result.messageId },
    select: { sourceMessageId: true, direction: true, attachments: true },
  })
  assert.equal(message?.sourceMessageId, "wamid.001")
  assert.equal(message?.direction, "inbound")
  assert.equal(message?.attachments.length, 1)
  assert.equal(message?.attachments[0].kind, "image")

  const identity = await db.externalIdentity.findFirst({
    where: { workspaceId: wsA.id, channel: "whatsapp" },
    include: { links: true },
  })
  assert.ok(identity)
  assert.equal(identity.scopeKey, "phone_A")
  // Provisional contact: one suggested/ingestion link, identity unresolved.
  assert.equal(identity.resolutionStatus, "unresolved")
  assert.equal(identity.links.length, 1)
  assert.equal(identity.links[0].status, "suggested")
  const contact = await db.contact.findUnique({ where: { id: result.contactId } })
  assert.ok(contact?.metadata?.includes("provisionalForIdentity"))
})

test("repeated webhook (same external id) dedupes without a second message", async () => {
  const first = await ingestInboundEnvelope(waEnvelope())
  assert.equal(first.alreadyProcessed, true)
  assert.equal(first.isNewConversation, false)
  const count = await db.message.count({ where: { workspaceId: wsA.id, sourceMessageId: "wamid.001" } })
  assert.equal(count, 1)
})

test("second message from the same sender reuses the provisional contact and active conversation", async () => {
  const result = await ingestInboundEnvelope(
    waEnvelope({ externalMessageId: "wamid.002", attachments: undefined, text: "¿Tenéis hueco el viernes?" }),
  )
  assert.equal(result.isNewConversation, false)
  assert.equal(result.matchedBy, "contact-active")
  const contacts = await db.contact.count({ where: { workspaceId: wsA.id, canal: "whatsapp" } })
  assert.equal(contacts, 1) // no contact-per-message
})

test("workspace isolation: the same external id ingests independently in another workspace", async () => {
  const result = await ingestInboundEnvelope(
    waEnvelope({ workspaceId: wsB.id, connectionId: null, providerAccountId: "phone_B", externalMessageId: "wamid.001" }),
  )
  assert.equal(result.alreadyProcessed ?? false, false)
  assert.equal(result.isNewConversation, true)
  const countB = await db.message.count({ where: { workspaceId: wsB.id, sourceMessageId: "wamid.001" } })
  assert.equal(countB, 1)
})

test("a connection from another workspace is rejected (connection_mismatch)", async () => {
  await assert.rejects(
    () => ingestInboundEnvelope(waEnvelope({ workspaceId: wsB.id, externalMessageId: "wamid.003" })),
    /connectionId does not belong/,
  )
})

test("outbound rows with the same external id never count as inbound duplicates", async () => {
  const conv = await db.conversation.findFirst({ where: { workspaceId: wsA.id, channel: "whatsapp" } })
  await db.message.create({
    data: {
      workspaceId: wsA.id,
      conversationId: conv!.id,
      role: "operator",
      direction: "outbound",
      content: "x",
      sourceMessageId: "wamid.OUT",
    },
  })
  const result = await ingestInboundEnvelope(waEnvelope({ externalMessageId: "wamid.OUT" }))
  assert.equal(result.alreadyProcessed ?? false, false)
})

test("resolved identity routes to its confirmed contact, not a provisional one", async () => {
  const contact = await db.contact.create({
    data: { workspaceId: wsA.id, nombre: "Cliente VIP", telefono: "+34600999888" },
  })
  const descriptor = buildIdentityDescriptor({
    channel: "whatsapp",
    kind: "psid",
    rawValue: "34600999888",
    provider: "meta",
    providerAccountId: "phone_A",
  })!
  await recordInboundIdentity({ workspaceId: wsA.id, descriptor, contactId: contact.id })
  const result = await ingestInboundEnvelope(
    waEnvelope({
      externalMessageId: "wamid.vip.1",
      senderIdentity: { kind: "psid", rawValue: "34600999888", externalId: "34600999888" },
      attachments: undefined,
    }),
  )
  assert.equal(result.contactId, contact.id)
})

test("ambiguous identity never silently picks a claimant — provisional contact instead", async () => {
  const c1 = await db.contact.create({ data: { workspaceId: wsA.id, nombre: "Hermana 1" } })
  const c2 = await db.contact.create({ data: { workspaceId: wsA.id, nombre: "Hermana 2" } })
  const descriptor = buildIdentityDescriptor({
    channel: "whatsapp",
    kind: "psid",
    rawValue: "34600777666",
    provider: "meta",
    providerAccountId: "phone_A",
  })!
  const identity = await db.externalIdentity.create({
    data: { workspaceId: wsA.id, ...descriptor },
  })
  for (const contactId of [c1.id, c2.id]) {
    await db.contactIdentityLink.create({
      data: {
        workspaceId: wsA.id,
        externalIdentityId: identity.id,
        contactId,
        status: "confirmed",
        source: "backfill",
      },
    })
  }
  const result = await ingestInboundEnvelope(
    waEnvelope({
      externalMessageId: "wamid.amb.1",
      senderIdentity: { kind: "psid", rawValue: "34600777666", externalId: "34600777666" },
      attachments: undefined,
    }),
  )
  assert.notEqual(result.contactId, c1.id)
  assert.notEqual(result.contactId, c2.id)
  const updated = await db.externalIdentity.findUnique({ where: { id: identity.id } })
  assert.equal(updated?.resolutionStatus, "ambiguous")
  assert.equal(updated?.primaryContactId, null)
})

// ─── Email adapter (Resend/IMAP inputs → envelope → pipeline) ───────────────

test("email adapter ingests with RFC metadata, threads replies and dedupes IMAP re-syncs", async () => {
  const base = {
    source: "imap",
    sourceId: `imap:${emailConnA.id}:101`,
    from: "Lola <lola@example.com>",
    to: ["inbox@a.com"],
    subject: "Booking",
    text: "Quiero una cita",
    html: null,
    headers: { "message-id": "<m1@mail>" },
    messageId: "<m1@mail>",
    connectionId: emailConnA.id,
    workspaceId: wsA.id,
  }
  const first = await ingestInboundEmail(base)
  assert.equal(first.isNewConversation, true)
  const message = await db.message.findUnique({
    where: { id: first.messageId },
    select: { metadata: true, sourceMessageId: true },
  })
  assert.equal(message?.sourceMessageId, `imap:${emailConnA.id}:101`)
  const meta = JSON.parse(message!.metadata!)
  assert.equal(meta.emailMessageId, "<m1@mail>")
  assert.equal(meta.emailSubject, "Booking")

  // IMAP re-sync of the same UID → dedup, no second message.
  const repeat = await ingestInboundEmail(base)
  assert.equal(repeat.alreadyProcessed, true)

  // A reply threading via In-Reply-To lands in the same conversation.
  const reply = await ingestInboundEmail({
    ...base,
    sourceId: `imap:${emailConnA.id}:102`,
    messageId: "<m2@mail>",
    headers: { "in-reply-to": "<m1@mail>" },
    text: "¿El viernes?",
  })
  assert.equal(reply.conversationId, first.conversationId)
  assert.equal(reply.isNewConversation, false)

  // Identity dual-write happened through the pipeline.
  const identity = await db.externalIdentity.findFirst({
    where: { workspaceId: wsA.id, channel: "email", externalKey: "lola@example.com" },
  })
  assert.ok(identity)
  assert.equal(identity.resolutionStatus, "resolved")
})

// ── NEON-03-R1: background work is deterministic and explicit ───────────────

test("post-persist background work settles deterministically: notifications fulfilled, AI triage fails explicitly (no provider keys), no network call", async () => {
  const outcomes = await settleBackgroundTasks({ aiDisabled: true })
  const byLabel = (label: string) => outcomes.filter((o) => o.label === label)
  // Every ingestion above spawned a notification task and an intelligence task;
  // every persisted message spawned (or skipped) a short-intent task.
  assert.ok(byLabel("ingest:notify").length >= 1)
  assert.ok(byLabel("ingest:notify").every((o) => o.status === "fulfilled"), "notifications never fail")
  assert.ok(byLabel("ingest:intelligence").length >= 1)
  for (const o of byLabel("ingest:intelligence")) {
    assert.equal(o.status, "rejected", "intelligence cannot run without a provider key")
    assert.ok(isMissingProviderKeyError(o.error), "the exact missing-credentials contract (provider_unavailable + adapter message)")
  }
  // Short-intent persistence is best-effort by contract: it catches the same
  // provider failure internally, logs it and fulfils WITHOUT persisting an
  // intent — and its fulfilled VALUE says why.
  assert.ok(byLabel("message:short-intent").length >= 1)
  for (const o of byLabel("message:short-intent")) {
    assert.equal(o.status, "fulfilled")
    const value = o.value as { status: string; stage?: string; error?: unknown }
    assert.equal(value.status, "failed")
    assert.equal(value.stage, "execute")
    assert.ok(isMissingProviderKeyError(value.error), "the internal cause is the same missing-credentials error")
  }
  assert.deepEqual(blockedOutboundAttempts(), [], "no provider call reached the network layer")
  // Their persistence side effects are visible (or absent) in PostgreSQL only now, deterministically.
  assert.equal(await db.aIClassification.count(), 0, "no classification is persisted when AI is disabled")
  const withIntent = await db.message.count({ where: { metadata: { contains: '"shortIntent"' } } })
  assert.equal(withIntent, 0, "no short intent is persisted when AI is disabled")
  // A second drain finds nothing left.
  assert.deepEqual(await settleBackgroundTasks(), [])
})
