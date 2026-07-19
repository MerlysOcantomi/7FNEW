/**
 * Pure planners for the INBOX-DATA-04B backfills. Each planner maps ONE
 * existing row to the writes its backfill script should perform — no DB, no
 * clock, fully unit-testable, and conservative by design: when the signal
 * is insufficient the plan is empty (never guess).
 *
 * Idempotency lives one layer down: identity writes upsert on the routing
 * key, attachment writes upsert on [messageId, attachmentKey], and delivery
 * events run through `projectDeliveryEvent`, which no-ops when the stored
 * state already covers the evidence. Re-running a backfill therefore plans
 * the same writes and they all collapse to no-ops.
 */

import type { DeliveryEvent } from "./delivery-projection"
import {
  buildIdentityDescriptor,
  type IdentityDescriptor,
} from "./identity-resolution"
import type { StoredAttachmentInput } from "./attachment-service"

// ── Identities (from Contact card values) ───────────────────────────────────

export interface IdentityBackfillPlanEntry {
  descriptor: IdentityDescriptor
  displayValue: string | null
  /** Normalization flags recorded on first insert (e.g. partial phone). */
  metadata: Record<string, unknown> | null
}

export function planIdentityBackfillForContact(contact: {
  email?: string | null
  telefono?: string | null
  nombre?: string | null
}): IdentityBackfillPlanEntry[] {
  const plans: IdentityBackfillPlanEntry[] = []
  if (contact.email) {
    const descriptor = buildIdentityDescriptor({
      channel: "email",
      kind: "email",
      rawValue: contact.email,
    })
    if (descriptor) {
      plans.push({ descriptor, displayValue: contact.email.trim(), metadata: null })
    }
  }
  if (contact.telefono) {
    const descriptor = buildIdentityDescriptor({
      channel: "sms",
      kind: "phone",
      rawValue: contact.telefono,
      // NO default country: the backfill never invents one (approved policy).
    })
    if (descriptor) {
      plans.push({
        descriptor,
        displayValue: contact.telefono.trim(),
        metadata: descriptor.externalKey.startsWith("+") ? null : { normalization: "partial" },
      })
    }
  }
  return plans
}

// ── Delivery (from legacy Message.metadata) ─────────────────────────────────

export interface DeliveryBackfillPlan {
  events: DeliveryEvent[]
  /** Historical outbound provider id to project into sourceMessageId. */
  sourceMessageId: string | null
}

const EMPTY_DELIVERY_PLAN: DeliveryBackfillPlan = { events: [], sourceMessageId: null }

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

export function planDeliveryBackfillForMessage(message: {
  direction: string
  isInternal: boolean
  createdAt: Date
  sourceMessageId?: string | null
  metadata: string | null
}): DeliveryBackfillPlan {
  // Inbound and internal messages carry no outbound delivery semantics.
  if (message.direction !== "outbound" || message.isInternal) return EMPTY_DELIVERY_PLAN
  if (!message.metadata) return EMPTY_DELIVERY_PLAN
  let meta: Record<string, unknown>
  try {
    const parsed = JSON.parse(message.metadata)
    if (!parsed || typeof parsed !== "object") return EMPTY_DELIVERY_PLAN
    meta = parsed as Record<string, unknown>
  } catch {
    return EMPTY_DELIVERY_PLAN
  }

  const events: DeliveryEvent[] = []
  const attemptedAt = parseDate(meta.emailAttemptedAt) ?? message.createdAt
  const emailStatus = typeof meta.emailStatus === "string" ? meta.emailStatus : null

  if (emailStatus === "sent") {
    events.push({ type: "sent", at: attemptedAt })
  } else if (emailStatus === "failed") {
    events.push({ type: "failed", at: attemptedAt, failureCode: "email_send_failed" })
  } else if (emailStatus === "pending") {
    // Conservative: a stale pending is still "queued" — we never guess that
    // a send actually happened without evidence.
    events.push({ type: "queued", at: message.createdAt })
  }

  const openedAt = parseDate(meta.openedAt)
  if (openedAt) {
    events.push({ type: "read", at: openedAt, readSource: "tracking_pixel" })
  }
  const confirmedAt = parseDate(meta.confirmedReadAt)
  if (confirmedAt) {
    events.push({ type: "read", at: confirmedAt, readSource: "manual" })
  }

  const resendId = typeof meta.resendId === "string" && meta.resendId ? meta.resendId : null
  const sourceMessageId = !message.sourceMessageId && resendId ? resendId : null

  return { events, sourceMessageId }
}

// ── Attachments (from legacy metadata arrays) ───────────────────────────────

export function planAttachmentBackfillForMessage(message: {
  metadata: string | null
}): StoredAttachmentInput[] {
  if (!message.metadata) return []
  let meta: Record<string, unknown>
  try {
    const parsed = JSON.parse(message.metadata)
    if (!parsed || typeof parsed !== "object") return []
    meta = parsed as Record<string, unknown>
  } catch {
    return []
  }
  if (!Array.isArray(meta.attachments)) return []
  const out: StoredAttachmentInput[] = []
  for (const raw of meta.attachments) {
    if (!raw || typeof raw !== "object") continue
    const att = raw as Record<string, unknown>
    const url = typeof att.url === "string" && att.url ? att.url : null
    // Reference-only entries without a URL are unrecoverable historical data
    // — we do not invent files (approved policy).
    if (!url) continue
    out.push({
      filename: typeof att.filename === "string" ? att.filename : null,
      url,
      contentType: typeof att.contentType === "string" ? att.contentType : null,
      size: typeof att.size === "number" ? att.size : null,
      status: "stored",
    })
  }
  return out
}
