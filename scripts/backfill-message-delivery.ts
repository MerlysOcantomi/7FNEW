/**
 * INBOX-DATA-04B backfill 2/3 — Message delivery/read projection from the
 * legacy metadata keys (emailStatus / emailAttemptedAt / openedAt /
 * confirmedReadAt / resendId).
 *
 * Run: DATABASE_URL=... npx tsx scripts/backfill-message-delivery.ts
 *
 * Conservative and idempotent: plans come from the pure planner (no signal
 * → no write), every event runs through the shared monotonic projection
 * (already-projected rows no-op), and `sourceMessageId` is only filled when
 * still empty. Re-runs report zero changes.
 */

import { db } from "@core/db"
import { planDeliveryBackfillForMessage } from "@modules/inbox/backfill-planners"
import { applyDeliveryEventToMessage } from "@modules/inbox/delivery-service"

const BATCH = 500

async function main() {
  const workspaces = await db.workspace.findMany({ select: { id: true } })
  let messagesSeen = 0
  let messagesProjected = 0
  let sourceIdsFilled = 0
  const statusCounts: Record<string, number> = {}

  for (const ws of workspaces) {
    let cursor: string | undefined
    for (;;) {
      const messages = await db.message.findMany({
        where: { workspaceId: ws.id, direction: "outbound", isInternal: false },
        select: {
          id: true,
          direction: true,
          isInternal: true,
          createdAt: true,
          sourceMessageId: true,
          metadata: true,
          deliveryStatus: true,
        },
        orderBy: { id: "asc" },
        take: BATCH,
        ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      })
      if (messages.length === 0) break
      cursor = messages[messages.length - 1].id

      for (const message of messages) {
        messagesSeen += 1
        const plan = planDeliveryBackfillForMessage(message)
        if (plan.sourceMessageId) {
          await db.message.update({
            where: { id: message.id },
            data: { sourceMessageId: plan.sourceMessageId },
          })
          sourceIdsFilled += 1
        }
        let changed = false
        for (const event of plan.events) {
          const applied = await applyDeliveryEventToMessage(message.id, event)
          changed = changed || applied
        }
        if (changed) {
          messagesProjected += 1
          const updated = await db.message.findUnique({
            where: { id: message.id },
            select: { deliveryStatus: true },
          })
          const status = updated?.deliveryStatus ?? "?"
          statusCounts[status] = (statusCounts[status] ?? 0) + 1
        }
      }
    }
  }

  console.warn("[backfill:delivery] done", {
    workspaces: workspaces.length,
    outboundMessagesSeen: messagesSeen,
    messagesProjected,
    sourceIdsFilled,
    projectedStatusCounts: statusCounts,
  })
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill:delivery] FAILED:", err)
    process.exit(1)
  })
