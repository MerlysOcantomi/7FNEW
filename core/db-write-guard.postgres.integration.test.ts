import assert from "node:assert/strict"
import test from "node:test"
import { provisionTestDatabase, queryRaw, type ProvisionedDatabase } from "@/test/support/postgres"
import { PrivilegedOperationDeniedError, resetPolicySource, setPolicySource, type PolicySource } from "@core/privileged-operations"

/**
 * NEON-05 — `database.write` enforcement at the REAL Prisma boundary.
 *
 * Proves, against a disposable PostgreSQL database and the application's own
 * client (`core/db.ts` with the write-guard extension), that while writes are
 * frozen every write-class operation is refused BEFORE reaching the database
 * — model writes, raw execution, disguised raw writes, and writes inside both
 * forms of `$transaction` — while every read keeps working; and that `normal`
 * mode is fully functional.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
let database: ProvisionedDatabase
let db: any

const mode = (m: "normal" | "freeze-writes"): PolicySource => ({ name: `test:${m}`, resolve: () => ({ kind: "mode", mode: m, origin: `test:${m}` }) })
const frozen = () => setPolicySource(mode("freeze-writes"))
const normal = () => setPolicySource(mode("normal"))

test.before(async () => {
  database = await provisionTestDatabase("write-guard")
  ;({ db } = await import("@core/db"))
})

test.after(async () => {
  resetPolicySource()
  await db.$disconnect()
  await database.dispose()
})

async function count(table: string): Promise<number> {
  return Number((await queryRaw<{ n: string }>(database, `SELECT COUNT(*)::text AS n FROM "${table}"`))[0].n)
}

test("normal mode: writes and reads work through the extended client (baseline)", async () => {
  normal()
  const ws = await db.workspace.create({ data: { nombre: "Guard", slug: "guard" } })
  await db.workspace.update({ where: { id: ws.id }, data: { nombre: "Guard 2" } })
  const u = await db.user.create({ data: { email: "g@example.test", nombre: "G" } })
  await db.$transaction(async (tx: any) => {
    await tx.workspaceMember.create({ data: { userId: u.id, workspaceId: ws.id, role: "OWNER" } })
  })
  assert.equal(await count("Workspace"), 1)
  assert.equal(await count("WorkspaceMember"), 1)
  assert.equal((await db.workspace.findMany()).length, 1)
})

test("frozen: every model write is refused before the database sees it; rows unchanged", async () => {
  frozen()
  const before = { ws: await count("Workspace"), user: await count("User"), member: await count("WorkspaceMember") }
  const ws = await db.workspace.findFirst()
  const ops: Array<[string, () => Promise<unknown>]> = [
    ["create", () => db.workspace.create({ data: { nombre: "X", slug: "x" } })],
    ["createMany", () => db.workspace.createMany({ data: [{ nombre: "Y", slug: "y" }] })],
    ["createManyAndReturn", () => db.workspace.createManyAndReturn({ data: [{ nombre: "Z", slug: "z" }] })],
    ["update", () => db.workspace.update({ where: { id: ws.id }, data: { nombre: "nope" } })],
    ["updateMany", () => db.workspace.updateMany({ data: { nombre: "nope" } })],
    ["updateManyAndReturn", () => db.workspace.updateManyAndReturn({ data: { nombre: "nope" } })],
    ["upsert", () => db.workspace.upsert({ where: { id: ws.id }, update: { nombre: "nope" }, create: { nombre: "N", slug: "n" } })],
    ["delete", () => db.workspaceMember.delete({ where: { id: (await_member()) } })],
    ["deleteMany", () => db.workspaceMember.deleteMany({})],
  ]
  async function await_member(): Promise<string> {
    return (await db.workspaceMember.findFirst()).id
  }
  for (const [name, op] of ops) {
    await assert.rejects(op(), (err: unknown) => err instanceof PrivilegedOperationDeniedError && err.status === 503, name)
  }
  assert.deepEqual({ ws: await count("Workspace"), user: await count("User"), member: await count("WorkspaceMember") }, before)
  assert.equal((await db.workspace.findFirst()).nombre, "Guard 2", "unchanged")
})

test("frozen: reads of every kind keep working", async () => {
  frozen()
  assert.equal((await db.workspace.findMany()).length, 1)
  assert.ok(await db.workspace.findFirst())
  assert.ok(await db.workspace.findUnique({ where: { slug: "guard" } }))
  assert.ok(await db.workspace.findFirstOrThrow())
  assert.equal(await db.workspace.count(), 1)
  assert.equal((await db.workspaceMember.groupBy({ by: ["role"], _count: true })).length, 1)
  assert.equal((await db.workspace.aggregate({ _count: true }))._count, 1)
  const raw = await db.$queryRawUnsafe('SELECT COUNT(*)::text AS n FROM "Workspace" WHERE slug = $1', "guard")
  assert.equal(raw[0].n, "1")
  const tagged = await db.$queryRaw`SELECT "id" FROM "Workspace" WHERE "slug" = ${"guard"}`
  assert.equal(tagged.length, 1)
})

test("frozen: raw execution and disguised raw writes are refused; transactions carrying writes are refused in both forms", async () => {
  frozen()
  const before = await count("Workspace")
  await assert.rejects(db.$executeRawUnsafe(`UPDATE "Workspace" SET nombre = 'raw'`), PrivilegedOperationDeniedError)
  await assert.rejects(db.$executeRaw`UPDATE "Workspace" SET nombre = ${"raw"}`, PrivilegedOperationDeniedError)
  await assert.rejects(db.$executeRawUnsafe("SELECT 1"), PrivilegedOperationDeniedError, "$executeRaw is a write by contract")
  await assert.rejects(db.$queryRawUnsafe(`WITH d AS (DELETE FROM "WorkspaceMember" RETURNING id) SELECT * FROM d`), PrivilegedOperationDeniedError)
  await assert.rejects(db.$queryRaw`DELETE FROM "WorkspaceMember" WHERE id = ${"nothing"}`, PrivilegedOperationDeniedError)
  // interactive transaction: the read inside runs, the write is refused, the transaction rolls back
  await assert.rejects(
    db.$transaction(async (tx: any) => {
      assert.equal(await tx.workspace.count(), 1, "reads inside a transaction still work")
      await tx.workspace.create({ data: { nombre: "tx", slug: "tx" } })
    }),
    PrivilegedOperationDeniedError,
  )
  // batch transaction
  await assert.rejects(db.$transaction([db.workspace.count(), db.workspace.deleteMany({})]), PrivilegedOperationDeniedError)
  assert.equal(await count("Workspace"), before)
  assert.equal(await count("WorkspaceMember"), 1)
})

test("back to normal: the same client writes again (no state left behind by the refusals)", async () => {
  normal()
  await db.$executeRawUnsafe(`UPDATE "Workspace" SET nombre = 'after'`)
  assert.equal((await db.workspace.findFirst()).nombre, "after")
  await db.$transaction([db.workspaceMember.deleteMany({})])
  assert.equal(await count("WorkspaceMember"), 0)
  await db.workspace.deleteMany({})
  await db.user.deleteMany({})
})
