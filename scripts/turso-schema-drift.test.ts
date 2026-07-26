/**
 * Turso schema drift detector.
 *
 * Fails when the Turso deploy mechanism (`prisma/turso-schema.ts`) stops
 * matching the source of truth (`prisma/schema.prisma`), or when it would
 * quietly apply — or quietly skip — a change it cannot perform safely.
 *
 * The comparison is STRUCTURAL, not name-based: tables, columns (type,
 * nullability, default, primary-key position), foreign keys (with their
 * actions) and indexes (uniqueness, key columns and order) all take part. The
 * expected side is produced by applying the canonical DDL to a clean temporary
 * SQLite database and introspecting it; the actual side is introspected from a
 * database that went through the real deploy path.
 *
 * Runs entirely against throwaway LOCAL SQLite files — it never connects to
 * any remote database, so it is safe in CI without credentials or the proxy.
 *
 * Run: npm run test:turso-drift
 */

import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test, { type TestContext } from "node:test"

import { createClient, type Client } from "@libsql/client"
import {
  ManualMigrationRequiredError,
  PROJECT_ROOT,
  assertModelNamesMatchTables,
  canonicalStructureFromDdl,
  diffStructures,
  generateCanonicalDdl,
  introspectStructure,
  parseSchemaModels,
  provisionSchema,
  splitSqlStatements,
  type DatabaseStructure,
  type IssueKind,
  type StructuralIssue,
} from "../prisma/turso-schema"

// ---------------------------------------------------------------------------
// Fixtures & helpers
// ---------------------------------------------------------------------------

let cachedDdl: string | undefined
/** The canonical DDL for the real schema. Generated once — Prisma is slow. */
function realDdl(): string {
  cachedDdl ??= generateCanonicalDdl()
  return cachedDdl
}

function schemaSource(): string {
  return readFileSync(join(PROJECT_ROOT, "prisma", "schema.prisma"), "utf8")
}

/** A throwaway file-backed SQLite database, cleaned up when the test ends. */
function tempClient(t: TestContext, label = "db"): Client {
  const dir = mkdtempSync(join(tmpdir(), "turso-drift-"))
  const client = createClient({ url: `file:${join(dir, `${label}.db`)}` })
  t.after(() => {
    client.close()
    rmSync(dir, { recursive: true, force: true })
  })
  return client
}

/** Apply raw SQL to a fresh database and return it. */
async function seeded(t: TestContext, sql: string, label = "seeded"): Promise<Client> {
  const client = tempClient(t, label)
  if (sql.trim()) await client.executeMultiple(`PRAGMA foreign_keys=OFF;\n${sql}`)
  return client
}

function issuesOfKind(issues: StructuralIssue[], kind: IssueKind): StructuralIssue[] {
  return issues.filter((i) => i.kind === kind)
}

/**
 * Assert that a live database is structurally equivalent to the canonical one.
 *
 * Uses the real comparison rather than `deepEqual`, because two structurally
 * identical databases legitimately differ in two ways that carry no meaning:
 * a column added by `ALTER TABLE` lands at the END of the physical column
 * order, and SQLite rewrites `sqlite_master.sql` when it does so. The
 * comparison covers both directions — anything missing, extra or mismatched
 * shows up.
 */
function assertStructurallyEqual(actual: DatabaseStructure, canonical: DatabaseStructure): void {
  const plan = diffStructures(canonical, actual)
  assert.deepEqual(plan.blocking, [], "blocking differences remain")
  assert.deepEqual(plan.extra, [], "unexpected objects remain")
  assert.deepEqual(
    plan.createTables.map((t) => t.name),
    [],
    "tables still missing",
  )
  assert.deepEqual(
    plan.addColumns.map((c) => `${c.table}.${c.column.name}`),
    [],
    "columns still missing",
  )
  assert.deepEqual(
    plan.createIndexes.map((i) => i.index.name),
    [],
    "indexes still missing",
  )
}

/**
 * Compare two hand-written schemas structurally and return the differences the
 * provisioner would refuse to apply.
 */
async function blockingBetween(expectedDdl: string, actualDdl: string): Promise<StructuralIssue[]> {
  const expected = await canonicalStructureFromDdl(expectedDdl)
  const actual = await canonicalStructureFromDdl(actualDdl)
  const plan = diffStructures(expected, actual)
  return [...plan.blocking, ...plan.extra]
}

