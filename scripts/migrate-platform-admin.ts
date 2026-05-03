import "dotenv/config"
import { createClient } from "@libsql/client"

/**
 * One-shot migration: creates the `PlatformAdmin` table in Turso/libSQL.
 *
 * This is the production counterpart of `npx prisma db push` (which our
 * `prisma.config.ts` hardcodes to `file:./dev.db`). It uses `@libsql/client`
 * directly so it can target the same remote DB the runtime uses.
 *
 * Idempotent: safe to run multiple times. Reads `DATABASE_URL` /
 * `DATABASE_AUTH_TOKEN` (or `TURSO_*` aliases) from `.env` exactly like
 * `core/db.ts`.
 *
 * Usage:
 *   npx tsx scripts/migrate-platform-admin.ts
 *
 * Required env (already used by the app):
 *   - DATABASE_URL          (libsql://... format)
 *   - DATABASE_AUTH_TOKEN   (optional for local file URLs, required for Turso)
 */
async function main() {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

  if (!url) {
    console.error("[migrate-platform-admin] Missing DATABASE_URL / TURSO_DATABASE_URL")
    process.exitCode = 1
    return
  }

  const db = createClient({ url, authToken })

  console.log(`[migrate-platform-admin] Connecting to: ${url.split("?")[0]}`)

  /**
   * Mirror of what Prisma would generate for SQLite/libSQL given our schema:
   *
   *   model PlatformAdmin {
   *     id        String   @id @default(cuid())
   *     userId    String   @unique
   *     user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
   *     role      String   @default("SUPPORT")
   *     createdAt DateTime @default(now())
   *     createdBy String?
   *   }
   */
  const stmts = [
    `CREATE TABLE IF NOT EXISTS "PlatformAdmin" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "userId" TEXT NOT NULL,
      "role" TEXT NOT NULL DEFAULT 'SUPPORT',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "createdBy" TEXT,
      CONSTRAINT "PlatformAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "PlatformAdmin_userId_key" ON "PlatformAdmin"("userId")`,
  ]

  for (const sql of stmts) {
    const summary = sql.split("\n")[0].trim()
    try {
      await db.execute(sql)
      console.log(`[migrate-platform-admin] OK · ${summary}`)
    } catch (err) {
      console.error(`[migrate-platform-admin] FAIL · ${summary}`)
      console.error(err)
      process.exitCode = 1
      return
    }
  }

  /**
   * Sanity check: verify the table is reachable and report row count.
   * Confirms the migration landed on the same DB the runtime will hit.
   */
  try {
    const res = await db.execute(`SELECT COUNT(*) as n FROM "PlatformAdmin"`)
    const n = Number(res.rows[0]?.n ?? 0)
    console.log(`[migrate-platform-admin] PlatformAdmin rows: ${n}`)
  } catch (err) {
    console.error("[migrate-platform-admin] Post-check failed:", err)
    process.exitCode = 1
    return
  }

  console.log("[migrate-platform-admin] Done.")
}

main().catch((err) => {
  console.error("[migrate-platform-admin] Unhandled:", err)
  process.exitCode = 1
})
