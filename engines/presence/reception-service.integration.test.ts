/**
 * Integration tests for the Presence reception service (PRESENCE-FANNY-01)
 * against a REAL local SQLite DB. Covers secure workspace resolution, anonymous
 * web conversation creation on the SHARED Smart Inbox model, session reuse,
 * multi-tenant isolation, deterministic answers, appointment → WorkspaceTask,
 * human transfer, WhatsApp resolution, consent, and gating (unpublished /
 * missing / reception disabled).
 */

import assert from "node:assert/strict"
import test from "node:test"
import { execSync } from "node:child_process"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

const dir = mkdtempSync(join(tmpdir(), "presence-reception-"))
const dbUrl = `file:${join(dir, "test.db")}`
process.env.DATABASE_URL = dbUrl

/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any
let repo: any
let svc: any

const PROFILE = {
  businessProfile: {
    businessName: "Estudio Aurora",
    businessDescription: "A calm studio",
    workingHours: "Mon–Fri 9–19",
    region: "Madrid",
  },
  serviceCatalog: [{ id: "s1", name: "Consultation", category: "General", active: true }],
}

async function publishedWorkspace(opts: { slug: string; whatsapp?: boolean; whatsappStatus?: string; disabled?: boolean }) {
  const config: any = { ...PROFILE }
  if (opts.disabled) config.inbox = { webChat: { enabled: false } }
  const ws = await db.workspace.create({
    data: { nombre: "Estudio Aurora", slug: opts.slug + "-ws", plan: "enterprise", config: JSON.stringify(config) },
  })
  if (opts.whatsapp) {
    await db.channelConnection.create({
      data: { workspaceId: ws.id, channelType: "whatsapp", provider: "meta", name: "WA", externalAccountId: "+34 600 000 000", status: opts.whatsappStatus ?? "active" },
    })
  }
  const site = await repo.getOrCreateSiteForWorkspace(ws.id, { slug: opts.slug })
  await repo.publishSite(ws.id, site.id)
  return { ws, site }
}

test.before(async () => {
  execSync(`npx prisma db push --accept-data-loss --url "${dbUrl}"`, { stdio: "ignore", cwd: process.cwd() })
  ;({ db } = await import("@core/db"))
  repo = await import("./repository")
  svc = await import("./reception-service")
})

// ---- secure resolution & gating -------------------------------------------

test("a nonexistent slug is rejected (not_found)", async () => {
  const r = await svc.handleReceptionMessage({ slug: "nope", visitorId: "visitor-000001", message: "hi" })
  assert.equal(r.ok, false)
  assert.equal(r.reason, "not_found")
})

test("an unpublished site is rejected (offline)", async () => {
  const ws = await db.workspace.create({ data: { nombre: "Draft", slug: "draft-ws", plan: "enterprise", config: JSON.stringify(PROFILE) } })
  const site = await repo.getOrCreateSiteForWorkspace(ws.id, { slug: "draft-recep" })
  void site
  const r = await svc.handleReceptionMessage({ slug: "draft-recep", visitorId: "visitor-000002", message: "hi" })
  assert.equal(r.ok, false)
  assert.equal(r.reason, "offline")
})

test("reception can be disabled via config", async () => {
  await publishedWorkspace({ slug: "disabled-recep", disabled: true })
  const r = await svc.handleReceptionMessage({ slug: "disabled-recep", visitorId: "visitor-000003", message: "hi" })
  assert.equal(r.ok, false)
  assert.equal(r.reason, "disabled")
})

// ---- web conversation on the shared Smart Inbox model ----------------------

test("a visitor message creates a web_chat / web conversation and Fanny answers", async () => {
  const { ws } = await publishedWorkspace({ slug: "chat-a", whatsapp: true })
  const r = await svc.handleReceptionMessage({ slug: "chat-a", visitorId: "visitor-chat-a1", message: "what services do you offer?" })
  assert.equal(r.ok, true)
  assert.match(r.reply, /Consultation/)
  assert.equal(r.intent, "services")

  const conv = await db.conversation.findUnique({ where: { id: r.conversationId } })
  assert.equal(conv.channel, "web_chat")
  assert.equal(conv.source, "web")
  assert.equal(conv.isPublic, true)
  assert.equal(conv.workspaceId, ws.id)

  // Both the visitor message and Fanny's reply are persisted (visible in Inbox).
  const msgs = await db.message.findMany({ where: { conversationId: r.conversationId }, orderBy: { createdAt: "asc" } })
  assert.equal(msgs.length, 2)
  assert.equal(msgs[0].direction, "inbound")
  assert.equal(msgs[0].role, "visitor")
  assert.equal(msgs[1].direction, "outbound")
  assert.equal(msgs[1].role, "assistant")
})

test("the same visitor session reuses one conversation", async () => {
  const { ws } = await publishedWorkspace({ slug: "chat-reuse" })
  const first = await svc.handleReceptionMessage({ slug: "chat-reuse", visitorId: "visitor-reuse-1", message: "hi" })
  const second = await svc.handleReceptionMessage({ slug: "chat-reuse", visitorId: "visitor-reuse-1", message: "hours?" })
  assert.equal(first.conversationId, second.conversationId)
  const count = await db.conversation.count({ where: { workspaceId: ws.id, channel: "web_chat" } })
  assert.equal(count, 1)
})

