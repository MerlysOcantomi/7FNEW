/**
 * `turso:verify` — read-only structural comparison.
 *
 * Proves that the comparison is structural rather than name-based (types,
 * nullability, defaults, primary keys, foreign keys with their actions, index
 * uniqueness/columns/collation), that it never writes to the target, and that
 * it refuses to answer `identical` for anything SQLite's PRAGMAs do not
 * describe faithfully.
 *
 * Runs entirely against throwaway LOCAL SQLite files — it never connects to
 * any remote database, so it is safe in CI without credentials or the proxy.
 *
 * Run: npm run test:turso-verify
 */

import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test, { type TestContext } from "node:test"

import { createClient, type Client } from "@libsql/client"
import { bootstrapSchema } from "../prisma/bootstrap-turso"
import { exitCodeFor, verifySchema } from "../prisma/verify-turso"
import {
  PROJECT_ROOT,
  asReadOnly,
  assertModelNamesMatchTables,
  canonicalStructureFromDdl,
  compareStructures,
  generateCanonicalDdl,
  introspectStructure,
  parseSchemaModels,
  splitSqlStatements,
  stripSqlLiterals,
  type FindingCategory,
  type ReadOnlyExecutor,
  type StructuralReport,
} from "../prisma/turso-schema"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let cachedDdl: string | undefined
function realDdl(): string {
  cachedDdl ??= generateCanonicalDdl()
  return cachedDdl
}

function tempDb(t: TestContext, label = "db"): Client {
  const dir = mkdtempSync(join(tmpdir(), "turso-verify-"))
  const client = createClient({ url: `file:${join(dir, `${label}.db`)}` })
  t.after(() => {
    client.close()
    rmSync(dir, { recursive: true, force: true })
  })
  return client
}

/** A database built from arbitrary SQL, for the drift scenarios. */
async function dbFrom(t: TestContext, sql: string, label: string): Promise<Client> {
  const client = tempDb(t, label)
  await client.executeMultiple(`PRAGMA foreign_keys=OFF;\n${sql}`)
  return client
}

/** Compare a hand-written "database" schema against a canonical DDL. */
async function reportFor(t: TestContext, canonicalDdl: string, actualSql: string, label: string) {
  const client = await dbFrom(t, actualSql, label)
  return verifySchema(asReadOnly(client), canonicalDdl)
}

function categories(report: StructuralReport): FindingCategory[] {
  return [...report.drift, ...report.unverifiable].map((f) => f.category)
}

const BASE = `CREATE TABLE "Parent" (
    "id" TEXT NOT NULL PRIMARY KEY
);
CREATE TABLE "Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "parentId" TEXT,
    CONSTRAINT "Item_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Item_label_idx" ON "Item"("label");
CREATE UNIQUE INDEX "Item_score_key" ON "Item"("score");`

function mutate(from: string, to: string): string {
  assert.ok(BASE.includes(from), `fixture does not contain ${from}`)
  return BASE.replace(from, to)
}

// ---------------------------------------------------------------------------
// 1. Identical
// ---------------------------------------------------------------------------

test("a database created by bootstrap verifies as identical", async (t) => {
  const ddl = realDdl()
  const source = readFileSync(join(PROJECT_ROOT, "prisma/schema.prisma"), "utf8")

  // The independent cross-check assumes model name === table name.
  assert.doesNotThrow(() => assertModelNamesMatchTables(source))
  assert.throws(
    () => assertModelNamesMatchTables('model Foo {\n  id String @id\n  @@map("foo")\n}'),
    /@@map/,
  )

  const client = tempDb(t, "identical")
  await bootstrapSchema(client, ddl)

  const report = await verifySchema(asReadOnly(client), ddl)
  assert.equal(report.verdict, "identical")
  assert.deepEqual(report.drift, [])
  assert.deepEqual(report.unverifiable, [])
  assert.equal(exitCodeFor(report), 0)

  // …and every model really is there (independent of the DDL).
  const tables = (await introspectStructure(asReadOnly(client))).tables.map((tb) => tb.name)
  assert.equal(tables.length, parseSchemaModels(source).length)
})