const BASE_TABLE = `CREATE TABLE "Parent" (
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

/** `BASE_TABLE` with one targeted mutation applied to its text. */
function mutated(from: string, to: string): string {
  assert.ok(BASE_TABLE.includes(from), `fixture does not contain ${from}`)
  return BASE_TABLE.replace(from, to)
}

// ---------------------------------------------------------------------------
// 1. The real schema, end to end
// ---------------------------------------------------------------------------

test("the deploy provisions a structure identical to prisma/schema.prisma", async (t) => {
  const source = schemaSource()
  const models = parseSchemaModels(source)
  const ddl = realDdl()

  // 12. Explicit non-support guard: a `@@map` would break the independent
  // model↔table cross-check below, so it must be caught here rather than
  // silently mis-compared.
  await t.test("schema.prisma does not use @@map (explicit non-support guard)", () => {
    assert.doesNotThrow(() => assertModelNamesMatchTables(source))
    // …and the guard really fires when a mapping is present.
    assert.throws(
      () => assertModelNamesMatchTables('model Foo {\n  id String @id\n  @@map("foo_table")\n}'),
      /@@map/,
    )
  })

  const canonical = await canonicalStructureFromDdl(ddl)
  const client = tempClient(t, "fresh")
  const report = await provisionSchema(client, ddl)
  const actual = await introspectStructure(client)

  // 10 + independent cross-check: the model list comes from the schema TEXT,
  // not from the DDL, so this catches a model that never reaches the database.
  await t.test("every model in schema.prisma exists as a table", () => {
    const provisioned = new Set(actual.tables.map((tb) => tb.name))
    const missing = models.filter((m) => !provisioned.has(m))
    assert.deepEqual(missing, [], `models not provisioned: ${missing.join(", ")}`)
    assert.equal(actual.tables.length, models.length)
  })

  await t.test("the provisioned structure matches the canonical structure exactly", () => {
    const plan = diffStructures(canonical, actual)
    assert.deepEqual(plan.blocking, [])
    assert.deepEqual(plan.extra, [])
    assert.deepEqual(plan.createTables, [])
    assert.deepEqual(plan.addColumns, [])
    assert.deepEqual(plan.createIndexes, [])
    assert.deepEqual(actual, canonical)
  })

  await t.test("integrity checks pass and everything was created by us", () => {
    assert.equal(report.integrity.foreignKeyViolations, 0)
    assert.equal(report.integrity.integrityCheck, "ok")
    assert.equal(report.before.tables.length, 0)
    assert.equal(report.applied.tables.length, models.length)
  })

  // 17.
  await t.test("a second run is completely idempotent", async () => {
    const second = await provisionSchema(client, ddl)
    assert.deepEqual(second.applied, { tables: [], columns: [], indexes: [] })
    assert.deepEqual(await introspectStructure(client), actual)
  })
})

// ---------------------------------------------------------------------------
// 2. Structural mismatches the detector must catch (1–8)
// ---------------------------------------------------------------------------

test("structural drift is detected, not just missing names", async (t) => {
  // 1.
  await t.test("1. a different column type is blocking", async () => {
    const issues = await blockingBetween(
      BASE_TABLE,
      mutated('"label" TEXT NOT NULL', '"label" BLOB NOT NULL'),
    )
    const found = issuesOfKind(issues, "column-mismatch")
    assert.equal(found.length, 1, JSON.stringify(issues))
    assert.equal(found[0].object, "Item.label")
    assert.match(found[0].detail, /type BLOB → TEXT/)
  })

  // 2.
  await t.test("2. nullable vs NOT NULL is blocking", async () => {
    const issues = await blockingBetween(BASE_TABLE, mutated('"label" TEXT NOT NULL', '"label" TEXT'))
    const found = issuesOfKind(issues, "column-mismatch")
    assert.equal(found.length, 1, JSON.stringify(issues))
    assert.match(found[0].detail, /NULL → NOT NULL/)
  })

  // 3.
  await t.test("3. a different default is blocking", async () => {
    const issues = await blockingBetween(
      BASE_TABLE,
      mutated('"score" INTEGER NOT NULL DEFAULT 0', '"score" INTEGER NOT NULL DEFAULT 7'),
    )
    const found = issuesOfKind(issues, "column-mismatch")
    assert.equal(found.length, 1, JSON.stringify(issues))
    assert.match(found[0].detail, /default 7 → 0/)
  })

  // 4.
  await t.test("4. a different primary key is blocking", async () => {
    const issues = await blockingBetween(
      BASE_TABLE,
      mutated(
        '"id" TEXT NOT NULL PRIMARY KEY,\n    "label" TEXT NOT NULL',
        '"id" TEXT NOT NULL,\n    "label" TEXT NOT NULL PRIMARY KEY',
      ),
    )
    assert.ok(issuesOfKind(issues, "primary-key-mismatch").length >= 1, JSON.stringify(issues))
  })

  // 5.
  await t.test("5. a missing foreign key is blocking", async () => {
    const issues = await blockingBetween(
      BASE_TABLE,
      mutated(
        ',\n    CONSTRAINT "Item_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent" ("id") ON DELETE CASCADE ON UPDATE CASCADE',
        "",
      ),
    )
    const found = issuesOfKind(issues, "foreign-key-missing")
    assert.equal(found.length, 1, JSON.stringify(issues))
    assert.match(found[0].object, /parentId->Parent/)
  })

  // 6.
  await t.test("6. a different ON DELETE action is blocking", async () => {
    const issues = await blockingBetween(
      BASE_TABLE,
      mutated("ON DELETE CASCADE", "ON DELETE SET NULL"),
    )
    const found = issuesOfKind(issues, "foreign-key-mismatch")
    assert.equal(found.length, 1, JSON.stringify(issues))
    assert.match(found[0].detail, /ON DELETE SET NULL → CASCADE/)
  })

  // 7.
  await t.test("7. a unique index degraded to a plain index is blocking", async () => {
    const issues = await blockingBetween(
      BASE_TABLE,
      mutated('CREATE UNIQUE INDEX "Item_score_key"', 'CREATE INDEX "Item_score_key"'),
    )
    const found = issuesOfKind(issues, "index-mismatch")
    assert.equal(found.length, 1, JSON.stringify(issues))
    assert.match(found[0].detail, /non-unique → UNIQUE/)
  })

  // 8.
  await t.test("8. an index over different columns is blocking", async () => {
    const issues = await blockingBetween(BASE_TABLE, mutated('ON "Item"("label")', 'ON "Item"("note")'))
    const found = issuesOfKind(issues, "index-mismatch")
    assert.equal(found.length, 1, JSON.stringify(issues))
    assert.match(found[0].detail, /columns \(note\) → \(label\)/)
  })

  await t.test("an identical schema produces no differences at all", async () => {
    assert.deepEqual(await blockingBetween(BASE_TABLE, BASE_TABLE), [])
  })
})

// ---------------------------------------------------------------------------
// 3. Additive work vs work that needs a human (9, 10, 14, 15)
// ---------------------------------------------------------------------------

test("supported additive differences are applied; the rest fail safely", async (t) => {
  const canonical = await canonicalStructureFromDdl(BASE_TABLE)

  // 9 + 10.
  await t.test("9+10. a missing nullable column and a missing table are additive", async () => {
    const client = await seeded(
      t,
      `CREATE TABLE "Item" (
         "id" TEXT NOT NULL PRIMARY KEY,
         "label" TEXT NOT NULL,
         "score" INTEGER NOT NULL DEFAULT 0,
         "parentId" TEXT,
         CONSTRAINT "Item_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent" ("id") ON DELETE CASCADE ON UPDATE CASCADE
       );`,
      "additive",
    )
    const plan = diffStructures(canonical, await introspectStructure(client))
    assert.deepEqual(plan.blocking, [])
    assert.deepEqual(
      plan.createTables.map((tb) => tb.name),
      ["Parent"],
    )
    assert.deepEqual(
      plan.addColumns.map((c) => `${c.table}.${c.column.name}`),
      ["Item.note"],
    )
    assert.deepEqual(plan.createIndexes.map((i) => i.index.name).sort(), [
      "Item_label_idx",
      "Item_score_key",
    ])

    const report = await provisionSchema(client, BASE_TABLE)
    assert.deepEqual(report.applied.tables, ["Parent"])
    assert.deepEqual(report.applied.columns, ["Item.note"])
    assertStructurallyEqual(await introspectStructure(client), canonical)
  })

  // 14a.
  await t.test("14a. NOT NULL without a default over existing rows requires a migration", async () => {
    const client = await seeded(
      t,
      `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY);
       INSERT INTO "T" ("id") VALUES ('row-1');`,
      "notnull",
    )
    const ddl = `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "required" TEXT NOT NULL);`
    await assert.rejects(
      () => provisionSchema(client, ddl),
      (err: unknown) => {
        assert.ok(err instanceof ManualMigrationRequiredError)
        assert.match(err.message, /manual migration required/)
        assert.match(err.message, /T\.required/)
        assert.match(err.message, /1 row\(s\) already exist/)
        return true
      },
    )
    // Nothing was written: the failure happened before any statement ran.
    const after = await client.execute(`PRAGMA table_info("T")`)
    assert.deepEqual(
      after.rows.map((r) => String(r.name)),
      ["id"],
    )
  })

  await t.test("14b. the same column IS addable while the table is empty", async () => {
    const client = await seeded(t, `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY);`, "empty")
    const ddl = `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "required" TEXT NOT NULL);`
    const report = await provisionSchema(client, ddl)
    assert.deepEqual(report.applied.columns, ["T.required"])
  })

  // 14c — the case the old code degraded to a warning and then reported success.
  await t.test("14c. a non-constant default (CURRENT_TIMESTAMP) requires a migration", async () => {
    const client = await seeded(t, `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY);`, "clock")
    const ddl = `CREATE TABLE "T" (
        "id" TEXT NOT NULL PRIMARY KEY,
        "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      );`
    await assert.rejects(
      () => provisionSchema(client, ddl),
      (err: unknown) => {
        assert.ok(err instanceof ManualMigrationRequiredError)
        assert.match(err.message, /manual migration required/)
        assert.match(err.message, /T\.createdAt/)
        assert.match(err.message, /non-constant default/)
        return true
      },
    )
  })

  // 14d.
  await t.test("14d. a new foreign key on an existing table requires a migration", async () => {
    const client = await seeded(
      t,
      `CREATE TABLE "Parent" ("id" TEXT NOT NULL PRIMARY KEY);
       CREATE TABLE "Item" (
         "id" TEXT NOT NULL PRIMARY KEY,
         "label" TEXT NOT NULL,
         "score" INTEGER NOT NULL DEFAULT 0,
         "note" TEXT,
         "parentId" TEXT
       );`,
      "nofk",
    )
    await assert.rejects(
      () => provisionSchema(client, BASE_TABLE),
      (err: unknown) => {
        assert.ok(err instanceof ManualMigrationRequiredError)
        assert.match(err.message, /manual migration required/)
        assert.ok(err.issues.some((i) => i.kind === "foreign-key-missing"))
        return true
      },
    )
  })

  // 15.
  await t.test("15. a unique index blocked by duplicate data requires a migration", async () => {
    const client = await seeded(
      t,
      `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "email" TEXT);
       INSERT INTO "T" ("id","email") VALUES ('a','same@example.com'),('b','same@example.com');`,
      "dupes",
    )
    const ddl = `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "email" TEXT);
CREATE UNIQUE INDEX "T_email_key" ON "T"("email");`
    await assert.rejects(
      () => provisionSchema(client, ddl),
      (err: unknown) => {
        assert.ok(err instanceof ManualMigrationRequiredError)
        assert.match(err.message, /manual migration required/)
        assert.match(err.message, /duplicate value group/)
        return true
      },
    )
    // The index was never created, and the rows are untouched.
    const idx = await client.execute(
      "SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND name='T_email_key'",
    )
    assert.equal(Number(idx.rows[0].n), 0)
    const rows = await client.execute(`SELECT count(*) AS n FROM "T"`)
    assert.equal(Number(rows.rows[0].n), 2)
  })

  // 15b — the uniqueness pre-flight must not trip over a column it is about to
  // create: every existing row will read NULL there, so duplicates are
  // impossible and the check has to be skipped, not crash.
  await t.test("15b. a unique index over a column being added in the same run", async () => {
    const client = await seeded(
      t,
      `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY);
       INSERT INTO "T" ("id") VALUES ('a'),('b');`,
      "newcol-unique",
    )
    const ddl = `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY, "slug" TEXT);
CREATE UNIQUE INDEX "T_slug_key" ON "T"("slug");`
    const report = await provisionSchema(client, ddl)
    assert.deepEqual(report.applied.columns, ["T.slug"])
    assert.deepEqual(report.applied.indexes, ["T_slug_key"])
    assertStructurallyEqual(await introspectStructure(client), await canonicalStructureFromDdl(ddl))
  })

  await t.test("a removed table or column is reported, never silently ignored", async () => {
    const client = await seeded(
      t,
      `${BASE_TABLE}
       CREATE TABLE "Legacy" ("id" TEXT NOT NULL PRIMARY KEY);
       ALTER TABLE "Item" ADD COLUMN "legacyFlag" TEXT;`,
      "legacy",
    )
    await assert.rejects(
      () => provisionSchema(client, BASE_TABLE),
      (err: unknown) => {
        assert.ok(err instanceof ManualMigrationRequiredError)
        assert.ok(err.issues.some((i) => i.kind === "extra-table" && i.object === "Legacy"))
        assert.ok(
          err.issues.some((i) => i.kind === "extra-column" && i.object === "Item.legacyFlag"),
        )
        return true
      },
    )
  })
})

