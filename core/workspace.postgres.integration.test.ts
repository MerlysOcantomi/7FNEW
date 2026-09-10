import assert from "node:assert/strict"
import test from "node:test"
import { provisionTestDatabase, queryRaw, type ProvisionedDatabase } from "@/test/support/postgres"

/**
 * NEON-03 — Workspace + OWNER membership atomicity on REAL PostgreSQL
 * (`ensureUserHasDefaultWorkspace`), plus the capability sources the AI
 * gateway reads. A membership write that fails (here: the FK to a missing
 * User) must roll the workspace back — before NEON-03 an orphan workspace
 * with a taken slug survived such a failure.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
let database: ProvisionedDatabase
let db: any
let workspace: typeof import("./workspace")

test.before(async () => {
  database = await provisionTestDatabase("core-workspace")
  ;({ db } = await import("@core/db"))
  workspace = await import("./workspace")
})

test.after(async () => {
  await db.$disconnect()
  await database.dispose()
})

test("ensureUserHasDefaultWorkspace creates the workspace and its OWNER membership together, once", async () => {
  const user = await db.user.create({ data: { email: "owner@example.test", nombre: "Owner" } })
  const workspaceId = await workspace.ensureUserHasDefaultWorkspace(user.id)
  const membership = await workspace.checkMembership(user.id, workspaceId)
  assert.equal(membership?.role, "OWNER")
  const ws = await db.workspace.findUnique({ where: { id: workspaceId } })
  assert.equal(ws.slug, "owner")
  assert.equal(ws.nombre, "Owner's Workspace")

  // Idempotent: a second call returns the same workspace, creates nothing.
  assert.equal(await workspace.ensureUserHasDefaultWorkspace(user.id), workspaceId)
  assert.equal(await db.workspace.count(), 1)
  assert.equal(await db.workspaceMember.count(), 1)
})

test("a failed membership write rolls the workspace back (no orphan workspace, slug not consumed)", async () => {
  const before = await db.workspace.count()
  // No User row → WorkspaceMember.userId FK fails inside the transaction.
  await assert.rejects(workspace.ensureUserHasDefaultWorkspace("ghost-user-id"), (e: any) => e?.code === "P2003" || /foreign key/i.test(String(e?.message)))
  assert.equal(await db.workspace.count(), before, "the workspace insert must have been rolled back")
  const orphan = await queryRaw<{ cnt: string }>(database.url, `SELECT COUNT(*) AS cnt FROM "Workspace" WHERE "slug" = $1`, ["ghost-user-id"])
  assert.equal(Number(orphan[0].cnt), 0)
})

test("slug disambiguation keeps working across users with the same local part", async () => {
  const a = await db.user.create({ data: { email: "twin@a.example.test" } })
  const b = await db.user.create({ data: { email: "twin@b.example.test" } })
  const wsA = await db.workspace.findUnique({ where: { id: await workspace.ensureUserHasDefaultWorkspace(a.id) } })
  const wsB = await db.workspace.findUnique({ where: { id: await workspace.ensureUserHasDefaultWorkspace(b.id) } })
  assert.equal(wsA.slug, "twin")
  assert.equal(wsB.slug, "twin-1")
})

test("getWorkspaceCapabilitySources reads persisted status/plan/config.modules (fail-closed on a missing workspace)", async () => {
  const ws = await db.workspace.create({
    data: { nombre: "Caps", slug: "caps", plan: "pro", status: "active", config: JSON.stringify({ modules: { inbox: true, presence: false } }) },
  })
  const sources = await workspace.getWorkspaceCapabilitySources(ws.id)
  assert.equal(sources.workspace?.plan, "pro")
  assert.equal(sources.workspace?.status, "active")
  assert.deepEqual(sources.workspace?.configModules, { inbox: true, presence: false })
  assert.equal(sources.presenceStandaloneActive, false)

  const missing = await workspace.getWorkspaceCapabilitySources("does-not-exist")
  assert.equal(missing.workspace, null)
})
