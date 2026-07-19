/**
 * MessageAttachment writeback (INBOX-DATA-04B). Dual-write phase: the legacy
 * metadata `attachments` arrays keep being written by the ingestion paths
 * exactly as before; this service adds the normalized rows.
 *
 * Idempotent by construction: rows upsert on `[messageId, attachmentKey]`
 * (keys from `attachment-keys.ts`, frozen at creation), so webhook
 * redeliveries and re-runs never duplicate. Best-effort by contract —
 * callers must never let attachment persistence block message ingestion.
 */

import { db } from "@core/db"
import { attachmentKindFromMime, buildAttachmentKey } from "./attachment-keys"

export interface StoredAttachmentInput {
  filename?: string | null
  url?: string | null
  contentType?: string | null
  size?: number | null
  externalMediaId?: string | null
  externalUrl?: string | null
  caption?: string | null
  /** "stored" when bytes live in our storage; "external_only"/"pending_download" otherwise. */
  status?: string
}

export async function createMessageAttachments(options: {
  workspaceId: string
  messageId: string
  provider?: string | null
  attachments: readonly StoredAttachmentInput[]
}): Promise<number> {
  let created = 0
  for (const [position, att] of options.attachments.entries()) {
    const attachmentKey = buildAttachmentKey({
      provider: options.provider,
      externalMediaId: att.externalMediaId,
      storageKey: att.url,
      checksum: null,
      position,
    })
    const data = {
      workspaceId: options.workspaceId,
      messageId: options.messageId,
      kind: attachmentKindFromMime(att.contentType),
      fileName: att.filename ?? null,
      mimeType: att.contentType ?? null,
      sizeBytes: typeof att.size === "number" ? att.size : null,
      storageKey: att.url ?? null,
      externalUrl: att.externalUrl ?? null,
      provider: options.provider ?? null,
      externalMediaId: att.externalMediaId ?? null,
      caption: att.caption ?? null,
      status: att.status ?? (att.url ? "stored" : "external_only"),
      position,
      attachmentKey,
    }
    const result = await db.messageAttachment.upsert({
      where: {
        messageId_attachmentKey: { messageId: options.messageId, attachmentKey },
      },
      create: data,
      // Re-delivery of the same attachment refreshes mutable presentation
      // fields only; the key (identity) never changes.
      update: {
        position,
        ...(att.url ? { storageKey: att.url, status: att.status ?? "stored" } : {}),
      },
      select: { createdAt: true, updatedAt: true },
    })
    if (result.createdAt.getTime() === result.updatedAt.getTime()) created += 1
  }
  return created
}