// ---------------------------------------------------------------------------
// 4. Column mapping (11)
// ---------------------------------------------------------------------------

test("11. a field-level @map is supported end to end", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "turso-map-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  const schemaPath = join(dir, "mapped.prisma")
  writeFileSync(
    schemaPath,
    `datasource db {
  provider = "sqlite"
}

model Mapped {
  id        String  @id
  legalName String  @map("legal_name")
  taxId     String? @map("tax_id")

  @@index([legalName])
}
`,
  )

  const ddl = generateCanonicalDdl({ schemaPath })
  const canonical = await canonicalStructureFromDdl(ddl)
  const columns = canonical.tables[0].columns.map((c) => c.name)

  assert.deepEqual(columns, ["id", "legal_name", "tax_id"], "physical column names come from @map")

  const client = tempClient(t, "mapped")
  await provisionSchema(client, ddl)
  assertStructurallyEqual(await introspectStructure(client), canonical)

  // And a drifted database that still uses the Prisma field name is caught.
  const drifted = await seeded(
    t,
    `CREATE TABLE "Mapped" ("id" TEXT NOT NULL PRIMARY KEY, "legalName" TEXT NOT NULL, "tax_id" TEXT);`,
    "drifted-map",
  )
  const plan = diffStructures(canonical, await introspectStructure(drifted))
  assert.ok(plan.extra.some((i) => i.object === "Mapped.legalName"))
  assert.ok(plan.addColumns.some((c) => c.column.name === "legal_name"))
})

