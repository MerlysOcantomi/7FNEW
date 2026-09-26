import assert from "node:assert/strict"
import test from "node:test"
import {
  assertRoutinePending,
  auditHistory,
  inspectMigration,
  migrationMode,
} from "./migration-policy"

test("migrationMode requires explicit policy on post-baseline migrations", () => {
  assert.equal(migrationMode("0_init", "CREATE TABLE x(id text);"), "baseline")
  assert.equal(
    migrationMode("7_feature", "-- sevenef:migration-mode=routine\nALTER TABLE x ADD COLUMN y text;"),
    "routine",
  )
  assert.equal(
    migrationMode("8_cleanup", "-- sevenef:migration-mode=manual\nDROP TABLE x;"),
    "manual",
  )
  assert.throws(
    () => migrationMode("9_missing", "ALTER TABLE x ADD COLUMN z text;"),
    /must declare/,
  )
})

test("routine migration rejects destructive/manual-only operations", () => {
  const safe = inspectMigration(
    "7_safe",
    "-- sevenef:migration-mode=routine\nALTER TABLE x ADD COLUMN y text;",
  )
  assert.deepEqual(safe.findings, [])

  const unsafe = inspectMigration(
    "8_unsafe",
    "-- sevenef:migration-mode=routine\nALTER TABLE x DROP COLUMN y;",
  )
  assert.ok(unsafe.findings.includes("DROP COLUMN"))
  assert.ok(auditHistory([
    inspectMigration("0_init", "CREATE TABLE x(id text);"),
    unsafe,
  ]).some((problem) => problem.includes("manual-only")))
})

test("pending automatic production migrations must all be routine and history must extend ledger", () => {
  const history = [
    inspectMigration("0_init", "CREATE TABLE x(id text);"),
    inspectMigration(
      "7_safe",
      "-- sevenef:migration-mode=routine\nALTER TABLE x ADD COLUMN y text;",
    ),
  ]
  assert.deepEqual(
    assertRoutinePending(history, ["0_init"]).map((m) => m.name),
    ["7_safe"],
  )
  assert.deepEqual(assertRoutinePending(history, ["0_init", "7_safe"]), [])
  assert.throws(
    () => assertRoutinePending(history, ["wrong"]),
    /not a prefix/,
  )
})

test("manual pending migration stops automatic production deployment", () => {
  const history = [
    inspectMigration("0_init", "CREATE TABLE x(id text);"),
    inspectMigration(
      "7_manual",
      "-- sevenef:migration-mode=manual\nDROP TABLE x;",
    ),
  ]
  assert.throws(
    () => assertRoutinePending(history, ["0_init"]),
    /manual migration/,
  )
})
