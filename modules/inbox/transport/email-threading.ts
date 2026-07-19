/**
 * RFC 5322 threading helpers for the EmailTransport (INBOX-TRANSPORT-05).
 * Pure — fixes the audit debt "outbound email sets no In-Reply-To/References
 * headers" by deriving them from the inbound message metadata the ingestion
 * paths already persist (`emailMessageId`, `references`, `inReplyTo`).
 *
 * Email-specific by design: this knowledge lives next to the EmailTransport,
 * never in the neutral outbound service or the common ingestion pipeline.
 */

export interface EmailThreadingHeaders {
  /** RFC Message-ID of the message being replied to, in <...> form. */
  inReplyTo: string
  /** Ancestor chain, oldest first, each in <...> form (ends with inReplyTo). */
  references: string[]
}

/** Normalize a raw RFC Message-ID to canonical `<...>` form; null if unusable. */
export function normalizeRfcMessageId(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  const value = raw.trim()
  if (!value) return null
  const inner = value.replace(/^<+/, "").replace(/>+$/, "").trim()
  // A Message-ID is opaque but always id-ish: something@something, no spaces.
  if (!inner || /\s/.test(inner) || !inner.includes("@")) return null
  return `<${inner}>`
}

function normalizeReferenceList(raw: unknown): string[] {
  const values: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === "string"
      ? raw.split(/[\s,]+/)
      : []
  const out: string[] = []
  for (const value of values) {
    const normalized = normalizeRfcMessageId(value)
    if (normalized && !out.includes(normalized)) out.push(normalized)
  }
  return out
}

/**
 * Build reply headers from the metadata of the inbound message being
 * answered: `References` = the parent's references chain + the parent's own
 * Message-ID; `In-Reply-To` = the parent's Message-ID (RFC 5322 §3.6.4).
 * Returns null when the parent has no usable Message-ID (message imported
 * without headers, malformed metadata, non-email history) — the send then
 * simply goes out unthreaded, exactly like before.
 */
export function buildEmailThreadingFromMetadata(
  metadata: string | Record<string, unknown> | null | undefined,
): EmailThreadingHeaders | null {
  if (!metadata) return null
  let parsed: Record<string, unknown>
  if (typeof metadata === "string") {
    try {
      const raw = JSON.parse(metadata)
      if (!raw || typeof raw !== "object") return null
      parsed = raw as Record<string, unknown>
    } catch {
      return null
    }
  } else {
    parsed = metadata
  }
  const parentId = normalizeRfcMessageId(parsed.emailMessageId)
  if (!parentId) return null
  const references = normalizeReferenceList(parsed.references)
  if (!references.includes(parentId)) references.push(parentId)
  return { inReplyTo: parentId, references }
}
