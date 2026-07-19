/**
 * attachmentKey builder (INBOX-DATA-04B) — the single place that computes
 * the idempotency anchor for `MessageAttachment` rows.
 *
 * Tiered derivation (approved design §6), first available wins; the key is
 * computed ONCE at row creation and NEVER recomputed afterwards (a
 * provisional row that later gains a storageKey/checksum keeps its key and
 * only fills the columns):
 *   1. `media:<provider>:<externalMediaId>` — per-instance unique at source.
 *   2. `store:<storageKey>` — per-instance unique in our storage.
 *   3. `sha256:<checksum>#<position>` — a checksum alone is NOT unique when
 *      the same file is attached twice intentionally; the creation-time
 *      position disambiguates.
 *   4. `pos:<position>` — deterministic fallback for single-shot sources
 *      (metadata-array backfills) with nothing better.
 * `position` itself remains presentation-only and mutable.
 */

export interface AttachmentKeyInput {
  provider?: string | null
  externalMediaId?: string | null
  storageKey?: string | null
  checksum?: string | null
  /** Creation-time position — only participates in tiers 3 and 4. */
  position: number
}

export function buildAttachmentKey(input: AttachmentKeyInput): string {
  const externalMediaId = input.externalMediaId?.trim()
  if (externalMediaId) {
    const provider = input.provider?.trim() || "unknown"
    return `media:${provider}:${externalMediaId}`
  }
  const storageKey = input.storageKey?.trim()
  if (storageKey) {
    return `store:${storageKey}`
  }
  const checksum = input.checksum?.trim()
  if (checksum) {
    return `sha256:${checksum}#${input.position}`
  }
  return `pos:${input.position}`
}

/** Coarse logical kind from a MIME type (registry-honest, no guessing). */
export function attachmentKindFromMime(mimeType: string | null | undefined): string {
  const mime = mimeType?.trim().toLowerCase() ?? ""
  if (mime.startsWith("image/")) return "image"
  if (mime.startsWith("video/")) return "video"
  if (mime.startsWith("audio/")) return "audio"
  return "file"
}
