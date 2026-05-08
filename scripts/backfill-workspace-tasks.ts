import "dotenv/config"
import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "@/generated/prisma/client"
import {
  mapInboxTodoToWorkspaceTaskData,
  type InboxTodoSourceRow,
} from "@modules/tasks/inbox-todo-mapping"

/**
 * Backfill: link every existing `InboxTodo` to a freshly-created
 * `WorkspaceTask` row.
 *
 * Pairs with the dual-write that PR 3 added to
 * `modules/inbox/todo-service.ts#createTodo`. Run order:
 *
 *   1) `npx tsx scripts/migrate-workspace-task.ts`        (PR 2)
 *   2) `npx tsx scripts/migrate-inbox-todo-link.ts`       (PR 3, this PR)
 *   3) Deploy the app (dual-write becomes live for new InboxTodo)
 *   4) `npx tsx scripts/backfill-workspace-tasks.ts`      (this script)
 *
 * Why a separate Prisma client (and not `@core/db`):
 * `@core/db` is a Next.js-runtime singleton that throws synchronously
 * if `DATABASE_URL` is missing AT IMPORT TIME. That's the right
 * behaviour for the runtime, but it makes the script harder to invoke
 * from CI / local with a `.env.local` override. We instantiate a
 * dedicated client here with the same adapter the runtime uses, so
 * connection semantics are identical without the import-time guard.
 *
 * Idempotency: the driver query is
 *   `WHERE workspaceTaskId IS NULL`
 * so any row mirrored by a prior pass is skipped. Per-row writes run
 * in their own transaction, so a failure on one row does not block
 * the others — the script is also safe to interrupt and re-run.
 *
 * Workspace safety: every WorkspaceTask insert copies `workspaceId`
 * straight from the originating InboxTodo. The query is not scoped
 * to a workspace by default — the script processes whatever the
 * connected DB contains — but each row's write is workspace-pinned
 * via the InboxTodo's own `workspaceId`. There is no path that
 * reassigns a row to a different tenant.
 *
 * Usage:
 *   npx tsx scripts/backfill-workspace-tasks.ts             # full run
 *   npx tsx scripts/backfill-workspace-tasks.ts --dry-run   # report only
 *   npx tsx scripts/backfill-workspace-tasks.ts --batch=200 # tune batch
 */

interface BackfillOptions {
  dryRun: boolean
  batchSize: number
}

function parseArgs(argv: string[]): BackfillOptions {
  let dryRun = false
  let batchSize = 100
  for (const arg of argv) {
    if (arg === "--dry-run" || arg === "--dry") {
      dryRun = true
    } else if (arg.startsWith("--batch=")) {
      const n = parseInt(arg.slice("--batch=".length), 10)
      if (!Number.isNaN(n) && n > 0) {
        batchSize = Math.min(500, n)
      }
    }
  }
  return { dryRun, batchSize }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
  const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN

  if (!url) {
    console.error("[backfill-workspace-tasks] Missing DATABASE_URL / TURSO_DATABASE_URL")
    process.exitCode = 1
    return
  }

  const adapter = new PrismaLibSql({ url, authToken })
  const db = new PrismaClient({ adapter })

  console.log(`[backfill-workspace-tasks] Connecting to: ${url.split("?")[0]}`)
  console.log(
    `[backfill-workspace-tasks] Mode: ${options.dryRun ? "DRY RUN (no writes)" : "live"}, batch=${options.batchSize}`,
  )

  /**
   * Top-level loop: keep pulling unbacked rows in batches until none
   * remain. Each batch is a fresh query so concurrent dual-writes
   * (from a live runtime) shrink the pending set automatically — the
   * script will simply see fewer rows next pass.
   */
  let totalProcessed = 0
  let totalSucceeded = 0
  let totalFailed = 0
  const failures: Array<{ id: string; error: string }> = []

  while (true) {
    const batch = await db.inboxTodo.findMany({
      where: { workspaceTaskId: null },
      orderBy: { createdAt: "asc" },
      take: options.batchSize,
    })

    if (batch.length === 0) {
      break
    }

    console.log(
      `[backfill-workspace-tasks] Pulled batch of ${batch.length} unbacked InboxTodo rows`,
    )

    for (const todo of batch) {
      totalProcessed += 1

      if (options.dryRun) {
        /** Dry run: build the mapping to surface any mapping bug
         *  without touching the DB, then move on. */
        try {
          mapInboxTodoToWorkspaceTaskData(todo as InboxTodoSourceRow)
          totalSucceeded += 1
        } catch (err) {
          totalFailed += 1
          failures.push({
            id: todo.id,
            error: err instanceof Error ? err.message : String(err),
          })
        }
        continue
      }

      try {
        /**
         * Per-row interactive transaction — same pattern as the
         * dual-write in `createTodo`. If either step fails, the
         * other is rolled back, leaving the row unbacked so the next
         * pass can retry it. We do NOT batch all rows in one giant
         * transaction: a single bad row would force the entire run
         * to rewind.
         */
        await db.$transaction(async (tx) => {
          /** Re-read inside the tx to avoid racing with the live
           *  dual-write — if the runtime back-linked this row in the
           *  microseconds between our query and our write, skip it. */
          const fresh = await tx.inboxTodo.findUnique({
            where: { id: todo.id },
          })
          if (!fresh || fresh.workspaceTaskId) {
            return
          }

          const taskData = mapInboxTodoToWorkspaceTaskData(fresh as InboxTodoSourceRow)
          const task = await tx.workspaceTask.create({ data: taskData })
          await tx.inboxTodo.update({
            where: { id: fresh.id },
            data: { workspaceTaskId: task.id },
          })
        })
        totalSucceeded += 1
      } catch (err) {
        totalFailed += 1
        failures.push({
          id: todo.id,
          error: err instanceof Error ? err.message : String(err),
        })
        console.error(`[backfill-workspace-tasks] FAIL · todo=${todo.id}`)
        console.error(err)
      }
    }

    if (batch.length < options.batchSize) {
      /** Last partial batch — no need for another query. */
      break
    }
  }

  console.log(
    `[backfill-workspace-tasks] Done. processed=${totalProcessed} succeeded=${totalSucceeded} failed=${totalFailed}`,
  )

  if (failures.length > 0) {
    console.error(
      `[backfill-workspace-tasks] First ${Math.min(10, failures.length)} failures:`,
    )
    for (const f of failures.slice(0, 10)) {
      console.error(`  · ${f.id} → ${f.error}`)
    }
    process.exitCode = 1
  }

  await db.$disconnect()
}

main().catch((err) => {
  console.error("[backfill-workspace-tasks] Unhandled:", err)
  process.exitCode = 1
})
