/**
 * CORE-03C-D5 — safety tests for the schema-tightenings applier.
 *
 * Proves, with zero network (local node:sqlite fixture in the exact
 * deployed pre-D5 shape):
 *   - flags: --target-production always, --owner-authorized for apply, and
 *     no override switch exists (--force / --skip-gates /
 *     --ignore-invalid-data abort as unknown arguments);
 *   - the committed migration file is byte-identical to the rehearsed
 *     bytes (pinned sha256), and tampering is detected;
 *   - state classification by PRAGMA column shape is fail-closed:
 *     relaxed → PENDING, target → APPLIED, anything mixed → INCONSISTENT;
 *   - the D5 data gates fail on every class of incompatible row (NULL,
 *     blank, invalid JSON, non-array, NULL url/tipo/fecha) and pass on
 *     clean data;
 *   - the real migration file, applied to the fixture, preserves rows,
 *     values, FK clauses and the unique index; rejects NULL on all four
 *     tightened columns afterwards; fills the two canonical defaults; and
 *     classifies APPLIED on a second look.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- PRAGMA/SQL fixture rows are untyped */

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createHash } from "node:crypto"
import { DatabaseSync } from "node:sqlite"
import {
  REHEARSED_SHA256_D5,
  EXPECTED_SHAPE,
  parseFlags,
  assertFlags,
  assertRehearsedChecksum,
  classifyD5State,
  runD5Gates,
  type QueryFn,
} from "./apply-core-03c-d5-tightenings"
import { splitStatements } from "./rehearse-core-03c-d6"

const MIGRATION = join(process.cwd(), "prisma", "migrations", "4_d5_schema_tightenings", "migration.sql")

/** The three tables in the exact deployed pre-D5 shape, plus FK parents. */
function buildFixture(): DatabaseSync {
  const db = new DatabaseSync(":memory:")
  db.exec(`
    PRAGMA foreign_keys=OFF;
    CREATE TABLE "Proyecto" (id TEXT PRIMARY KEY, "workspaceId" TEXT);
    CREATE TABLE "Cliente" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "nombre" TEXT NOT NULL,
        "email" TEXT,
        "telefono" TEXT,
        "empresa" TEXT,
        "tipo" TEXT,
        "estado" TEXT NOT NULL DEFAULT 'activo',
        "notas" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL
      , "customId" TEXT, "workspaceId" TEXT, "preferredPaymentMethod" TEXT, "currency" TEXT);
    CREATE TABLE "Documento" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "nombre" TEXT NOT NULL,
        "tipo" TEXT NOT NULL DEFAULT 'documento',
        "url" TEXT,
        "tamano" INTEGER,
        "clienteId" TEXT,
        "proyectoId" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL, "workspaceId" TEXT,
        CONSTRAINT "Documento_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "Documento_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    CREATE TABLE "Factura" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "numero" TEXT NOT NULL,
        "estado" TEXT NOT NULL DEFAULT 'borrador',
        "subtotal" REAL NOT NULL DEFAULT 0,
        "impuesto" REAL NOT NULL DEFAULT 0,
        "total" REAL NOT NULL DEFAULT 0,
        "items" TEXT,
        "fechaEmision" DATETIME,
        "fechaVencimiento" DATETIME,
        "paidAt" DATETIME,
        "clienteId" TEXT,
        "proyectoId" TEXT,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updatedAt" DATETIME NOT NULL, "workspaceId" TEXT,
        CONSTRAINT "Factura_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
        CONSTRAINT "Factura_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto" ("id") ON DELETE SET NULL ON UPDATE CASCADE
      );
    CREATE UNIQUE INDEX "Factura_numero_key" ON "Factura"("numero");

    INSERT INTO "Cliente" ("id","nombre","tipo","updatedAt","workspaceId") VALUES
      ('c1','Uno','empresa',CURRENT_TIMESTAMP,'w1'),
      ('c2','Dos','freelancer',CURRENT_TIMESTAMP,'w1');
    INSERT INTO "Documento" ("id","nombre","url","updatedAt","clienteId") VALUES
      ('d1','Doc','https://example.invalid/a',CURRENT_TIMESTAMP,'c1');
    INSERT INTO "Factura" ("id","numero","items","fechaEmision","total","updatedAt","clienteId") VALUES
      ('f1','F-001','[{"descripcion":"x","cantidad":1,"precioUnitario":5,"total":5}]','2026-01-02 03:04:05',5,CURRENT_TIMESTAMP,'c1'),
      ('f2','F-002','[]','2026-02-03 04:05:06',0,CURRENT_TIMESTAMP,'c2');
  `)
  return db
}

