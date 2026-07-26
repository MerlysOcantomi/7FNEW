/**
 * Canonical Turso deploy runner — additive bootstrap only.
 *
 * `schema.prisma` is the single source of truth. This script renders the
 * schema's DDL with the Prisma CLI, derives the canonical structure from a
 * throwaway local SQLite database, compares it against the target, and applies
 * ONLY additive differences (new tables, new columns, new indexes).
 *
 * Any non-additive difference — a type / nullability / default / primary-key
 * change, a foreign key that does not exist on an existing table, a renamed or
 * removed object, an incompatible index — aborts with `manual migration
 * required` BEFORE anything is written. See `docs/turso-schema-deploy.md`.
 *
 * Usage (behind this environment's egress proxy, Node needs the proxy opt-in):
 *
 *     NODE_USE_ENV_PROXY=1 npm run turso:push
 *
 * Environment variables (precedence documented in `resolveTursoTarget`):
 *   URL:   TURSO_DATABASE_URL  →  DATABASE_URL (libsql:// only)
 *   TOKEN: paired with whichever variable supplied the URL
 *
 * Only databases whose name carries an explicit non-production marker are
 * provisioned automatically; anything else requires
 * `TURSO_PROVISION_ALLOW_PRODUCTION=<exact database name>`.
 */

import "dotenv/config"
import { createClient } from "@libsql/client"
import {
  ManualMigrationRequiredError,
  assertWritableTarget,
  generateCanonicalDdl,
  provisionSchema,
  resolveTursoTarget,
} from "./turso-schema"

function list(label: string, values: string[]): void {
  if (!values.length) return
  console.log(`  ${label} (${values.length}):`)
  for (const value of values) console.log(`    + ${value}`)
}

async function main() {
  const target = resolveTursoTarget()

  // Identify the target explicitly BEFORE writing. Only the database NAME and
  // the variable it came from are printed — never the URL, host or token.
  console.log(`Target database: ${target.dbName} (from ${target.urlSource})`)
  console.log(
    `  classification: ${target.classification.safe ? "non-production" : "PRODUCTION"} — ` +
      target.classification.reason,
  )
  console.log(`  auth token:     ${target.tokenSource ?? "(none configured)"}`)
  assertWritableTarget(target)

  const ddl = generateCanonicalDdl()

  const client = createClient({ url: target.url, authToken: target.authToken })
  try {
    console.log("Comparing the live database against prisma/schema.prisma…")
    const report = await provisionSchema(client, ddl)

    const expectedTables = report.canonical.tables.length
    const expectedIndexes = report.canonical.tables.reduce(
      (n, t) => n + t.indexes.filter((i) => i.origin === "c").length,
      0,
    )

    console.log(`  Tables before:   ${report.before.tables.length}`)
    console.log(`  Tables after:    ${report.after.tables.length} (schema declares ${expectedTables})`)
    console.log(`  Indexes:         ${expectedIndexes} declared by schema.prisma`)
    list("Tables created", report.applied.tables)
    list("Columns added", report.applied.columns)
    list("Indexes created", report.applied.indexes)
    if (
      !report.applied.tables.length &&
      !report.applied.columns.length &&
      !report.applied.indexes.length
    ) {
      console.log("  No changes needed — the database already matches schema.prisma.")
    }

    console.log(`  FK violations:   ${report.integrity.foreignKeyViolations}`)
    console.log(`  integrity_check: ${report.integrity.integrityCheck}`)

    if (report.integrity.foreignKeyViolations > 0) {
      throw new Error(
        `Foreign key violations detected after provisioning (${report.integrity.foreignKeyViolations}). ` +
          "The schema is in place but the DATA is inconsistent — resolve it before using this database.",
      )
    }
    if (report.integrity.integrityCheck !== "ok") {
      throw new Error(
        `PRAGMA integrity_check returned "${report.integrity.integrityCheck}" (expected "ok").`,
      )
    }

    // Reached only when the post-apply structural comparison found no
    // difference at all and both integrity checks passed.
    console.log("✓ Schema provisioned successfully from prisma/schema.prisma")
  } finally {
    client.close()
  }
}

main().catch((err) => {
  if (err instanceof ManualMigrationRequiredError) {
    console.error(err.message)
    process.exit(2)
  }
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
