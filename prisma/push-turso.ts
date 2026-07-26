/**
 * Turso schema pusher (hardened — DEV-PREVIEW-01D).
 *
 * Applies the OFFICIAL repository schema (derived directly from
 * `prisma/schema.prisma`, the single source of truth) to a remote Turso/libSQL
 * database over `@libsql/client`.
 *
 * Hardening contract (why this file was rewritten):
 *   - Never announce success when any statement failed.
 *   - Count succeeded / skipped / failed statements and report them.
 *   - Capture and report every error WITHOUT revealing secrets (token, URL).
 *   - Exit with a non-zero code if a single statement fails.
 *   - Do not continue silently after a critical (connection/auth) error.
 *
 * The schema is generated from Prisma so the pushed shape can never drift from
 * the app's data model (the previous hand-maintained list was missing tables
 * such as Workspace / WorkspaceMember / WorkspaceTask). Re-running is
 * idempotent: "already exists" / "duplicate column" are treated as skips.
 */

import "dotenv/config"
import { execFileSync } from "child_process"
import { pathToFileURL } from "url"
import { createClient } from "@libsql/client"

// ── Secret redaction ─────────────────────────────────────────────────────────

/**
 * Remove anything secret from a string before it is logged. Redacts the exact
 * values of the known secret env vars and, defensively, any libsql/https URL
 * or JWT-shaped token that might appear inside a driver error message.
 */
