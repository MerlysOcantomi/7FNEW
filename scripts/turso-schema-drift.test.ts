/**
 * Turso schema drift detector.
 *
 * Fails when the Turso deploy mechanism (`prisma/turso-schema.ts`) stops
 * matching the source of truth (`prisma/schema.prisma`). Runs entirely against
 * throwaway LOCAL SQLite files — it never connects to any remote database, so
 * it is safe to run in CI or locally without credentials or the egress proxy.
 *
 * Run: npm run test:turso-drift
 *
 * It catches, among others:
 *   - a model added to schema.prisma but not provisioned,
 *   - a table/index/column that the provisioner fails to create,
 *   - a regression that reintroduces a hand-maintained, divergent SQL list,
 *   - a provisioning path that is not idempotent on re-apply.
 */

import assert from "node:assert/strict"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { readFileSync } from "node:fs"

import { createClient, type Client } from "@libsql/client"
import {
  generateCanonicalDdl,
  parseSchemaModels,
  provisionSchema,
  toIdempotentDdl,
} from "../prisma/turso-schema"

interface Introspection {
  tables: string[]
  indexes: string[]
  columns: Record<string, string[]>
}

async function introspect(client: Client): Promise<Introspection> {
  const t = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%' ORDER BY name",
  )
  const tables = t.rows.map((r) => String(r.name))
  const i = await client.execute(
    "SELECT name FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  )
  const indexes = i.rows.map((r) => String(r.name))
  const columns: Record<string, string[]> = {}
  for (const name of tables) {
    const info = await client.execute(`PRAGMA table_info("${name}")`)
    columns[name] = info.rows.map((r) => String(r.name)).sort()
  }
  return { tables, indexes, columns }
}

function tempDbUrl(dir: string, label: string): string {
  return `file:${join(dir, `${label}.db`)}`
}

test("Turso deploy provisions a schema equivalent to prisma/schema.prisma", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "turso-drift-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  const schemaSource = readFileSync("prisma/schema.prisma", "utf8")
  const models = parseSchemaModels(schemaSource)
  const canonicalDdl = generateCanonicalDdl()

  // Guard: this whole check assumes model name === table name. A `@@map` would
  // break that assumption and must be handled explicitly before it lands.
  assert.ok(!/@@map\s*\(/.test(schemaSource), "schema.prisma uses @@map — drift check needs updating")

  // "Expected" DB: the raw source-of-truth DDL, applied directly.
  const expected = createClient({ url: tempDbUrl(dir, "expected") })
  t.after(() => expected.close())
  await expected.executeMultiple(`PRAGMA foreign_keys=OFF;\n${canonicalDdl}`)
  const expectedSchema = await introspect(expected)

  // "Actual" DB: provisioned through the real deploy mechanism.
  const actual = createClient({ url: tempDbUrl(dir, "actual") })
  t.after(() => actual.close())
  const report = await provisionSchema(actual, canonicalDdl)
  const actualSchema = await introspect(actual)

  await t.test("every schema.prisma model is provisioned as a table", () => {
    const missing = models.filter((m) => !actualSchema.tables.includes(m))
    assert.deepEqual(missing, [], `Models not provisioned: ${missing.join(", ")}`)
    assert.equal(actualSchema.tables.length, models.length)
  })

  await t.test("provisioned tables match the source of truth", () => {
    assert.deepEqual(actualSchema.tables, expectedSchema.tables)
  })

  await t.test("provisioned indexes match the source of truth", () => {
    assert.deepEqual(actualSchema.indexes, expectedSchema.indexes)
  })

  await t.test("provisioned columns match the source of truth", () => {
    assert.deepEqual(actualSchema.columns, expectedSchema.columns)
  })

  await t.test("provisioning reports the same object counts", () => {
    assert.equal(report.tables.length, expectedSchema.tables.length)
    assert.equal(report.indexes.length, expectedSchema.indexes.length)
    assert.deepEqual(report.warnings, [])
  })

  await t.test("re-provisioning is idempotent (no throw, identical schema)", async () => {
    const second = await provisionSchema(actual, canonicalDdl)
    assert.deepEqual(second.addedColumns, [])
    assert.deepEqual(second.warnings, [])
    assert.deepEqual(await introspect(actual), actualSchema)
  })
})

test("provisioning converges an older database by adding missing columns", async (t) => {
  const dir = mkdtempSync(join(tmpdir(), "turso-evolve-"))
  t.after(() => rmSync(dir, { recursive: true, force: true }))

  const canonicalDdl = generateCanonicalDdl()
  const client = createClient({ url: tempDbUrl(dir, "old") })
  t.after(() => client.close())

  // Simulate an older deploy: a table missing a column the current schema has.
  await client.executeMultiple(
    'CREATE TABLE "Workspace" ("id" TEXT NOT NULL PRIMARY KEY, "nombre" TEXT NOT NULL);',
  )
  const before = await client.execute('PRAGMA table_info("Workspace")')
  assert.ok(!before.rows.some((r) => String(r.name) === "slug"), "precondition: no slug column yet")

  const report = await provisionSchema(client, canonicalDdl)

  const after = await client.execute('PRAGMA table_info("Workspace")')
  const cols = after.rows.map((r) => String(r.name))
  assert.ok(cols.includes("slug"), "expected slug column to be added by reconciliation")
  assert.ok(
    report.addedColumns.some((c) => c.startsWith("Workspace.")),
    "reconciliation should report added Workspace columns",
  )
})

// Independent sanity check: the idempotent transform only adds IF NOT EXISTS
// and never changes object names.
test("idempotent transform preserves object names", () => {
  const ddl = generateCanonicalDdl()
  const before = ddl.match(/CREATE (?:TABLE|(?:UNIQUE )?INDEX) "([^"]+)"/g)?.length ?? 0
  const after = toIdempotentDdl(ddl)
  assert.match(after, /CREATE TABLE IF NOT EXISTS "/)
  const stillThere =
    after.match(/CREATE (?:TABLE|(?:UNIQUE )?INDEX) IF NOT EXISTS "([^"]+)"/g)?.length ?? 0
  assert.equal(stillThere, before)
})
