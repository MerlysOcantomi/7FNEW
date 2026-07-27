/**
 * `turso:bootstrap` — empty-only schema creation.
 *
 * Proves the contract: it creates the whole schema on an empty database, it
 * refuses every non-empty database without touching it, it never issues a
 * column-adding or repairing statement, and a failure anywhere rolls the whole
 * thing back to an empty database.
 *
 * Runs entirely against throwaway LOCAL SQLite files — it never connects to
 * any remote database, so it is safe in CI without credentials or the proxy.
 *
 * Run: npm run test:turso-bootstrap
 */

import assert from "node:assert/strict"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test, { type TestContext } from "node:test"

import { createClient, type Client } from "@libsql/client"
import {
  BootstrapVerificationError,
  DatabaseNotEmptyError,
  NOT_EMPTY_MESSAGE,
  bootstrapSchema,
  type BootstrapClient,
  type BootstrapTransaction,
} from "../prisma/bootstrap-turso"
import * as tursoSchema from "../prisma/turso-schema"
import {
  PROJECT_ROOT,
  asReadOnly,
  applicationTableNames,
  canonicalStructureFromDdl,
  compareStructures,
  generateCanonicalDdl,
  introspectStructure,
  parseSchemaModels,
} from "../prisma/turso-schema"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let cachedDdl: string | undefined
/** The canonical DDL for the real schema. Generated once — Prisma is slow. */
function realDdl(): string {
  cachedDdl ??= generateCanonicalDdl()
  return cachedDdl
}

/** A throwaway file-backed SQLite database, cleaned up when the test ends. */
function tempDb(t: TestContext, label = "db"): { client: Client; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "turso-bootstrap-"))
  const path = join(dir, `${label}.db`)
  const client = createClient({ url: `file:${path}` })
  t.after(() => {
    client.close()
    rmSync(dir, { recursive: true, force: true })
  })
  return { client, path }
}

interface SpiedCall {
  via: "execute" | "executeMultiple"
  sql: string
}

/** Records every statement issued, so we can prove what was NOT run. */
function spyOn(client: Client): { client: BootstrapClient; calls: SpiedCall[] } {
  const calls: SpiedCall[] = []
  return {
    calls,
    client: {
      async transaction(mode: "write") {
        const tx = await client.transaction(mode)
        const wrapped: BootstrapTransaction = {
          async execute(sql: string) {
            calls.push({ via: "execute", sql })
            return tx.execute(sql)
          },
          async executeMultiple(sql: string) {
            calls.push({ via: "executeMultiple", sql })
            return tx.executeMultiple(sql)
          },
          commit: () => tx.commit(),
          rollback: () => tx.rollback(),
          close: () => tx.close(),
        }
        return wrapped
      },
    },
  }
}

// ---------------------------------------------------------------------------
// 1. Empty database — the only supported case
// ---------------------------------------------------------------------------

test("an empty database gets the complete schema", async (t) => {
  const ddl = realDdl()
  const canonical = await canonicalStructureFromDdl(ddl)
  const models = parseSchemaModels(readFileSync(join(PROJECT_ROOT, "prisma/schema.prisma"), "utf8"))

  const { client } = tempDb(t, "empty")
  const result = await bootstrapSchema(client, ddl)

  await t.test("every model reaches the database as a table", async () => {
    const tables = await applicationTableNames(asReadOnly(client))
    const missing = models.filter((m) => !tables.includes(m))
    assert.deepEqual(missing, [], `models not created: ${missing.join(", ")}`)
    assert.equal(tables.length, models.length)
    assert.equal(result.tables, models.length)
  })

  await t.test("tables, indexes and foreign keys match the canonical structure", async () => {
    const actual = await introspectStructure(asReadOnly(client))
    const report = compareStructures(canonical, actual)
    assert.deepEqual(report.drift, [])
    assert.deepEqual(report.unverifiable, [])
    assert.equal(report.verdict, "identical")
    assert.ok(result.indexes > 0)
    assert.ok(result.foreignKeys > 0)
  })

  await t.test("integrity checks are clean", () => {
    assert.equal(result.foreignKeyViolations, 0)
    assert.equal(result.integrityCheck, "ok")
  })
})

// ---------------------------------------------------------------------------
// 2. Non-empty databases are refused, untouched
// ---------------------------------------------------------------------------

test("a second run is refused and changes nothing", async (t) => {
  const ddl = realDdl()
  const { client } = tempDb(t, "twice")
  await bootstrapSchema(client, ddl)

  const before = await introspectStructure(asReadOnly(client))

  await assert.rejects(
    () => bootstrapSchema(client, ddl),
    (err: unknown) => {
      assert.ok(err instanceof DatabaseNotEmptyError)
      assert.ok(
        err.message.startsWith(NOT_EMPTY_MESSAGE),
        `expected the contract refusal, got: ${err.message}`,
      )
      return true
    },
  )

  assert.deepEqual(await introspectStructure(asReadOnly(client)), before)
})