test("visitors on different workspaces are isolated", async () => {
  const a = await publishedWorkspace({ slug: "iso-a" })
  const b = await publishedWorkspace({ slug: "iso-b" })
  const ra = await svc.handleReceptionMessage({ slug: "iso-a", visitorId: "visitor-shared-id", message: "hi" })
  const rb = await svc.handleReceptionMessage({ slug: "iso-b", visitorId: "visitor-shared-id", message: "hi" })
  const ca = await db.conversation.findUnique({ where: { id: ra.conversationId } })
  const cb = await db.conversation.findUnique({ where: { id: rb.conversationId } })
  assert.equal(ca.workspaceId, a.ws.id)
  assert.equal(cb.workspaceId, b.ws.id)
  assert.notEqual(ra.conversationId, rb.conversationId)
})

// ---- WhatsApp resolution (server-side) -------------------------------------

test("WhatsApp link is resolved server-side; connected reflects channel status", async () => {
  await publishedWorkspace({ slug: "wa-link", whatsapp: true, whatsappStatus: "active" })
  const r = await svc.handleReceptionMessage({ slug: "wa-link", visitorId: "visitor-wa-1", message: "hi" })
  assert.equal(r.whatsapp.available, true)
  assert.match(r.whatsapp.link.href, /^https:\/\/wa\.me\/34600000000/)
  assert.equal(r.whatsapp.connected, false) // "active" is a public link, not the connected API

  await publishedWorkspace({ slug: "wa-connected", whatsapp: true, whatsappStatus: "connected" })
  const c = await svc.handleReceptionMessage({ slug: "wa-connected", visitorId: "visitor-wa-2", message: "hi" })
  assert.equal(c.whatsapp.connected, true)
})

test("no WhatsApp number → not available (no fabricated link)", async () => {
  await publishedWorkspace({ slug: "wa-none" })
  const r = await svc.handleReceptionMessage({ slug: "wa-none", visitorId: "visitor-wa-3", message: "hi" })
  assert.equal(r.whatsapp.available, false)
  assert.equal(r.whatsapp.link, null)
})

// ---- human transfer --------------------------------------------------------

test("asking for a person creates a WorkspaceTask (needs human) without leaving the chat", async () => {
  const { ws } = await publishedWorkspace({ slug: "human-a" })
  const r = await svc.handleReceptionMessage({ slug: "human-a", visitorId: "visitor-human-1", action: "human", message: "" })
  assert.equal(r.handoff, true)
  const tasks = await db.workspaceTask.findMany({ where: { workspaceId: ws.id, conversationId: r.conversationId } })
  assert.equal(tasks.length, 1)
  assert.equal(tasks[0].suggestedBy, "fanny")
})

// ---- appointment request (never auto-confirmed) ----------------------------

test("appointment request → structured message + task + consent recorded", async () => {
  const { ws } = await publishedWorkspace({ slug: "appt-a", whatsapp: true })
  const r = await svc.handleReceptionAppointment({
    slug: "appt-a",
    visitorId: "visitor-appt-1",
    appointment: { name: "Ana", service: "Consultation", preferredDay: "Friday", contactPreference: "whatsapp", contact: "+34 611 111 111" },
    consent: { promotional: true },
  })
  assert.equal(r.ok, true)
  assert.equal(r.contactPreference, "whatsapp")

  const tasks = await db.workspaceTask.findMany({ where: { workspaceId: ws.id, conversationId: r.conversationId } })
  assert.equal(tasks.length, 1)
  const meta = JSON.parse(tasks[0].metadata)
  assert.equal(meta.contactPreference, "whatsapp")
  assert.equal(meta.promotionalConsent, true)
  assert.equal(meta.needsHumanReview, true)

  const msgs = await db.message.findMany({ where: { conversationId: r.conversationId }, orderBy: { createdAt: "asc" } })
  const structured = msgs.find((m: any) => m.content.includes("Appointment request from Ana"))
  assert.ok(structured)
  assert.equal(JSON.parse(structured.metadata).consent.promotional, true)
})

test("invalid appointment (no name) is rejected", async () => {
  await publishedWorkspace({ slug: "appt-bad" })
  const r = await svc.handleReceptionAppointment({ slug: "appt-bad", visitorId: "visitor-appt-2", appointment: { service: "x" } })
  assert.equal(r.ok, false)
  assert.equal(r.reason, "invalid_appointment")
})

test("promotional consent defaults to false when not given", async () => {
  const { ws } = await publishedWorkspace({ slug: "appt-noconsent" })
  const r = await svc.handleReceptionAppointment({
    slug: "appt-noconsent",
    visitorId: "visitor-appt-3",
    appointment: { name: "Ben", contactPreference: "chat" },
  })
  assert.equal(r.ok, true)
  const tasks = await db.workspaceTask.findMany({ where: { workspaceId: ws.id, conversationId: r.conversationId } })
  assert.equal(JSON.parse(tasks[0].metadata).promotionalConsent, false)
})

// ---- reception model -------------------------------------------------------

test("resolveReceptionModel returns Fanny + WhatsApp for a published site", async () => {
  await publishedWorkspace({ slug: "model-a", whatsapp: true })
  const m = await svc.resolveReceptionModel("model-a")
  assert.equal(m.ok, true)
  assert.equal(m.businessName, "Estudio Aurora")
  assert.equal(m.model.whatsapp.available, true)
  assert.ok(m.model.fanny.quickActions.length > 0)
})
