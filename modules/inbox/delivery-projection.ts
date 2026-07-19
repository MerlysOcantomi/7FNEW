/**
 * Delivery/read projection for Message rows (INBOX-DATA-04B) — THE state
 * machine every writer must go through (send routes, tracking routes,
 * future provider callbacks, backfills). No inline transitions anywhere.
 *
 * Semantics (approved design §5.2):
 *   - Monotonic rank: none < queued < sending < sent < delivered < read.
 *     A projection NEVER downgrades rank.
 *   - Failure states (failed | undeliverable | cancelled) are terminal and
 *     reachable only from pre-`delivered` states.
 *   - Timestamps are independent: a late `delivered` callback fills
 *     `deliveredAt` without touching an already-set `readAt` or the
 *     already-higher status (out-of-order receipts are expected).
 *   - `readSource` provenance: manual / provider_receipt outrank
 *     tracking_pixel. A stronger source may overwrite the provenance (and
 *     move `readAt` earlier when its evidence is earlier); a weaker source
 *     never downgrades a stronger one.
 */

export type DeliveryStatus =
  | "none"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "undeliverable"
  | "cancelled"

export type ReadSource = "provider_receipt" | "tracking_pixel" | "manual"

export interface DeliveryState {
  deliveryStatus: DeliveryStatus
  sentAt: Date | null
  deliveredAt: Date | null
  readAt: Date | null
  readSource: ReadSource | null
  failedAt: Date | null
  failureCode: string | null
}

export interface DeliveryEvent {
  type: "queued" | "sending" | "sent" | "delivered" | "read" | "failed" | "undeliverable" | "cancelled"
  at: Date
  /** Required for `read` events; ignored otherwise. */
  readSource?: ReadSource
  /** Stable machine code for failure events ("email_send_failed", …). */
  failureCode?: string
}

export const EMPTY_DELIVERY_STATE: DeliveryState = Object.freeze({
  deliveryStatus: "none",
  sentAt: null,
  deliveredAt: null,
  readAt: null,
  readSource: null,
  failedAt: null,
  failureCode: null,
})

const PROGRESS_RANK: Record<DeliveryStatus, number> = {
  none: 0,
  queued: 1,
  sending: 2,
  sent: 3,
  delivered: 4,
  read: 5,
  // Failure states carry no progress rank — handled separately.
  failed: -1,
  undeliverable: -1,
  cancelled: -1,
}

const FAILURE_STATES: ReadonlySet<DeliveryStatus> = new Set(["failed", "undeliverable", "cancelled"])

const READ_SOURCE_STRENGTH: Record<ReadSource, number> = {
  tracking_pixel: 1,
  provider_receipt: 2,
  manual: 2,
}

function isFailureEvent(type: DeliveryEvent["type"]): type is "failed" | "undeliverable" | "cancelled" {
  return type === "failed" || type === "undeliverable" || type === "cancelled"
}

/**
 * Apply one event to the current state. Returns the NEW state, or `null`
 * when the event changes nothing (idempotent re-delivery, weaker evidence,
 * illegal transition) — callers skip the write on `null`.
 */
export function projectDeliveryEvent(
  current: DeliveryState,
  event: DeliveryEvent,
): DeliveryState | null {
  const state = { ...current }
  let changed = false

  if (isFailureEvent(event.type)) {
    // Terminal failures: only from pre-delivered, non-failure states.
    if (FAILURE_STATES.has(current.deliveryStatus)) return null
    if (PROGRESS_RANK[current.deliveryStatus] >= PROGRESS_RANK.delivered) return null
    state.deliveryStatus = event.type
    state.failedAt = current.failedAt ?? event.at
    state.failureCode = event.failureCode ?? current.failureCode ?? null
    return state
  }

  // Progress events on a failed message: ignore (a retry creates fresh
  // projection via a new queued/sent cycle handled by the caller resetting
  // through this same helper only when the send path re-attempts — the
  // failure stays until a real `sent` succeeds).
  const eventRank = PROGRESS_RANK[event.type]
  const currentRank = PROGRESS_RANK[current.deliveryStatus]

  if (FAILURE_STATES.has(current.deliveryStatus)) {
    // A successful re-send supersedes a previous failure.
    if (event.type === "sent" || event.type === "sending" || event.type === "queued") {
      state.deliveryStatus = event.type
      if (event.type === "sent" && !state.sentAt) state.sentAt = event.at
      return state
    }
    return null
  }

  // Timestamps fill independently of rank (out-of-order callbacks).
  if (event.type === "sent" && !state.sentAt) {
    state.sentAt = event.at
    changed = true
  }
  if (event.type === "delivered" && !state.deliveredAt) {
    state.deliveredAt = event.at
    changed = true
  }
  if (event.type === "read") {
    const source = event.readSource
    if (!source) return null
    const currentStrength = state.readSource ? READ_SOURCE_STRENGTH[state.readSource] : 0
    const eventStrength = READ_SOURCE_STRENGTH[source]
    if (!state.readAt) {
      state.readAt = event.at
      state.readSource = source
      changed = true
    } else if (eventStrength > currentStrength) {
      // Stronger evidence upgrades provenance; earlier timestamp wins.
      state.readSource = source
      if (event.at < state.readAt) state.readAt = event.at
      changed = true
    } else if (eventStrength === currentStrength && event.at < state.readAt) {
      state.readAt = event.at
      changed = true
    }
  }

  // Status advances only forward.
  if (eventRank > currentRank) {
    state.deliveryStatus = event.type
    changed = true
  }

  return changed ? state : null
}
