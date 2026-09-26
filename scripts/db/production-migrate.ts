/**
 * Production schema migrator for sevenef Vercel deployments.
 *
 * Contract:
 * - Preview/development builds NEVER touch a remote database.
 * - Production builds require an explicitly identified Neon production target.
 * - The live database identity marker must match the expected Neon project/branch.
 * - The production ledger must be a clean prefix of repository history.
 * - Only pending migrations marked `routine` may be applied automatically.
 * - Any `manual` migration stops the deployment before Prisma writes anything.
 * - After `prisma migrate deploy`, the ledger is re-read and must exactly match
 *   repository history before the application build may continue.
 *
 * This script never prints connection strings or credentials.
 */

import { spawnSync } from "node:child_process"
import { Client as PgClient } from "pg"
import {
  assertRoutinePending,
  auditHistory,
  loadMigrationHistory,
  type MigrationDescriptor,
} from "./migration-policy"
import {
  assertTargetUrl,
  checkProductionMarker,
  type ProductionIdentity,
  type TargetExpectation,
} from "./etl-turso-to-postgres"
import { SEVENF_PRODUCTION_DATABASE_TARGET } from "./production-target"

export interface ProductionMigrationConfig {
  directUrl: string
  host: string
  database: string
  project: string
  branch: string
}

export interface LedgerRow {
  migration_name: string
  applied_steps_count: number
  finished_at: Date | null
  rolled_back_at: Date | null
}

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(`production-migrate: required environment variable ${name} is missing`)
  }
  return value.trim()
}

export function shouldRunProductionMigration(vercelEnv: string | undefined): boolean {
  return vercelEnv === "production"
}

export function readProductionMigrationConfig(
  env: NodeJS.ProcessEnv,
): ProductionMigrationConfig {
  const directUrl = required("DIRECT_URL", env.DIRECT_URL)
  const { host, database, project, branch } = SEVENF_PRODUCTION_DATABASE_TARGET

  const expectation: TargetExpectation = {
    role: "production",
    host,
    database,
    production: { project, branch },
  }
  assertTargetUrl(directUrl, expectation)

  return { directUrl, host, database, project, branch }
}

export function validateLedgerRows(rows: LedgerRow[]): string[] {
  for (const row of rows) {
    if (
      row.applied_steps_count !== 1 ||
      row.finished_at === null ||
      row.rolled_back_at !== null
    ) {
      throw new Error(
        `production-migrate: migration ledger contains an incomplete, multi-step, or rolled-back row: ${row.migration_name}`,
      )
    }
  }
  return rows.map((row) => row.migration_name)
}

function expectationFromConfig(config: ProductionMigrationConfig): TargetExpectation {
  const production: ProductionIdentity = {
    project: config.project,
    branch: config.branch,
  }
  return {
    role: "production",
    host: config.host,
    database: config.database,
    production,
  }
}

async function readLedgerAndVerifyIdentity(
  config: ProductionMigrationConfig,
): Promise<string[]> {
  const expectation = expectationFromConfig(config)
  assertTargetUrl(config.directUrl, expectation)

  const pg = new PgClient({ connectionString: config.directUrl })
  await pg.connect()
  try {
    const who = await pg.query<{ db: string }>(
      "SELECT current_database() AS db",
    )
    if (who.rows[0]?.db !== config.database) {
      throw new Error(
        "production-migrate: live current_database() does not match the configured production database",
      )
    }

    const marker = await pg.query<{ comment: string | null }>(
      "SELECT shobj_description(oid, 'pg_database') AS comment FROM pg_database WHERE datname = current_database()",
    )
    checkProductionMarker(marker.rows[0]?.comment ?? null, {
      project: config.project,
      branch: config.branch,
    })

    const ledgerExists = await pg.query<{ present: boolean }>(
      "SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present",
    )
    if (!ledgerExists.rows[0]?.present) {
      throw new Error(
        "production-migrate: production database has no Prisma migration ledger",
      )
    }

    const ledger = await pg.query<LedgerRow>(
      `SELECT migration_name, applied_steps_count, finished_at, rolled_back_at
       FROM "_prisma_migrations"
       ORDER BY started_at, migration_name`,
    )
    return validateLedgerRows(ledger.rows)
  } finally {
    await pg.end()
  }
}

export function planProductionMigration(
  history: MigrationDescriptor[],
  appliedNames: string[],
): MigrationDescriptor[] {
  const policyProblems = auditHistory(history)
  if (policyProblems.length > 0) {
    throw new Error(
      `production-migrate: repository migration policy invalid: ${policyProblems.join("; ")}`,
    )
  }
  return assertRoutinePending(history, appliedNames)
}

function runPrismaDeploy(config: ProductionMigrationConfig): void {
  const result = spawnSync(
    process.platform === "win32" ? "npm.cmd" : "npm",
    ["run", "db:migrate:deploy"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        DIRECT_URL: config.directUrl,
        DATABASE_URL: config.directUrl,
      },
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  )

  if (result.status !== 0) {
    const safe =
      [result.stdout, result.stderr]
        .filter(Boolean)
        .join("\n")
        .replaceAll(config.directUrl, "[REDACTED_DATABASE_URL]")
        .slice(-6000) || "unknown Prisma migration failure"
    throw new Error(`production-migrate: prisma migrate deploy failed\n${safe}`)
  }
}

function migrationRoot(): string {
  return new URL("../../prisma/migrations-postgres/", import.meta.url).pathname
}

export async function runProductionMigration(): Promise<void> {
  if (!shouldRunProductionMigration(process.env.VERCEL_ENV)) {
    console.log(
      `[production-migrate] skipped: VERCEL_ENV=${process.env.VERCEL_ENV ?? "unset"}`,
    )
    return
  }

  const config = readProductionMigrationConfig(process.env)
  const history = loadMigrationHistory(migrationRoot())
  const before = await readLedgerAndVerifyIdentity(config)
  const pending = planProductionMigration(history, before)

  if (pending.length === 0) {
    console.log(
      `[production-migrate] schema already current: ${history.length} migration(s)`,
    )
    return
  }

  console.log(
    `[production-migrate] applying ${pending.length} routine migration(s): ${pending
      .map((migration) => migration.name)
      .join(", ")}`,
  )

  runPrismaDeploy(config)

  const after = await readLedgerAndVerifyIdentity(config)
  const expected = history.map((migration) => migration.name)
  if (JSON.stringify(after) !== JSON.stringify(expected)) {
    throw new Error(
      "production-migrate: post-deploy migration ledger does not exactly match repository history",
    )
  }

  console.log(
    `[production-migrate] verified: production schema is current at ${expected.at(-1)}`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runProductionMigration().catch((error) => {
    const message = error instanceof Error ? error.message : String(error)
    console.error(message)
    process.exitCode = 1
  })
}
