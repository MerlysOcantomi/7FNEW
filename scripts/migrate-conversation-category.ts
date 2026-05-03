import "dotenv/config"
import { createClient } from "@libsql/client"

/**
 * One-shot migration: adds `Conversation.category` (TEXT, nullable)
 * + an index on the column to Turso/libSQL.
 *
 * Same pattern as `scripts/migrate-workspace-status.ts`:
 *   - PRAGMA-based idempotency check (libSQL has no `ADD COLUMN IF NOT
 *     EXISTS`).
 *   - Index uses `CREATE INDEX IF NOT EXISTS` so re-runs are silent.
 *
 * The column is intentionally NULLABLE and has NO default. Conversations
 * that already exist remain uncategorised after the migration; only the
 * operator action through `PATCH /api/inbox/conversations/[id]/category`
 * can set a value.
 *
 * Usage:
 *   npx tsx scripts/migrate-conversation-category.ts
 *
 * Required env (already used by the app):
 *   - DATABASE_URL          (libsql://... format; falls back to TURSO_DATABASE_URL)
 *   - DATABASE_AUTH_TOKEN   (required for Turso; falls back to TURSO_AUTH_TOKEN)
 */
async function main() {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

  if (!url) {
    console.error("[migrate-conversation-category] Missing DATABASE_URL / TURSO_DATABASE_URL")
    process.exitCode = 1
    return
  }

  const db = createClient({ url, authToken })

  console.log(`[migrate-conversation-category] Connecting to: ${url.split("?")[0]}`)

  /**
   * Step 1 — confirm `Conversation` exists and check whether `category`
   * is already there. We compare the column name case-insensitively as
   * a defensive measure even though libSQL/SQLite is case-sensitive for
   * identifiers in PRAGMA output.
   */
  let alreadyHasColumn = false
  try {
    const res = await db.execute(`PRAGMA table_info("Conversation")`)
    if (res.rows.length === 0) {
      console.error(
        '[migrate-conversation-category] Table "Conversation" not found. Aborting.',
      )
      process.exitCode = 1
      return
    }
    alreadyHasColumn = res.rows.some(
      (r) => String(r.name ?? "").toLowerCase() === "category",
    )
  } catch (err) {
    console.error("[migrate-conversation-category] PRAGMA failed:", err)
    process.exitCode = 1
    return
  }

  /**
   * Step 2 — ALTER (idempotent). Skipping when the column already
   * exists; otherwise we add it nullable so existing rows are valid
   * without backfill.
   */
  if (alreadyHasColumn) {
    console.log(`[migrate-conversation-category] OK · "category" column already exists, skipping ALTER`)
  } else {
    try {
      await db.execute(`ALTER TABLE "Conversation" ADD COLUMN "category" TEXT`)
      console.log(`[migrate-conversation-category] OK · ALTER TABLE … ADD COLUMN category`)
    } catch (err) {
      console.error("[migrate-conversation-category] FAIL · ALTER TABLE")
      console.error(err)
      process.exitCode = 1
      return
    }
  }

  /**
   * Step 3 — index. Always idempotent. Used to make the future
   * server-side `WHERE category = ?` filter scale linearly with
   * matching rows instead of full-scanning the table.
   */
  try {
    await db.execute(
      `CREATE INDEX IF NOT EXISTS "Conversation_workspaceId_category_idx" ON "Conversation"("workspaceId","category")`,
    )
    console.log(
      `[migrate-conversation-category] OK · CREATE INDEX IF NOT EXISTS Conversation_workspaceId_category_idx`,
    )
  } catch (err) {
    console.error("[migrate-conversation-category] FAIL · CREATE INDEX")
    console.error(err)
    process.exitCode = 1
    return
  }

  /**
   * Sanity check: count conversations by category. Confirms the column
   * is queryable on the same DB the runtime will use.
   */
  try {
    const res = await db.execute(
      `SELECT IFNULL("category",'(unset)') AS category, COUNT(*) AS n FROM "Conversation" GROUP BY "category" ORDER BY n DESC LIMIT 20`,
    )
    if (res.rows.length === 0) {
      console.log(`[migrate-conversation-category] Conversation rows by category: (none)`)
    } else {
      const summary = res.rows.map((r) => `${r.category}=${r.n}`).join(" ")
      console.log(`[migrate-conversation-category] Conversation rows by category: ${summary}`)
    }
  } catch (err) {
    console.error("[migrate-conversation-category] Post-check failed:", err)
    process.exitCode = 1
    return
  }

  console.log("[migrate-conversation-category] Done.")
}

main().catch((err) => {
  console.error("[migrate-conversation-category] Unhandled:", err)
  process.exitCode = 1
})
