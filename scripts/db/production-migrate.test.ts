import assert from "node:assert/strict"
import test from "node:test"
import { inspectMigration } from "./migration-policy"
import {
  planProductionMigration,
  readProductionMigrationConfig,
  shouldRunProductionMigration,
  validateLedgerRows,
} from "./production-migrate"
import { SEVENF_PRODUCTION_DATABASE_TARGET } from "./production-target"

test("production migrator only runs in Vercel production", () => {
  assert.equal(shouldRunProductionMigration("production"), true)
  assert.equal(shouldRunProductionMigration("preview"), false)
  assert.equal(shouldRunProductionMigration("development"), false)
  assert.equal(shouldRunProductionMigration(undefined), false)
})

test("production config is pinned to the versioned Neon target and refuses mismatches", () => {
  const target = SEVENF_PRODUCTION_DATABASE_TARGET
  const env = {
    DIRECT_URL:
      `postgresql://user:pass@${target.host}/${target.database}?sslmode=verify-full`,
  } as NodeJS.ProcessEnv

  const config = readProductionMigrationConfig(env)
  assert.equal(config.database, target.database)
  assert.equal(config.project, target.project)
  assert.equal(config.branch, target.branch)

  assert.throws(
    () =>
      readProductionMigrationConfig({
        DIRECT_URL:
          `postgresql://user:pass@ep-wrong.example.neon.tech/${target.database}?sslmode=verify-full`,
      }),
    /host does not match/,
  )

  assert.throws(
    () =>
      readProductionMigrationConfig({
        DIRECT_URL:
          `postgresql://user:pass@${target.host}/other?sslmode=verify-full`,
      }),
    /database does not match/,
  )
})

test("production ledger accepts only completed one-step non-rolled-back rows", () => {
  const now = new Date()
  assert.deepEqual(
    validateLedgerRows([
      {
        migration_name: "0_init",
        applied_steps_count: 1,
        finished_at: now,
        rolled_back_at: null,
      },
    ]),
    ["0_init"],
  )

  assert.throws(
    () =>
      validateLedgerRows([
        {
          migration_name: "bad",
          applied_steps_count: 0,
          finished_at: null,
          rolled_back_at: null,
        },
      ]),
    /incomplete/,
  )
})

test("production plan allows routine pending migration and blocks manual", () => {
  const baseline = inspectMigration("0_init", "CREATE TABLE x(id text);")
  const routine = inspectMigration(
    "7_add",
    "-- sevenef:migration-mode=routine\nALTER TABLE x ADD COLUMN y text;",
  )
  assert.deepEqual(
    planProductionMigration([baseline, routine], ["0_init"]).map((m) => m.name),
    ["7_add"],
  )

  const manual = inspectMigration(
    "8_drop",
    "-- sevenef:migration-mode=manual\nDROP TABLE x;",
  )
  assert.throws(
    () => planProductionMigration([baseline, routine, manual], ["0_init", "7_add"]),
    /manual migration/,
  )
})
