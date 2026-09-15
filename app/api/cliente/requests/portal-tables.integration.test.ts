/**
 * CORE-03C-2B — the four CANONICAL_ADD tables actually support the runtime's
 * access patterns, proven against a database built FROM THE MIGRATION
 * HISTORY (PostgreSQL `0_init`, which carries the portal tables the SQLite
 * history introduced in 3_create_portal_tables) with `prisma migrate deploy`
 * through test/support/postgres.ts (dotenv-free, loopback only). Until this
 * migration existed, every one of these operations failed in production
 * (CORE-03B CRITICAL).
 *
 * Covered write/read patterns, mirroring the productive code:
 *   - ClientRequest nested `assets: { create: … }` + `include: { assets }`
 *     (app/api/cliente/requests/route.ts);
 *   - ClientAsset create + workspace/cliente-scoped list
 *     (app/api/cliente/archivos/route.ts);
 *   - Forte snapshot store upsert/read/delete via the REAL module
 *     (agents/forte/runtime/business/snapshot-store.ts);
 *   - declared FK actions are enforced (Cliente delete cascades the portal
 *     rows; Workspace delete cascades the snapshot).
 *
 * Local throwaway PostgreSQL only; synthetic data; no remote access.
 */

import assert from "node:assert/strict"
import test, { before, after } from "node:test"
import { provisionTestDatabase, type ProvisionedDatabase } from "@/test/support/postgres"

let database: ProvisionedDatabase

/* eslint-disable @typescript-eslint/no-explicit-any */
let db: any
let snapshotStore: typeof import("@/agents/forte/runtime/business/snapshot-store")
let ws: any
let cliente: any

before(async () => {
  database = await provisionTestDatabase("portal-tables")
  ;({ db } = await import("@core/db"))
  snapshotStore = await import("@/agents/forte/runtime/business/snapshot-store")

  ws = await db.workspace.create({ data: { nombre: "Portal WS", slug: "ws-portal-t" } })
  cliente = await db.cliente.create({
    data: { nombre: "Cliente Portal", email: "portal@test.local", workspaceId: ws.id },
  })
})

after(async () => {
  await db.$disconnect()
  await database.dispose()
})

test("ClientRequest supports the route's nested-asset create and include", async () => {
  const created = await db.clientRequest.create({
    data: {
      workspaceId: ws.id,
      clienteId: cliente.id,
      title: "Necesito el logo",
      description: "sintetico",
      assets: { create: [{ assetUrl: "https://example.test/a.png", assetName: "a.png" }] },
    },
    include: { assets: true },
  })
  assert.equal(created.status, "OPEN")
  assert.equal(created.priority, "MEDIUM")
  assert.equal(created.assets.length, 1)
  assert.equal(created.assets[0].assetName, "a.png")

  const listed = await db.clientRequest.findMany({
    where: { workspaceId: ws.id, clienteId: cliente.id },
    include: { assets: true },
  })
  assert.equal(listed.length, 1)
  assert.equal(listed[0].assets.length, 1)
})

test("ClientAsset supports the archivos route's create and scoped list", async () => {
  await db.clientAsset.create({
    data: {
      workspaceId: ws.id,
      clienteId: cliente.id,
      filename: "doc.pdf",
      mimeType: "application/pdf",
      url: "https://example.test/doc.pdf",
    },
  })
  const assets = await db.clientAsset.findMany({ where: { workspaceId: ws.id, clienteId: cliente.id } })
  assert.equal(assets.length, 1)
  assert.equal(assets[0].type, "OTHER")
  assert.equal(assets[0].sizeBytes, 0)
})

test("Forte snapshot store round-trips through the real module", async () => {
  await snapshotStore.upsertForteSnapshot({
    workspaceId: ws.id,
    maturity: "foundational",
    domains: [],
    topPriorities: [],
    recommendedNextMove: null,
  } as any)
  const loaded = await snapshotStore.getLatestForteSnapshot(ws.id)
  assert.ok(loaded)
  assert.equal(loaded!.workspaceId, ws.id)
  assert.equal(loaded!.maturity, "foundational")
  assert.equal(loaded!.version, 1)

  // unique workspaceId: a second upsert updates, never duplicates
  await snapshotStore.upsertForteSnapshot({
    workspaceId: ws.id,
    maturity: "operational",
    domains: [],
    topPriorities: [],
    recommendedNextMove: null,
  } as any)
  assert.equal(await db.forteSnapshot.count({ where: { workspaceId: ws.id } }), 1)
  assert.equal((await snapshotStore.getLatestForteSnapshot(ws.id))!.maturity, "operational")
})

test("declared FK actions are enforced by the history-built database", async () => {
  // Cliente delete cascades ClientRequest -> ClientRequestAsset and ClientAsset.
  await db.cliente.delete({ where: { id: cliente.id } })
  assert.equal(await db.clientRequest.count(), 0)
  assert.equal(await db.clientRequestAsset.count(), 0)
  assert.equal(await db.clientAsset.count(), 0)

  // Workspace delete cascades the ForteSnapshot row.
  await db.workspace.delete({ where: { id: ws.id } })
  assert.equal(await db.forteSnapshot.count(), 0)
})
