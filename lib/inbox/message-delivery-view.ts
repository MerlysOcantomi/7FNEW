/**
 * Central read-with-fallback helpers for message delivery state and
 * attachments (INBOX-DATA-04B, rollout step 5).
 *
 * Readers must (1) prefer the normalized columns written by the dual-write
 * paths, (2) fall back to the legacy metadata keys for rows that predate the
 * migration/backfill, and (3) keep that fallback in ONE grep-able place —
 * this module — instead of duplicating parsing in components. When the
 * fallback is eventually removed (a later mission), only this file changes.
 */

export interface MessageDeliveryLike {
  deliveryStatus?: string | null
  sentAt?: string | Date | null
  readAt?: string | Date | null
  readSource?: string | null
  failureCode?: string | null
  metadata?: string | Record<string, unknown> | null
}

export interface MessageDeliveryView {
  /** Normalized status ("none" when nothing is known). */
  status: string
  failed: boolean
  /** Read evidence timestamp (ISO string) and its provenance. */
  readAt: string | null
  readSource: "provider_receipt" | "tracking_pixel" | "manual" | null
  /** Pixel heuristics (proxy prefetch / suspect UA) — metadata-only signals. */
  readSuspect: boolean
  /** Most recent open for display ("Opened · {time}"), pixel-based. */
  lastOpenedAt: string | null
}

function parseMetadata(metadata: MessageDeliveryLike["metadata"]): Record<string, unknown> {
  if (!metadata) return {}
  if (typeof metadata === "object") return metadata
  try {
    const parsed = JSON.parse(metadata)
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  } catch {
    return {}
  }
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  return value
}

const READ_SOURCES = new Set(["provider_receipt", "tracking_pixel", "manual"])

export function getMessageDeliveryView(message: MessageDeliveryLike): MessageDeliveryView {
  const meta = parseMetadata(message.metadata)
  const metaOpenedAt = typeof meta.openedAt === "string" ? meta.openedAt : null
  const metaLastOpenedAt = typeof meta.lastOpenedAt === "string" ? meta.lastOpenedAt : null
  const metaConfirmedAt = typeof meta.confirmedReadAt === "string" ? meta.confirmedReadAt : null
  const readSuspect = meta.openProxy === true || meta.openSuspect === true

  // 1) Normalized columns win whenever the projection has run.
  const columnStatus = message.deliveryStatus
  if (columnStatus && columnStatus !== "none") {
    const readSource =
      message.readSource && READ_SOURCES.has(message.readSource)
        ? (message.readSource as MessageDeliveryView["readSource"])
        : null
    return {
      status: columnStatus,
      failed:
        columnStatus === "failed" ||
        columnStatus === "undeliverable" ||
        columnStatus === "cancelled",
      readAt: toIso(message.readAt),
      readSource,
      readSuspect,
      lastOpenedAt: metaLastOpenedAt ?? metaOpenedAt ?? toIso(message.readAt),
    }
  }

  // 2) Legacy metadata fallback (rows predating dual-write/backfill).
  const emailStatus = typeof meta.emailStatus === "string" ? meta.emailStatus : null
  if (metaConfirmedAt) {
    return {
      status: "read",
      failed: false,
      readAt: metaConfirmedAt,
      readSource: "manual",
      readSuspect,
      lastOpenedAt: metaLastOpenedAt ?? metaOpenedAt ?? metaConfirmedAt,
    }
  }
  if (metaOpenedAt) {
    return {
      status: "read",
      failed: false,
      readAt: metaOpenedAt,
      readSource: "tracking_pixel",
      readSuspect,
      lastOpenedAt: metaLastOpenedAt ?? metaOpenedAt,
    }
  }
  if (emailStatus === "failed") {
    return { status: "failed", failed: true, readAt: null, readSource: null, readSuspect, lastOpenedAt: null }
  }
  if (emailStatus === "sent") {
    return { status: "sent", failed: false, readAt: null, readSource: null, readSuspect, lastOpenedAt: null }
  }
  if (emailStatus === "pending") {
    return { status: "queued", failed: false, readAt: null, readSource: null, readSuspect, lastOpenedAt: null }
  }
  return { status: "none", failed: false, readAt: null, readSource: null, readSuspect, lastOpenedAt: null }
}

// ── Attachments ─────────────────────────────────────────────────────────────

export interface MessageAttachmentView {
  filename: string
  url: string
  contentType: string
  size?: number
}

interface MessageAttachmentRowLike {
  fileName?: string | null
  storageKey?: string | null
  externalUrl?: string | null
  mimeType?: string | null
  sizeBytes?: number | null
  position?: number
}

/**
 * Prefer relational MessageAttachment rows (ordered by position); fall back
 * to the legacy metadata `attachments` array for historical rows.
 */
export function getMessageAttachmentsView(message: {
  attachments?: readonly MessageAttachmentRowLike[] | null
  metadata?: string | Record<string, unknown> | null
}): MessageAttachmentView[] {
  const rows = message.attachments
  if (Array.isArray(rows) && rows.length > 0) {
    return [...rows]
      .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
      .map((row) => ({
        filename: row.fileName ?? "file",
        url: row.storageKey ?? row.externalUrl ?? "",
        contentType: row.mimeType ?? "application/octet-stream",
        ...(typeof row.sizeBytes === "number" ? { size: row.sizeBytes } : {}),
      }))
      .filter((att) => att.url.length > 0)
  }
  const meta = parseMetadata(message.metadata)
  if (Array.isArray(meta.attachments)) {
    return (meta.attachments as MessageAttachmentView[]).filter(
      (att) => att && typeof att.url === "string" && att.url.length > 0,
    )
  }
  return []
}
