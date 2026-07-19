/**
 * Centralized observability for the multi-channel Inbox integration layer
 * (INBOX-TRANSPORT-05). The 04B dual-writes are best-effort by contract —
 * this module makes their failures (and routing anomalies) VISIBLE without
 * ever leaking PII.
 *
 * Log policy (hard rules, enforced by the sanitizer):
 *   - ids and machine codes only — NEVER raw emails, phones, handles,
 *     tokens, message bodies or signed URLs;
 *   - anything value-shaped must arrive pre-hashed (use
 *     `hashIdentityValue` from identity-resolution.ts);
 *   - structured single-line JSON so log tooling can index events.
 * Persisting events to a table is a future decision — centralized
 * structured logs are the current contract.
 */

export type InboxIntegrationEventName =
  | "identity_write_failed"
  | "delivery_projection_failed"
  | "attachment_write_failed"
  | "transport_missing"
  | "connection_not_found"
  | "connection_mismatch"
  | "duplicate_inbound"
  | "webhook_unknown_account"
  | "webhook_unknown_provider"
  | "envelope_invalid"

export interface InboxIntegrationEvent {
  event: InboxIntegrationEventName
  workspaceId?: string
  connectionId?: string
  conversationId?: string
  messageId?: string
  channel?: string
  provider?: string
  providerAccountId?: string
  errorCode?: string
  /** Pre-hashed identity value (hashIdentityValue) when relevant. */
  valueHash?: string
  /** Small safe extras (counts, reasons). Sanitized before logging. */
  detail?: Record<string, string | number | boolean>
}

const ALLOWED_KEYS: ReadonlySet<string> = new Set([
  "event",
  "workspaceId",
  "connectionId",
  "conversationId",
  "messageId",
  "channel",
  "provider",
  "providerAccountId",
  "errorCode",
  "valueHash",
  "detail",
])

/** Keys that must never appear even inside `detail`. */
const FORBIDDEN_DETAIL_KEYS = /email|phone|telefono|handle|token|credential|body|content|url|address|recipient|from|to$/i

/** Drop unknown top-level keys and suspicious detail keys — defense in depth. */
export function sanitizeIntegrationEvent(event: InboxIntegrationEvent): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(event)) {
    if (!ALLOWED_KEYS.has(key) || value === undefined) continue
    if (key === "detail" && value && typeof value === "object") {
      const detail: Record<string, unknown> = {}
      for (const [dKey, dValue] of Object.entries(value)) {
        if (FORBIDDEN_DETAIL_KEYS.test(dKey)) continue
        if (typeof dValue === "string" && dValue.length > 120) continue
        detail[dKey] = dValue
      }
      out.detail = detail
      continue
    }
    out[key] = value
  }
  return out
}

export function logInboxIntegrationEvent(event: InboxIntegrationEvent): void {
  try {
    console.warn(`[inbox:integration] ${JSON.stringify(sanitizeIntegrationEvent(event))}`)
  } catch {
    // Observability must never throw into a send/ingest path.
  }
}
