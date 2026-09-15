import assert from "node:assert/strict"
import test from "node:test"
import { provisionTestDatabase, type ProvisionedDatabase } from "@/test/support/postgres"

/**
 * NEON-03 transactions audit — the IMAP cursor is committed OPTIMISTICALLY:
 * `commitImapSyncCursor` writes the new `syncState` only when the persisted
 * value is still the one the run started from. Verified on real PostgreSQL
 * (the `updateMany` + `IS NULL` semantics are the database's, not a mock's).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
let database: ProvisionedDatabase
let db: any
let commitImapSyncCursor: typeof import("./imap-sync")["commitImapSyncCursor"]
let ws: any

async function connection(syncState: string | null) {
  return db.channelConnection.create({
    data: { workspaceId: ws.id, channelType: "email", provider: "imap_smtp", name: "IMAP", syncState, status: "connected" },
  })
}

test.before(async () => {
  database = await provisionTestDatabase("imap-cursor")
  ;({ db } = await import("@core/db"))
  ;({ commitImapSyncCursor } = await import("./imap-sync"))
  ws = await db.workspace.create({ data: { nombre: "IMAP", slug: "ws-imap" } })
})

test.after(async () => {
  await db.$disconnect()
  await database.dispose()
})

test("a first sync (persisted syncState NULL) commits its cursor and marks the connection active", async () => {
  const conn = await connection(null)
  const ok = await commitImapSyncCursor({ connectionId: conn.id, expectedSyncState: null, newSyncState: { lastUid: 10, uidValidity: 1 }, lastError: null })
  assert.equal(ok, true)
  const after = await db.channelConnection.findUnique({ where: { id: conn.id } })
  assert.deepEqual(JSON.parse(after.syncState), { lastUid: 10, uidValidity: 1 })
  assert.equal(after.status, "active")
  assert.ok(after.lastSyncAt instanceof Date)
})

test("a run that started from the current cursor advances it; a stale run is refused and cannot regress it", async () => {
  const start = JSON.stringify({ lastUid: 10, uidValidity: 1 })
  const conn = await connection(start)

  // Run A and run B both read lastUid=10. A commits first.
  const a = await commitImapSyncCursor({ connectionId: conn.id, expectedSyncState: start, newSyncState: { lastUid: 25, uidValidity: 1 }, lastError: null })
  assert.equal(a, true)
  // B (slower, saw fewer messages) must NOT overwrite A's cursor with 18.
  const b = await commitImapSyncCursor({ connectionId: conn.id, expectedSyncState: start, newSyncState: { lastUid: 18, uidValidity: 1 }, lastError: "late" })
  assert.equal(b, false)

  const after = await db.channelConnection.findUnique({ where: { id: conn.id } })
  assert.deepEqual(JSON.parse(after.syncState), { lastUid: 25, uidValidity: 1 })
  assert.equal(after.lastError, null, "the refused run wrote nothing at all")
})

test("a stale first sync (expected NULL) cannot overwrite a cursor another first sync just committed", async () => {
  const conn = await connection(null)
  assert.equal(await commitImapSyncCursor({ connectionId: conn.id, expectedSyncState: null, newSyncState: { lastUid: 3 }, lastError: null }), true)
  assert.equal(await commitImapSyncCursor({ connectionId: conn.id, expectedSyncState: null, newSyncState: { lastUid: 2 }, lastError: null }), false)
  const after = await db.channelConnection.findUnique({ where: { id: conn.id } })
  assert.deepEqual(JSON.parse(after.syncState), { lastUid: 3 })
})

test("the commit is scoped to its own connection", async () => {
  const one = await connection(JSON.stringify({ lastUid: 1 }))
  const two = await connection(JSON.stringify({ lastUid: 1 }))
  assert.equal(await commitImapSyncCursor({ connectionId: one.id, expectedSyncState: JSON.stringify({ lastUid: 1 }), newSyncState: { lastUid: 9 }, lastError: null }), true)
  const untouched = await db.channelConnection.findUnique({ where: { id: two.id } })
  assert.deepEqual(JSON.parse(untouched.syncState), { lastUid: 1 })
})
