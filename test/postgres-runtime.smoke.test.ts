import assert from "node:assert/strict"
import test from "node:test"
import { provisionTestDatabase, type ProvisionedDatabase } from "./support/postgres"

/**
 * NEON-03 — end-to-end smoke of the PostgreSQL runtime through the REAL
 * services, in the order a tenant comes to life:
 *
 *   user → workspace (+ OWNER membership, atomic) → capability sources →
 *   capability snapshot (what the AI gateway reads) → cliente → inbox
 *   ingestion → inbox-scoped task with a due date → presence site published
 *   and publicly resolvable → AI snapshot again → multi-tenant isolation
 *   (a second tenant sees none of it, cannot attach to it, is not a member).
 *
 * One disposable database built from `prisma/migrations-postgres`; no mocks
 * on the data path. AI providers are never called (no keys; the intelligence
 * step fails closed inside ingestion and is not asserted).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
let database: ProvisionedDatabase
let db: any
let workspace: typeof import("@core/workspace")
let capabilities: typeof import("@core/platform/workspace-capabilities")
let clientes: typeof import("@modules/clientes/service")
let inbox: typeof import("@modules/inbox/service")
let ingestion: typeof import("@modules/inbox/ingestion/pipeline")
let tasksWrite: typeof import("@modules/inbox/inbox-tasks-write")
let tasksRead: typeof import("@modules/inbox/inbox-tasks-read")
let presence: typeof import("@engines/presence/repository")

let userA: any
let userB: any
let wsA = ""
let wsB = ""
let conversationId = ""

test.before(async () => {
  database = await provisionTestDatabase("runtime-smoke")
  ;({ db } = await import("@core/db"))
  workspace = await import("@core/workspace")
  capabilities = await import("@core/platform/workspace-capabilities")
  clientes = await import("@modules/clientes/service")
  inbox = await import("@modules/inbox/service")
  ingestion = await import("@modules/inbox/ingestion/pipeline")
  tasksWrite = await import("@modules/inbox/inbox-tasks-write")
  tasksRead = await import("@modules/inbox/inbox-tasks-read")
  presence = await import("@engines/presence/repository")
})

test.after(async () => {
  await db.$disconnect()
  await database.dispose()
})

test("1. user → workspace + OWNER membership (atomic), for two independent tenants", async () => {
  userA = await db.user.create({ data: { email: "ana@tenant-a.test", nombre: "Ana" } })
  userB = await db.user.create({ data: { email: "bea@tenant-b.test", nombre: "Bea" } })
  wsA = await workspace.ensureUserHasDefaultWorkspace(userA.id)
  wsB = await workspace.ensureUserHasDefaultWorkspace(userB.id)
  assert.notEqual(wsA, wsB)
  assert.equal((await workspace.checkMembership(userA.id, wsA))?.role, "OWNER")
  assert.equal((await workspace.checkMembership(userB.id, wsB))?.role, "OWNER")
  assert.equal(await workspace.checkMembership(userA.id, wsB), null)
  assert.equal(await workspace.checkMembership(userB.id, wsA), null)
  assert.deepEqual((await workspace.listWorkspacesForUser(userA.id)).map((w) => w.id), [wsA])
})

test("2. capability sources → snapshot (the AI gateway's entitlement view) from persisted plan/config", async () => {
  await db.workspace.update({
    where: { id: wsA },
    data: { plan: "enterprise", status: "active", config: JSON.stringify({ modules: { inbox: true, crm: true } }) },
  })
  const snapshot = capabilities.resolveWorkspaceCapabilitySnapshot(await workspace.getWorkspaceCapabilitySources(wsA))
  assert.equal(snapshot.workspaceId, wsA)
  assert.equal(snapshot.status, "active")
  assert.ok(snapshot.products.some((p) => p.product === "smart_inbox"), "config.modules.inbox → smart_inbox")
  assert.ok(snapshot.capabilities.size > 0)
  assert.equal(snapshot.observational, true)

  const inboxProduct = snapshot.products.find((p) => p.product === "smart_inbox")
  assert.ok(inboxProduct?.sources.includes("config.modules:inbox"), "tenant A's grant is evidenced by ITS persisted config")

  // Tenant B resolves from its OWN row: plan "free" defaults, no config — nothing of A's config leaks in.
  const sourcesB = await workspace.getWorkspaceCapabilitySources(wsB)
  assert.equal(sourcesB.workspace?.plan, "free")
  assert.equal(sourcesB.workspace?.configModules, null)
  const other = capabilities.resolveWorkspaceCapabilitySnapshot(sourcesB)
  assert.equal(other.workspaceId, wsB)
  assert.ok(other.products.every((p) => !p.sources.some((s) => s.startsWith("config.modules:"))), "no config-derived grant in tenant B")
})

test("3. cliente with a generated customId, scoped to its workspace", async () => {
  const cliente = await clientes.create({ nombre: "Cliente Smoke", email: "cliente@tenant-a.test" } as any, wsA)
  assert.equal(cliente.workspaceId, wsA)
  assert.equal(cliente.customId, "CLIENT-0001")
  assert.equal((await clientes.list({ workspaceId: wsA } as any)).total, 1)
  assert.equal((await clientes.list({ workspaceId: wsB } as any)).total, 0)
  assert.equal(await clientes.getById(cliente.id, wsB), null, "tenant B cannot read tenant A's client by id")
})

test("4. inbox ingestion creates contact, conversation and message in the right tenant only", async () => {
  const conn = await db.channelConnection.create({
    data: { workspaceId: wsA, channelType: "whatsapp", provider: "meta", name: "WA A", providerAccountId: "phone_smoke_a" },
  })
  const result = await ingestion.ingestInboundEnvelope({
    channel: "whatsapp",
    provider: "meta",
    workspaceId: wsA,
    connectionId: conn.id,
    providerAccountId: "phone_smoke_a",
    externalMessageId: "wamid.smoke.001",
    senderIdentity: { kind: "psid", rawValue: "34600999888", externalId: "34600999888", displayName: "Visitante" },
    text: "Hola, quiero una cita",
  } as any)
  assert.equal(result.isNewConversation, true)
  conversationId = result.conversationId

  const listA = await inbox.listConversations({ workspaceId: wsA })
  assert.equal(listA.total, 1)
  assert.equal(listA.data[0].id, conversationId)
  const listB = await inbox.listConversations({ workspaceId: wsB })
  assert.equal(listB.total, 0)
  assert.equal(await inbox.getConversationById(conversationId, wsB), null, "tenant B cannot read tenant A's conversation")

  // Duplicate delivery is idempotent.
  const again = await ingestion.ingestInboundEnvelope({
    channel: "whatsapp",
    provider: "meta",
    workspaceId: wsA,
    connectionId: conn.id,
    providerAccountId: "phone_smoke_a",
    externalMessageId: "wamid.smoke.001",
    senderIdentity: { kind: "psid", rawValue: "34600999888", externalId: "34600999888", displayName: "Visitante" },
    text: "Hola, quiero una cita",
  } as any)
  assert.equal(again.alreadyProcessed, true)
  assert.equal(await db.message.count({ where: { workspaceId: wsA, direction: "inbound" } }), 1)
})

test("5. inbox-scoped task with a due date (schedule) mirrors into WorkspaceTask, tenant-checked", async () => {
  const dueAt = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const task = await tasksWrite.createInboxScopedTask({
    workspaceId: wsA,
    title: "Llamar para agendar",
    conversationId,
    dueAt,
    createdBy: userA.id,
  })
  assert.equal(task.workspaceId, wsA)
  assert.equal(task.conversationId, conversationId)
  assert.equal(new Date(task.dueAt as any).getTime(), dueAt.getTime())

  const listA = await tasksRead.listInboxScopedTasks({ workspaceId: wsA })
  assert.equal(listA.length, 1)
  assert.equal(listA[0].id, task.id)
  assert.equal((await tasksRead.listInboxScopedTasks({ workspaceId: wsB })).length, 0)

  // Tenant B cannot attach a task to tenant A's conversation.
  await assert.rejects(
    tasksWrite.createInboxScopedTask({ workspaceId: wsB, title: "Robo", conversationId, createdBy: userB.id }),
    /does not belong to this workspace/,
  )
})

test("6. presence: site created, published and publicly resolvable; the other tenant has no site", async () => {
  const site = await presence.getOrCreateSiteForWorkspace(wsA, { slug: "smoke-studio" })
  assert.equal(site.status, "draft")
  const published = await presence.publishSite(wsA, site.id)
  assert.equal(published.status, "published")
  const resolved = await presence.resolvePublicSite("smoke-studio")
  assert.ok(resolved)
  assert.equal(resolved.site.workspaceId, wsA)
  assert.equal(resolved.entitlement.entitled, true)
  assert.equal(resolved.isPubliclyVisible, true)

  assert.equal(await db.presenceSite.findUnique({ where: { workspaceId: wsB } }), null)
  await assert.rejects(presence.publishSite(wsB, site.id), "tenant B cannot publish tenant A's site")
})

test("7. AI snapshot after the whole flow is unchanged in kind and still per-workspace", async () => {
  const snapshot = capabilities.resolveWorkspaceCapabilitySnapshot(await workspace.getWorkspaceCapabilitySources(wsA))
  assert.equal(snapshot.status, "active")
  assert.ok(snapshot.products.some((p) => p.product === "smart_inbox"))
  assert.deepEqual(snapshot.addonCapabilities, [], "no standalone Presence subscription → no add-on grant")
  assert.equal(snapshot.version, 1)
})

test("8. multi-tenant totals: everything created lives in tenant A, tenant B is empty", async () => {
  for (const model of ["cliente", "contact", "conversation", "message", "workspaceTask", "presenceSite"]) {
    assert.ok((await db[model].count({ where: { workspaceId: wsA } })) >= 1, `${model} exists in A`)
    assert.equal(await db[model].count({ where: { workspaceId: wsB } }), 0, `${model} absent in B`)
  }
})
