/**
 * CORE-03C-D2 — safety tests for the legacy-portal-retirement applier.
 *
 * Proves, with zero network (local node:sqlite fixtures):
 *   - flags: --target-production always, --owner-authorized for apply, and
 *     no override switch exists (--force / --skip-gates / --drop-nonempty /
 *     --ignore-dependencies abort as unknown arguments);
 *   - every migration file (0–5) matches its pinned sha256, and tampering
 *     with ANY of them — the new one or the historical ones — is detected;
 *   - state classification is fail-closed: all three present with the
 *     deployed shape → PENDING; all absent → APPLIED; a partial set or a
 *     shape mismatch → INCONSISTENT;
 *   - the gate fails on a single row in any of the three tables, on an
 *     inbound DDL dependency, and on a missing canonical table;
 *   - `decideDrop` (the exact sequence `apply` runs) returns the three
 *     DROPs only when PENDING + gates green; on a seeded row it STOPS
 *     without returning any DDL; on APPLIED it is a no-op;
 *   - executing the returned DDL retires exactly the three tables,
 *     preserves the canonical portal tables and every other row.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- SQL fixture rows are untyped */

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createHash } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import {
  LEGACY_TABLES,
  PROTECTED_TABLES,
  PINNED_SHA256,
  SHAPE_AFTER,
  parseFlags,
  assertFlags,
  assertPinnedChecksums,
  classifyD2State,
  runD2Gates,
  decideDrop,
  type QueryFn,
} from "./apply-core-03c-d2-legacy-portal-retirement"

const MIGRATIONS = join(process.cwd(), "prisma", "migrations")

/** Deployed-shape legacy trio + canonical portal tables + a bystander. */
function buildFixture(): DatabaseSync {
  const db = new DatabaseSync(":memory:")
  db.exec(`
    PRAGMA foreign_keys=OFF;
    CREATE TABLE "Cliente" (id TEXT PRIMARY KEY, "workspaceId" TEXT);
    CREATE TABLE "ClientProject" (
      "id" TEXT NOT NULL PRIMARY KEY, "clienteId" TEXT NOT NULL, "titulo" TEXT NOT NULL,
      "descripcion" TEXT, "estado" TEXT NOT NULL DEFAULT 'activo',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "ClientProject_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
    CREATE TABLE "ClientInvoice" (
      "id" TEXT NOT NULL PRIMARY KEY, "clienteId" TEXT NOT NULL, "monto" REAL NOT NULL,
      "estado" TEXT NOT NULL DEFAULT 'pendiente', "qrCodeUrl" TEXT, "paymentUrl" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ClientInvoice_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
    CREATE TABLE "ClientFile" (
      "id" TEXT NOT NULL PRIMARY KEY, "clienteId" TEXT NOT NULL, "nombre" TEXT NOT NULL,
      "url" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "tamano" INTEGER NOT NULL,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "ClientFile_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE CASCADE ON UPDATE CASCADE);
    CREATE TABLE "ClientAsset" (id TEXT PRIMARY KEY, "clienteId" TEXT);
    CREATE TABLE "ClientRequest" (id TEXT PRIMARY KEY, "clienteId" TEXT);
    CREATE TABLE "ClientRequestAsset" (id TEXT PRIMARY KEY, "requestId" TEXT);
    CREATE TABLE "ForteSnapshot" (id TEXT PRIMARY KEY, "workspaceId" TEXT);
    CREATE TABLE "ClientAuth" (id TEXT PRIMARY KEY, "clienteId" TEXT);
    INSERT INTO "Cliente" VALUES ('c1', 'w1');
    INSERT INTO "ClientAsset" VALUES ('a1', 'c1');
  `)
  return db
}

const q = (db: DatabaseSync): QueryFn => async (sql, args = []) => db.prepare(sql).all(...(args as any[])) as any[]

test("flags and forbidden overrides", () => {
  assert.throws(() => assertFlags("status", parseFlags([])), /--target-production/)
  assertFlags("gates", parseFlags(["--target-production"]))
  assert.throws(() => assertFlags("apply", parseFlags(["--target-production"])), /--owner-authorized/)
  assertFlags("apply", parseFlags(["--target-production", "--owner-authorized"]))
  for (const bad of ["--force", "--skip-gates", "--drop-nonempty", "--ignore-dependencies"]) {
    assert.throws(() => parseFlags([bad]), /unknown argument/)
  }
})

