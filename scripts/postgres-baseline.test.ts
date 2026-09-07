import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import {
  auditBaselineSql,
  CANONICAL_SCHEMA_PATH,
  countBaseline,
  derivePostgresSchema,
  POSTGRES_CLIENT_OUTPUT,
  sha256,
} from "./postgres-baseline"

/**
 * NEON-02 — unit tests for the PostgreSQL baseline tooling. Pure text
 * functions only: no database, no Prisma CLI, no environment.
 */

const CANONICAL = readFileSync(CANONICAL_SCHEMA_PATH, "utf8")

test("derivePostgresSchema rewrites ONLY the datasource provider and the generator output", () => {
  const { schema, rewrittenLines } = derivePostgresSchema(CANONICAL)
  const before = CANONICAL.split("\n")
  const after = schema.split("\n")
  // Header lines are prepended; everything after them aligns with the canonical lines.
  const headerLength = after.length - before.length
  assert.ok(headerLength >= 1 && after.slice(0, headerLength).every((l) => l.startsWith("//")), "generated header")
  const changed: number[] = []
  for (let i = 0; i < before.length; i++) if (before[i] !== after[i + headerLength]) changed.push(i + 1)
  assert.deepEqual(changed, [...rewrittenLines].sort((a, b) => a - b))
  assert.equal(changed.length, 2)
  assert.match(after[rewrittenLines[0] - 1 + headerLength], /provider\s*=\s*"postgresql"/)
  assert.match(after[rewrittenLines[1] - 1 + headerLength], new RegExp(`output\\s*=\\s*"${POSTGRES_CLIENT_OUTPUT.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}"`))
  assert.equal((schema.match(/provider\s*=\s*"postgresql"/g) ?? []).length, 1)
  assert.equal((schema.match(/provider\s*=\s*"sqlite"/g) ?? []).length, 0)
  assert.equal((schema.match(/^model /gm) ?? []).length, (CANONICAL.match(/^model /gm) ?? []).length)
})

test("derivePostgresSchema is deterministic", () => {
  assert.equal(sha256(derivePostgresSchema(CANONICAL).schema), sha256(derivePostgresSchema(CANONICAL).schema))
})

test("derivePostgresSchema fails closed on an unexpected canonical shape", () => {
  assert.throws(() => derivePostgresSchema(CANONICAL.replace('provider = "sqlite"', 'provider = "postgresql"')), /not "sqlite"/)
  assert.throws(() => derivePostgresSchema(CANONICAL.replace(/^datasource db \{[\s\S]*?\n\}/m, "")), /exactly one datasource provider line, found 0/)
  assert.throws(() => derivePostgresSchema(CANONICAL.replace(/^generator client \{[\s\S]*?\n\}/m, "")), /exactly one generator output line, found 0/)
  const twoDatasources = CANONICAL + '\ndatasource other {\n  provider = "sqlite"\n}\n'
  assert.throws(() => derivePostgresSchema(twoDatasources), /found 2/)
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
})
