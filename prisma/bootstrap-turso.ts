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
 * THE GUARD CANNOT BE SKIPPED
 * ---------------------------
 * `bootstrapTursoFromEnv()` is the only exported way in, and it takes **raw
 * environment values, not a target**. Everything the guard depends on — the
 * URL, the host, the database name, the classification — is derived inside this
 * module from that environment, so there is nothing for a caller to hand in
 * pre-decided. The primitive that accepts an already-open writable client is
 * module private.
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
  applicationObjects,
  assertBootstrapTarget,
  asReadOnly,
  canonicalStructureFromDdl,
  classifyDdlStatements,
  compareStructures,
  formatReport,
  generateCanonicalDdl,
  introspectStructure,
  describeError,
  resolveTursoTarget,
  sanitizeForLog,
  type DatabaseObject,
  type DatabaseStructure,
  type ProvisionEnv,
  type SqlExecutor,
  type TursoTarget,
} from "./turso-schema"

/** The exact refusal the contract requires for a non-empty database. */
export const NOT_EMPTY_MESSAGE =
  "Database is not empty.\nBootstrap refused.\nUse turso:verify or create a fresh database."

export class DatabaseNotEmptyError extends Error {
  /** Every non-internal object found: tables, indexes, views and triggers. */
  readonly objects: DatabaseObject[]

  constructor(objects: DatabaseObject[]) {
    super(
      `${NOT_EMPTY_MESSAGE}\n\nObjects found (${objects.length}): ` +
        objects.map((o) => `${o.type} ${o.name}`).join(", "),
    )
    this.name = "DatabaseNotEmptyError"
    this.objects = objects
  }

