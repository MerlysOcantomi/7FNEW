/**
 * InboundEnvelope (INBOX-TRANSPORT-05B) — the neutral contract every inbound
 * message is converted to before entering the common ingestion pipeline.
 * Channel adapters (email today; WhatsApp/Meta/Twilio later) own the
 * provider-specific parsing and produce this shape; the pipeline never sees
 * RFC headers, webhook payloads or provider quirks.
 *
 * SQLite/codebase constraints honored: metadata travels as plain objects
 * serialized to JSON strings at the persistence edge; dates are real Date
 * objects here (adapters parse provider timestamps).
 */

import type { InboxChannelId } from "@core/inbox/channel-registry"
import type { IdentityKind } from "../identity-resolution"
import type { StoredAttachmentInput } from "../attachment-service"

export interface ExternalIdentityInput {
  kind: IdentityKind
  /** Raw addressable value (email address, E.164/raw phone, handle, visitor id). */
  rawValue: string
  /** Provider-scoped opaque id when one exists (PSID, IGSID, wa_id). */
  externalId?: string | null
  displayName?: string | null
}

export type InboundAttachmentInput = StoredAttachmentInput

export interface InboundEnvelope {
  channel: InboxChannelId
  /** Transport provider that produced this message ("resend", "imap", "meta"…). */
  provider: string
  /** Tenant — resolved by the adapter (webhook routing / connection lookup). */
  workspaceId: string
  connectionId?: string | null
  providerAccountId?: string | null
  /** Provider's id for this message → dedup + `Message.sourceMessageId`. */
  externalMessageId: string
  externalConversationId?: string | null
  senderIdentity: ExternalIdentityInput
  text?: string | null
  subject?: string | null
  receivedAt?: Date
  replyToExternalMessageId?: string | null
  /**
   * Opaque channel threading hints. The generic pipeline only reads
   * `externalMessageIds` (list of provider message ids that belong to the
   * same thread); anything else is adapter-private.
   */
  threadHints?: Record<string, string | string[]>
  attachments?: InboundAttachmentInput[]
  /**
   * Safe provider extras persisted into `Message.metadata` (no tokens, no
   * signed URLs). Email uses this for its RFC fields.
   */
  providerMetadata?: Record<string, unknown>
  /** Conversation defaults for NEW conversations. */
  conversationSource?: string
  isPublic?: boolean
}

/** Pure validation — returns machine-readable problems; empty = valid. */
export function validateInboundEnvelope(envelope: InboundEnvelope): string[] {
  const problems: string[] = []
  if (!envelope.workspaceId?.trim()) problems.push("missing_workspace")
  if (!envelope.channel) problems.push("missing_channel")
  if (!envelope.provider?.trim()) problems.push("missing_provider")
  if (!envelope.externalMessageId?.trim()) problems.push("missing_external_message_id")
  if (!envelope.senderIdentity?.rawValue?.trim() && !envelope.senderIdentity?.externalId?.trim()) {
    problems.push("missing_sender_identity")
  }
  const hasText = typeof envelope.text === "string" && envelope.text.trim().length > 0
  const hasAttachments = (envelope.attachments?.length ?? 0) > 0
  if (!hasText && !hasAttachments) problems.push("empty_message")
  return problems
}

/** Thread-hint message ids the generic matcher may use, normalized to a list. */
export function extractThreadHintMessageIds(envelope: InboundEnvelope): string[] {
  const out: string[] = []
  if (envelope.replyToExternalMessageId?.trim()) out.push(envelope.replyToExternalMessageId.trim())
  const hint = envelope.threadHints?.externalMessageIds
  const values = Array.isArray(hint) ? hint : typeof hint === "string" ? [hint] : []
  for (const value of values) {
    const trimmed = value.trim()
    if (trimmed && !out.includes(trimmed)) out.push(trimmed)
  }
  return out
}