test("declaration order is irrelevant", async (t) => {
  const reordered = `CREATE TABLE "Item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "label" TEXT NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "parentId" TEXT,
    CONSTRAINT "Item_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Item_score_key" ON "Item"("score");
CREATE INDEX "Item_label_idx" ON "Item"("label");
CREATE TABLE "Parent" ("id" TEXT NOT NULL PRIMARY KEY);`

  const report = await reportFor(t, BASE, reordered, "reordered")
  assert.equal(report.verdict, "identical", JSON.stringify(report.drift))
})

// ---------------------------------------------------------------------------
// 2. Drift the comparison must catch
// ---------------------------------------------------------------------------

const DRIFT_CASES: Array<[label: string, actualSql: string, expected: FindingCategory]> = [
  ["a missing table", mutate('CREATE TABLE "Parent" (\n    "id" TEXT NOT NULL PRIMARY KEY\n);\n', ""), "missing-table"],
  ["an extra table", `${BASE}\nCREATE TABLE "Ghost" ("id" TEXT NOT NULL PRIMARY KEY);`, "extra-table"],
  ["a missing column", mutate('    "note" TEXT,\n', ""), "missing-column"],
  ["an extra column", mutate('    "note" TEXT,', '    "note" TEXT,\n    "surplus" TEXT,'), "extra-column"],
  ["a different type", mutate('"label" TEXT NOT NULL', '"label" BLOB NOT NULL'), "column-mismatch"],
  ["different nullability", mutate('"label" TEXT NOT NULL', '"label" TEXT'), "column-mismatch"],
  ["a different default", mutate('"score" INTEGER NOT NULL DEFAULT 0', '"score" INTEGER NOT NULL DEFAULT 7'), "column-mismatch"],
  [
    "a different primary key",
    mutate(
      '"id" TEXT NOT NULL PRIMARY KEY,\n    "label" TEXT NOT NULL',
      '"id" TEXT NOT NULL,\n    "label" TEXT NOT NULL PRIMARY KEY',
    ),
    "column-mismatch",
  ],
  [
    "a missing foreign key",
    mutate(
      ',\n    CONSTRAINT "Item_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent" ("id") ON DELETE CASCADE ON UPDATE CASCADE',
      "",
    ),
    "missing-foreign-key",
  ],
  ["different foreign-key actions", mutate("ON DELETE CASCADE", "ON DELETE SET NULL"), "foreign-key-mismatch"],
  ["a missing index", mutate('CREATE INDEX "Item_label_idx" ON "Item"("label");\n', ""), "missing-index"],
  ["an extra index", `${BASE}\nCREATE INDEX "Item_note_idx" ON "Item"("note");`, "extra-index"],
  ["a unique index turned plain", mutate('CREATE UNIQUE INDEX "Item_score_key"', 'CREATE INDEX "Item_score_key"'), "index-mismatch"],
  ["an index over other columns", mutate('ON "Item"("label")', 'ON "Item"("note")'), "index-mismatch"],
]

test("structural drift is detected in every dimension", async (t) => {
  for (const [label, actualSql, expected] of DRIFT_CASES) {
    await t.test(label, async () => {
      const report = await reportFor(t, BASE, actualSql, label.replace(/\W+/g, "-"))
      assert.equal(report.verdict, "drift detected", JSON.stringify(report))
      assert.ok(
        categories(report).includes(expected),
        `expected a ${expected} finding, got ${JSON.stringify(categories(report))}`,
      )
      assert.equal(exitCodeFor(report), 2)
    })
  }
})

test("a default differing only in whitespace is never treated as equal", async (t) => {
  const canonical = `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "label" TEXT DEFAULT ' spaced ');`
  const drifted = `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "label" TEXT DEFAULT 'spaced');`

  const report = await reportFor(t, canonical, drifted, "whitespace-default")
  assert.notEqual(report.verdict, "identical")
  assert.ok(categories(report).includes("column-mismatch"), JSON.stringify(report))

  // The identical case still verifies, because defaults are compared raw.
  const same = await reportFor(t, canonical, canonical, "whitespace-default-same")
  assert.equal(same.verdict, "identical")
})

// ---------------------------------------------------------------------------
// 3. Constructs the tool cannot compare faithfully
// ---------------------------------------------------------------------------

