import assert from "node:assert/strict"
import test from "node:test"
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createClient, type Client as LibsqlClient } from "@libsql/client"
import { Client as PgClient } from "pg"
import { provisionTestDatabase, queryRaw, type ProvisionedDatabase } from "@/test/support/postgres"
import { REPO_ROOT, runPrisma, writeTempPrismaConfig } from "../lib/prisma-cli"
import { deriveSqliteSchema } from "../build-db-from-history"
import { BASELINE_SHA256, assertEmptyProductionTarget, formatProductionMarker, formatStagingMarker, runEtl, stampProductionIdentity, stampStagingIdentity, verifyParity, type EtlManifest, type TargetExpectation } from "./etl-turso-to-postgres"

/**
 * NEON-04 — end-to-end ETL rehearsal on LOCAL infrastructure, in CI:
 *
 *   SOURCE: a throwaway SQLite database built from the LEGACY history exactly
 *           as production Turso is today (migrations 0..5 — 49 tables, no
 *           WorkspaceEntitlement, no Workspace.entitlementRevision), seeded
 *           with synthetic rows that exercise every transformation: adapter
 *           dates with offsets, a SQLite CURRENT_TIMESTAMP date, 0/1 booleans,
 *           JSON documents, a float, ciphertext-shaped credentials, a
 *           self-referencing media chain, nullable FKs, mixed-case Message-IDs.
 *   TARGET: a disposable PostgreSQL database carrying the pinned 0_init
 *           (test/support/postgres.ts).
 *
 * Proves: guards fail closed before any write; the load is transactional;
 * every transformation lands with the intended semantics; parity is OK with
 * per-row digests and field-level live comparison; a tampered target is
 * detected with redacted reporting; a second run from a reset target is
 * byte-identical in its manifest digests (reproducibility).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
let database: ProvisionedDatabase
let sourceDir: string
let sourceUrl: string
let source: LibsqlClient
let expectation: TargetExpectation

const NOW = "2026-07-19T12:00:00.123+00:00"
const OFFSET = "2026-07-19T14:00:00.500+02:00" // = 12:00:00.500Z
const CIPHERTEXT = "v1:gcm:AAAAAAAAAAAAAAAA:ZmFrZS1jaXBoZXJ0ZXh0LW5vdC1hLXNlY3JldA=="
const RAW_MESSAGE_ID = "<CAB+7Fx9KqZ_Mixed.Case@mail.Example.COM>"

async function seedSource(): Promise<number> {
  const stmts: string[] = [
    `INSERT INTO "Workspace" ("id","nombre","slug","plan","createdAt","updatedAt","config") VALUES ('ws_a','Tenant A','tenant-a','enterprise','${NOW}','${NOW}','{"modules":{"inbox":true,"crm":true}}')`,
    `INSERT INTO "Workspace" ("id","nombre","slug","createdAt","updatedAt") VALUES ('ws_b','Tenant B','tenant-b','${OFFSET}','${OFFSET}')`,
    `INSERT INTO "User" ("id","email","nombre","isPrivate","createdAt","updatedAt") VALUES ('u_a','ana@tenant-a.test','Ana',1,'${NOW}','${NOW}')`,
    `INSERT INTO "User" ("id","email","createdAt","updatedAt") VALUES ('u_b','bea@tenant-b.test','${NOW}','${NOW}')`,
    `INSERT INTO "WorkspaceMember" ("id","userId","workspaceId","role","createdAt") VALUES ('m_a','u_a','ws_a','OWNER','${NOW}'),('m_b','u_b','ws_b','OWNER','${NOW}')`,
    `INSERT INTO "AllowedEmail" ("id","email","createdAt") VALUES ('ae_1','invite@tenant-a.test','2026-01-01 00:00:00')`,
    `INSERT INTO "Cliente" ("id","nombre","customId","workspaceId","createdAt","updatedAt") VALUES ('cl_1','Cliente Uno','CLIENT-0001','ws_a','${NOW}','${NOW}')`,
    `INSERT INTO "Proyecto" ("id","nombre","progreso","presupuesto","tags","workspaceId","createdAt","updatedAt") VALUES ('p_1','Rebrand',1,1234.5,'urgente,VIP','ws_a','${NOW}','${NOW}')`,
    `INSERT INTO "Contact" ("id","workspaceId","nombre","email","createdAt","updatedAt") VALUES ('ct_a','ws_a','Acme Contact','acme@example.test','${NOW}','${NOW}'),('ct_b','ws_b','Other','o@example.test','${NOW}','${NOW}')`,
    `INSERT INTO "ChannelConnection" ("id","workspaceId","channelType","provider","name","config","credentials","isDefault","syncState","createdAt","updatedAt") VALUES ('cc_1','ws_a','email','imap_smtp','Mail A','{"imapHost":"imap.example.test"}','${CIPHERTEXT}',1,'{"lastUid":42}','${NOW}','${NOW}')`,
    `INSERT INTO "Conversation" ("id","contactId","workspaceId","channel","status","subject","lastMessageAt","createdAt","updatedAt") VALUES ('cv_a','ct_a','ws_a','email','triaged','Acme quote','${NOW}','${NOW}','${NOW}'),('cv_b','ct_b','ws_b','whatsapp','new',NULL,'${OFFSET}','${OFFSET}','${OFFSET}')`,
    `INSERT INTO "Message" ("id","conversationId","role","content","workspaceId","direction","isInternal","metadata","createdAt") VALUES ('msg_1','cv_a','visitor','Hola {no json aqui','ws_a','inbound',0,'{"source":"email","emailMessageId":"${RAW_MESSAGE_ID}"}','${NOW}'),('msg_2','cv_a','operator','Respuesta','ws_a','outbound',1,NULL,'${OFFSET}'),('msg_3','cv_b','visitor','Hi','ws_b','inbound',0,NULL,'${NOW}')`,
    `INSERT INTO "PresenceSite" ("id","workspaceId","slug","createdAt","updatedAt") VALUES ('ps_1','ws_a','tenant-a-site','${NOW}','${NOW}')`,
    `INSERT INTO "PresenceMedia" ("id","workspaceId","siteId","kind","storageKey","url","createdAt","updatedAt","sourceMediaId") VALUES ('pm_v2','ws_a','ps_1','image','media/v2.jpg','https://blob/v2.jpg','${NOW}','${NOW}','pm_v1'),('pm_orig','ws_a','ps_1','image','media/o.jpg','https://blob/o.jpg','${NOW}','${NOW}',NULL),('pm_v1','ws_a','ps_1','image','media/v1.jpg','https://blob/v1.jpg','${NOW}','${NOW}','pm_orig')`,
  ]
  let rows = 0
  for (const s of stmts) {
    const r = await source.execute(s)
    rows += r.rowsAffected
  }
  return rows
}

test.before(async () => {
  database = await provisionTestDatabase("etl-rehearsal")
  expectation = {
    role: "local",
    host: database.target.host,
    database: database.target.database,
    // CI runs PostgreSQL as a container with a published port: the client dials
    // loopback but the server reports its container address. Declared, not detected.
    forwardedLoopback: process.env.TEST_DATABASE_FORWARDED_LOOPBACK === "1",
  }

  // Production-shaped SQLite source: legacy history WITHOUT migration 6.
  sourceDir = mkdtempSync(join(tmpdir(), "etl-source-"))
  const migrations = join(sourceDir, "migrations")
  cpSync(join(REPO_ROOT, "prisma", "migrations"), migrations, { recursive: true })
  rmSync(join(migrations, "6_found04a_workspace_entitlements"), { recursive: true, force: true })
  const sqliteSchema = join(sourceDir, "schema.sqlite.prisma")
  writeFileSync(sqliteSchema, deriveSqliteSchema(require("node:fs").readFileSync(join(REPO_ROOT, "prisma", "schema.prisma"), "utf8")))
  sourceUrl = `file:${join(sourceDir, "source.db")}`
  const config = writeTempPrismaConfig({ schemaPath: sqliteSchema, migrationsDir: migrations, url: sourceUrl, prefix: "etl-source-config-" })
  try {
    runPrisma(["migrate", "deploy", "--config", config.configPath])
  } finally {
    config.cleanup()
  }
  source = createClient({ url: sourceUrl })
  await source.execute("PRAGMA foreign_keys = ON")
})

test.after(async () => {
  source.close()
  rmSync(sourceDir, { recursive: true, force: true })
  await database.dispose()
})

async function targetCount(table: string): Promise<number> {
  return Number((await queryRaw<{ n: string }>(database, `SELECT COUNT(*)::text AS n FROM "${table}"`))[0].n)
}

let seededRows = 0
let manifest1: EtlManifest

test("the source mirrors production today: 49 tables, no WorkspaceEntitlement, no entitlementRevision", async () => {
  const tables = await source.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations'")
  assert.equal(tables.rows.length, 49)
  assert.ok(!tables.rows.some((r) => r.name === "WorkspaceEntitlement"))
  const cols = await source.execute('PRAGMA table_info("Workspace")')
  assert.ok(!cols.rows.some((r) => r.name === "entitlementRevision"))
  seededRows = await seedSource()
  assert.equal(seededRows, 21)
})

test("guards fail closed before any write: wrong database, wrong host, forbidden roles, wrong source scheme", async () => {
  const base = { sourceUrl, targetUrl: database.url }
  await assert.rejects(runEtl({ ...base, expectation: { ...expectation, database: "other_db" } }), /database does not match/)
  await assert.rejects(runEtl({ ...base, expectation: { ...expectation, host: "db.example.invalid" } }), /host does not match/)
  await assert.rejects(runEtl({ ...base, expectation: { ...expectation, role: "production" as any } }), /requires --expect-project and --expect-branch/, "production is an explicit, separately identified role")
  await assert.rejects(runEtl({ ...base, expectation: { ...expectation, role: "prod" as any } }), /unknown target role/)
  await assert.rejects(runEtl({ ...base, expectation: { ...expectation, role: "staging", host: "db.prod.invalid" } }), /host does not match|production/)
  await assert.rejects(runEtl({ sourceUrl: database.url, targetUrl: database.url, expectation }), /source is never PostgreSQL/)
  await assert.rejects(runEtl({ sourceUrl, targetUrl: sourceUrl, expectation }), /target is never Turso/)
  assert.equal(await targetCount("Workspace"), 0, "nothing was written")
})

test("rehearsal #1: extract → transform → load in one transaction, manifest with per-row digests", async () => {
  const log: string[] = []
  manifest1 = await runEtl({ sourceUrl, targetUrl: database.url, expectation, log: (l) => log.push(l) })
  assert.equal(manifest1.totals.sourceRows, seededRows)
  assert.equal(manifest1.totals.loadedRows, seededRows)
  assert.equal(manifest1.totals.tables, 50)
  assert.equal(manifest1.tables.WorkspaceEntitlement.presentInSource, false)
  assert.equal(manifest1.tables.WorkspaceEntitlement.loadedRows, 0)
  assert.equal(manifest1.source.tables, 49)
  assert.deepEqual(manifest1.totals.warnings, 0, "message content that merely starts with { is not JSON-looking-invalid: it does not start with { …")
  assert.ok(log.some((l) => /one read snapshot/.test(l)))
  assert.ok(!JSON.stringify(manifest1).includes(CIPHERTEXT), "the manifest never carries values")
  assert.ok(!JSON.stringify(manifest1).includes(sourceUrl) && !JSON.stringify(manifest1).includes(database.url), "the manifest never carries connection strings")
})

test("transformations landed with the intended semantics", async () => {
  const ws = await queryRaw<{ id: string; createdAt: string; entitlementRevision: string | null; config: string | null }>(database, `SELECT id, "createdAt"::text AS "createdAt", "entitlementRevision"::text AS "entitlementRevision", config FROM "Workspace" ORDER BY id`)
  assert.equal(ws[0].createdAt, "2026-07-19 12:00:00.123", "adapter date with +00:00 → UTC timestamp(3)")
  assert.equal(ws[1].createdAt, "2026-07-19 12:00:00.5", "+02:00 offset converted to UTC")
  assert.equal(ws[0].entitlementRevision, null, "column new in PostgreSQL → NULL")
  assert.equal(ws[0].config, '{"modules":{"inbox":true,"crm":true}}', "JSON text byte-identical")
  const ae = await queryRaw<{ createdAt: string }>(database, `SELECT "createdAt"::text AS "createdAt" FROM "AllowedEmail"`)
  assert.equal(ae[0].createdAt, "2026-01-01 00:00:00", "SQLite CURRENT_TIMESTAMP shape read as UTC")
  const user = await queryRaw<{ isPrivate: boolean }>(database, `SELECT "isPrivate" FROM "User" WHERE id = 'u_a'`)
  assert.equal(user[0].isPrivate, true, "SQLite 1 → boolean true where the column is BOOLEAN")
  const p = await queryRaw<{ progreso: number; presupuesto: number }>(database, `SELECT progreso, presupuesto FROM "Proyecto"`)
  assert.equal(p[0].progreso, 1, "SQLite 1 in an INTEGER column stays 1")
  assert.equal(p[0].presupuesto, 1234.5)
  const cc = await queryRaw<{ credentials: string; isDefault: boolean; syncState: string }>(database, `SELECT credentials, "isDefault", "syncState" FROM "ChannelConnection"`)
  assert.equal(cc[0].credentials, CIPHERTEXT, "ciphertext carried verbatim, never decrypted or re-encoded")
  assert.equal(cc[0].isDefault, true)
  assert.equal(cc[0].syncState, '{"lastUid":42}')
  const media = await queryRaw<{ id: string; sourceMediaId: string | null }>(database, `SELECT id, "sourceMediaId" FROM "PresenceMedia" ORDER BY id`)
  assert.deepEqual(media.map((m) => `${m.id}<${m.sourceMediaId ?? "null"}`), ["pm_orig<null", "pm_v1<pm_orig", "pm_v2<pm_v1"], "self-referencing chain loaded under enforced FKs")
  const msg = await queryRaw<{ metadata: string | null; isInternal: boolean }>(database, `SELECT metadata, "isInternal" FROM "Message" WHERE id = 'msg_1'`)
  assert.ok(msg[0].metadata!.includes(RAW_MESSAGE_ID), "Message-ID casing preserved")
  assert.equal(msg[0].isInternal, false)
  const m2 = await queryRaw<{ isInternal: boolean; metadata: string | null }>(database, `SELECT "isInternal", metadata FROM "Message" WHERE id = 'msg_2'`)
  assert.equal(m2[0].isInternal, true)
  assert.equal(m2[0].metadata, null)
  // The runtime client reads the migrated rows as the app would (UTC semantics, real types).
  const { db } = await import("@core/db")
  try {
    const conv = await db.conversation.findFirst({ where: { workspaceId: "ws_b" }, select: { lastMessageAt: true, subject: true } })
    assert.equal(conv?.lastMessageAt.toISOString(), "2026-07-19T12:00:00.500Z")
    assert.equal(conv?.subject, null)
    const hit = await db.message.findFirst({ where: { workspaceId: "ws_a", metadata: { contains: "cab+7fx9kqz_mixed.case@mail.example.com", mode: "insensitive" } }, select: { id: true } })
    assert.equal(hit?.id, "msg_1", "case-insensitive Message-ID lookup works on migrated data")
  } finally {
    await db.$disconnect()
  }
})

test("parity: counts, per-table digests, FK orphans and duplicate PKs are all clean; live source agrees field by field", async () => {
  const report = await verifyParity({ sourceUrl, targetUrl: database.url, expectation, manifest: manifest1, liveSource: true })
  assert.equal(report.ok, true, JSON.stringify(report.mismatches))
  assert.equal(report.tables.length, 50)
  assert.ok(report.tables.every((t) => t.digestMatch && t.fkOrphans === 0 && t.duplicatePks === 0 && t.manifestRows === t.targetRows))
  assert.deepEqual(report.mismatches, [])
  assert.ok(report.liveSourceDrift!.every((d) => !d.digestChanged), "the source has not changed since the snapshot")
  assert.deepEqual(report.domainWarnings, [])
})

test("a non-empty target is refused without an explicit, exact reset confirmation", async () => {
  await assert.rejects(runEtl({ sourceUrl, targetUrl: database.url, expectation }), /target is not empty/)
  await assert.rejects(runEtl({ sourceUrl, targetUrl: database.url, expectation, resetTarget: true, confirmReset: "wrong-name" }), /--confirm-reset must repeat the exact target database name/)
  assert.equal(await targetCount("Message"), 3, "still intact")
})

test("rehearsal #2 from a reset target is reproducible: identical per-table digests and totals", async () => {
  const manifest2 = await runEtl({ sourceUrl, targetUrl: database.url, expectation, resetTarget: true, confirmReset: expectation.database })
  assert.deepEqual(manifest2.totals, manifest1.totals)
  for (const t of Object.keys(manifest1.tables)) {
    assert.equal(manifest2.tables[t].digest, manifest1.tables[t].digest, `${t} digest reproducible`)
    assert.deepEqual(manifest2.tables[t].rows, manifest1.tables[t].rows)
  }
  const report = await verifyParity({ sourceUrl, targetUrl: database.url, expectation, manifest: manifest2 })
  assert.equal(report.ok, true)
})

test("a tampered target is detected with table/pk/field detail; sensitive fields are reported redacted", async () => {
  const pg = new PgClient({ host: database.target.host, port: database.target.port, user: database.target.user, password: database.target.password, database: database.target.database })
  await pg.connect()
  try {
    await pg.query(`UPDATE "Message" SET content = 'tampered' WHERE id = 'msg_3'`)
    await pg.query(`UPDATE "ChannelConnection" SET credentials = 'v1:gcm:other:Y2hhbmdlZA==' WHERE id = 'cc_1'`)
    await pg.query(`DELETE FROM "PresenceMedia" WHERE id = 'pm_v2'`)
  } finally {
    await pg.end()
  }
  const report = await verifyParity({ sourceUrl, targetUrl: database.url, expectation, manifest: manifest1, liveSource: true })
  assert.equal(report.ok, false)
  const bad = report.tables.filter((t) => t.status === "MISMATCH").map((t) => t.table).sort()
  assert.deepEqual(bad, ["ChannelConnection", "Message", "PresenceMedia"])
  const content = report.mismatches.find((m) => m.table === "Message" && m.primaryKey === "msg_3" && m.field === "content")
  assert.deepEqual(content && { source: content.source, target: content.target }, { source: "Hi", target: "tampered" })
  const cred = report.mismatches.find((m) => m.table === "ChannelConnection" && m.field === "credentials")
  assert.ok(cred)
  assert.match(cred.source, /^<redacted sha256:/)
  assert.match(cred.target, /^<redacted sha256:/)
  assert.ok(!JSON.stringify(report).includes(CIPHERTEXT) && !JSON.stringify(report).includes("Y2hhbmdlZA=="), "ciphertext never appears in the report")
  assert.ok(report.mismatches.some((m) => m.table === "PresenceMedia" && m.primaryKey === "pm_v2" && m.target === "<absent in target>"))
  // Restore a clean target for teardown determinism (the helper drops it anyway).
  await runEtl({ sourceUrl, targetUrl: database.url, expectation, resetTarget: true, confirmReset: expectation.database })
})

// ─── NEON-04-R1: independent staging identity (database comment) ────────────

const STAGING_ID = "sevenf-neon04-rehearsal"

async function setDatabaseComment(comment: string | null): Promise<void> {
  const pg = new PgClient({ host: database.target.host, port: database.target.port, user: database.target.user, password: database.target.password, database: database.target.database })
  await pg.connect()
  try {
    // Test-only: writes the comment directly (no bind parameters exist for COMMENT ON).
    await pg.query(`COMMENT ON DATABASE "${database.target.database}" IS ${comment === null ? "NULL" : `'${comment.replace(/'/g, "''")}'`}`)
  } finally {
    await pg.end()
  }
}

function stagingExpectation(stagingId: string | undefined = STAGING_ID): TargetExpectation {
  // Same operator-supplied host/database as the working local expectation: they
  // are self-consistent with the URL and with current_database(), on purpose.
  return { role: "staging", host: expectation.host, database: expectation.database, stagingId }
}

test("staging: an operator-consistent host/database on a database WITHOUT the identity marker is refused — run, parity and --reset-target alike, no TRUNCATE", async () => {
  await setDatabaseComment(null)
  const before = await targetCount("Message")
  assert.equal(before, 3, "the previous test left a loaded target: the reset path has something to destroy")
  const staging = stagingExpectation()
  await assert.rejects(runEtl({ sourceUrl, targetUrl: database.url, expectation: staging }), /carries no staging identity marker/)
  await assert.rejects(
    runEtl({ sourceUrl, targetUrl: database.url, expectation: staging, resetTarget: true, confirmReset: staging.database }),
    /carries no staging identity marker/,
    "--reset-target with a valid confirmation still fails on identity first",
  )
  await assert.rejects(verifyParity({ sourceUrl, targetUrl: database.url, expectation: staging, manifest: manifest1 }), /carries no staging identity marker/)
  assert.equal(await targetCount("Message"), before, "nothing was truncated or written")
  const noId: TargetExpectation = { role: "staging", host: expectation.host, database: expectation.database }
  await assert.rejects(runEtl({ sourceUrl, targetUrl: database.url, expectation: noId }), /requires --expect-staging-id/)
  await assert.rejects(verifyParity({ sourceUrl, targetUrl: database.url, expectation: noId, manifest: manifest1 }), /requires --expect-staging-id/)
})

test("staging: a present but different or malformed marker is refused, still without reaching TRUNCATE", async () => {
  const staging = stagingExpectation()
  const before = await targetCount("Message")
  for (const [comment, pattern] of [
    [formatStagingMarker("another-staging-db"), /names a different target/],
    ["sevenf:environment=local;sevenf:migration=neon-04;sevenf:target=" + STAGING_ID, /environment is not staging/],
    ["sevenf:environment=staging;sevenf:migration=neon-05;sevenf:target=" + STAGING_ID, /migration is not neon-04/],
    ["staging - please do not truncate", /malformed/],
  ] as const) {
    await setDatabaseComment(comment)
    await assert.rejects(runEtl({ sourceUrl, targetUrl: database.url, expectation: staging, resetTarget: true, confirmReset: staging.database }), pattern, comment)
    await assert.rejects(verifyParity({ sourceUrl, targetUrl: database.url, expectation: staging, manifest: manifest1 }), pattern, comment)
  }
  assert.equal(await targetCount("Message"), before, "nothing was truncated or written")
})

async function markerCount(): Promise<string> {
  return queryRaw<{ n: string }>(database, "SELECT COUNT(*)::text AS n FROM pg_shdescription d JOIN pg_database db ON db.oid = d.objoid WHERE db.datname = current_database()").then((r) => r[0].n)
}

async function rawTarget<T>(fn: (pg: PgClient) => Promise<T>): Promise<T> {
  const pg = new PgClient({ host: database.target.host, port: database.target.port, user: database.target.user, password: database.target.password, database: database.target.database })
  await pg.connect()
  try {
    return await fn(pg)
  } finally {
    await pg.end()
  }
}

test("NEON-04-R2 P1: a POPULATED, unmarked canonical database with valid host/db/role/id/confirmation can NOT be stamped — rows intact, comment still NULL", async () => {
  await setDatabaseComment(null)
  const before = await targetCount("Message")
  assert.equal(before, 3, "the database is populated (loaded by the previous tests)")
  const stampArgs = { targetUrl: database.url, expectation: stagingExpectation(), confirmStamp: expectation.database }
  await assert.rejects(stampStagingIdentity(stampArgs), (err: Error) => {
    assert.match(err.message, /refusing to stamp a populated database as staging/)
    assert.match(err.message, /Message=3/, "safe detail: table names and counts")
    assert.ok(!err.message.includes(database.url), "no connection string")
    if (database.target.password) assert.ok(!err.message.includes(database.target.password), "no password")
    return true
  })
  // The other pre-write refusals still hold and still write nothing.
  await assert.rejects(stampStagingIdentity({ ...stampArgs, confirmStamp: "wrong" }), /--confirm-stamp must repeat/)
  await assert.rejects(stampStagingIdentity({ ...stampArgs, expectation }), /only applies to --target-role staging/)
  await assert.rejects(stampStagingIdentity({ ...stampArgs, expectation: stagingExpectation("prod-like") }), /must not look like production/)
  await setDatabaseComment(formatStagingMarker("another-staging-db"))
  await assert.rejects(stampStagingIdentity(stampArgs), /already carries a different/)
  await setDatabaseComment(null)
  assert.equal(await targetCount("Message"), before, "rows intact")
  assert.equal(await markerCount(), "0", "no marker written")
})

test("NEON-04-R2: the stamp also demands the canonical ledger and schema — no ledger, no 0_init, rolled back, foreign checksum, missing table, foreign table all FAIL before any write", async () => {
  const stampArgs = { targetUrl: database.url, expectation: stagingExpectation(), confirmStamp: expectation.database }
  const cases: Array<[string, string, string, RegExp]> = [
    ["no ledger at all", `ALTER TABLE "_prisma_migrations" RENAME TO "_ledger_gone"`, `ALTER TABLE "_ledger_gone" RENAME TO "_prisma_migrations"`, /has no _prisma_migrations ledger/],
    ["foreign checksum", `UPDATE "_prisma_migrations" SET checksum = repeat('0', 64) WHERE migration_name = '0_init'`, `UPDATE "_prisma_migrations" SET checksum = '${BASELINE_SHA256}' WHERE migration_name = '0_init'`, /0_init checksum differs from the pinned baseline/],
    ["rolled back", `UPDATE "_prisma_migrations" SET rolled_back_at = now() WHERE migration_name = '0_init'`, `UPDATE "_prisma_migrations" SET rolled_back_at = NULL WHERE migration_name = '0_init'`, /no completed 0_init row/],
    ["no 0_init", `UPDATE "_prisma_migrations" SET migration_name = '9_other' WHERE migration_name = '0_init'`, `UPDATE "_prisma_migrations" SET migration_name = '0_init' WHERE migration_name = '9_other'`, /no completed 0_init row/],
    ["incomplete schema", `ALTER TABLE "Vertical" RENAME TO "Vertical_gone"`, `ALTER TABLE "Vertical_gone" RENAME TO "Vertical"`, /missing table\(s\): Vertical/],
    ["foreign application table", `CREATE TABLE "OtherApp" (id integer PRIMARY KEY)`, `DROP TABLE "OtherApp"`, /outside the canonical schema \(OtherApp\)/],
  ]
  for (const [label, breakSql, restoreSql, pattern] of cases) {
    await rawTarget((pg) => pg.query(breakSql))
    try {
      await assert.rejects(stampStagingIdentity(stampArgs), pattern, label)
      if (label === "foreign application table") {
        // the same guard protects run and parity (single source of truth)
        await assert.rejects(runEtl({ sourceUrl, targetUrl: database.url, expectation, resetTarget: true, confirmReset: expectation.database }), pattern, "run shares the guard")
        await assert.rejects(verifyParity({ sourceUrl, targetUrl: database.url, expectation, manifest: manifest1 }), pattern, "parity shares the guard")
      }
    } finally {
      await rawTarget((pg) => pg.query(restoreSql))
    }
    assert.equal(await markerCount(), "0", `${label}: no marker written`)
  }
  assert.equal(await targetCount("Message"), 3, "rows intact throughout")
})

test("NEON-04-R2: canonical schema + every table empty → stamp OK; identical marker idempotent; only then staging run/parity; local unaffected", async () => {
  // Test-only: make the canonical database empty again (a freshly provisioned
  // staging database is exactly this state: 0_init applied, no rows).
  const tables = (await queryRaw<{ table_name: string }>(database, "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'")).map((r) => r.table_name)
  assert.equal(tables.length, 50)
  await rawTarget((pg) => pg.query(`TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`))
  assert.equal(await targetCount("Message"), 0)
  assert.equal(await markerCount(), "0")

  const log: string[] = []
  const marker = await stampStagingIdentity({ targetUrl: database.url, expectation: stagingExpectation(), confirmStamp: expectation.database, log: (l) => log.push(l) })
  assert.deepEqual(marker, { environment: "staging", migration: "neon-04", target: STAGING_ID })
  assert.ok(log.some((l) => l.includes("stamped")))
  assert.ok(!log.join("\n").includes(database.url), "no connection string in logs")
  assert.equal(await markerCount(), "1")
  const again = await stampStagingIdentity({ targetUrl: database.url, expectation: stagingExpectation(), confirmStamp: expectation.database })
  assert.deepEqual(again, marker, "idempotent for the identical marker on a still-valid schema")

  // Correct marker + empty canonical target: the staging role loads and verifies parity.
  const staging = stagingExpectation()
  const manifestS = await runEtl({ sourceUrl, targetUrl: database.url, expectation: staging })
  assert.equal(manifestS.target.role, "staging")
  assert.equal(manifestS.target.stagingId, STAGING_ID)
  assert.equal(manifestS.totals.loadedRows, seededRows)
  for (const t of Object.keys(manifest1.tables)) assert.equal(manifestS.tables[t].digest, manifest1.tables[t].digest)
  const report = await verifyParity({ sourceUrl, targetUrl: database.url, expectation: staging, manifest: manifestS, liveSource: true })
  assert.equal(report.ok, true)
  // Once stamped and populated by the ETL, re-stamping the identical marker is
  // still a no-op (schema re-verified, nothing written); a different id is refused.
  assert.deepEqual(await stampStagingIdentity({ targetUrl: database.url, expectation: stagingExpectation(), confirmStamp: expectation.database }), marker)
  await assert.rejects(runEtl({ sourceUrl, targetUrl: database.url, expectation: stagingExpectation("someone-elses-staging"), resetTarget: true, confirmReset: staging.database }), /names a different target/)
  await assert.rejects(stampStagingIdentity({ targetUrl: database.url, expectation: stagingExpectation("someone-elses-staging"), confirmStamp: expectation.database }), /already carries a different/)
  assert.equal(await targetCount("Message"), 3)

  // role local is unchanged by the marker: no id needed, reset path works.
  const manifestL = await runEtl({ sourceUrl, targetUrl: database.url, expectation, resetTarget: true, confirmReset: expectation.database })
  assert.equal(manifestL.target.role, "local")
  assert.equal(manifestL.target.stagingId, undefined)
  assert.equal(manifestL.totals.loadedRows, seededRows)
})

// ─── NEON-05: production role on the same stand-in ───────────────────────────

const PROD_IDENTITY = { project: "old-wave-11795585", branch: "br-broad-river-b2ue75l8" }

function productionExpectation(identity = PROD_IDENTITY): TargetExpectation {
  return { role: "production", host: expectation.host, database: expectation.database, production: identity }
}

test("NEON-05: production cannot masquerade as staging — a staging-marked, populated database is refused under the production role before any write", async () => {
  const prod = productionExpectation()
  const before = await targetCount("Message")
  assert.equal(before, 3, "the previous local run left data and the staging marker in place")
  await assert.rejects(runEtl({ sourceUrl, targetUrl: database.url, expectation: prod, confirmProduction: prod.database }), /production identity marker is malformed/)
  await assert.rejects(verifyParity({ sourceUrl, targetUrl: database.url, expectation: prod, manifest: manifest1 }), /production identity marker is malformed/)
  await assert.rejects(stampProductionIdentity({ targetUrl: database.url, expectation: prod, confirmStamp: prod.database }), /already carries a different/)
  assert.equal(await targetCount("Message"), before)
})

test("NEON-05: stamp-production only on an empty canonical database with explicit confirmation; staging can then no longer address it", async () => {
  const tables = (await queryRaw<{ table_name: string }>(database, "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name <> '_prisma_migrations'")).map((r) => r.table_name)
  await rawTarget((pg) => pg.query(`TRUNCATE ${tables.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`))
  await setDatabaseComment(null)
  const prod = productionExpectation()
  await assert.rejects(stampProductionIdentity({ targetUrl: database.url, expectation: prod, confirmStamp: "neondb" }), /--confirm-stamp must repeat/)
  await assert.rejects(stampProductionIdentity({ targetUrl: database.url, expectation, confirmStamp: expectation.database }), /only applies to --target-role production/)
  await assert.rejects(stampProductionIdentity({ targetUrl: database.url, expectation: { ...prod, production: undefined }, confirmStamp: prod.database }), /requires --expect-project and --expect-branch/)
  assert.equal(await markerCount(), "0")
  // a populated database (one row) is refused, then emptied again
  await rawTarget((pg) => pg.query(`INSERT INTO "AllowedEmail" ("id","email","createdAt") VALUES ('p1','p@example.test',now())`))
  await assert.rejects(stampProductionIdentity({ targetUrl: database.url, expectation: prod, confirmStamp: prod.database }), /refusing to stamp a populated database as production/)
  await rawTarget((pg) => pg.query(`DELETE FROM "AllowedEmail"`))
  assert.equal(await markerCount(), "0")

  const log: string[] = []
  const marker = await stampProductionIdentity({ targetUrl: database.url, expectation: prod, confirmStamp: prod.database, log: (l) => log.push(l) })
  assert.deepEqual(marker, { environment: "production", migration: "neon-05", ...PROD_IDENTITY })
  assert.ok(!log.join("\n").includes(database.url))
  const comment = await queryRaw<{ c: string }>(database, "SELECT shobj_description(oid, 'pg_database') AS c FROM pg_database WHERE datname = current_database()")
  assert.equal(comment[0].c, formatProductionMarker(PROD_IDENTITY))
  assert.deepEqual(await stampProductionIdentity({ targetUrl: database.url, expectation: prod, confirmStamp: prod.database }), marker, "idempotent")
  // staging cannot masquerade as production: the staging role refuses the production-marked database
  await assert.rejects(runEtl({ sourceUrl, targetUrl: database.url, expectation: stagingExpectation() }), /staging identity marker is malformed/)
  await assert.rejects(stampStagingIdentity({ targetUrl: database.url, expectation: stagingExpectation(), confirmStamp: expectation.database }), /already carries a different/)
})

test("NEON-05: production run is ONE SHOT — explicit confirmation, no reset path, refused on a non-empty target, wrong project/branch refused, no secret leakage", async () => {
  const prod = productionExpectation()
  await assert.rejects(runEtl({ sourceUrl, targetUrl: database.url, expectation: prod }), /requires --confirm-production/)
  await assert.rejects(runEtl({ sourceUrl, targetUrl: database.url, expectation: prod, confirmProduction: "neondb" }), /requires --confirm-production/)
  await assert.rejects(runEtl({ sourceUrl, targetUrl: database.url, expectation: prod, confirmProduction: prod.database, resetTarget: true, confirmReset: prod.database }), /has no reset path/)
  assert.equal(await targetCount("Message"), 0, "nothing loaded by the refusals")

  const manifestP = await runEtl({ sourceUrl, targetUrl: database.url, expectation: prod, confirmProduction: prod.database })
  assert.equal(manifestP.target.role, "production")
  assert.equal(manifestP.target.project, PROD_IDENTITY.project)
  assert.equal(manifestP.target.branch, PROD_IDENTITY.branch)
  assert.equal(manifestP.target.stagingId, undefined)
  assert.equal(manifestP.totals.loadedRows, seededRows)
  for (const t of Object.keys(manifest1.tables)) assert.equal(manifestP.tables[t].digest, manifest1.tables[t].digest, `${t}: same data as the staging/local rehearsals`)
  const report = await verifyParity({ sourceUrl, targetUrl: database.url, expectation: prod, manifest: manifestP, liveSource: true })
  assert.equal(report.ok, true)

  // rerun after success: refused; reset flags: refused; rows intact
  await assert.rejects(runEtl({ sourceUrl, targetUrl: database.url, expectation: prod, confirmProduction: prod.database }), (err: Error) => {
    assert.match(err.message, /production target is not empty/)
    assert.match(err.message, /one shot and has no reset path/)
    assert.ok(!err.message.includes("--reset-target"), "no hint towards a reset")
    assert.ok(!err.message.includes(database.url))
    return true
  })
  await assert.rejects(runEtl({ sourceUrl, targetUrl: database.url, expectation: prod, confirmProduction: prod.database, resetTarget: true, confirmReset: prod.database }), /has no reset path/)
  assert.equal(await targetCount("Message"), 3)

  // wrong project / wrong branch against the stamped database
  await assert.rejects(runEtl({ sourceUrl, targetUrl: database.url, expectation: productionExpectation({ project: "other-project-99", branch: PROD_IDENTITY.branch }), confirmProduction: prod.database }), /different Neon project/)
  await assert.rejects(runEtl({ sourceUrl, targetUrl: database.url, expectation: productionExpectation({ project: PROD_IDENTITY.project, branch: "br-other-branch-99" }), confirmProduction: prod.database }), /different Neon branch/)
  await assert.rejects(verifyParity({ sourceUrl, targetUrl: database.url, expectation: productionExpectation({ project: "other-project-99", branch: PROD_IDENTITY.branch }), manifest: manifestP }), /different Neon project/)
  assert.equal(await targetCount("Message"), 3)

  // the stamped production database still refuses staging and still cannot be re-stamped differently
  await assert.rejects(stampProductionIdentity({ targetUrl: database.url, expectation: productionExpectation({ project: "other-project-99", branch: PROD_IDENTITY.branch }), confirmStamp: prod.database }), /already carries a different/)
})

test("NEON-05 R2: preflight-empty runs the production guard before connecting and refuses a non-empty target (this database carries 0_init and data)", async () => {
  const prod = productionExpectation()
  const before = await targetCount("Message")
  // URL guard first — these never open a connection (wrong host / pooled / no verify-full on a remote host)
  await assert.rejects(assertEmptyProductionTarget({ targetUrl: database.url, expectation: { ...prod, host: "ep-other.c-6.eu-central-1.aws.neon.tech" } }), /host does not match/)
  await assert.rejects(
    assertEmptyProductionTarget({ targetUrl: "postgresql://u:p@ep-x-pooler.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=verify-full", expectation: { ...prod, host: "ep-x-pooler.c-6.eu-central-1.aws.neon.tech", database: "neondb" } }),
    /DIRECT endpoint; a pooled/,
  )
  await assert.rejects(
    assertEmptyProductionTarget({ targetUrl: "postgresql://u:p@ep-x.c-6.eu-central-1.aws.neon.tech/neondb?sslmode=require", expectation: { ...prod, host: "ep-x.c-6.eu-central-1.aws.neon.tech", database: "neondb" } }),
    /requires sslmode=verify-full/,
  )
  await assert.rejects(assertEmptyProductionTarget({ targetUrl: database.url, expectation: stagingExpectation() }), /only applies to --target-role production/)
  await assert.rejects(assertEmptyProductionTarget({ targetUrl: database.url, expectation: { ...prod, production: undefined } }), /requires --expect-project and --expect-branch/)
  // live: this database has the ledger and tables → not empty → refused, read-only, nothing changed
  await assert.rejects(assertEmptyProductionTarget({ targetUrl: database.url, expectation: prod }), (err: Error) => {
    assert.match(err.message, /production target is not empty/)
    assert.match(err.message, /ledger=true/)
    assert.ok(!err.message.includes(database.url))
    return true
  })
  assert.equal(await targetCount("Message"), before)
  assert.equal(await markerCount(), "1", "the production marker is untouched")
})
