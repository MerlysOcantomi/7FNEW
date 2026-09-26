/**
 * sevenef migration policy.
 *
 * Every PostgreSQL migration after the immutable 0_init baseline declares:
 *   -- sevenef:migration-mode=routine
 * or
 *   -- sevenef:migration-mode=manual
 *
 * Routine migrations are eligible for automatic production deploys and must
 * remain backwards-compatible with the currently running application.
 * Manual migrations are valid history but intentionally stop the automatic
 * production migrator until an explicit runbook handles them.
 */
import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { fileURLToPath } from "node:url"

export type MigrationMode = "baseline" | "routine" | "manual"

export interface MigrationDescriptor {
  name: string
  mode: MigrationMode
  sql: string
  findings: string[]
}

export const BASELINE_MIGRATION = "0_init"
export const MIGRATION_MODE_PATTERN =
  /^\s*--\s*sevenef:migration-mode=(routine|manual)\s*$/m

// These operations are not necessarily "bad", but they are not safe for an
// unattended expand-first production deploy while the previous app version is
// still serving traffic.
export const ROUTINE_FORBIDDEN_PATTERNS: ReadonlyArray<{
  label: string
  regex: RegExp
}> = [
  { label: "DROP TABLE", regex: /\bDROP\s+TABLE\b/i },
  { label: "DROP COLUMN", regex: /\bDROP\s+COLUMN\b/i },
  { label: "DROP CONSTRAINT", regex: /\bDROP\s+CONSTRAINT\b/i },
  { label: "DROP INDEX", regex: /\bDROP\s+INDEX\b/i },
  { label: "TRUNCATE", regex: /\bTRUNCATE\b/i },
  { label: "DELETE data", regex: /\bDELETE\s+FROM\b/i },
  { label: "UPDATE data", regex: /\bUPDATE\s+["A-Za-z_]/i },
  { label: "table/column rename", regex: /\bRENAME\s+(?:COLUMN\s+\S+\s+TO|TO)\b/i },
  { label: "column type change", regex: /\bALTER\s+COLUMN\b[\s\S]{0,160}\bTYPE\b/i },
  { label: "SET NOT NULL", regex: /\bALTER\s+COLUMN\b[\s\S]{0,160}\bSET\s+NOT\s+NULL\b/i },
  { label: "ADD COLUMN NOT NULL", regex: /\bADD\s+COLUMN\b[\s\S]{0,240}\bNOT\s+NULL\b/i },
  { label: "CREATE OR REPLACE", regex: /\bCREATE\s+OR\s+REPLACE\b/i },
]

export function migrationMode(name: string, sql: string): MigrationMode {
  if (name === BASELINE_MIGRATION) return "baseline"
  const match = MIGRATION_MODE_PATTERN.exec(sql)
  if (!match) {
    throw new Error(
      `migration-policy: ${name} must declare "-- sevenef:migration-mode=routine" or "-- sevenef:migration-mode=manual"`,
    )
  }
  return match[1] as Exclude<MigrationMode, "baseline">
}

export function routineFindings(sql: string): string[] {
  return ROUTINE_FORBIDDEN_PATTERNS
    .filter(({ regex }) => regex.test(sql))
    .map(({ label }) => label)
}

export function inspectMigration(name: string, sql: string): MigrationDescriptor {
  const mode = migrationMode(name, sql)
  const findings = mode === "routine" ? routineFindings(sql) : []
  return { name, mode, sql, findings }
}

export function migrationDirectories(root: string): string[] {
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
}

export function loadMigrationHistory(root: string): MigrationDescriptor[] {
  return migrationDirectories(root).map((name) => {
    const sql = readFileSync(join(root, name, "migration.sql"), "utf8")
    return inspectMigration(name, sql)
  })
}

export function auditHistory(history: MigrationDescriptor[]): string[] {
  const problems: string[] = []
  if (history.length === 0 || history[0].name !== BASELINE_MIGRATION) {
    problems.push(`migration history must start with immutable ${BASELINE_MIGRATION}`)
  }

  for (const migration of history) {
    if (migration.mode === "routine" && migration.findings.length > 0) {
      problems.push(
        `${migration.name}: routine migration contains manual-only operation(s): ${migration.findings.join(", ")}`,
      )
    }
  }
  return problems
}

export function assertRoutinePending(
  history: MigrationDescriptor[],
  appliedNames: string[],
): MigrationDescriptor[] {
  const names = history.map((migration) => migration.name)

  for (let i = 0; i < appliedNames.length; i++) {
    if (names[i] !== appliedNames[i]) {
      throw new Error(
        `migration-policy: production ledger is not a prefix of repository history at position ${i + 1}`,
      )
    }
  }

  const pending = history.slice(appliedNames.length)
  const manual = pending.filter((migration) => migration.mode === "manual")
  if (manual.length > 0) {
    throw new Error(
      `migration-policy: automatic production deploy stopped because manual migration(s) are pending: ${manual
        .map((migration) => migration.name)
        .join(", ")}`,
    )
  }

  const unsafe = pending.filter(
    (migration) => migration.mode === "routine" && migration.findings.length > 0,
  )
  if (unsafe.length > 0) {
    throw new Error(
      `migration-policy: automatic production deploy stopped because routine migration(s) violate policy: ${unsafe
        .map((migration) => `${migration.name} [${migration.findings.join(", ")}]`)
        .join("; ")}`,
    )
  }

  return pending
}

function main() {
  const command = process.argv[2] ?? "audit"
  if (command !== "audit") {
    throw new Error(`migration-policy: unknown command "${command}"`)
  }

  const root = fileURLToPath(new URL("../../prisma/migrations-postgres/", import.meta.url))
  const history = loadMigrationHistory(root)
  const problems = auditHistory(history)
  if (problems.length > 0) {
    for (const problem of problems) console.error(`[migration-policy] ${problem}`)
    process.exitCode = 1
    return
  }

  console.log(
    `[migration-policy] OK: ${history.length} PostgreSQL migration(s); routine auto-deploy policy satisfied`,
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main()
}
