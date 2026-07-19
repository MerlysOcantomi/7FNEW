/**
 * DB writeback for the Message delivery/read projection (INBOX-DATA-04B).
 * The ONLY way message delivery columns are written — every caller (send
 * routes, tracking routes, retries, future provider callbacks, backfills)
 * goes through `projectDeliveryEvent` from `delivery-projection.ts` so the
 * monotonic/no-downgrade rules hold everywhere.
 *
 * Dual-write phase: legacy metadata keys (`emailStatus`, `resendId`,
 * `openedAt`, …) keep being written by their existing call sites exactly as
 * before; this service only adds the normalized columns. Best-effort by
 * contract: a projection failure must never break sending or ingestion —
 * callers wrap in try/catch.
 */

import { db } from "@core/db"
import {
  projectDeliveryEvent,
  type DeliveryEvent,
  type DeliveryState,
  type DeliveryStatus,
  type ReadSource,
} from "./delivery-projection"

/** Load → project → persist one event. Returns true when a write happened. */
export async function applyDeliveryEventToMessage(
  messageId: string,
  event: DeliveryEvent,
): Promise<boolean> {
  const message = await db.message.findUnique({
    where: { id: messageId },
    select: {
      id: true,
      deliveryStatus: true,
      sentAt: true,
      deliveredAt: true,
      readAt: true,
      readSource: true,
      failedAt: true,
      failureCode: true,
    },
  })
  if (!message) return false
  const current: DeliveryState = {
    deliveryStatus: message.deliveryStatus as DeliveryStatus,
    sentAt: message.sentAt,
    deliveredAt: message.deliveredAt,
    readAt: message.readAt,
    readSource: message.readSource as ReadSource | null,
    failedAt: message.failedAt,
    failureCode: message.failureCode,
  }
  const next = projectDeliveryEvent(current, event)
  if (!next) return false
  await db.message.update({
    where: { id: messageId },
    data: {
      deliveryStatus: next.deliveryStatus,
      sentAt: next.sentAt,
      deliveredAt: next.deliveredAt,
      readAt: next.readAt,
      readSource: next.readSource,
      failedAt: next.failedAt,
      failureCode: next.failureCode,
      deliveryUpdatedAt: new Date(),
    },
  })
  return true
}

/**
 * Convenience for the outbound send/retry writebacks: projects sent/failed
 * and dual-writes the provider-assigned id into `sourceMessageId` (the
 * both-directions provider id — metadata keeps `resendId` as before).
 */
export async function recordOutboundSendResult(options: {
  messageId: string
  ok: boolean
  providerMessageId?: string | null
  failureCode?: string
  at?: Date
}): Promise<void> {
  const at = options.at ?? new Date()
  if (options.ok && options.providerMessageId) {
    await db.message.update({
      where: { id: options.messageId },
      data: { sourceMessageId: options.providerMessageId },
    })
  }
  await applyDeliveryEventToMessage(options.messageId, {
    type: options.ok ? "sent" : "failed",
    at,
    ...(options.ok ? {} : { failureCode: options.failureCode ?? "email_send_failed" }),
  })
}