const q = (db: DatabaseSync): QueryFn => async (sql, args = []) => db.prepare(sql).all(...(args as any[])) as any[]

test("flags and forbidden overrides", () => {
  assert.throws(() => assertFlags("status", parseFlags([])), /--target-production/)
  assertFlags("gates", parseFlags(["--target-production"]))
  assert.throws(() => assertFlags("apply", parseFlags(["--target-production"])), /--owner-authorized/)
  assertFlags("apply", parseFlags(["--target-production", "--owner-authorized"]))
  assert.throws(() => parseFlags(["--force"]), /unknown argument/)
  assert.throws(() => parseFlags(["--skip-gates"]), /unknown argument/)
  assert.throws(() => parseFlags(["--ignore-invalid-data"]), /unknown argument/)
})

test("the committed migration is byte-identical to the rehearsed checksum", () => {
  assert.equal(createHash("sha256").update(readFileSync(MIGRATION)).digest("hex"), REHEARSED_SHA256_D5)
  assertRehearsedChecksum()
  assert.throws(() => assertRehearsedChecksum(MIGRATION + ".does-not-exist"))
})

test("state classification is fail-closed", async () => {
  const db = buildFixture()
  assert.equal(await classifyD5State(q(db)), "PENDING")
  // Tighten only Documento.url out-of-band → mixed shape → INCONSISTENT.
  db.exec(`CREATE TABLE "new_Documento" ("id" TEXT NOT NULL PRIMARY KEY, "nombre" TEXT NOT NULL, "tipo" TEXT NOT NULL DEFAULT 'documento', "url" TEXT NOT NULL, "tamano" INTEGER, "clienteId" TEXT, "proyectoId" TEXT, "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" DATETIME NOT NULL, "workspaceId" TEXT);
    INSERT INTO "new_Documento" SELECT * FROM "Documento"; DROP TABLE "Documento"; ALTER TABLE "new_Documento" RENAME TO "Documento";`)
  assert.equal(await classifyD5State(q(db)), "INCONSISTENT")
  db.close()
})

test("data gates fail on each incompatible class and pass on clean data", async () => {
  const db = buildFixture()
  const clean = await runD5Gates(q(db))
  assert.ok(clean.every((g) => g.pass), JSON.stringify(clean))

  const failing: Array<[string, string]> = [
    [`INSERT INTO "Factura" ("id","numero","updatedAt") VALUES ('fx1','FX-1',CURRENT_TIMESTAMP)`, "Factura.items"], // NULL items + NULL fecha
    [`INSERT INTO "Factura" ("id","numero","items","fechaEmision","updatedAt") VALUES ('fx2','FX-2','   ','2026-01-01',CURRENT_TIMESTAMP)`, "Factura.items"], // blank
    [`INSERT INTO "Factura" ("id","numero","items","fechaEmision","updatedAt") VALUES ('fx3','FX-3','not json','2026-01-01',CURRENT_TIMESTAMP)`, "Factura.items"], // invalid JSON
    [`INSERT INTO "Factura" ("id","numero","items","fechaEmision","updatedAt") VALUES ('fx4','FX-4','{"a":1}','2026-01-01',CURRENT_TIMESTAMP)`, "Factura.items"], // non-array
    [`INSERT INTO "Factura" ("id","numero","items","fechaEmision","updatedAt") VALUES ('fx5','FX-5','[]','nonsense-date',CURRENT_TIMESTAMP)`, "Factura.fechaEmision"], // unparseable
    [`INSERT INTO "Documento" ("id","nombre","updatedAt") VALUES ('dx1','x',CURRENT_TIMESTAMP)`, "Documento.url"],
    [`INSERT INTO "Cliente" ("id","nombre","updatedAt") VALUES ('cx1','x',CURRENT_TIMESTAMP)`, "Cliente.tipo"],
  ]
  for (const [sql, gateName] of failing) {
    const dirty = buildFixture()
    dirty.exec(sql)
    const results = await runD5Gates(q(dirty))
    const gate = results.find((g) => g.name === gateName)!
    assert.equal(gate.pass, false, `${gateName} should fail after: ${sql}`)
    dirty.close()
  }
  db.close()
})

