/**
 * `turso:bootstrap` — create the schema on an EMPTY Turso database.
 *
 * CONTRACT
 * --------
 * Writes only to a database that is (a) classified as non-production and
 * (b) contains no application tables. It creates everything or nothing: the
 * whole run happens inside one `BEGIN IMMEDIATE` transaction that is committed
 * only after the resulting structure has been proven to match
 * `prisma/schema.prisma`.
 *
 * It never repairs anything. There is no column-adding path, no partial-database
 * completion, no drift reconciliation and no change planning. A database that
 * already has tables is refused outright — use `turso:verify` to inspect it, or
 * create a fresh database.
 *
 * There is also **no production override**: no environment variable can unlock
 * a production or unrecognised name. Provisioning production is a different,
 * deliberate procedure.
 *
 * Usage (behind this environment's egress proxy, Node needs the proxy opt-in):
 *
 *     NODE_USE_ENV_PROXY=1 npm run turso:bootstrap
 *
 * Exit codes: 0 success · 2 refused (not empty / not verifiable) · 1 error.
 */

import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import "dotenv/config"
import { createClient } from "@libsql/client"
import {
  applicationTableNames,
  assertBootstrapTarget,
  asReadOnly,
  canonicalStructureFromDdl,
  classifyDdlStatements,
  compareStructures,
  formatReport,
  generateCanonicalDdl,
  introspectStructure,
  resolveTursoTarget,
  sanitizeForLog,
  type DatabaseStructure,
  type SqlExecutor,
} from "./turso-schema"

/** The exact refusal the contract requires for a non-empty database. */
export const NOT_EMPTY_MESSAGE =
  "Database is not empty.\nBootstrap refused.\nUse turso:verify or create a fresh database."

export class DatabaseNotEmptyError extends Error {
  readonly tables: string[]

  constructor(tables: string[]) {
    super(`${NOT_EMPTY_MESSAGE}\n\nApplication tables found (${tables.length}): ${tables.join(", ")}`)
    this.name = "DatabaseNotEmptyError"
    this.tables = tables
  }
}

export class BootstrapVerificationError extends Error {
  constructor(detail: string) {
    super(`Bootstrap verification failed — rolled back, the database is unchanged.\n${detail}`)
    this.name = "BootstrapVerificationError"
  }
}

/**
 * The transaction surface bootstrap needs. Structurally satisfied by
 * `@libsql/client`'s `Transaction`.
 */
export interface BootstrapTransaction extends SqlExecutor {
  commit(): Promise<void>
  rollback(): Promise<void>
  close(): void
}

/** The client surface bootstrap needs: a write transaction, nothing else. */
export interface BootstrapClient {
  transaction(mode: "write"): Promise<BootstrapTransaction>
}

export interface BootstrapResult {
  tables: number
  indexes: number
  foreignKeys: number
  integrityCheck: string
  foreignKeyViolations: number
  structure: DatabaseStructure
}

/**
 * Create the canonical schema inside a single exclusive transaction.
 *
 *   1. `BEGIN IMMEDIATE` — take the write lock before reading, so two
 *      concurrent runs cannot both decide the database is empty.
 *   2. Read `sqlite_master`; refuse if any application table exists.
 *   3. Apply the whole canonical DDL.
 *   4. Introspect and require the result to match the canonical structure.
 *   5. `PRAGMA foreign_key_check` and `PRAGMA integrity_check`.
 *   6. Commit only if every step passed; otherwise roll back.
 */
export async function bootstrapSchema(
  client: BootstrapClient,
  ddl: string,
): Promise<BootstrapResult> {
  // Validate the DDL before opening any transaction.
  classifyDdlStatements(ddl)
  const canonical = await canonicalStructureFromDdl(ddl)

  const tx = await client.transaction("write")
  try {
    const existing = await applicationTableNames(asReadOnly(tx))
    if (existing.length) throw new DatabaseNotEmptyError(existing)

    await tx.executeMultiple(ddl)

    const structure = await introspectStructure(asReadOnly(tx))
    const report = compareStructures(canonical, structure)
    if (report.verdict !== "identical") {
      throw new BootstrapVerificationError(formatReport(report))
    }

    const fkCheck = await tx.execute("PRAGMA foreign_key_check")
    if (fkCheck.rows.length > 0) {
      throw new BootstrapVerificationError(
        `PRAGMA foreign_key_check returned ${fkCheck.rows.length} violation(s).`,
      )
    }

    const integrity = await tx.execute("PRAGMA integrity_check")
    const integrityCheck = String(Object.values(integrity.rows[0] ?? {})[0] ?? "unknown")
    if (integrityCheck !== "ok") {
      throw new BootstrapVerificationError(
        `PRAGMA integrity_check returned "${integrityCheck}" (expected "ok").`,
      )
    }

    await tx.commit()

    return {
      tables: structure.tables.length,
      indexes: structure.tables.reduce(
        (n, t) => n + t.indexes.filter((i) => i.origin === "c").length,
        0,
      ),
      foreignKeys: structure.tables.reduce((n, t) => n + t.foreignKeys.length, 0),
      integrityCheck,
      foreignKeyViolations: fkCheck.rows.length,
      structure,
    }
  } catch (err) {
    // `close()` rolls back when the transaction was not committed, and is a
    // no-op once it is closed — safe on every path.
    tx.close()
    throw err
  }
}

/** True only when this file is the process entry point, never on import. */
function isDirectRun(): boolean {
  const entry = process.argv[1]
  return Boolean(entry) && resolve(entry) === fileURLToPath(import.meta.url)
}

async function main() {
  const target = resolveTursoTarget()

  // Only the database NAME and the variable it came from are ever printed —
  // never the URL, the host or the token.
  console.log(`Target database: ${target.dbName} (from ${target.urlSource})`)
  console.log(
    `  classification: ${target.classification.safe ? "non-production" : "PRODUCTION"} — ` +
      target.classification.reason,
  )
  console.log(`  auth token:     ${target.tokenSource ?? "(none configured)"}`)
  assertBootstrapTarget(target)

  const ddl = generateCanonicalDdl()

  const client = createClient({ url: target.url, authToken: target.authToken })
  try {
    console.log("Bootstrapping schema from prisma/schema.prisma…")
    const result = await bootstrapSchema(client, ddl)

    console.log(`  Tables created:  ${result.tables}`)
    console.log(`  Indexes created: ${result.indexes}`)
    console.log(`  Foreign keys:    ${result.foreignKeys}`)
    console.log(`  FK violations:   ${result.foreignKeyViolations}`)
    console.log(`  integrity_check: ${result.integrityCheck}`)
    console.log("✓ Schema created and verified. Re-run `npm run turso:verify` at any time.")
  } finally {
    client.close()
  }
}

if (isDirectRun()) {
  main().catch((err) => {
    const message = err instanceof Error ? err.message : String(err)
    console.error(sanitizeForLog(message))
    process.exit(err instanceof DatabaseNotEmptyError || err instanceof BootstrapVerificationError ? 2 : 1)
  })
}