// ---------------------------------------------------------------------------
// 5. Existing databases, partial runs and idempotence (13, 16, 17)
// ---------------------------------------------------------------------------

test("13. an older database keeps its data while it converges", async (t) => {
  const canonicalDdl = `CREATE TABLE "Note" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "body" TEXT NOT NULL,
    "tag" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false
);
CREATE INDEX "Note_tag_idx" ON "Note"("tag");`

  const client = await seeded(
    t,
    `CREATE TABLE "Note" ("id" TEXT NOT NULL PRIMARY KEY, "body" TEXT NOT NULL);
     INSERT INTO "Note" ("id","body") VALUES ('n1','keep me'),('n2','and me');`,
    "older",
  )

  const report = await provisionSchema(client, canonicalDdl)
  assert.deepEqual(report.applied.columns.sort(), ["Note.archived", "Note.tag"])
  assert.deepEqual(report.applied.indexes, ["Note_tag_idx"])

  const rows = await client.execute(`SELECT "id","body","tag","archived" FROM "Note" ORDER BY "id"`)
  assert.equal(rows.rows.length, 2)
  assert.equal(String(rows.rows[0].body), "keep me")
  assert.equal(String(rows.rows[1].body), "and me")
  assert.equal(rows.rows[0].tag, null)
  // The constant default was back-filled for the existing rows.
  assert.equal(Number(rows.rows[0].archived), 0)

  assertStructurallyEqual(await introspectStructure(client), await canonicalStructureFromDdl(canonicalDdl))
})

