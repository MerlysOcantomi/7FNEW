import assert from "node:assert/strict"
import test from "node:test"
import { inspectMigration } from "./migration-policy"
import {
  planProductionMigration,
  readProductionMigrationConfig,
  shouldRunProductionMigration,
  validateLedgerRows,
} from "./production-migrate"

test("production migrator only runs in Vercel production", () => {
  assert.equal(shouldRunProductionMigration("production"), true)
  assert.equal(shouldRunProductionMigration("preview"), false)
  assert.equal(shouldRunProductionMigration("development"), false)
  assert.equal(shouldRunProductionMigration(undefined), false)
})

test("production config is explicit and refuses pooled or mismatched targets", () => {
  const env = {
    DIRECT_URL:
      "postgresql://user:pass@ep-sevenef.example.neon.tech/neondb?sslmode=verify-full",
    SEVENF_PRODUCTION_DB_HOST: "ep-sevenef.example.neon.tech",
    SEVENF_PRODUCTION_DB_DATABASE: "neondb",
    SEVENF_PRODUCTION_DB_PROJECT: "old-wave-11795585",
    SEVENF_PRODUCTION_DB_BRANCH: "br-broad-river-b2ue75l8",
  } as NodeJS.ProcessEnv

  assert.equal(readProductionMigrationConfig(env).database, "neondb")

  assert.throws(
    () =>
      readProductionMigrationConfig({
        ...env,
        DIRECT_URL:
          "postgresql://user:pass@ep-sevenef-pooler.example.neon.tech/neondb?sslmode=verify-full",
        SEVENF_PRODUCTION_DB_HOST: "ep-sevenef-pooler.example.neon.tech",
      }),
    /DIRECT endpoint|pooled/,
  )

  assert.throws(
    () =>
      readProductionMigrationConfig({
        ...env,
        SEVENF_PRODUCTION_DB_DATABASE: "other",
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