test("a database with a single unrelated table is refused", async (t) => {
  const { client } = tempDb(t, "one-table")
  await client.executeMultiple(`CREATE TABLE "Leftover" ("id" TEXT NOT NULL PRIMARY KEY);`)

  await assert.rejects(
    () => bootstrapSchema(client, realDdl()),
    (err: unknown) => {
      assert.ok(err instanceof DatabaseNotEmptyError)
      assert.deepEqual(err.tables, ["Leftover"])
      return true
    },
  )

  assert.deepEqual(await applicationTableNames(asReadOnly(client)), ["Leftover"])
})

test("a partially created database is refused, not completed", async (t) => {
  const ddl = realDdl()
  const canonical = await canonicalStructureFromDdl(ddl)
  const { client } = tempDb(t, "partial")

  // Half a schema: the first five tables, as an interrupted run would leave it.
  const partial = canonical.tables.slice(0, 5)
  await client.executeMultiple(
    `PRAGMA foreign_keys=OFF;\n${partial.map((tb) => `${tb.createSql};`).join("\n")}`,
  )
  const before = await introspectStructure(asReadOnly(client))

  await assert.rejects(
    () => bootstrapSchema(client, ddl),
    (err: unknown) => {
      assert.ok(err instanceof DatabaseNotEmptyError)
      assert.equal(err.tables.length, 5)
      return true
    },
  )

  // Still five tables — nothing was completed, added or reconciled.
  assert.deepEqual(await introspectStructure(asReadOnly(client)), before)
})

test("internal tables do not make a database look non-empty", async (t) => {
  const { client } = tempDb(t, "internal")
  await client.executeMultiple(`CREATE TABLE "_prisma_migrations" ("id" TEXT NOT NULL PRIMARY KEY);`)
  const result = await bootstrapSchema(client, realDdl())
  assert.ok(result.tables > 0)
})

// ---------------------------------------------------------------------------
// 3. The forbidden operations really are absent
// ---------------------------------------------------------------------------

