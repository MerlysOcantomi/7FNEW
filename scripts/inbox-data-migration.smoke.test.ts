import assert from "node:assert/strict"
import test from "node:test"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createClient, type Client } from "@libsql/client"

/**
 * Smoke tests for the INBOX-DATA-04B additive migration
 * (`prisma/sql/2026-07-19-inbox-data-04b-additive.sql`).
 *
 * Builds a scratch SQLite database with MINIMAL pre-migration parent tables
 * (only the columns the migration's ALTERs and the tests touch), applies the
 * committed migration SQL verbatim, and asserts the constraints behave as
 * designed:
 *   - ExternalIdentity routing uniqueness (and what it deliberately allows);
 *   - ContactIdentityLink per-identity/per-contact uniqueness (shared values
 *     across contacts stay legal);
 *   - MessageAttachment [messageId, attachmentKey] idempotency anchor;
 *   - Message/ChannelConnection new columns with their defaults.
 */

const MIGRATION_PATH = join(process.cwd(), "prisma/sql/2026-07-19-inbox-data-04b-additive.sql")

function splitStatements(sql: string): string[] {
  return sql
    .split(/;\s*\n/)
    .map((s) => s.replace(/^--.*$/gm, "").trim())
    .filter((s) => s.length > 0)
}

let dir: string
let db: Client

test.before(async () => {
  dir = mkdtempSync(join(tmpdir(), "inbox-data-smoke-"))
  db = createClient({ url: `file:${join(dir, "smoke.db")}` })

  // Minimal PRE-migration parent tables (subset of the old schema).
  await db.execute(`CREATE TABLE "Workspace" ("id" TEXT NOT NULL PRIMARY KEY)`)
  await db.execute(`CREATE TABLE "Contact" ("id" TEXT NOT NULL PRIMARY KEY, "workspaceId" TEXT)`)
  await db.execute(
    `CREATE TABLE "Message" ("id" TEXT NOT NULL PRIMARY KEY, "workspaceId" TEXT, "connectionId" TEXT, "sourceMessageId" TEXT)`,
  )
  await db.execute(
    `CREATE TABLE "ChannelConnection" ("id" TEXT NOT NULL PRIMARY KEY, "workspaceId" TEXT, "provider" TEXT)`,
  )

  const migration = readFileSync(MIGRATION_PATH, "utf8")
  for (const statement of splitStatements(migration)) {
    await db.execute(statement)
  }

  await db.execute(`INSERT INTO "Workspace" ("id") VALUES ('ws1')`)
  await db.execute(`INSERT INTO "Contact" ("id", "workspaceId") VALUES ('c1', 'ws1'), ('c2', 'ws1')`)
  await db.execute(`INSERT INTO "Message" ("id", "workspaceId") VALUES ('m1', 'ws1'), ('m2', 'ws1')`)
})

test.after(() => {
  db.close()
  rmSync(dir, { recursive: true, force: true })
})

async function expectUniqueViolation(sql: string) {
  await assert.rejects(
    () => db.execute(sql),
    (err: Error) => /unique/i.test(String(err)),
    `expected UNIQUE violation for: ${sql}`,
  )
}

test("ExternalIdentity: routing key is unique; scope variants stay legal", async () => {
  const insert = (id: string, scopeKey: string, externalKey: string, channel = "messenger") =>
    `INSERT INTO "ExternalIdentity" ("id","workspaceId","channel","provider","scopeKey","kind","externalKey","updatedAt")
     VALUES ('${id}','ws1','${channel}','meta','${scopeKey}','psid','${externalKey}',CURRENT_TIMESTAMP)`

  await db.execute(insert("ei1", "page_A", "psid-123"))
  // Exact same routing key → rejected.
  await expectUniqueViolation(insert("ei1b", "page_A", "psid-123"))
  // Same external id under ANOTHER page (scopeKey) → legal (page-scoped PSIDs).
  await db.execute(insert("ei2", "page_B", "psid-123"))
  // Same value on another channel → legal.
  await db.execute(insert("ei3", "", "psid-123", "sms"))
})

test("ContactIdentityLink: one link per identity+contact; shared values across contacts allowed", async () => {
  const insert = (id: string, identity: string, contact: string) =>
    `INSERT INTO "ContactIdentityLink" ("id","workspaceId","externalIdentityId","contactId","updatedAt")
     VALUES ('${id}','ws1','${identity}','${contact}',CURRENT_TIMESTAMP)`

  await db.execute(insert("l1", "ei1", "c1"))
  // Same identity, same contact → rejected.
  await expectUniqueViolation(insert("l1b", "ei1", "c1"))
  // Same identity, DIFFERENT contact → legal: this IS the ambiguous/shared case.
  await db.execute(insert("l2", "ei1", "c2"))
})

test("MessageAttachment: [messageId, attachmentKey] anchors idempotency; position is not identity", async () => {
  const insert = (id: string, message: string, key: string, position: number) =>
    `INSERT INTO "MessageAttachment" ("id","workspaceId","messageId","attachmentKey","position","updatedAt")
     VALUES ('${id}','ws1','${message}','${key}',${position},CURRENT_TIMESTAMP)`

  await db.execute(insert("a1", "m1", "media:meta:xyz", 0))
  // Webhook redelivery (same message, same key) → rejected → upsert no-op path.
  await expectUniqueViolation(insert("a1b", "m1", "media:meta:xyz", 1))
  // Same key on ANOTHER message → legal.
  await db.execute(insert("a2", "m2", "media:meta:xyz", 0))
  // Same message, same POSITION but different key → legal (position ≠ identity).
  await db.execute(insert("a3", "m1", "store:blob/1", 0))
})

test("Message/ChannelConnection new columns exist with their defaults", async () => {
  const msg = await db.execute(`SELECT "deliveryStatus", "readSource" FROM "Message" WHERE id='m1'`)
  assert.equal(msg.rows[0]["deliveryStatus"], "none")
  assert.equal(msg.rows[0]["readSource"], null)

  await db.execute(
    `INSERT INTO "ChannelConnection" ("id","workspaceId","provider") VALUES ('cc1','ws1','meta')`,
  )
  const conn = await db.execute(
    `SELECT "numberUsage", "providerAccountId" FROM "ChannelConnection" WHERE id='cc1'`,
  )
  assert.equal(conn.rows[0]["numberUsage"], "unknown")
  assert.equal(conn.rows[0]["providerAccountId"], null)
})
