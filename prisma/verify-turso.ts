/**
 * `turso:verify` — compare a Turso database against `prisma/schema.prisma`.
 *
 * CONTRACT
 * --------
 * Strictly read-only. The canonical structure is materialised in a throwaway
 * LOCAL SQLite file; the target is only ever read. The target is handed to the
 * comparison through `asReadOnly()`, whose type exposes no write method and
 * whose runtime guard forwards only a `SELECT` or one of the six allow-listed
 * introspection pragmas (`READ_ONLY_PRAGMAS`) in its exact argument shape.
 * A mutating pragma such as `PRAGMA user_version(42)` is refused before it
 * reaches the client. It emits no corrective SQL and suggests no repair.
 *
 * Because it cannot write, it is safe to run against ANY database, including
 * production — that is the point of having it separate from `turso:bootstrap`.
 *
 * Verdicts and exit codes:
 *
 *     identical                 → 0
 *     drift detected            → 2
 *     structure not verifiable  → 2
 *     operational/config error  → 1
 *
 * `identical` is returned only when it can be proven. Anything SQLite's
 * PRAGMAs do not describe faithfully — CHECK constraints, generated columns,
 * expression indexes, collations, unsupported constructs — yields
 * `structure not verifiable` rather than being assumed equal.
 *
 * Usage (behind this environment's egress proxy, Node needs the proxy opt-in):
 *
 *     NODE_USE_ENV_PROXY=1 npm run turso:verify
 */

import { resolve } from "node:path"
import { fileURLToPath } from "node:url"

import "dotenv/config"
import { createClient } from "@libsql/client"
import {
  asReadOnly,
  canonicalStructureFromDdl,
  compareStructures,
  formatReport,
  generateCanonicalDdl,
  introspectStructure,
  describeError,
  resolveTursoTarget,
  sanitizeForLog,
  type ReadOnlyExecutor,
  type StructuralReport,
} from "./turso-schema"

/**
 * Compare a target against the canonical schema. Takes a read-only surface, so
 * this function has no way to modify the database even if it wanted to.
 */
export async function verifySchema(
  target: ReadOnlyExecutor,
  ddl: string,
): Promise<StructuralReport> {
  const canonical = await canonicalStructureFromDdl(ddl)
  const actual = await introspectStructure(target)
  return compareStructures(canonical, actual)
}

/** Process exit code for a verdict. */
export function exitCodeFor(report: StructuralReport): 0 | 2 {
  return report.verdict === "identical" ? 0 : 2
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

    // Read-only: the classification is reported for context, not enforced.
    console.log(`Target database: ${target.dbName} (from ${target.urlSource})`)
    console.log(
      `  classification: ${target.classification.safe ? "non-production" : "production"} — ` +
        target.classification.reason,
    )
    console.log("  access:         read-only (only allow-listed reads are issued)")

    const ddl = generateCanonicalDdl()

    const client = createClient({ url: target.url, authToken: target.authToken })
    try {
      const report = await verifySchema(asReadOnly(client), ddl)
      console.log("")
      console.log(formatReport(report))
      return exitCodeFor(report)
    } finally {
      client.close()
    }
  } catch (err) {
    console.error(sanitizeForLog(describeError(err), secrets))
    return 1
  }
}

if (isDirectRun()) {
  main().then((code) => process.exit(code))
}
