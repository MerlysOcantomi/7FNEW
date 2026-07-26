/**
 * Canonical Turso deploy runner.
 *
 * `schema.prisma` is the single source of truth. This script renders the
 * schema's DDL with the Prisma CLI, makes it idempotent, and applies it to the
 * remote Turso database with `@libsql/client` (Prisma's migration engine cannot
 * reach `libsql://` directly — see `prisma/turso-schema.ts`). There is no
 * hand-maintained SQL list anymore, so it can never drift from the schema.
 *
 * Usage (behind this environment's egress proxy, Node needs the proxy opt-in):
 *
 *     NODE_USE_ENV_PROXY=1 npx tsx prisma/push-turso.ts
 *
 * Environment variables (precedence documented in `resolveTursoTarget`):
 *   URL:   TURSO_DATABASE_URL  →  DATABASE_URL (libsql:// only)
 *   TOKEN: TURSO_AUTH_TOKEN    →  DATABASE_AUTH_TOKEN
 *
 * A production-looking target is refused unless
 * `TURSO_PROVISION_ALLOW_PRODUCTION` equals its name.
 */

import "dotenv/config"
import { createClient } from "@libsql/client"
import {
  resolveTursoTarget,
  assertWritableTarget,
  generateCanonicalDdl,
  provisionSchema,
} from "./turso-schema"

async function main() {
  const target = resolveTursoTarget()

  // Identify the target explicitly BEFORE writing (name only — never the URL
  // or token).
  console.log(`Target database: ${target.dbName} (from ${target.urlSource})`)
  if (target.looksLikeProduction) {
    console.log("⚠️  Target name looks like PRODUCTION.")
  }
  assertWritableTarget(target)

  const ddl = generateCanonicalDdl()

  const client = createClient({ url: target.url, authToken: target.authToken })
  try {
    console.log("Applying canonical schema derived from prisma/schema.prisma…")
    const report = await provisionSchema(client, ddl)

    // Verify against the live database.
    const tableCount = await client.execute(
      "SELECT count(*) AS n FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_litestream%'",
    )
    const indexCount = await client.execute(
      "SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'",
    )
    const fkCheck = await client.execute("PRAGMA foreign_key_check")

    console.log(`  Expected tables:  ${report.tables.length}`)
    console.log(`  Expected indexes: ${report.indexes.length}`)
    console.log(`  Live tables:      ${Number(tableCount.rows[0].n)}`)
    console.log(`  Live indexes:     ${Number(indexCount.rows[0].n)}`)
    console.log(`  FK violations:    ${fkCheck.rows.length}`)
    if (report.addedColumns.length) {
      console.log(`  Columns added:    ${report.addedColumns.join(", ")}`)
    }
    for (const w of report.warnings) console.warn(`  ⚠️  ${w}`)

    if (Number(tableCount.rows[0].n) < report.tables.length) {
      throw new Error("Live table count is lower than expected — provisioning incomplete.")
    }
    if (fkCheck.rows.length > 0) {
      throw new Error("Foreign key violations detected after provisioning.")
    }

    console.log("✓ Schema provisioned successfully from prisma/schema.prisma")
  } finally {
    client.close()
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