test("16. a partial run is completed by re-running, and then stays idempotent", async (t) => {
  const ddl = realDdl()
  const canonical = await canonicalStructureFromDdl(ddl)

  // Simulate a run that died halfway: the first five tables exist (with their
  // indexes), the rest never happened.
  const partial = canonical.tables.slice(0, 5)
  const client = await seeded(
    t,
    [
      ...partial.map((tb) => `${tb.createSql};`),
      ...partial.flatMap((tb) =>
        tb.indexes.filter((i) => i.origin === "c" && i.sql).map((i) => `${i.sql};`),
      ),
    ].join("\n"),
    "partial",
  )

  const before = await introspectStructure(client)
  assert.equal(before.tables.length, 5)

  const first = await provisionSchema(client, ddl)
  assert.equal(first.applied.tables.length, canonical.tables.length - 5)
  assertStructurallyEqual(await introspectStructure(client), canonical)

  // 17.
  const second = await provisionSchema(client, ddl)
  assert.deepEqual(second.applied, { tables: [], columns: [], indexes: [] })
  assertStructurallyEqual(await introspectStructure(client), canonical)
})

// ---------------------------------------------------------------------------
// 6. The generator itself
// ---------------------------------------------------------------------------

test("generateCanonicalDdl does not depend on the working directory", async (t) => {
  const original = process.cwd()
  const elsewhere = mkdtempSync(join(tmpdir(), "turso-cwd-"))
  t.after(() => {
    process.chdir(original)
    rmSync(elsewhere, { recursive: true, force: true })
  })

  process.chdir(elsewhere)
  const fromElsewhere = generateCanonicalDdl()
  process.chdir(original)

  assert.equal(fromElsewhere, realDdl(), "the DDL must not change with the caller's cwd")
})

