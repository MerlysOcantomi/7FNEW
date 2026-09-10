import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import {
  assertCanonicalPostgresSchema,
  assertFirstDeployApplied,
  assertLocalPostgresUrl,
  assertRedeployNoop,
  auditBaselineSql,
  BASELINE_MIGRATION_NAME,
  BASELINE_SHA256,
  CANONICAL_SCHEMA_PATH,
  countBaseline,
  EMPTY_DATABASE_ASSERTION_SQL,
  EXPECTED_POSTGRES_MIGRATIONS,
  isEmptyDiff,
  LEDGER_ASSERTION_SQL,
  ledgerAssertionSql,
  NO_CONNECTION_PLACEHOLDER_URL,
  POSTGRES_INIT_SQL_PATH,
  reconcileBaseline,
  redactConnectionUrls,
  sha256,
} from "./postgres-baseline"

/**
 * NEON-02/NEON-03 — unit tests for the PostgreSQL baseline tooling. Pure text
 * functions only: no database, no Prisma CLI, no environment.
 */

const CANONICAL = readFileSync(CANONICAL_SCHEMA_PATH, "utf8")

test("the canonical schema is the PostgreSQL schema (NEON-03) and 0_init on disk is the pinned, immutable baseline", () => {
  assert.doesNotThrow(() => assertCanonicalPostgresSchema(CANONICAL))
  assert.equal((CANONICAL.match(/provider\s*=\s*"postgresql"/g) ?? []).length, 1)
  assert.equal((CANONICAL.match(/provider\s*=\s*"sqlite"/g) ?? []).length, 0)
  assert.equal(sha256(readFileSync(POSTGRES_INIT_SQL_PATH, "utf8")), BASELINE_SHA256)
  assert.deepEqual([...EXPECTED_POSTGRES_MIGRATIONS], [BASELINE_MIGRATION_NAME])
})

test("assertCanonicalPostgresSchema fails closed on any other provider shape", () => {
  assert.throws(() => assertCanonicalPostgresSchema(CANONICAL.replace('provider = "postgresql"', 'provider = "sqlite"')), /is "sqlite", not "postgresql"/)
  assert.throws(() => assertCanonicalPostgresSchema(CANONICAL.replace(/^datasource db \{[\s\S]*?\n\}/m, "")), /exactly one datasource provider line.*found 0/)
  const twoDatasources = CANONICAL + '\ndatasource other {\n  provider = "postgresql"\n}\n'
  assert.throws(() => assertCanonicalPostgresSchema(twoDatasources), /found 2/)
  // A generator `provider` line is not a datasource provider.
  assert.doesNotThrow(() => assertCanonicalPostgresSchema(CANONICAL.replace('provider = "prisma-client"', 'provider = "prisma-client"')))
})

test("auditBaselineSql flags every SQLite remnant and unexpected PostgreSQL construct", () => {
  const dirty = [
    'PRAGMA foreign_keys=OFF;',
    'CREATE TABLE "new_Cliente" ("id" TEXT NOT NULL PRIMARY KEY, "createdAt" DATETIME NOT NULL, "n" INTEGER PRIMARY KEY AUTOINCREMENT);',
    'INSERT INTO "new_Cliente" SELECT * FROM "Cliente";',
    'DROP TABLE "Cliente";',
    'ALTER TABLE "new_Cliente" RENAME TO "Cliente";',
    "SELECT rowid FROM sqlite_master WHERE x = ? AND strftime('%s', datetime('now')) > json_extract(m, '$.a');",
    'CREATE TABLE "T" ("id" SERIAL, "j" JSONB, "u" UUID DEFAULT gen_random_uuid(), "n" NUMERIC(10,2), "t" TIMESTAMPTZ, "g" INTEGER GENERATED ALWAYS AS IDENTITY);',
    'CREATE TYPE "Status" AS ENUM (\'a\');',
    'CREATE EXTENSION IF NOT EXISTS "citext";',
    'ALTER TABLE "T" ADD CONSTRAINT "f" FOREIGN KEY ("a") REFERENCES "U"("id") DEFERRABLE;',
    `CREATE INDEX "${"a".repeat(64)}" ON "T"("id");`,
  ].join("\n")
  const findings = auditBaselineSql(dirty)
  for (const expected of [
    "PRAGMA", "DATETIME type", "AUTOINCREMENT", "rowid", "sqlite_ internals", "table rebuild (new_ prefix)", "INSERT INTO (data copy)", "RENAME TO", "DROP TABLE", "? placeholder", "strftime()", "datetime()", "json_extract()",
    "SERIAL", "IDENTITY", "JSONB", "CREATE TYPE (enum)", "gen_random_uuid", "UUID type", "DEFERRABLE", "CREATE EXTENSION", "TIMESTAMPTZ", "NUMERIC/DECIMAL",
  ]) {
    assert.ok(findings.some((f) => f.includes(expected)), `expected finding: ${expected}\n${findings.join("\n")}`)
  }
  assert.ok(findings.some((f) => f.includes("longer than 63 characters")))
})

