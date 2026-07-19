/**
 * INBOX-DATA-04B backfill 3/3 — MessageAttachment rows from the legacy
 * metadata `attachments` arrays (Resend inbound + composer outbound paths).
 *
 * Run: DATABASE_URL=... npx tsx scripts/backfill-message-attachments.ts
 *
 * Scope boundaries (approved design §8.3):
 *   - backfills ONLY already-stored references (metadata entries with a
 *     blob URL). Reference-less entries are unrecoverable history — we never
 *     invent files;
 *   - the IMAP ingestion fix for NEW mail shipped in 04B.3 (imap-sync.ts);
 *   - historical IMAP mail whose bytes were never stored produces no rows
 *     (optionally recoverable later by an explicit re-fetch-by-UID job).
 * Idempotent: upserts on [messageId, attachmentKey]; re-runs create zero.
 */

import { db } from "@core/db"
import { planAttachmentBackfillForMessage } from "@modules/inbox/backfill-planners"
import { createMessageAttachments } from "@modules/inbox/attachment-service"

const BATCH = 500

/** Dry-run mode: counts recoverable rows without writing. */
const DRY_RUN = process.env.INBOX_BACKFILL_DRY_RUN === "1" || process.argv.includes("--dry-run")

async function main() {
  const workspaces = await db.workspace.findMany({ select: { id: true } })
  let messagesSeen = 0
  let messagesWithAttachments = 0
  let rowsCreated = 0

  for (const ws of workspaces) {
    let cursor: string | undefined
    for (;;) {
      const messages = await db.message.findMany({
        // Only rows that can possibly carry the legacy array — cheap prefilter.
        where: { workspaceId: ws.id, metadata: { contains: "attachments" } },
        select: { id: true, metadata: true },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      })
      if (messages.length === 0) break
      cursor = messages[messages.length - 1].id

      for (const message of messages) {
        messagesSeen += 1
        const plan = planAttachmentBackfillForMessage(message)
        if (plan.length === 0) continue
        messagesWithAttachments += 1
        if (DRY_RUN) {
          const existing = await db.messageAttachment.count({ where: { messageId: message.id } })
          rowsCreated += Math.max(0, plan.length - existing)
          continue
        }
        rowsCreated += await createMessageAttachments({
          workspaceId: ws.id,
          messageId: message.id,
          provider: null,
          attachments: plan,
        })
      }
    }
  }

  console.warn(`[backfill:attachments] ${DRY_RUN ? "DRY-RUN (no writes)" : "done"}`, {
    workspaces: workspaces.length,
    candidateMessagesSeen: messagesSeen,
    messagesWithAttachments,
    rowsCreated,
  })
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill:attachments] FAILED:", err)
    process.exit(1)
  })
