import "dotenv/config"
import { createClient } from "@libsql/client"

/**
 * One-shot migration: adds `InboxTodo.workspaceTaskId` (nullable) and
 * the `[workspaceId, workspaceTaskId]` index in Turso/libSQL.
 *
 * Same pattern as `scripts/migrate-platform-admin.ts` /
 * `scripts/migrate-workspace-task.ts` — `prisma.config.ts` pins
 * `prisma db push` to the local `dev.db`, so this script is the
 * production counterpart that targets the actual remote DB.
 *
 * Idempotent:
 *   - `ALTER TABLE ADD COLUMN` is wrapped in try/catch and treats
 *     "duplicate column" as success (matching the convention in
 *     `prisma/push-turso.ts`).
 *   - `CREATE INDEX IF NOT EXISTS` is naturally idempotent.
 *
 * Pairs with `scripts/migrate-workspace-task.ts` (PR 2) and
 * `scripts/backfill-workspace-tasks.ts` (PR 3). Apply order:
 *   1) migrate-workspace-task (table)
 *   2) migrate-inbox-todo-link (this column)
 *   3) Deploy app (dual-write goes live for new InboxTodo rows)
 *   4) backfill-workspace-tasks (back-link historical rows)
 *
 * Usage:
 *   npx tsx scripts/migrate-inbox-todo-link.ts
 *
 * Required env (already used by the app):
 *   - DATABASE_URL          (libsql://... format; falls back to TURSO_DATABASE_URL)
 *   - DATABASE_AUTH_TOKEN   (required for Turso, optional for local file URLs)
 */
async function main() {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

  if (!url) {
    console.error("[migrate-inbox-todo-link] Missing DATABASE_URL / TURSO_DATABASE_URL")
    process.exitCode = 1
    return
  }

  const db = createClient({ url, authToken })

  console.log(`[migrate-inbox-todo-link] Connecting to: ${url.split("?")[0]}`)

  /**
   * `ADD COLUMN` requires special handling under sqlite/libSQL: there
   * is no `IF NOT EXISTS` clause for ADD COLUMN, so we run it and
   * tolerate the duplicate-column error. This mirrors the
   * `alterColumns` loop in `prisma/push-turso.ts`.
   */
  try {
    await db.execute(`ALTER TABLE "InboxTodo" ADD COLUMN "workspaceTaskId" TEXT`)
    console.log(`[migrate-inbox-todo-link] OK · ALTER TABLE InboxTodo ADD COLUMN workspaceTaskId`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes("duplicate column") || msg.includes("already exists")) {
      console.log(`[migrate-inbox-todo-link] SKIP · workspaceTaskId already exists`)
    } else {
      console.error(`[migrate-inbox-todo-link] FAIL · ALTER TABLE InboxTodo ADD COLUMN workspaceTaskId`)
      console.error(err)
      process.exitCode = 1
      return
    }
  }

  const indexStmts = [
    `CREATE INDEX IF NOT EXISTS "InboxTodo_workspaceId_workspaceTaskId_idx" ON "InboxTodo"("workspaceId", "workspaceTaskId")`,
  ]

  for (const sql of indexStmts) {
    const summary = sql.split("\n")[0].trim()
    try {
      await db.execute(sql)
      console.log(`[migrate-inbox-todo-link] OK · ${summary}`)
    } catch (err) {
      console.error(`[migrate-inbox-todo-link] FAIL · ${summary}`)
      console.error(err)
      process.exitCode = 1
      return
    }
  }

  /**
   * Sanity check — make sure we can query the new column on the same
   * DB the runtime will hit. Prints the count of unbacked rows so it
   * doubles as a "how big is the backfill?" preview.
   */
  try {
    const res = await db.execute(
      `SELECT COUNT(*) as n FROM "InboxTodo" WHERE "workspaceTaskId" IS NULL`,
    )
    const n = Number(res.rows[0]?.n ?? 0)
    console.log(`[migrate-inbox-todo-link] InboxTodo rows pending backfill: ${n}`)
  } catch (err) {
    console.error("[migrate-inbox-todo-link] Post-check failed:", err)
    process.exitCode = 1
    return
  }

  console.log("[migrate-inbox-todo-link] Done.")
}

main().catch((err) => {
  console.error("[migrate-inbox-todo-link] Unhandled:", err)
  process.exitCode = 1
})
