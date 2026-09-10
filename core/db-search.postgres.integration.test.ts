import assert from "node:assert/strict"
import test from "node:test"
import { provisionTestDatabase, type ProvisionedDatabase } from "@/test/support/postgres"
import { searchContains, searchStartsWith, structuredContains } from "./db-search"

/**
 * NEON-03 — search parity on REAL PostgreSQL, through the runtime client and
 * the real services. Pins the per-family decisions recorded in
 * `core/db-search.ts`:
 *   A. free-text search is case-insensitive (what Turso users have today);
 *   B. structured "identifier" filters compare exactly, structured "text"
 *      filters are case-insensitive;
 *   C/D. literal identity lookups (authorization by id, generated prefixes)
 *      stay exact.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
let database: ProvisionedDatabase
let db: any
let proyectos: typeof import("@modules/proyectos/service")
let contenido: typeof import("@modules/contenido/service")
let clientes: typeof import("@modules/clientes/service")
let ws: any
let other: any

test.before(async () => {
  database = await provisionTestDatabase("db-search")
  ;({ db } = await import("@core/db"))
  proyectos = await import("@modules/proyectos/service")
  contenido = await import("@modules/contenido/service")
  clientes = await import("@modules/clientes/service")

  ws = await db.workspace.create({ data: { nombre: "Search WS", slug: "ws-search" } })
  other = await db.workspace.create({ data: { nombre: "Other WS", slug: "ws-search-other" } })

  const contact = await db.contact.create({ data: { workspaceId: ws.id, nombre: "Acme Contact", email: "acme@example.test" } })
  await db.conversation.create({ data: { workspaceId: ws.id, contactId: contact.id, subject: "Acme Corp quote", status: "triaged" } })
  await db.proyecto.create({
    data: {
      workspaceId: ws.id,
      nombre: "Rebrand Acme",
      descripcion: "Visual identity",
      customId: "PRJ-007",
      assignedTo: "Ana R.",
      tags: "urgente,VIP",
      visibility: "private",
      createdBy: "owner-user",
      allowedUsers: JSON.stringify(["User_ABC"]),
    },
  })
  await db.proyecto.create({ data: { workspaceId: other.id, nombre: "Rebrand Elsewhere", customId: "PRJ-007", assignedTo: "Ana R." } })
  await db.contentPiece.create({ data: { workspaceId: ws.id, titulo: "Launch post", responsable: "Ana R.", copy: "Hello Acme" } })
})

test.after(async () => {
  await db.$disconnect()
  await database.dispose()
})

// ── A. free-text search ─────────────────────────────────────────────────────

test("family A: searchContains is case-insensitive on PostgreSQL (ILIKE), scoped by workspace", async () => {
  assert.equal(await db.conversation.count({ where: { workspaceId: ws.id, subject: searchContains("acme") } }), 1)
  assert.equal(await db.conversation.count({ where: { workspaceId: ws.id, subject: searchContains("ACME CORP") } }), 1)
  assert.equal(await db.conversation.count({ where: { workspaceId: ws.id, subject: searchContains("nothing") } }), 0)
  assert.equal(await db.conversation.count({ where: { workspaceId: other.id, subject: searchContains("acme") } }), 0)
  // The plain filter (no mode) is what PostgreSQL would do without the helper: case-sensitive.
  assert.equal(await db.conversation.count({ where: { workspaceId: ws.id, subject: { contains: "acme" } } }), 0)
})

test("family A: searchStartsWith is a case-insensitive prefix match", async () => {
  assert.equal(await db.contact.count({ where: { workspaceId: ws.id, nombre: searchStartsWith("acme") } }), 1)
  assert.equal(await db.contact.count({ where: { workspaceId: ws.id, nombre: searchStartsWith("contact") } }), 0, "prefix, not substring")
})

test("family A through the real services: proyectos.list / clientes.list search parameters", async () => {
  const byName = await proyectos.list({ workspaceId: ws.id, search: "REBRAND" })
  assert.equal(byName.total, 1)
  assert.equal(byName.data[0].customId, "PRJ-007")
  const byDescription = await proyectos.list({ workspaceId: ws.id, search: "visual IDENTITY" })
  assert.equal(byDescription.total, 1)
  const none = await proyectos.list({ workspaceId: ws.id, search: "zzz" })
  assert.equal(none.total, 0)

  await clientes.create({ nombre: "Acme Holdings", empresa: "ACME" } as any, ws.id)
  const found = await clientes.list({ workspaceId: ws.id, search: "acme" } as any)
  assert.equal(found.total, 1)
})

// ── B. structured filters ───────────────────────────────────────────────────

test("family B identifier: Proyecto.customId compares exactly (case-sensitive) on PostgreSQL", async () => {
  assert.equal((await proyectos.list({ workspaceId: ws.id, customId: "PRJ-007" })).total, 1)
  assert.equal((await proyectos.list({ workspaceId: ws.id, customId: "PRJ-" })).total, 1, "partial match by contract")
  assert.equal((await proyectos.list({ workspaceId: ws.id, customId: "prj-007" })).total, 0, "identifiers are compared as written")
  assert.equal(await db.proyecto.count({ where: { workspaceId: ws.id, customId: structuredContains("prj", "identifier") } }), 0)
})

test("family B text: assignedTo, tags and responsable are case-insensitive (human text in a named parameter)", async () => {
  assert.equal((await proyectos.list({ workspaceId: ws.id, assignedTo: "ana r." })).total, 1)
  assert.equal((await proyectos.list({ workspaceId: ws.id, tag: "vip" })).total, 1)
  assert.equal((await proyectos.list({ workspaceId: ws.id, tag: "URGENTE" })).total, 1)
  assert.equal((await proyectos.list({ workspaceId: ws.id, tag: "missing" })).total, 0)
  assert.equal((await contenido.list({ workspaceId: ws.id, responsable: "ANA" })).total, 1)
  assert.equal((await contenido.list({ workspaceId: ws.id, responsable: "Nadie" })).total, 0)
  // Workspace scoping composes: the other workspace's project never leaks in.
  assert.equal((await proyectos.list({ workspaceId: ws.id, assignedTo: "Ana" })).data.every((p: any) => p.workspaceId === ws.id), true)
})

// ── C/D. identity lookups stay exact ───────────────────────────────────────

test("family D authorization: Proyecto.allowedUsers is matched by exact id — a differently-cased id never grants access", async () => {
  // The literal filter used by modules/proyectos/service.ts for non-admin visibility.
  const visibleToUser = await proyectos.list({ workspaceId: ws.id, userId: "User_ABC", userRole: "viewer" })
  assert.equal(visibleToUser.total, 1)
  const wrongCase = await proyectos.list({ workspaceId: ws.id, userId: "user_abc", userRole: "viewer" })
  assert.equal(wrongCase.total, 0, "authorization must not widen on PostgreSQL")
  const stranger = await proyectos.list({ workspaceId: ws.id, userId: "someone-else", userRole: "viewer" })
  assert.equal(stranger.total, 0)
})

test("family C generated prefix: Cliente.customId startsWith the generator's exact prefix", async () => {
  const created = await clientes.create({ nombre: "Prefix Check" } as any, ws.id)
  assert.match(created.customId ?? "", /^CLIENT-\d{4}$/)
  const second = await clientes.create({ nombre: "Prefix Check 2" } as any, ws.id)
  assert.notEqual(second.customId, created.customId, "the sequence advances from the exact-prefix scan")
  assert.equal(await db.cliente.count({ where: { workspaceId: ws.id, customId: { startsWith: "client-" } } }), 0, "exact prefix on PostgreSQL")
})