  /** Convenience for callers that only care about tables. */
  get tables(): string[] {
    return this.objects.filter((o) => o.type === "table").map((o) => o.name)
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

/** The client surface bootstrap needs: a write transaction, and a way to close. */
export interface BootstrapClient {
  transaction(mode: "write"): Promise<BootstrapTransaction>
  close(): void
}

/**
 * Opens the write connection. Only ever invoked AFTER the environment has been
 * resolved and the derived target has passed `assertBootstrapTarget`, and always
 * with that internally-derived target — which is why a factory may be injected
 * for tests without weakening the guard.
 */
export type BootstrapClientFactory = (target: TursoTarget) => BootstrapClient

export interface BootstrapOptions {
  /** Canonical DDL. Rendered from `schema.prisma` when omitted. */
  ddl?: string
  /** How to open the write connection. Defaults to a real libsql client. */
  createClient?: BootstrapClientFactory
}

export interface BootstrapResult {
  tables: number
  indexes: number
  foreignKeys: number
  integrityCheck: string
  foreignKeyViolations: number
  structure: DatabaseStructure
}

function defaultClientFactory(target: TursoTarget): BootstrapClient {
  return createClient({ url: target.url, authToken: target.authToken })
}

/**
 * Create the canonical schema inside a single exclusive transaction.
 *
 *   1. `BEGIN IMMEDIATE` — take the write lock before reading, so two
 *      concurrent runs cannot both decide the database is empty.
 *   2. Read `sqlite_master`; refuse if any application table exists.
 *   3. Apply the whole canonical DDL — the ONLY write this tool ever issues.
 *   4. Introspect and require the result to match the canonical structure.
 *   5. `PRAGMA foreign_key_check` and `PRAGMA integrity_check`.
 *   6. Commit only if every step passed; otherwise roll back.
 *
 * Module private on purpose: it takes an already-open writable client, so
 * exporting it would be a path around `assertBootstrapTarget`. Reach it through
 * `bootstrapTursoFromEnv()`.
 */
async function bootstrapSchemaInternal(
  client: BootstrapClient,
  ddl: string,
): Promise<BootstrapResult> {
  // Validate the DDL before opening any transaction.
  classifyDdlStatements(ddl)
  const canonical = await canonicalStructureFromDdl(ddl)

  const tx = await client.transaction("write")
  try {
    // Every read goes through the read-only guard; the only statement that is
    // not is the canonical DDL below.
    const reader = asReadOnly(tx)

    // Not just tables: a leftover view or trigger also makes a database
    // non-empty, and a trigger would survive to run against what we create.
    const existing = await applicationObjects(reader)
    if (existing.length) throw new DatabaseNotEmptyError(existing)

    await tx.executeMultiple(ddl)

    const structure = await introspectStructure(reader)
    const report = compareStructures(canonical, structure)
    if (report.verdict !== "identical") {
      throw new BootstrapVerificationError(formatReport(report))
    }

    const fkCheck = await reader.execute("PRAGMA foreign_key_check")
    if (fkCheck.rows.length > 0) {
      throw new BootstrapVerificationError(
        `PRAGMA foreign_key_check returned ${fkCheck.rows.length} violation(s).`,
      )
    }

    const integrity = await reader.execute("PRAGMA integrity_check")
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
    // no-op once it is closed — safe on every path. Its own failure must never
    // replace the error that caused the rollback.
    try {
      tx.close()
    } catch {
      /* best effort: the original error below is what the operator needs */
    }
    throw err
  }
}

/**
 * The one and only entry point that can write a schema.
 *
 * It deliberately takes the **environment**, not a target. Every value the
 * guard rests on is derived here:
 *
 *   1. resolve the URL and token from `env` (precedence in `resolveTursoTarget`);
 *   2. parse the URL, deriving `host` and `dbName` from it;
 *   3. classify from that derived name;
 *   4. run the guard — which re-derives and cross-checks all of it again;
 *   5. only then render the DDL;
 *   6. only then open a connection;
 *   7. hand the internally-derived target to the private transactional
 *      primitive.
 *
 * Because there is no `target` parameter, a caller cannot supply a hand-built
 * `TursoTarget` whose `classification.safe` says `true` about a production URL.
 */
export async function bootstrapTursoFromEnv(
  env: ProvisionEnv = process.env,
  options: BootstrapOptions = {},
): Promise<BootstrapResult> {
  // Steps 1-3: derived here, from the environment, and nowhere else.
  const target = resolveTursoTarget(env)
  // Step 4: the guard re-parses the URL and recomputes the classification; it
  // reads nothing the caller could have influenced.
  assertBootstrapTarget(target)

  const ddl = options.ddl ?? generateCanonicalDdl()
  const client = (options.createClient ?? defaultClientFactory)(target)
  try {
    return await bootstrapSchemaInternal(client, ddl)
  } finally {
    // Releasing the connection is best effort. A failure here must not mask the
    // real outcome — neither a successful bootstrap nor the refusal that has to
    // reach the operator with its own exit code.
    try {
      client.close()
    } catch {
      /* intentionally ignored */
    }
  }
}

/** True only when this file is the process entry point, never on import. */
function isDirectRun(): boolean {
  const entry = process.argv[1]
  return Boolean(entry) && resolve(entry) === fileURLToPath(import.meta.url)
}

async function main(): Promise<number> {
  // Populated as soon as the target resolves, so the error path can redact the
  // token and hostname literally instead of relying on pattern matching.
  const secrets: Array<string | undefined> = []
  try {
    const target = resolveTursoTarget()
    secrets.push(target.authToken, target.host, target.url)

    // Only the database NAME and the variable it came from are ever printed —
    // never the URL, the host or the token.
    console.log(`Target database: ${target.dbName} (from ${target.urlSource})`)
    console.log(
      `  classification: ${target.classification.safe ? "non-production" : "PRODUCTION"} — ` +
        target.classification.reason,
    )
    console.log(`  auth token:     ${target.tokenSource ?? "(none configured)"}`)

    const result = await bootstrapTursoFromEnv(process.env)

    console.log(`  Tables created:  ${result.tables}`)
    console.log(`  Indexes created: ${result.indexes}`)
    console.log(`  Foreign keys:    ${result.foreignKeys}`)
    console.log(`  FK violations:   ${result.foreignKeyViolations}`)
    console.log(`  integrity_check: ${result.integrityCheck}`)
    console.log("✓ Schema created and verified. Re-run `npm run turso:verify` at any time.")
    return 0
  } catch (err) {
    console.error(sanitizeForLog(describeError(err), secrets))
    return err instanceof DatabaseNotEmptyError || err instanceof BootstrapVerificationError ? 2 : 1
  }
}

if (isDirectRun()) {
  main().then((code) => process.exit(code))
}