const UNVERIFIABLE_CASES: Array<[label: string, canonical: string, actual: string, expected: FindingCategory]> = [
  [
    "a CHECK constraint present only in the schema",
    `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "n" INTEGER CHECK ("n" > 0));`,
    `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "n" INTEGER);`,
    "check-constraint",
  ],
  [
    "a CHECK constraint present only in the database",
    `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "n" INTEGER);`,
    `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "n" INTEGER CHECK ("n" > 0));`,
    "check-constraint",
  ],
  [
    "a generated column with a different expression",
    `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "n" INTEGER, "double" INTEGER GENERATED ALWAYS AS ("n" * 2) VIRTUAL);`,
    `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "n" INTEGER, "double" INTEGER GENERATED ALWAYS AS ("n" * 3) VIRTUAL);`,
    "generated-column",
  ],
  [
    "an expression index",
    `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "label" TEXT);
CREATE INDEX "T_lower_idx" ON "T"(lower("label"));`,
    `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "label" TEXT);
CREATE INDEX "T_lower_idx" ON "T"(upper("label"));`,
    "expression-index",
  ],
  [
    "a column collation",
    `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "label" TEXT COLLATE NOCASE);`,
    `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "label" TEXT);`,
    "collation",
  ],
  [
    "a WITHOUT ROWID table",
    `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY) WITHOUT ROWID;`,
    `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY);`,
    "unsupported-construct",
  ],
]

test("constructs PRAGMAs cannot describe are never assumed equal", async (t) => {
  for (const [label, canonical, actual, expected] of UNVERIFIABLE_CASES) {
    await t.test(label, async () => {
      const report = await reportFor(t, canonical, actual, label.replace(/\W+/g, "-"))
      assert.notEqual(report.verdict, "identical", `${label} must not verify as identical`)
      assert.ok(
        categories(report).includes(expected),
        `expected a ${expected} finding, got ${JSON.stringify(categories(report))}`,
      )
      assert.equal(exitCodeFor(report), 2)
    })
  }
})

test("an index collation difference is reported", async (t) => {
  const canonical = `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "label" TEXT);
CREATE INDEX "T_label_idx" ON "T"("label" COLLATE NOCASE);`
  const actual = `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "label" TEXT);
CREATE INDEX "T_label_idx" ON "T"("label");`

  const report = await reportFor(t, canonical, actual, "index-collation")
  assert.notEqual(report.verdict, "identical")
  assert.ok(
    report.drift.some((f) => /collations/.test(f.detail)),
    JSON.stringify(report.drift),
  )
})

test("identical unverifiable constructs still refuse the identical verdict", async (t) => {
  // Both sides carry the same CHECK. We cannot see it through PRAGMAs, so we
  // must say so rather than claim equality we cannot prove.
  const both = `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "n" INTEGER CHECK ("n" > 0));`
  const report = await reportFor(t, both, both, "same-check")
  assert.equal(report.verdict, "structure not verifiable")
  assert.deepEqual(report.drift, [])
  assert.equal(exitCodeFor(report), 2)
})

// ---------------------------------------------------------------------------
// 4. Read-only enforcement
// ---------------------------------------------------------------------------

test("verify issues no write against the target", async (t) => {
  const ddl = realDdl()
  const client = tempDb(t, "readonly")
  await bootstrapSchema(client, ddl)

  const issued: string[] = []
  const recording: ReadOnlyExecutor = {
    async execute(sql: string) {
      issued.push(sql)
      return client.execute(sql)
    },
  }

  const report = await verifySchema(asReadOnly(recording), ddl)
  assert.equal(report.verdict, "identical")
  assert.ok(issued.length > 0)

  for (const sql of issued) {
    const head = stripSqlLiterals(sql).replace(/\s+/g, " ").trim()
    assert.match(
      head,
      /^(SELECT|PRAGMA)\b/i,
      `verify issued a non-read statement against the target: ${head.slice(0, 80)}`,
    )
    assert.ok(
      !/\b(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|REPLACE|BEGIN|COMMIT)\b/i.test(head),
      `verify issued a write against the target: ${head.slice(0, 80)}`,
    )
  }
})