test("generateCanonicalDdl reports child-process failures safely", () => {
  assert.throws(
    () => generateCanonicalDdl({ schemaPath: "prisma/definitely-missing.prisma" }),
    (err: unknown) => {
      assert.ok(err instanceof Error)
      assert.match(err.message, /prisma\/definitely-missing\.prisma/)
      return true
    },
  )

  const dir = mkdtempSync(join(tmpdir(), "turso-bad-"))
  try {
    const bad = join(dir, "bad.prisma")
    writeFileSync(
      bad,
      'datasource db {\n  provider = "sqlite"\n}\n\nmodel Broken { id }\n',
    )
    assert.throws(
      () => generateCanonicalDdl({ schemaPath: bad }),
      (err: unknown) => {
        assert.ok(err instanceof Error)
        assert.match(err.message, /exit status:/)
        assert.match(err.message, /stderr:/)
        // The Prisma diagnostic must survive, not be swallowed.
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
    "tpl" TEXT DEFAULT 'CREATE TABLE "fake" (x);',
    "note" TEXT DEFAULT 'line one
-- not a comment'
);
-- a real comment; with a semicolon
CREATE INDEX "T_greeting_idx" ON "T"("greeting");`

  const statements = splitSqlStatements(tricky)
  assert.equal(statements.length, 2)
  assert.match(statements[0], /^CREATE TABLE "T"/)
  assert.ok(statements[0].includes("hola; adios"), "a ';' inside a literal must not split")
  assert.ok(statements[0].includes("-- not a comment"), "a '--' inside a literal must survive")
  assert.match(statements[1], /^CREATE INDEX "T_greeting_idx"/)
})

test("an unsupported DDL statement class is a hard error, never a silent table", async () => {
  await assert.rejects(
    () =>
      canonicalStructureFromDdl(
        `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY);
CREATE TRIGGER "t_after" AFTER INSERT ON "T" BEGIN SELECT 1; END;`,
      ),
    /manual migration required/,
  )
})

test("the real canonical DDL contains only statement classes we support", () => {
  for (const statement of splitSqlStatements(realDdl())) {
    const head = statement.replace(/\s+/g, " ").slice(0, 40)
    assert.match(head, /^CREATE (TABLE|UNIQUE INDEX|INDEX)\b/i, `unsupported statement: ${head}`)
  }
})

// ---------------------------------------------------------------------------
// 7. The comparison is order-insensitive but difference-sensitive
// ---------------------------------------------------------------------------

test("declaration order does not create false positives", async (t) => {
  const a = `CREATE TABLE "A" ("id" TEXT NOT NULL PRIMARY KEY);
CREATE TABLE "B" ("id" TEXT NOT NULL PRIMARY KEY, "aId" TEXT,
  CONSTRAINT "B_aId_fkey" FOREIGN KEY ("aId") REFERENCES "A" ("id") ON DELETE SET NULL ON UPDATE CASCADE);
CREATE INDEX "B_aId_idx" ON "B"("aId");`

  const b = `CREATE TABLE "B" ("id" TEXT NOT NULL PRIMARY KEY, "aId" TEXT,
  CONSTRAINT "B_aId_fkey" FOREIGN KEY ("aId") REFERENCES "A" ("id") ON DELETE SET NULL ON UPDATE CASCADE);
CREATE INDEX "B_aId_idx" ON "B"("aId");
CREATE TABLE "A" ("id" TEXT NOT NULL PRIMARY KEY);`

  const expected: DatabaseStructure = await canonicalStructureFromDdl(a)
  const actual: DatabaseStructure = await canonicalStructureFromDdl(b)
  assert.deepEqual(diffStructures(expected, actual).blocking, [])
  assert.deepEqual(expected, actual)
  t.diagnostic(`${expected.tables.length} tables compared order-insensitively`)
})