test("all six migration files match their pinned checksums; tampering is detected", () => {
  for (const [name, expected] of Object.entries(PINNED_SHA256)) {
    const actual = createHash("sha256").update(readFileSync(join(MIGRATIONS, name, "migration.sql"))).digest("hex")
    assert.equal(actual, expected, `${name} drifted from the pinned bytes`)
  }
  assertPinnedChecksums()
  assert.throws(() => assertPinnedChecksums(join(MIGRATIONS, "does-not-exist")))
})

test("state classification is fail-closed", async () => {
  const db = buildFixture()
  assert.equal(await classifyD2State(q(db)), "PENDING")
  db.exec(`DROP TABLE "ClientInvoice"`)
  assert.equal(await classifyD2State(q(db)), "INCONSISTENT") // partial set
  db.exec(`DROP TABLE "ClientFile"; DROP TABLE "ClientProject"`)
  assert.equal(await classifyD2State(q(db)), "APPLIED")
  db.close()

  const wrongShape = buildFixture()
  wrongShape.exec(`ALTER TABLE "ClientFile" ADD COLUMN "extra" TEXT`)
  assert.equal(await classifyD2State(q(wrongShape)), "INCONSISTENT") // shape mismatch
  wrongShape.close()
})

test("the gate fails on a row, on an inbound dependency, and on missing canon", async () => {
  const clean = buildFixture()
  assert.equal((await runD2Gates(q(clean))).pass, true)
  clean.close()

  const withRow = buildFixture()
  withRow.exec(`INSERT INTO "ClientInvoice" ("id","clienteId","monto") VALUES ('x','c1',1)`)
  const g1 = await runD2Gates(q(withRow))
  assert.equal(g1.pass, false)
  assert.equal(g1.counts.ClientInvoice, 1)
  withRow.close()

  const withInbound = buildFixture()
  withInbound.exec(`CREATE TABLE "Dependent" (id TEXT PRIMARY KEY, "pid" TEXT, CONSTRAINT "d_fk" FOREIGN KEY ("pid") REFERENCES "ClientProject" ("id"))`)
  const g2 = await runD2Gates(q(withInbound))
  assert.equal(g2.pass, false)
  assert.deepEqual(g2.inboundRefs, ["Dependent"])
  withInbound.close()

  const missingCanon = buildFixture()
  missingCanon.exec(`DROP TABLE "ForteSnapshot"`)
  assert.equal((await runD2Gates(q(missingCanon))).pass, false)
  missingCanon.close()
})

test("decideDrop returns the three DROPs on green, STOPs with zero DDL on a row, no-ops on APPLIED", async () => {
  const db = buildFixture()
  const stmts = await decideDrop(q(db))
  assert.deepEqual(stmts, [`DROP TABLE "ClientFile"`, `DROP TABLE "ClientInvoice"`, `DROP TABLE "ClientProject"`])

  // Fail-closed: one seeded row → STOP before any DDL is even returned.
  db.exec(`INSERT INTO "ClientProject" ("id","clienteId","titulo","updatedAt") VALUES ('p','c1','t',CURRENT_TIMESTAMP)`)
  await assert.rejects(() => decideDrop(q(db)), /gate failed/)
  for (const t of LEGACY_TABLES) {
    assert.ok((await q(db)(`SELECT name FROM sqlite_schema WHERE type='table' AND name = ?`, [t])).length === 1, `${t} must still exist`)
  }
  assert.equal((db.prepare(`SELECT COUNT(*) c FROM "ClientProject"`).get() as any).c, 1)

  // Clean again → execute the DDL: exactly three retired, canon + rows intact.
  db.exec(`DELETE FROM "ClientProject"`) // fixture reset only — the real tool never DELETEs
  for (const stmt of await decideDrop(q(db))) db.exec(stmt)
  assert.equal(await classifyD2State(q(db)), "APPLIED")
  const tables = new Set((await q(db)(`SELECT name FROM sqlite_schema WHERE type='table'`)).map((r: any) => String(r.name)))
  for (const p of PROTECTED_TABLES) assert.ok(tables.has(p), `${p} must survive`)
  assert.equal((db.prepare(`SELECT COUNT(*) c FROM "ClientAsset"`).get() as any).c, 1)
  assert.equal((db.prepare(`SELECT COUNT(*) c FROM "Cliente"`).get() as any).c, 1)
  // Second run: no-op.
  assert.deepEqual(await decideDrop(q(db)), [])
  db.close()
})

test("expected post shape is 49/93 (three tables, zero explicit indexes removed)", () => {
  assert.deepEqual(SHAPE_AFTER, { tables: 49, indexes: 93 })
})