export function sanitizeSecret(input: unknown): string {
  let msg = input instanceof Error ? input.message || String(input) : String(input)

  const secrets = [
    process.env.TURSO_DATABASE_URL,
    process.env.TURSO_AUTH_TOKEN,
    process.env.DATABASE_URL,
    process.env.DATABASE_AUTH_TOKEN,
  ].filter((s): s is string => typeof s === "string" && s.length > 0)

  for (const secret of secrets) {
    msg = msg.split(secret).join("[REDACTED]")
  }

  // Defensive: redact any remote DB URL or JWT even if it did not come from env.
  msg = msg.replace(/(libsql|https?|wss?):\/\/[^\s"'`]+/gi, "[REDACTED_URL]")
  msg = msg.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[REDACTED_TOKEN]")
  return msg
}

// ── Statement handling ───────────────────────────────────────────────────────

/**
 * Split a DDL script into individual executable statements. Strips `--` line
 * comments and blank lines, then splits on `;`. The Prisma-generated SQLite DDL
 * contains no `;` inside string literals, so a plain split is safe here.
 */
export function splitSqlStatements(sql: string): string[] {
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")

  return withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

/** A re-run of an idempotent create is not a failure. */
export function isIdempotentSkip(message: string): boolean {
  return /already exists|duplicate column/i.test(message)
}

/**
 * A critical error means the whole run is doomed (bad URL/token, no network,
 * permission denied). We must stop rather than plough through hundreds of
 * statements that will all fail — and never do so silently.
 */
export function isCriticalError(message: string): boolean {
  return /UNAUTHORIZED|authenticat|forbidden|denied|not authorized|URL_INVALID|unable to (open|connect)|connection (refused|reset|closed)|network|DNS|ENOTFOUND|ECONNREFUSED|ETIMEDOUT|proxy|TLS|certificate/i.test(
    message,
  )
}

/** A short human label for a statement, for logs (never contains secrets). */
export function statementLabel(sql: string): string {
  const create = sql.match(/CREATE (?:UNIQUE )?(TABLE|INDEX)(?: IF NOT EXISTS)? "?(\w+)"?/i)
  if (create) return `${create[1].toUpperCase()} ${create[2]}`
  const alter = sql.match(/ALTER TABLE "?(\w+)"?\s+ADD COLUMN "?(\w+)"?/i)
  if (alter) return `ALTER ${alter[1]}.${alter[2]}`
  return sql.slice(0, 40).replace(/\s+/g, " ")
}

// ── Result model ─────────────────────────────────────────────────────────────

export interface StatementFailure {
  index: number
  label: string
  error: string
}

export interface SchemaPushResult {
  total: number
  succeeded: number
  skipped: number
  failed: number
  aborted: boolean
  failures: StatementFailure[]
}

export interface SqlExecutor {
  execute(sql: string): Promise<unknown>
}

export interface Logger {
  log: (msg: string) => void
  error: (msg: string) => void
}

const silentLogger: Logger = { log: () => {}, error: () => {} }

/**
 * Execute every statement, counting outcomes. Idempotent re-creates are
 * skipped, real errors are recorded (sanitized), and a critical error aborts
 * the remaining statements loudly. Pure with respect to I/O beyond the injected
 * executor + logger, so it is fully unit-testable.
 */
export async function runSchemaStatements(
  executor: SqlExecutor,
  statements: string[],
  logger: Logger = silentLogger,
): Promise<SchemaPushResult> {
  const result: SchemaPushResult = {
    total: statements.length,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    aborted: false,
    failures: [],
  }

  for (let i = 0; i < statements.length; i++) {
    const sql = statements[i]
    const label = statementLabel(sql)
    try {
      await executor.execute(sql)
      result.succeeded++
      logger.log(`  ✓ ${label}`)
    } catch (err) {
      const message = sanitizeSecret(err)
      if (isIdempotentSkip(message)) {
        result.skipped++
        logger.log(`  • ${label} — already present, skipped`)
        continue
      }
      result.failed++
      result.failures.push({ index: i, label, error: message })
      logger.error(`  ✗ ${label} — ${message}`)
      if (isCriticalError(message)) {
        result.aborted = true
        logger.error(
          `  ! critical error — aborting after ${i + 1}/${statements.length} statements`,
        )
        break
      }
    }
  }

  return result
}

/** Non-zero exit if anything failed or the run was aborted. */
export function computeExitCode(result: SchemaPushResult): number {
  return result.failed > 0 || result.aborted ? 1 : 0
}

/** True only when it is honest to announce success. */
export function isSuccess(result: SchemaPushResult): boolean {
  return result.failed === 0 && !result.aborted
}

/** A summary line that never claims success in the presence of failures. */
export function formatReport(result: SchemaPushResult): string {
  const base =
    `statements=${result.total} ok=${result.succeeded} ` +
    `skipped=${result.skipped} failed=${result.failed}`
  if (isSuccess(result)) return `Schema applied successfully (${base})`
  const suffix = result.aborted ? " [ABORTED on critical error]" : ""
  return `Schema push FAILED (${base})${suffix}`
}

// ── Official schema source (Prisma = source of truth) ────────────────────────

/**
 * Generate the complete official schema SQL from `prisma/schema.prisma` via
 * `prisma migrate diff`. This guarantees the pushed schema matches the app's
 * data model exactly and cannot silently drift.
 */
export function loadOfficialSchemaSql(): string {
  const args = [
    "migrate",
    "diff",
    "--from-empty",
    "--to-schema",
    "prisma/schema.prisma",
    "--script",
  ]
  const candidates = ["node_modules/.bin/prisma", "prisma"]
  let lastErr: unknown
  for (const bin of candidates) {
    try {
      return execFileSync(bin, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] })
    } catch (err) {
      lastErr = err
    }
  }
  // Last resort: npx.
  try {
    return execFileSync("npx", ["prisma", ...args], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    })
  } catch {
    throw new Error(`unable to generate official schema SQL: ${sanitizeSecret(lastErr)}`)
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const dbUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL
  const dbToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN

  if (!dbUrl || !dbUrl.startsWith("libsql://")) {
    console.error("TURSO_DATABASE_URL is not configured (expected a libsql:// URL).")
    process.exit(1)
  }

  console.log("Connecting to Turso (host hidden)…")
  const client = createClient({ url: dbUrl, authToken: dbToken })

  const statements = splitSqlStatements(loadOfficialSchemaSql())
  console.log(`Applying official schema: ${statements.length} statements`)

  const result = await runSchemaStatements(client, statements, console)
  client.close()

  console.log("")
  const report = formatReport(result)
  if (isSuccess(result)) {
    console.log(report)
  } else {
    console.error(report)
    for (const f of result.failures) {
      console.error(`    - [${f.index}] ${f.label}: ${f.error}`)
    }
  }

  process.exit(computeExitCode(result))
}

const invokedPath = process.argv[1] ? pathToFileURL(process.argv[1]).href : ""
if (import.meta.url === invokedPath) {
  main().catch((err) => {
    // Never let an unexpected throw masquerade as success.
    console.error(`Fatal: ${sanitizeSecret(err)}`)
    process.exit(1)
  })
}
