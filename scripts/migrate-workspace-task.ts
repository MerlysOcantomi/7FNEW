import "dotenv/config"
import { createClient } from "@libsql/client"

/**
 * One-shot migration: creates the `WorkspaceTask` table + indexes in
 * Turso/libSQL.
 *
 * Same pattern as `scripts/migrate-platform-admin.ts` and
 * `scripts/migrate-platform-audit-log.ts` — `prisma.config.ts` pins
 * `prisma db push` to the local `dev.db`, so this script is the
 * production counterpart that targets the actual remote DB.
 *
 * Idempotent: every statement uses `IF NOT EXISTS`. Safe to re-run.
 *
 * This migration is purely additive. PR 2 introduces the model
 * skeleton only; nothing reads from or writes to `WorkspaceTask` yet.
 * `InboxTodo` and `Tarea` remain untouched.
 *
 * Usage:
 *   npx tsx scripts/migrate-workspace-task.ts
 *
 * Required env (already used by the app):
 *   - DATABASE_URL          (libsql://... format; falls back to TURSO_DATABASE_URL)
 *   - DATABASE_AUTH_TOKEN   (required for Turso, optional for local file URLs)
 */
async function main() {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

  if (!url) {
    console.error("[migrate-workspace-task] Missing DATABASE_URL / TURSO_DATABASE_URL")
    process.exitCode = 1
    return
  }

  const db = createClient({ url, authToken })

  console.log(`[migrate-workspace-task] Connecting to: ${url.split("?")[0]}`)

  /**
   * Mirror of the schema (see `model WorkspaceTask` in
   * `prisma/schema.prisma`). The only FK is on `workspaceId`; all
   * source/link fields are nullable scalar IDs without FK constraints
   * so deleting a source record (conversation, message, client, etc.)
   * never cascades into the task row. The audit trail outlives the
   * source — same rationale documented on `InboxTodo`.
   */
  const stmts = [
    `CREATE TABLE IF NOT EXISTS "WorkspaceTask" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "title" TEXT NOT NULL,
      "description" TEXT,
      "status" TEXT NOT NULL DEFAULT 'open',
      "priority" TEXT NOT NULL DEFAULT 'normal',
      "assigneeType" TEXT NOT NULL DEFAULT 'unassigned',
      "assigneeId" TEXT,
      "dueAt" DATETIME,
      "remindAt" DATETIME,
      "completedAt" DATETIME,
      "completedBy" TEXT,
      "dismissedAt" DATETIME,
      "dismissedReason" TEXT,
      "sourceType" TEXT,
      "sourceId" TEXT,
      "sourceLabel" TEXT,
      "conversationId" TEXT,
      "messageId" TEXT,
      "conversationActionId" TEXT,
      "clienteId" TEXT,
      "proyectoId" TEXT,
      "eventoId" TEXT,
      "tareaId" TEXT,
      "createdBy" TEXT NOT NULL,
      "suggestedBy" TEXT,
      "executionMode" TEXT,
      "metadata" TEXT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL,
      CONSTRAINT "WorkspaceTask_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )`,
    `CREATE INDEX IF NOT EXISTS "WorkspaceTask_workspaceId_status_idx" ON "WorkspaceTask"("workspaceId", "status")`,
    `CREATE INDEX IF NOT EXISTS "WorkspaceTask_workspaceId_dueAt_idx" ON "WorkspaceTask"("workspaceId", "dueAt")`,
    `CREATE INDEX IF NOT EXISTS "WorkspaceTask_workspaceId_assigneeId_idx" ON "WorkspaceTask"("workspaceId", "assigneeId")`,
    `CREATE INDEX IF NOT EXISTS "WorkspaceTask_workspaceId_sourceType_sourceId_idx" ON "WorkspaceTask"("workspaceId", "sourceType", "sourceId")`,
    `CREATE INDEX IF NOT EXISTS "WorkspaceTask_workspaceId_conversationId_idx" ON "WorkspaceTask"("workspaceId", "conversationId")`,
    `CREATE INDEX IF NOT EXISTS "WorkspaceTask_workspaceId_proyectoId_idx" ON "WorkspaceTask"("workspaceId", "proyectoId")`,
    `CREATE INDEX IF NOT EXISTS "WorkspaceTask_workspaceId_tareaId_idx" ON "WorkspaceTask"("workspaceId", "tareaId")`,
  ]

  for (const sql of stmts) {
    const summary = sql.split("\n")[0].trim()
    try {
      await db.execute(sql)
      console.log(`[migrate-workspace-task] OK · ${summary}`)
    } catch (err) {
      console.error(`[migrate-workspace-task] FAIL · ${summary}`)
      console.error(err)
      process.exitCode = 1
      return
    }
  }

  /**
   * Sanity check — confirms the migration landed on the same DB the
   * runtime will hit. Row count is fine to print: the table is empty
   * by design in PR 2 (no writers wired up yet).
   */
  try {
    const res = await db.execute(`SELECT COUNT(*) as n FROM "WorkspaceTask"`)
    const n = Number(res.rows[0]?.n ?? 0)
    console.log(`[migrate-workspace-task] WorkspaceTask rows: ${n}`)
  } catch (err) {
    console.error("[migrate-workspace-task] Post-check failed:", err)
    process.exitCode = 1
    return
  }

  console.log("[migrate-workspace-task] Done.")
}

main().catch((err) => {
  console.error("[migrate-workspace-task] Unhandled:", err)
  process.exitCode = 1
})