test("bootstrap issues no repairing statement of any kind", async (t) => {
  const { client } = tempDb(t, "spy")
  const spy = spyOn(client)
  await bootstrapSchema(spy.client, realDdl())

  const forbidden = [/\bALTER\s+TABLE\b/i, /\bDROP\b/i, /\bDELETE\s+FROM\b/i, /\bUPDATE\s+"/i]
  for (const pattern of forbidden) {
    const offending = spy.calls.filter((c) => pattern.test(c.sql))
    assert.deepEqual(offending, [], `bootstrap issued ${pattern}: ${offending[0]?.sql.slice(0, 80)}`)
  }

  // The only thing ever written is the canonical DDL, verbatim, in one go.
  const writes = spy.calls.filter((c) => c.via === "executeMultiple")
  assert.equal(writes.length, 1, "the schema is applied as a single canonical script")
  assert.equal(writes[0].sql, realDdl())

  // Everything else is a read: sqlite_master and PRAGMAs, nothing more.
  for (const call of spy.calls.filter((c) => c.via === "execute")) {
    assert.match(call.sql.trim(), /^(SELECT|PRAGMA)\b/i, call.sql.slice(0, 80))
  }
})

test("the additive planner is gone from the public surface", () => {
  const removed = [
    "provisionSchema",
    "diffStructures",
    "preflightPlan",
    "columnDefinition",
    "isNonConstantDefault",
    "ManualMigrationRequiredError",
    "assertWritableTarget",
  ]
  const surface = Object.keys(tursoSchema)
  for (const name of removed) {
    assert.ok(!surface.includes(name), `${name} should no longer be exported`)
  }
  // …and the read-only comparison is what replaced it.
  assert.ok(surface.includes("compareStructures"))
  assert.ok(surface.includes("asReadOnly"))
})

test("there is no production override for bootstrap", () => {
  const source = readFileSync(join(PROJECT_ROOT, "prisma/turso-schema.ts"), "utf8")
  const bootstrap = readFileSync(join(PROJECT_ROOT, "prisma/bootstrap-turso.ts"), "utf8")
  assert.ok(
    !/TURSO_PROVISION_ALLOW_PRODUCTION/.test(source + bootstrap),
    "the production override must be gone entirely",
  )
})

// ---------------------------------------------------------------------------
// 4. Atomicity: rollback and concurrency
// ---------------------------------------------------------------------------

test("a failure mid-run rolls back to an empty database", async (t) => {
  const { client } = tempDb(t, "rollback")

  // A DDL whose last statement fails: the index references a column that does
  // not exist, so the script aborts after several tables already exist.
  const brokenDdl = `CREATE TABLE "A" ("id" TEXT NOT NULL PRIMARY KEY, "label" TEXT);
CREATE TABLE "B" ("id" TEXT NOT NULL PRIMARY KEY);
CREATE INDEX "A_label_idx" ON "A"("label");
CREATE INDEX "B_nope_idx" ON "B"("nope");`

  await assert.rejects(() => bootstrapSchema(client, brokenDdl), /no such column: nope/)

  assert.deepEqual(
    await applicationTableNames(asReadOnly(client)),
    [],
    "rollback must leave the database completely empty",
  )
  const indexes = await client.execute(
    "SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'",
  )
  assert.equal(Number(indexes.rows[0].n), 0, "no partial index may survive")
})

test("a database that fails verification is rolled back, not committed", async (t) => {
  const { client } = tempDb(t, "verify-fail")

  // A CHECK constraint cannot be compared through PRAGMAs, so the structure is
  // not verifiable and the transaction must not be committed.
  const uncheckableDdl = `CREATE TABLE "A" ("id" TEXT NOT NULL PRIMARY KEY, "n" INTEGER CHECK ("n" > 0));`

  await assert.rejects(
    () => bootstrapSchema(client, uncheckableDdl),
    (err: unknown) => {
      assert.ok(err instanceof BootstrapVerificationError)
      assert.match(err.message, /rolled back/)
      assert.match(err.message, /structure not verifiable/)
      return true
    },
  )

  assert.deepEqual(await applicationTableNames(asReadOnly(client)), [])
})

test("two concurrent bootstraps leave no partial state and only one succeeds", async (t) => {
  const ddl = realDdl()
  const { path } = tempDb(t, "concurrent")

  const a = createClient({ url: `file:${path}` })
  const b = createClient({ url: `file:${path}` })
  t.after(() => {
    a.close()
    b.close()
  })

  const results = await Promise.allSettled([bootstrapSchema(a, ddl), bootstrapSchema(b, ddl)])
  const fulfilled = results.filter((r) => r.status === "fulfilled")
  const rejected = results.filter((r) => r.status === "rejected")

  assert.equal(fulfilled.length, 1, "exactly one bootstrap may succeed")
  assert.equal(rejected.length, 1)

  // The loser must fail for a legitimate reason: locked out, or it saw the
  // winner's tables. Never a half-written database.
  const reason = (rejected[0] as PromiseRejectedResult).reason
  const message = reason instanceof Error ? reason.message : String(reason)
  assert.ok(
    /SQLITE_BUSY|database is locked|locked|Database is not empty/i.test(message),
    `unexpected concurrent failure: ${message}`,
  )

  // Whatever happened, the database is exactly the canonical schema.
  const canonical = await canonicalStructureFromDdl(ddl)
  const actual = await introspectStructure(asReadOnly(a))
  assert.equal(compareStructures(canonical, actual).verdict, "identical")
})

// ---------------------------------------------------------------------------
// 5. Error hygiene
// ---------------------------------------------------------------------------

test("errors never carry credentials", async (t) => {
  const { client } = tempDb(t, "sanitize")
  const secret = "libsql://leaky-lab.turso.io?authToken=leakedsecret"

  const failing: BootstrapClient = {
    async transaction() {
      throw new Error(`connection to ${secret} failed (Bearer leakedbearer)`)
    },
  }

  await assert.rejects(
    () => bootstrapSchema(failing, realDdl()),
    (err: unknown) => {
      assert.ok(err instanceof Error)
      // The raw error still has it; what we print must not.
      const printed = tursoSchema.sanitizeForLog(err.message)
      assert.ok(!printed.includes("leakedsecret"), printed)
      assert.ok(!printed.includes("leakedbearer"), printed)
      assert.ok(!printed.includes("leaky-lab"), printed)
      return true
    },
  )

  assert.deepEqual(await applicationTableNames(asReadOnly(client)), [])
})

// ---------------------------------------------------------------------------
// 6. Environment independence
// ---------------------------------------------------------------------------

test("bootstrap works from any working directory", async (t) => {
  const original = process.cwd()
  const elsewhere = mkdtempSync(join(tmpdir(), "turso-cwd-"))
  t.after(() => {
    process.chdir(original)
    rmSync(elsewhere, { recursive: true, force: true })
  })

  const { client } = tempDb(t, "from-tmp")
  process.chdir(elsewhere)
  const ddl = generateCanonicalDdl()
  const result = await bootstrapSchema(client, ddl)
  process.chdir(original)

  assert.equal(ddl, realDdl(), "the DDL must not change with the caller's cwd")
  assert.ok(result.tables > 0)
})