test("auditBaselineSql accepts a clean Prisma-style PostgreSQL baseline and counts its objects", () => {
  const clean = [
    'CREATE SCHEMA IF NOT EXISTS "public";',
    "-- CreateTable",
    'CREATE TABLE "Workspace" (',
    '    "id" TEXT NOT NULL,',
    '    "isPrivate" BOOLEAN NOT NULL DEFAULT false,',
    '    "presupuesto" DOUBLE PRECISION,',
    '    "count" INTEGER NOT NULL DEFAULT 0,',
    '    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,',
    '    CONSTRAINT "Workspace_pkey" PRIMARY KEY ("id")',
    ");",
    'CREATE TABLE "Member" (',
    '    "id" TEXT NOT NULL,',
    '    "workspaceId" TEXT NOT NULL,',
    '    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")',
    ");",
    'CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");',
    'CREATE INDEX "Member_workspaceId_idx" ON "Member"("workspaceId");',
    'ALTER TABLE "Member" ADD CONSTRAINT "Member_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;',
  ].join("\n")
  assert.deepEqual(auditBaselineSql(clean), [])
  assert.deepEqual(countBaseline(clean), {
    createTable: 2,
    createIndex: 1,
    createUniqueIndex: 1,
    foreignKeys: 1,
    onDeleteCascade: 1,
    onDeleteSetNull: 0,
    onDeleteRestrict: 0,
    primaryKeys: 2,
  })
  // The committed baseline itself passes the audit.
  assert.deepEqual(auditBaselineSql(readFileSync(POSTGRES_INIT_SQL_PATH, "utf8")), [])
})

// ─── R3: baseline immutability ──────────────────────────────────────────────

test("reconcileBaseline: absent baseline is written, identical baseline is accepted unchanged", () => {
  assert.equal(reconcileBaseline(null, "CREATE TABLE \"A\" ();\n"), "write")
  assert.equal(reconcileBaseline("CREATE TABLE \"A\" ();\n", "CREATE TABLE \"A\" ();\n"), "unchanged")
})

test("reconcileBaseline: a differing existing baseline can NEVER be overwritten (no override exists)", () => {
  const existing = "CREATE TABLE \"A\" ();\n"
  const fresh = "CREATE TABLE \"A\" ();\nCREATE TABLE \"B\" ();\n"
  assert.throws(() => reconcileBaseline(existing, fresh), (e: unknown) => e instanceof Error && /immutable/.test(e.message) && /NEW PostgreSQL migration/.test(e.message) && !/--force/.test(e.message))
  // Even a one-byte difference is a hard failure.
  assert.throws(() => reconcileBaseline(existing, existing.trimEnd()), /immutable/)
  assert.equal(reconcileBaseline.length, 2, "no third override parameter")
})

// ─── R3: empty-database preflight and ledger contracts ──────────────────────

test("EMPTY_DATABASE_ASSERTION_SQL is read-only and counts every non-system base table (ledger included)", () => {
  const sql = EMPTY_DATABASE_ASSERTION_SQL
  assert.match(sql, /information_schema\.tables/)
  assert.match(sql, /table_type = 'BASE TABLE'/)
  assert.match(sql, /table_schema NOT IN \('pg_catalog', 'information_schema'\)/)
  assert.match(sql, /RAISE EXCEPTION 'POSTGRES_BASELINE_NOT_EMPTY/)
  assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE|GRANT)\b/i)
  // No carve-out for _prisma_migrations: a database with a ledger is not empty.
  assert.doesNotMatch(sql, /_prisma_migrations/)
})

