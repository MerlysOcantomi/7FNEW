/**
 * CORE-03C-2B (C7) — the migration-history verifier must FAIL CLOSED.
 *
 * The happy path proves the real history + schema + drift manifest are in
 * sync; every other test doctors ONE input in a temporary copy and proves
 * the verifier reports the problem and returns not-ok:
 *   - an unknown, unmanifested drift (a model added to a schema copy);
 *   - a stale manifest entry that matches no real drift;
 *   - a malformed manifest entry and a duplicated id;
 *   - a missing migration directory;
 *   - an unexpected extra migration directory.
 *
 * Everything runs on throwaway local SQLite databases in temp directories;
 * the repository inputs are never modified.
 */

import assert from "node:assert/strict"
import test, { after } from "node:test"
import { mkdtempSync, rmSync, cpSync, readFileSync, writeFileSync, appendFileSync, mkdirSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { verifyMigrationHistory, EXPECTED_MIGRATIONS } from "./build-db-from-history"

const REPO = process.cwd()
const MIGRATIONS = join(REPO, "prisma", "migrations")
const SCHEMA = join(REPO, "prisma", "schema.prisma")
const MANIFEST = join(MIGRATIONS, "drift-manifest.json")

const tempDirs: string[] = []
function scratch(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix))
  tempDirs.push(dir)
  return dir
}

after(() => {
  for (const dir of tempDirs) rmSync(dir, { recursive: true, force: true })
})

test("happy path: real history, schema and manifest are in sync", async () => {
  const result = await verifyMigrationHistory()
  assert.deepEqual(result.problems, [])
  assert.equal(result.ok, true)
  assert.equal(result.counts.tables, 52)
  assert.equal(result.counts.indexes, 93)
  assert.equal(result.counts.integrity, "ok")
  assert.equal(result.counts.fkViolations, 0)
  assert.equal(result.driftCount, result.manifestCount, "every drift item maps 1:1 to a manifest entry")
})

test("an unknown drift not in the manifest fails the run", async () => {
  const dir = scratch("verify-unknown-")
  const schemaCopy = join(dir, "schema.prisma")
  writeFileSync(schemaCopy, readFileSync(SCHEMA, "utf8"))
  appendFileSync(schemaCopy, "\nmodel DriftProbe {\n  id String @id\n}\n")
  const result = await verifyMigrationHistory({ schemaPath: schemaCopy })
  assert.equal(result.ok, false)
  assert.ok(result.problems.some((p) => p.includes("UNKNOWN drift") && p.includes("table:DriftProbe")), result.problems.join("\n"))
})

test("a stale manifest entry with no matching drift fails the run", async () => {
  const dir = scratch("verify-stale-")
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"))
  manifest.entries.push({
    id: "index:Contact.Contact_fake_idx",
    kind: "index",
    table: "Contact",
    identifier: "Contact_fake_idx",
    direction: "history-lacks",
    reason: "synthetic stale entry for the negative test",
    source: "test",
    expiresWith: "NEON_CUTOVER",
  })
  const manifestCopy = join(dir, "drift-manifest.json")
  writeFileSync(manifestCopy, JSON.stringify(manifest))
  const result = await verifyMigrationHistory({ manifestPath: manifestCopy })
  assert.equal(result.ok, false)
  assert.ok(result.problems.some((p) => p.includes("STALE manifest entry") && p.includes("Contact_fake_idx")), result.problems.join("\n"))
})

test("a malformed entry and a duplicated id fail the run", async () => {
  const dir = scratch("verify-malformed-")
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"))
  // malformed: missing reason + bad expiry format
  manifest.entries.push({ id: "index:X.broken", kind: "index", table: "X", direction: "history-lacks", source: "test", expiresWith: "WHENEVER" })
  // duplicate of a real entry
  manifest.entries.push({ ...manifest.entries[0] })
  const manifestCopy = join(dir, "drift-manifest.json")
  writeFileSync(manifestCopy, JSON.stringify(manifest))
  const result = await verifyMigrationHistory({ manifestPath: manifestCopy })
  assert.equal(result.ok, false)
  assert.ok(result.problems.some((p) => p.includes('missing or empty "reason"')), result.problems.join("\n"))
  assert.ok(result.problems.some((p) => p.includes("does not match C<N>")), result.problems.join("\n"))
  assert.ok(result.problems.some((p) => p.includes("duplicate id")), result.problems.join("\n"))
})

test("a missing migration directory fails the run", async () => {
  const dir = scratch("verify-missing-")
  const migrationsCopy = join(dir, "migrations")
  cpSync(MIGRATIONS, migrationsCopy, { recursive: true })
  rmSync(join(migrationsCopy, "1_add_missing_indexes"), { recursive: true, force: true })
  const result = await verifyMigrationHistory({ migrationsDir: migrationsCopy })
  assert.equal(result.ok, false)
  assert.ok(
    result.problems.some((p) => p.includes("expected migration missing from history: 1_add_missing_indexes")),
    result.problems.join("\n"),
  )
})

test("an unexpected extra migration fails the run", async () => {
  const dir = scratch("verify-extra-")
  const migrationsCopy = join(dir, "migrations")
  cpSync(MIGRATIONS, migrationsCopy, { recursive: true })
  mkdirSync(join(migrationsCopy, "9_rogue"))
  writeFileSync(join(migrationsCopy, "9_rogue", "migration.sql"), 'CREATE INDEX "Rogue_idx" ON "Contact"("nombre");\n')
  const result = await verifyMigrationHistory({ migrationsDir: migrationsCopy })
  assert.equal(result.ok, false)
  assert.ok(result.problems.some((p) => p.includes("unexpected migration in history: 9_rogue")), result.problems.join("\n"))
})

test("the expected migration list is the four-entry CORE-03C-2B history", () => {
  assert.deepEqual([...EXPECTED_MIGRATIONS], ["0_baseline", "1_add_missing_indexes", "2_add_link_columns", "3_create_portal_tables"])
})
