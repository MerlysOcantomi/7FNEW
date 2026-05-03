import "dotenv/config"
import { createClient } from "@libsql/client"

/**
 * One-shot migration: creates the `PlatformAuditLog` table + indexes in
 * Turso/libSQL.
 *
 * Same pattern as `scripts/migrate-platform-admin.ts` — `prisma.config.ts`
 * pins `prisma db push` to the local `dev.db`, so this script is the
 * production counterpart that targets the actual remote DB.
 *
 * Idempotent: every statement uses `IF NOT EXISTS`. Safe to re-run.
 *
 * Usage:
 *   npx tsx scripts/migrate-platform-audit-log.ts
 *
 * Required env (already used by the app):
 *   - DATABASE_URL          (libsql://... format; falls back to TURSO_DATABASE_URL)
 *   - DATABASE_AUTH_TOKEN   (required for Turso, optional for local file URLs)
 */
async function main() {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

  if (!url) {
    console.error("[migrate-platform-audit-log] Missing DATABASE_URL / TURSO_DATABASE_URL")
    process.exitCode = 1
    return
  }

  const db = createClient({ url, authToken })

  console.log(`[migrate-platform-audit-log] Connecting to: ${url.split("?")[0]}`)

  /**
   * Mirror of the schema (see `model PlatformAuditLog` in `prisma/schema.prisma`).
   *
   * No FK on `actorId` — see schema comment. Indexes match the four read
   * patterns we expect on the audit page (by actor, by action, by target,
   * by recency).
   */
  const stmts = [
    `CREATE TABLE IF NOT EXISTS "PlatformAuditLog" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "actorId" TEXT NOT NULL,
      "action" TEXT NOT NULL,
      "targetType" TEXT NOT NULL,
      "targetId" TEXT NOT NULL,
      "metadata" TEXT,
      "ip" TEXT,
      "userAgent" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE INDEX IF NOT EXISTS "PlatformAuditLog_actorId_idx" ON "PlatformAuditLog"("actorId")`,
    `CREATE INDEX IF NOT EXISTS "PlatformAuditLog_action_idx" ON "PlatformAuditLog"("action")`,
    `CREATE INDEX IF NOT EXISTS "PlatformAuditLog_targetType_targetId_idx" ON "PlatformAuditLog"("targetType", "targetId")`,
    `CREATE INDEX IF NOT EXISTS "PlatformAuditLog_createdAt_idx" ON "PlatformAuditLog"("createdAt")`,
  ]

  for (const sql of stmts) {
    const summary = sql.split("\n")[0].trim()
    try {
      await db.execute(sql)
      console.log(`[migrate-platform-audit-log] OK · ${summary}`)
    } catch (err) {
      console.error(`[migrate-platform-audit-log] FAIL · ${summary}`)
      console.error(err)
      process.exitCode = 1
      return
    }
  }

  /**
   * Sanity check — confirms the migration landed on the same DB the runtime
   * will hit. Row count is fine to print: the audit table is internal
   * platform metadata, not tenant content.
   */
  try {
    const res = await db.execute(`SELECT COUNT(*) as n FROM "PlatformAuditLog"`)
    const n = Number(res.rows[0]?.n ?? 0)
    console.log(`[migrate-platform-audit-log] PlatformAuditLog rows: ${n}`)
  } catch (err) {
    console.error("[migrate-platform-audit-log] Post-check failed:", err)
    process.exitCode = 1
    return
  }

  console.log("[migrate-platform-audit-log] Done.")
}

main().catch((err) => {
  console.error("[migrate-platform-audit-log] Unhandled:", err)
  process.exitCode = 1
})
