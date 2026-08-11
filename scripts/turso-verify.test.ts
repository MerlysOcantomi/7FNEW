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
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test, { type TestContext } from "node:test"

import { createClient, type Client } from "@libsql/client"
import { bootstrapTursoFromEnv, type BootstrapClient } from "../prisma/bootstrap-turso"
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
  READ_ONLY_PRAGMAS,
  READ_ONLY_STATEMENTS,
  assertReadOnlySql as tursoAssert,
  describeError,
  sanitizeForLog,
  SQLITE_MASTER_QUERY,
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

/**
 * Bootstrap a local SQLite database through the guarded entry point. The target
 * name is non-production so the guard passes; the injected factory redirects the
 * write to the throwaway file.
 */
async function bootstrapInto(client: Client, ddl: string): Promise<void> {
  const nonClosing: BootstrapClient = {
    transaction: (mode) => client.transaction(mode),
    close: () => {},
  }
  await bootstrapTursoFromEnv(
    { TURSO_DATABASE_URL: "libsql://verify-sandbox.turso.io" },
    { ddl, createClient: () => nonClosing },
  )
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
  await bootstrapInto(client, ddl)

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
  await bootstrapInto(client, ddl)

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

/**
 * Statements that must never reach the client. `PRAGMA name(value)` matters as
 * much as `PRAGMA name = value`: SQLite accepts the functional form as a write
 * too, which is how `PRAGMA user_version(42)` slipped past the previous guard.
 */
const REFUSED_STATEMENTS: Array<[label: string, sql: string]> = [
  // Mutating pragmas in functional form.
  ["writable_schema(1)", "PRAGMA writable_schema(1)"],
  ["user_version(42)", "PRAGMA user_version(42)"],
  ["journal_mode(WAL)", "PRAGMA journal_mode(WAL)"],
  ["foreign_keys(ON)", "PRAGMA foreign_keys(ON)"],
  ["application_id(123)", "PRAGMA application_id(123)"],
  ["cache_size(-1000)", "PRAGMA cache_size(-1000)"],
  ["secure_delete(1)", "PRAGMA secure_delete(1)"],
  // Assignment form.
  ["user_version = 42", "PRAGMA user_version = 42"],
  ["foreign_keys = ON", "PRAGMA foreign_keys = ON"],
  ["writable_schema=1", "PRAGMA writable_schema=1"],
  // Schema-qualified names.
  ["main.user_version", "PRAGMA main.user_version"],
  ["main.writable_schema(1)", "PRAGMA main.writable_schema(1)"],
  ["temp.journal_mode", "PRAGMA temp.journal_mode"],
  // An allow-listed pragma with an argument shape it never uses.
  ["integrity_check(42)", "PRAGMA integrity_check(42)"],
  ["table_xinfo with no argument", "PRAGMA table_xinfo"],
  ["table_xinfo with a bare word", "PRAGMA table_xinfo(Workspace)"],
  // Statement chaining and comment smuggling.
  ["two statements", "PRAGMA integrity_check; PRAGMA user_version(42)"],
  ["select then pragma", "SELECT 1; PRAGMA user_version(42)"],
  ["introspection then DROP", 'PRAGMA table_xinfo("T"); DROP TABLE "T"'],
  ["line comment suffix", "PRAGMA integrity_check -- ; PRAGMA user_version(42)"],
  ["block comment suffix", "PRAGMA integrity_check /* hidden */"],
  ["leading comment", "/* hide */ PRAGMA user_version(42)"],
  // Case must not help.
  ["lower-case pragma", "pragma USER_VERSION(42)"],
  // SELECT is NOT blanket-allowed: the bundled libSQL build registers
  // writefile/readfile/load_extension, so a SELECT can destroy the target file.
  ["writefile truncating the database", "SELECT writefile('/tmp/victim.db', '')"],
  ["writefile replacing the database", "SELECT writefile('/tmp/victim.db', readfile('/tmp/evil.db'))"],
  ["writefile creating a new file", "SELECT writefile('/tmp/outside.txt', 'x')"],
  ["readfile exfiltration", "SELECT hex(readfile('/etc/hostname'))"],
  ["load_extension", "SELECT load_extension('/tmp/evil.so')"],
  ["an unrelated SELECT", 'SELECT * FROM "User"'],
  ["a near-miss of the allow-listed query", "SELECT type, name, sql FROM sqlite_master"],
  // Plain writes.
  ["CREATE TABLE", 'CREATE TABLE "X" ("id" TEXT)'],
  ["DROP TABLE", 'DROP TABLE "X"'],
  ["INSERT", 'INSERT INTO "X" VALUES (1)'],
  ["UPDATE", 'UPDATE "X" SET "id" = 1'],
  ["DELETE", 'DELETE FROM "X"'],
  ["BEGIN", "BEGIN IMMEDIATE"],
  ["VACUUM", "VACUUM"],
  ["ATTACH", "ATTACH DATABASE 'other.db' AS other"],
  ["empty", "   "],
]

/** Exactly what the runtime issues against a target, and nothing more. */
const ALLOWED_STATEMENTS = [
  SQLITE_MASTER_QUERY,
  'PRAGMA table_xinfo("Workspace")',
  'PRAGMA foreign_key_list("Workspace")',
  'PRAGMA index_list("Workspace")',
  'PRAGMA index_xinfo("Workspace_slug_key")',
  "PRAGMA integrity_check",
  "PRAGMA foreign_key_check",
]

test("the read-only guard forwards nothing outside its allow-list", async (t) => {
  for (const [label, sql] of REFUSED_STATEMENTS) {
    await t.test(`refuses ${label}`, async () => {
      let forwarded = 0
      const reader = asReadOnly({
        async execute() {
          forwarded++
          throw new Error("the underlying client must never be reached")
        },
      })
      await assert.rejects(() => reader.execute(sql), /Read-only guard refused/, sql)
      assert.equal(forwarded, 0, `"${sql}" reached the client`)
    })
  }
})

test("the allow-listed introspection statements still work", async () => {
  const forwarded: string[] = []
  const reader = asReadOnly({
    async execute(sql: string) {
      forwarded.push(sql)
      return { rows: [] }
    },
  })
  for (const sql of ALLOWED_STATEMENTS) {
    await assert.doesNotReject(() => reader.execute(sql), sql)
  }
  assert.deepEqual(forwarded, ALLOWED_STATEMENTS)
})

test("the allow-list is exactly the six pragmas the runtime needs", () => {
  assert.deepEqual(Object.keys(READ_ONLY_PRAGMAS).sort(), [
    "foreign_key_check",
    "foreign_key_list",
    "index_list",
    "index_xinfo",
    "integrity_check",
    "table_xinfo",
  ])
  // Nothing mutating can be on it, in any argument shape.
  for (const name of ["user_version", "writable_schema", "journal_mode", "foreign_keys"]) {
    assert.equal((READ_ONLY_PRAGMAS as Record<string, unknown>)[name], undefined, name)
  }
})

test("a real database is provably unchanged after every refused statement", async (t) => {
  const client = tempDb(t, "pragma-attack")
  await client.executeMultiple(
    `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "label" TEXT);
     INSERT INTO "T" ("id","label") VALUES ('r1','keep me');`,
  )
  // Set a known, observable value directly on the client (not through the guard).
  await client.execute("PRAGMA user_version = 7")
  await client.execute("PRAGMA application_id = 99")

  const reader = asReadOnly(client)
  for (const [, sql] of REFUSED_STATEMENTS) {
    await assert.rejects(() => reader.execute(sql), /Read-only guard refused/, sql)
  }

  const userVersion = await client.execute("PRAGMA user_version")
  assert.equal(Number(userVersion.rows[0].user_version), 7, "user_version was mutated")
  const applicationId = await client.execute("PRAGMA application_id")
  assert.equal(Number(applicationId.rows[0].application_id), 99, "application_id was mutated")

  const rows = await client.execute(`SELECT "id","label" FROM "T"`)
  assert.equal(rows.rows.length, 1)
  assert.equal(String(rows.rows[0].label), "keep me")
  const tables = await client.execute(
    "SELECT count(*) AS n FROM sqlite_master WHERE name NOT LIKE 'sqlite_%'",
  )
  assert.equal(Number(tables.rows[0].n), 1)
})

test("a SELECT that can write is refused, and the database file survives", async (t) => {
  // The adversarial finding this closes: `SELECT writefile(<db>, '')` truncates
  // the target to zero bytes, contains no write keyword, no ';' and no comment,
  // and needs nothing beyond execute(). A blanket "SELECT is read-only" rule
  // forwards it. The literal allow-list does not.
  const dir = mkdtempSync(join(tmpdir(), "turso-writefile-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))
  const path = join(dir, "victim.db")
  const client = createClient({ url: `file:${path}` })
  t.after(() => client.close())

  await client.executeMultiple(
    `CREATE TABLE "Invoice" ("id" INTEGER PRIMARY KEY, "total" REAL);
     INSERT INTO "Invoice" VALUES (1, 1234.5);`,
  )
  const before = statSync(path).size
  assert.ok(before > 0)

  const reader = asReadOnly(client)
  for (const payload of [
    `SELECT writefile('${path}', '')`,
    `SELECT writefile('${join(dir, "outside.txt")}', 'escaped')`,
    "SELECT hex(readfile('/etc/hostname'))",
  ]) {
    await assert.rejects(() => reader.execute(payload), /Read-only guard refused/, payload)
  }

  // The database is byte-for-byte intact and its rows are still readable.
  assert.equal(statSync(path).size, before)
  const rows = await client.execute(`SELECT "total" FROM "Invoice"`)
  assert.equal(Number(rows.rows[0].total), 1234.5)
  assert.equal(existsSync(join(dir, "outside.txt")), false, "a file was written outside the database")
})

test("the SELECT allow-list is literal, not a shape", () => {
  assert.deepEqual([...READ_ONLY_STATEMENTS], [SQLITE_MASTER_QUERY])
  // Whitespace is normalized, so the runtime's own formatting still matches…
  assert.doesNotThrow(() => tursoAssert(`  ${SQLITE_MASTER_QUERY.replace(/ /g, "  ")}  `))
  // …but a near-miss does not.
  assert.throws(() => tursoAssert(SQLITE_MASTER_QUERY.replace("ORDER BY type, name", "")), /Read-only guard/)
})

test("verify reports a stray view or trigger instead of calling it identical", async (t) => {
  const canonical = `CREATE TABLE "User" ("id" TEXT NOT NULL PRIMARY KEY, "email" TEXT);`

  const clean = await reportFor(t, canonical, canonical, "objects-clean")
  assert.equal(clean.verdict, "identical")

  const hostile = `${canonical}
CREATE VIEW "v_gate" AS SELECT * FROM "User";
CREATE TRIGGER "evil_exfil" INSTEAD OF INSERT ON "v_gate" BEGIN UPDATE "User" SET "email" = 'pwned@evil'; END;`

  const report = await reportFor(t, canonical, hostile, "objects-hostile")
  assert.equal(report.verdict, "drift detected")
  const objects = report.drift.filter((f) => f.category === "extra-object")
  assert.deepEqual(objects.map((f) => f.object).sort(), ["trigger evil_exfil", "view v_gate"])
  assert.match(objects.find((f) => f.object.startsWith("trigger"))!.detail, /runs against/)
})

test("sanitizeForLog redacts by construction as well as by pattern", () => {
  // 1. A bare hostname repeated by the network layer — no URL pattern matches it,
  //    so the CLIs pass the known host in as a secret.
  const host = "lab-sevenef-mr-forte.aws-eu-west-1.turso.io"
  const dnsError = `request to libsql://${host} failed, reason: getaddrinfo ENOTFOUND ${host}`
  const withSecret = sanitizeForLog(dnsError, [host, `libsql://${host}`])
  assert.ok(!withSecret.includes(host), withSecret)
  // …and even without the secret list, a bare *.turso.io host is caught.
  assert.ok(!sanitizeForLog(dnsError).includes(host), sanitizeForLog(dnsError))

  // 2. Connection strings for other engines, which a Prisma error can quote back.
  for (const url of [
    "postgres://admin:S3cr3tP4ss@db.internal:5432/app",
    "mongodb+srv://admin:S3cr3tP4ss@cluster0.mongodb.net/app",
    "sqlserver://sa:S3cr3tP4ss@10.0.0.4:1433;database=app",
    "prisma+postgres://accelerate.prisma-data.net/?api_key=ey_secret_value",
  ]) {
    const clean = sanitizeForLog(`error: ${url}`)
    assert.ok(!clean.includes("S3cr3tP4ss"), clean)
    assert.ok(!clean.includes("ey_secret_value"), clean)
  }

  // 3. Env-var names whose underscore prefix defeated the old word boundary.
  for (const line of [
    "TURSO_AUTH_TOKEN=ts_5f3a2b1c9d8e7f6a",
    "DATABASE_AUTH_TOKEN: ts_5f3a2b1c9d8e7f6a",
    "MY_API_KEY=ts_5f3a2b1c9d8e7f6a",
  ]) {
    assert.ok(!sanitizeForLog(line).includes("ts_5f3a2b1c9d8e7f6a"), sanitizeForLog(line))
  }

  // 4. A short or empty "secret" must not blank out the whole message.
  assert.equal(sanitizeForLog("all fine", ["", undefined, "ab"]), "all fine")
})

/**
 * Every shape the CLIs can surface. `leaks` are substrings that must be gone;
 * `keeps` are what an operator still needs in order to act on the message.
 */
const SANITIZER_MATRIX: Array<{
  label: string
  input: string
  secrets?: string[]
  leaks: string[]
  keeps?: string[]
}> = [
  {
    label: "a scheme-less connection string with a path and a query",
    input: "TURSO_DATABASE_URL=secret-host.internal/path?token=x",
    leaks: ["secret-host.internal", "/path", "token=x"],
    keeps: ["TURSO_DATABASE_URL"],
  },
  {
    label: "a scheme-less host",
    input: "DATABASE_URL=secret-host.internal",
    leaks: ["secret-host.internal"],
    keeps: ["DATABASE_URL"],
  },
  {
    label: "a credentialed postgres URL behind a key",
    input: "DATABASE_URL=postgres://user:pass@host/db",
    leaks: ["user:pass", "postgres://", "@host"],
    keeps: ["DATABASE_URL"],
  },
  {
    label: "LIBSQL_URL with a port and path",
    input: "LIBSQL_URL=private.internal:8080/db",
    leaks: ["private.internal", "8080"],
    keeps: ["LIBSQL_URL"],
  },
  { label: "TURSO_AUTH_TOKEN", input: "TURSO_AUTH_TOKEN=abc", leaks: ["abc"], keeps: ["TURSO_AUTH_TOKEN"] },
  {
    label: "DATABASE_AUTH_TOKEN",
    input: "DATABASE_AUTH_TOKEN=abc",
    leaks: ["abc"],
    keeps: ["DATABASE_AUTH_TOKEN"],
  },
  {
    label: "mongodb+srv with userinfo",
    input: "connecting to mongodb+srv://admin:S3cr3t@cluster0.mongodb.net/app",
    leaks: ["S3cr3t", "cluster0.mongodb.net"],
    keeps: ["connecting to"],
  },
  {
    label: "postgresql with userinfo",
    input: "connecting to postgresql://user:pw@db.internal/app",
    leaks: ["db.internal", "user:pw"],
    keeps: ["connecting to"],
  },
  {
    label: "a Bearer header",
    input: "Authorization: Bearer sk-live-abc123",
    leaks: ["sk-live-abc123"],
    keeps: ["Bearer"],
  },
  {
    label: "a JWT",
    input: "token eyJhbGciOiJFZERTQSJ9.eyJhIjoicncifQ.signature-part",
    leaks: ["eyJhbGciOiJFZERTQSJ9"],
  },
  {
    label: "a known host repeated by DNS resolution",
    input: "request to libsql://lab-x.aws-eu-west-1.turso.io failed, reason: getaddrinfo ENOTFOUND lab-x.aws-eu-west-1.turso.io",
    secrets: ["lab-x.aws-eu-west-1.turso.io", "libsql://lab-x.aws-eu-west-1.turso.io"],
    leaks: ["lab-x.aws-eu-west-1.turso.io"],
    keeps: ["getaddrinfo ENOTFOUND"],
  },
  {
    label: "a private host that only the secret list can know",
    input: "connect ECONNREFUSED private.internal:443",
    secrets: ["private.internal"],
    leaks: ["private.internal"],
    keeps: ["ECONNREFUSED"],
  },
]

test("the sanitizer matrix leaves nothing sensitive and stays useful", async (t) => {
  for (const c of SANITIZER_MATRIX) {
    await t.test(c.label, () => {
      const out = sanitizeForLog(c.input, c.secrets ?? [])
      for (const leak of c.leaks) {
        assert.ok(!out.includes(leak), `"${leak}" survived sanitization: ${out}`)
      }
      for (const keep of c.keeps ?? []) {
        assert.ok(out.includes(keep), `"${keep}" was lost, the message is no longer actionable: ${out}`)
      }
    })
  }
})

test("describeError keeps the cause chain, and the sanitizer cleans all of it", () => {
  const host = "lab-x.aws-eu-west-1.turso.io"
  const nested = new Error(`request to libsql://${host} failed`, {
    cause: Object.assign(new Error(`getaddrinfo ENOTFOUND ${host}`), { name: "SystemError" }),
  })

  const described = describeError(nested)
  assert.match(described, /^request to libsql:\/\//, "the top-level message must stay verbatim")
  assert.match(described, /caused by: SystemError: getaddrinfo ENOTFOUND/)

  const clean = sanitizeForLog(described, [host, `libsql://${host}`])
  assert.ok(!clean.includes(host), clean)
  // The class of failure survives — that is the point of walking the chain.
  assert.match(clean, /caused by: SystemError: getaddrinfo ENOTFOUND/)

  // A contract message must not gain a prefix from its own error class.
  const named = Object.assign(new Error("Database is not empty."), { name: "DatabaseNotEmptyError" })
  assert.equal(describeError(named), "Database is not empty.")

  // A cycle cannot spin forever.
  const a = new Error("a")
  const b = new Error("b", { cause: a })
  ;(a as { cause?: unknown }).cause = b
  assert.ok(describeError(a).split("caused by").length <= 4)
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
