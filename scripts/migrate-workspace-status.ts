import "dotenv/config"
import { createClient } from "@libsql/client"

/**
 * One-shot migration: adds `Workspace.status` (TEXT NOT NULL DEFAULT 'active')
 * + an index on the column to Turso/libSQL.
 *
 * Same pattern as `scripts/migrate-platform-admin.ts` and
 * `scripts/migrate-platform-audit-log.ts` — `prisma.config.ts` pins
 * `prisma db push` to local `dev.db`, so this script is the production
 * counterpart that targets the actual remote DB.
 *
 * Idempotency strategy:
 *   - SQLite/libSQL does NOT support `ALTER TABLE ... ADD COLUMN IF NOT
 *     EXISTS`. Instead we inspect `PRAGMA table_info("Workspace")` to
 *     decide whether the ALTER is needed.
 *   - The index is created with `CREATE INDEX IF NOT EXISTS`, so re-runs
 *     are silent.
 *
 * Usage:
 *   npx tsx scripts/migrate-workspace-status.ts
 *
 * Required env (already used by the app):
 *   - DATABASE_URL          (libsql://... format; falls back to TURSO_DATABASE_URL)
 *   - DATABASE_AUTH_TOKEN   (required for Turso; falls back to TURSO_AUTH_TOKEN)
 */
async function main() {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

  if (!url) {
    console.error("[migrate-workspace-status] Missing DATABASE_URL / TURSO_DATABASE_URL")
    process.exitCode = 1
    return
  }

  const db = createClient({ url, authToken })

  console.log(`[migrate-workspace-status] Connecting to: ${url.split("?")[0]}`)

  /**
   * Step 1 — verify the table exists and check whether `status` is already
   * present. PRAGMA returns one row per column; we look for a name match.
   */
  let alreadyHasColumn = false
  try {
    const res = await db.execute(`PRAGMA table_info("Workspace")`)
    if (res.rows.length === 0) {
      console.error(
        "[migrate-workspace-status] Table \"Workspace\" not found. Aborting.",
      )
      process.exitCode = 1
      return
    }
    alreadyHasColumn = res.rows.some(
      (r) => String(r.name ?? "").toLowerCase() === "status",
    )
  } catch (err) {
    console.error("[migrate-workspace-status] PRAGMA failed:", err)
    process.exitCode = 1
    return
  }

  /**
   * Step 2 — ALTER (idempotent). If the column already exists we skip
   * outright; SQLite would reject the ALTER otherwise and there's no
   * `IF NOT EXISTS` form for ADD COLUMN.
   */
  if (alreadyHasColumn) {
    console.log(`[migrate-workspace-status] OK · "status" column already exists, skipping ALTER`)
  } else {
    try {
      await db.execute(
        `ALTER TABLE "Workspace" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'active'`,
      )
      console.log(`[migrate-workspace-status] OK · ALTER TABLE … ADD COLUMN status`)
    } catch (err) {
      console.error("[migrate-workspace-status] FAIL · ALTER TABLE")
      console.error(err)
      process.exitCode = 1
      return
    }
  }

  /**
   * Step 3 — index. Always idempotent thanks to `IF NOT EXISTS`. Useful so
   * the future enforcement / billing layers can scan suspended workspaces
   * cheaply without a full table scan.
   */
  try {
    await db.execute(
      `CREATE INDEX IF NOT EXISTS "Workspace_status_idx" ON "Workspace"("status")`,
    )
    console.log(
      `[migrate-workspace-status] OK · CREATE INDEX IF NOT EXISTS Workspace_status_idx`,
    )
  } catch (err) {
    console.error("[migrate-workspace-status] FAIL · CREATE INDEX")
    console.error(err)
    process.exitCode = 1
    return
  }

  /**
   * Sanity check: count by status. Confirms the column is queryable on the
   * same DB the runtime will use, and gives operators a quick distribution.
   */
  try {
    const res = await db.execute(
      `SELECT "status" as status, COUNT(*) as n FROM "Workspace" GROUP BY "status"`,
    )
    if (res.rows.length === 0) {
      console.log(`[migrate-workspace-status] Workspace rows by status: (none)`)
    } else {
      const summary = res.rows
        .map((r) => `${r.status}=${r.n}`)
        .join(" ")
      console.log(`[migrate-workspace-status] Workspace rows by status: ${summary}`)
    }
  } catch (err) {
    console.error("[migrate-workspace-status] Post-check failed:", err)
    process.exitCode = 1
    return
  }

  console.log("[migrate-workspace-status] Done.")
}

main().catch((err) => {
  console.error("[migrate-workspace-status] Unhandled:", err)
  process.exitCode = 1
})