test("the real migration rebuilds the three tables preserving everything but the four shapes", async () => {
  const db = buildFixture()
  const before = {
    clientes: db.prepare(`SELECT COUNT(*) c FROM "Cliente"`).get() as any,
    itemsLen: db.prepare(`SELECT SUM(LENGTH("items")) l FROM "Factura"`).get() as any,
    f1: db.prepare(`SELECT "items","fechaEmision","total" FROM "Factura" WHERE id='f1'`).get() as any,
  }

  for (const stmt of splitStatements(readFileSync(MIGRATION, "utf8"))) db.exec(stmt)

  assert.equal(await classifyD5State(q(db)), "APPLIED")
  // Rows and values verbatim.
  assert.equal((db.prepare(`SELECT COUNT(*) c FROM "Cliente"`).get() as any).c, before.clientes.c)
  assert.equal((db.prepare(`SELECT SUM(LENGTH("items")) l FROM "Factura"`).get() as any).l, before.itemsLen.l)
  assert.deepEqual(db.prepare(`SELECT "items","fechaEmision","total" FROM "Factura" WHERE id='f1'`).get(), before.f1)
  // FK clauses and the unique index survive.
  const facturaSql = String((db.prepare(`SELECT sql FROM sqlite_schema WHERE type='table' AND name='Factura'`).get() as any).sql)
  assert.ok(facturaSql.includes("Factura_clienteId_fkey") && facturaSql.includes("Factura_proyectoId_fkey"))
  assert.ok(db.prepare(`SELECT name FROM sqlite_schema WHERE type='index' AND name='Factura_numero_key'`).get())
  assert.throws(() => db.exec(`INSERT INTO "Factura" ("id","numero","items","fechaEmision","updatedAt") VALUES ('f1-dup','F-001','[]','2026-01-01',CURRENT_TIMESTAMP)`), /UNIQUE/)
  // NULL rejected on all four tightened columns.
  assert.throws(() => db.exec(`INSERT INTO "Cliente" ("id","nombre","tipo","updatedAt") VALUES ('cn','x',NULL,CURRENT_TIMESTAMP)`), /NOT NULL/)
  assert.throws(() => db.exec(`INSERT INTO "Documento" ("id","nombre","url","updatedAt") VALUES ('dn','x',NULL,CURRENT_TIMESTAMP)`), /NOT NULL/)
  assert.throws(() => db.exec(`INSERT INTO "Factura" ("id","numero","items","updatedAt") VALUES ('fn','FN-1',NULL,CURRENT_TIMESTAMP)`), /NOT NULL/)
  assert.throws(() => db.exec(`INSERT INTO "Factura" ("id","numero","items","fechaEmision","updatedAt") VALUES ('fn2','FN-2','[]',NULL,CURRENT_TIMESTAMP)`), /NOT NULL/)
  // The two canonical defaults fill omitted values.
  db.exec(`INSERT INTO "Cliente" ("id","nombre","updatedAt") VALUES ('cd','x',CURRENT_TIMESTAMP)`)
  assert.equal((db.prepare(`SELECT "tipo" t FROM "Cliente" WHERE id='cd'`).get() as any).t, "empresa")
  db.exec(`INSERT INTO "Factura" ("id","numero","items","updatedAt") VALUES ('fd','FD-1','[]',CURRENT_TIMESTAMP)`)
  assert.ok((db.prepare(`SELECT "fechaEmision" f FROM "Factura" WHERE id='fd'`).get() as any).f)
  db.close()
})

test("expected shape constants stay at the post-D6 numbers (rebuilds are equivalent)", () => {
  assert.deepEqual(EXPECTED_SHAPE, { tables: 52, indexes: 93 })
})