test("LEDGER_ASSERTION_SQL requires exactly the expected completed, single-step, non-rolled-back rows", () => {
  const sql = LEDGER_ASSERTION_SQL
  assert.match(sql, /FROM "_prisma_migrations"/)
  assert.match(sql, new RegExp(`migration_name IN \\('${BASELINE_MIGRATION_NAME}'\\)`))
  assert.match(sql, /applied_steps_count = 1/)
  assert.match(sql, /finished_at IS NOT NULL/)
  assert.match(sql, /rolled_back_at IS NULL/)
  assert.match(sql, /IF total <> 1 OR ok <> 1 THEN/)
  assert.doesNotMatch(sql, /\b(INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|TRUNCATE)\b/i)
  // A longer history (a future NEW migration) scales the assertion; 0_init is never rewritten.
  const two = ledgerAssertionSql(["0_init", "1_future"])
  assert.match(two, /IN \('0_init', '1_future'\)/)
  assert.match(two, /IF total <> 2 OR ok <> 2 THEN/)
})

test("assertFirstDeployApplied accepts only a deploy that applied 0_init in this run", () => {
  assert.doesNotThrow(() => assertFirstDeployApplied("Applying migration `0_init`\nThe following migration(s) have been applied:\nmigrations/\n  └─ 0_init/\n    └─ migration.sql\nAll migrations have been successfully applied."))
  assert.throws(() => assertFirstDeployApplied("1 migration found in prisma/migrations\nNo pending migrations to apply."), /not empty/)
  assert.throws(() => assertFirstDeployApplied("Applying migration `1_other`\nAll migrations have been successfully applied."), /expected 0_init/)
  assert.throws(() => assertFirstDeployApplied(""), /unexpected first migrate deploy output/)
})

test("assertRedeployNoop accepts only a no-op second deploy", () => {
  assert.doesNotThrow(() => assertRedeployNoop("1 migration found in prisma/migrations\nNo pending migrations to apply."))
  assert.throws(() => assertRedeployNoop("Applying migration `0_init`"), /not a no-op/)
})

test("isEmptyDiff accepts ONLY the explicit empty-migration marker — blank output fails closed", () => {
  assert.equal(isEmptyDiff("Loaded Prisma config from prisma.config.ts.\n\n-- This is an empty migration.\n"), true)
  assert.equal(isEmptyDiff("-- This is an empty migration.\n\n"), true)
  assert.equal(isEmptyDiff('-- CreateTable\nCREATE TABLE "Stray" ("id" INTEGER);\n'), false)
  // Prisma 7.4.1 prints nothing when its config has no datasource: not a diff.
  assert.equal(isEmptyDiff(""), false)
  assert.equal(isEmptyDiff("Loaded Prisma config from prisma.config.ts.\n"), false)
  assert.match(NO_CONNECTION_PLACEHOLDER_URL, /^postgresql:\/\/[^@]+@127\.0\.0\.1:1\//)
})

test("assertLocalPostgresUrl: loopback only unless explicitly allowed; never a non-PostgreSQL scheme", () => {
  assert.doesNotThrow(() => assertLocalPostgresUrl("postgresql://postgres@127.0.0.1:5432/verify", false))
  assert.doesNotThrow(() => assertLocalPostgresUrl("postgres://postgres@localhost/verify", false))
  assert.throws(() => assertLocalPostgresUrl("postgresql://user:pw@db.example.invalid/verify", false), (e: unknown) => e instanceof Error && /LOOPBACK/.test(e.message) && !/example\.invalid/.test(e.message))
  assert.doesNotThrow(() => assertLocalPostgresUrl("postgresql://user:pw@db.example.invalid/verify", true))
  assert.throws(() => assertLocalPostgresUrl("libsql://127.0.0.1/x", true), /must be a postgresql:\/\/ URL/)
  assert.throws(() => assertLocalPostgresUrl("not a url", true), /not a valid URL/)
})

test("redactConnectionUrls never lets a connection string through an error message", () => {
  const msg = "failed: postgresql://user:s3cret@db.example.invalid:5432/app?sslmode=require and postgres://x:y@h/d and libsql://tok@turso.invalid"
  const red = redactConnectionUrls(msg)
  assert.doesNotMatch(red, /s3cret|example\.invalid|turso\.invalid/)
  assert.match(red, /postgresql:\/\/<redacted>/)
  assert.match(red, /libsql:\/\/<redacted>/)
})