test("the read-only wrapper refuses a write even if one is attempted", async () => {
  const reader = asReadOnly({
    async execute() {
      throw new Error("the underlying client must never be reached")
    },
  })

  for (const sql of [
    'CREATE TABLE "X" ("id" TEXT)',
    'DROP TABLE "X"',
    'INSERT INTO "X" VALUES (1)',
    "PRAGMA foreign_keys = ON",
    "BEGIN IMMEDIATE",
  ]) {
    await assert.rejects(() => reader.execute(sql), /Read-only guard refused/, sql)
  }

  // The read surface it does allow.
  const ok = asReadOnly({ async execute() { return { rows: [] } } })
  await assert.doesNotReject(() => ok.execute("SELECT name FROM sqlite_master"))
  await assert.doesNotReject(() => ok.execute('PRAGMA table_xinfo("T")'))
  await assert.doesNotReject(() => ok.execute("PRAGMA integrity_check"))
})

test("verify exposes no write method on the target type", () => {
  const reader = asReadOnly({ async execute() { return { rows: [] } } })
  assert.deepEqual(Object.keys(reader), ["execute"])
  for (const method of ["executeMultiple", "transaction", "batch", "migrate", "sync"]) {
    assert.equal(
      (reader as unknown as Record<string, unknown>)[method],
      undefined,
      `${method} must not be reachable on the read-only surface`,
    )
  }
})

// ---------------------------------------------------------------------------
// 5. The generator and the scanner
// ---------------------------------------------------------------------------

test("verify works from any working directory and uses the local Prisma CLI", async (t) => {
  const original = process.cwd()
  const elsewhere = mkdtempSync(join(tmpdir(), "turso-verify-cwd-"))
  t.after(() => {
    process.chdir(original)
    rmSync(elsewhere, { recursive: true, force: true })
  })

  process.chdir(elsewhere)
  const fromElsewhere = generateCanonicalDdl()
  process.chdir(original)

  assert.equal(fromElsewhere, realDdl())
})

test("generateCanonicalDdl reports child-process failures safely", () => {
  assert.throws(
    () => generateCanonicalDdl({ schemaPath: "prisma/definitely-missing.prisma" }),
    /prisma\/definitely-missing\.prisma/,
  )

  const dir = mkdtempSync(join(tmpdir(), "turso-bad-"))
  try {
    const bad = join(dir, "bad.prisma")
    writeFileSync(bad, 'datasource db {\n  provider = "sqlite"\n}\n\nmodel Broken { id }\n')
    assert.throws(
      () => generateCanonicalDdl({ schemaPath: bad }),
      (err: unknown) => {
        assert.ok(err instanceof Error)
        assert.match(err.message, /exit status:/)
        assert.match(err.message, /stderr:/)
        assert.match(err.message, /P1012|Error validating/)
        return true
      },
    )
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("the statement scanner is not confused by literals or comments", () => {
  const tricky = `CREATE TABLE "T" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "greeting" TEXT NOT NULL DEFAULT 'hola; adios',
    "note" TEXT DEFAULT 'line one
-- not a comment'
);
-- a real comment; with a semicolon
CREATE INDEX "T_greeting_idx" ON "T"("greeting");`

  const statements = splitSqlStatements(tricky)
  assert.equal(statements.length, 2)
  assert.ok(statements[0].includes("hola; adios"), "a ';' inside a literal must not split")
  assert.ok(statements[0].includes("-- not a comment"), "a '--' inside a literal must survive")
  assert.match(statements[1], /^CREATE INDEX "T_greeting_idx"/)

  // Keyword scanning must ignore keywords inside literals and identifiers.
  const decoy = `CREATE TABLE "T" ("checkish" TEXT DEFAULT 'CHECK (x > 0)');`
  assert.ok(!/\bCHECK\s*\(/i.test(stripSqlLiterals(decoy)), "a CHECK inside a literal is not a CHECK")
})

test("an unsupported DDL statement class is a hard error", async () => {
  await assert.rejects(
    () =>
      canonicalStructureFromDdl(
        `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY);
CREATE TRIGGER "t_after" AFTER INSERT ON "T" BEGIN SELECT 1; END;`,
      ),
    /do not support/,
  )
})

test("the real canonical DDL is fully verifiable", async () => {
  const canonical = await canonicalStructureFromDdl(realDdl())
  const report = compareStructures(canonical, canonical)
  assert.equal(
    report.verdict,
    "identical",
    `schema.prisma introduced a construct the tools cannot verify: ${JSON.stringify(report.unverifiable)}`,
  )
})
