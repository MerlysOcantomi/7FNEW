/**
 * Channel transport contracts (INBOX-TRANSPORT-05A) — the neutral seam every
 * outbound channel implementation sits behind. Phase 5 of
 * docs/product/smart-inbox-multichannel-audit.md.
 *
 * Rules:
 *   - Channel-neutral: nothing email-only is REQUIRED here. Email-specific
 *     knobs (reply mode, tracking, CC/BCC) travel through the optional
 *     fields / `channelData`, and each transport reads only what its
 *     channel supports (per `core/inbox/channel-registry.ts` capabilities).
 *   - Transports own their provider details end to end: connection/sender
 *     resolution, provider selection, payload mapping, threading. Callers
 *     (the outbound service) never see provider payloads.
 *   - Results are projection-ready: `initialDeliveryStatus` feeds the
 *     shared delivery projection, `externalMessageId` feeds
 *     `Message.sourceMessageId`.
 */

import type { InboxChannelId } from "@core/inbox/channel-registry"

export interface ChannelSendRecipient {
  /** External address in the channel's own format (email, E.164, PSID…). */
  address: string
  displayName?: string | null
}

export interface ChannelSendAttachment {
  filename: string
  url: string
  contentType: string
}

export interface ChannelSendInput {
  workspaceId: string
  conversationId: string
  /** The already-persisted Message row this send delivers. */
  messageId: string
  /** Connection to send through; null lets the transport pick the default. */
  connectionId: string | null
  to: ChannelSendRecipient
  text: string
  /** Channels without subject support ignore it (capability-gated in UI). */
  subject?: string | null
  cc?: string[]
  bcc?: string[]
  /** Extra/override recipients (email reply-all & forward). */
  extraRecipients?: string[]
  attachments?: ChannelSendAttachment[]
  /** External id of the message being replied to (threading). */
  replyToExternalMessageId?: string | null
  /**
   * Opaque channel threading hints (e.g. RFC References chain for email).
   * Built by channel-side helpers; the neutral layer never interprets them.
   */
  threadHints?: Record<string, string | string[]>
  /** Template payload for template-only channels (WhatsApp business-initiated). */
  templateData?: Record<string, unknown>
  /**
   * Controlled channel-specific extras. Email uses: `mode`
   * ("reply"|"reply_all"|"forward"), `requestConfirmation` (boolean).
   * Never a dumping ground for provider payloads.
   */
  channelData?: Record<string, unknown>
}

export type ChannelInitialDeliveryStatus = "queued" | "sent" | "failed"

export interface ChannelSendResult {
  accepted: boolean
  /** Provider-assigned message id → `Message.sourceMessageId`. */
  externalMessageId: string | null
  provider: string
  initialDeliveryStatus: ChannelInitialDeliveryStatus
  sentAt: Date | null
  /** Stable machine code ("email_send_failed", "missing_recipient", …). */
  errorCode: string | null
  /** Human-readable detail — may contain provider text, NEVER logged raw with PII. */
  errorMessage?: string | null
  /** Whether a retry with the same input could plausibly succeed. */
  retryable: boolean
  /** Safe provider metadata (no tokens, no signed URLs, no bodies). */
  providerMetadata?: Record<string, unknown>
}

export interface ChannelTransport {
  channel: InboxChannelId
  /** Provider key this transport serves ("resend_smtp_email" family uses "email"). */
  provider: string
  send(input: ChannelSendInput): Promise<ChannelSendResult>
}
