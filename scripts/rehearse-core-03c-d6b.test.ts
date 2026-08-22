/**
 * CORE-03C-D6B — safety tests for the cloud rehearsal driver.
 *
 * Proves, with no network access at all:
 *   - the target guard accepts ONLY the pinned disposable branch hostname
 *     (production-shaped hostnames, local targets, embedded credentials and
 *     foreign schemes are all refused);
 *   - the environment guard refuses production-shaped credentials, and
 *     admits the app-client pair only for the e2e phase and only when it
 *     equals the branch values;
 *   - the schema-precondition parser derives exactly the objects the real
 *     committed migrations create (21 indexes / 2 columns + 2 indexes /
 *     4 tables + 9 indexes), and refuses non-additive statement shapes;
 *   - applied-state classification is fail-closed: all-present → APPLIED,
 *     none-present → PENDING, anything partial → INCONSISTENT.
 */

import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import {
  PINNED_HOST,
  assertBranchUrl,
  assertNoProductionEnv,
  parsePreconditions,
  classifyState,
} from "./rehearse-core-03c-d6b"

const MIGRATIONS = join(process.cwd(), "prisma", "migrations")
const readMigration = (name: string): string => readFileSync(join(MIGRATIONS, name, "migration.sql"), "utf8")

test("target guard accepts only the pinned branch hostname", () => {
  assertBranchUrl(`libsql://${PINNED_HOST}`)
  assertBranchUrl(`https://${PINNED_HOST}`)
  assertBranchUrl(`wss://${PINNED_HOST}`)
  // Anything else is refused — production-shaped hosts above all.
  assert.throws(() => assertBranchUrl("libsql://7frames-7frames.aws-eu-west-1.turso.io"))
  assert.throws(() => assertBranchUrl(`libsql://prod-${PINNED_HOST}`))
  assert.throws(() => assertBranchUrl(`libsql://${PINNED_HOST}.evil.example`))
  assert.throws(() => assertBranchUrl("libsql://127.0.0.1"))
  assert.throws(() => assertBranchUrl("libsql://localhost"))
  assert.throws(() => assertBranchUrl("file:/tmp/whatever.db"))
  assert.throws(() => assertBranchUrl(`http://${PINNED_HOST}`)) // plaintext refused
  assert.throws(() => assertBranchUrl(`libsql://user:pass@${PINNED_HOST}`)) // embedded credentials refused
  assert.throws(() => assertBranchUrl(""))
  assert.throws(() => assertBranchUrl("not a url"))
})

test("environment guard refuses production-shaped credentials", () => {
  const base = { D6B_DATABASE_URL: `libsql://${PINNED_HOST}`, D6B_AUTH_TOKEN: "branch-token" }
  assertNoProductionEnv("apply", { ...base })
  assert.throws(() => assertNoProductionEnv("apply", { ...base, TURSO_DATABASE_URL: "libsql://x" }))
  assert.throws(() => assertNoProductionEnv("apply", { ...base, TURSO_AUTH_TOKEN: "t" }))
  // App-client pair: only in e2e, only when equal to the branch values.
  assert.throws(() => assertNoProductionEnv("apply", { ...base, DATABASE_URL: base.D6B_DATABASE_URL }))
  assert.throws(() => assertNoProductionEnv("e2e", { ...base, DATABASE_URL: "libsql://other" }))
  assert.throws(() =>
    assertNoProductionEnv("e2e", { ...base, DATABASE_URL: base.D6B_DATABASE_URL, DATABASE_AUTH_TOKEN: "different" }),
  )
  assertNoProductionEnv("e2e", { ...base, DATABASE_URL: base.D6B_DATABASE_URL, DATABASE_AUTH_TOKEN: base.D6B_AUTH_TOKEN })
})

test("precondition parser derives the real migrations' objects exactly", () => {
  const m1 = parsePreconditions(readMigration("1_add_missing_indexes"))
  assert.equal(m1.indexes.length, 21)
  assert.equal(m1.tables.length, 0)
  assert.equal(m1.columns.length, 0)

  const m2 = parsePreconditions(readMigration("2_add_link_columns"))
  assert.deepEqual(
    m2.columns,
    [
      { table: "InboxTodo", column: "workspaceTaskId" },
      { table: "QRCode", column: "workspaceId" },
    ],
  )
  assert.deepEqual(m2.indexes, ["InboxTodo_workspaceId_workspaceTaskId_idx", "QRCode_workspaceId_module_recordId_idx"])
  assert.equal(m2.tables.length, 0)

  const m3 = parsePreconditions(readMigration("3_create_portal_tables"))
  assert.deepEqual(m3.tables, ["ClientAsset", "ClientRequest", "ClientRequestAsset", "ForteSnapshot"])
  assert.equal(m3.indexes.length, 9)
  assert.equal(m3.columns.length, 0)
})

test("precondition parser refuses non-additive statement shapes", () => {
  assert.throws(() => parsePreconditions(`DROP TABLE "X";`))
  assert.throws(() => parsePreconditions(`UPDATE "X" SET a = 1;`))
  assert.throws(() => parsePreconditions(`INSERT INTO "X" (a) VALUES (1);`))
  assert.throws(() => parsePreconditions(`CREATE INDEX unquoted_name ON "X"("a");`))
})

test("applied-state classification is fail-closed", () => {
  const pre = parsePreconditions(readMigration("2_add_link_columns"))
  const none = { indexes: new Set<string>(), tables: new Set<string>(), columns: new Set<string>() }
  assert.equal(classifyState(pre, none), "PENDING")
  const all = {
    indexes: new Set(pre.indexes),
    tables: new Set(pre.tables),
    columns: new Set(pre.columns.map((c) => `${c.table}.${c.column}`)),
  }
  assert.equal(classifyState(pre, all), "APPLIED")
  const partial = { ...all, indexes: new Set([pre.indexes[0]]) }
  assert.equal(classifyState(pre, partial), "INCONSISTENT")
  assert.throws(() => classifyState({ indexes: [], tables: [], columns: [] }, none))
})
