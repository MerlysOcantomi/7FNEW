/**
 * Common outbound send service (INBOX-TRANSPORT-05C) — the ONE flow every
 * send/retry route uses. Replaces the per-route `channel !== "email"` guards
 * with channel-capability + registered-transport resolution:
 *
 *   load conversation+message (workspace-scoped) → resolve channel and
 *   connection → capability check (outbound) → transport lookup → build
 *   neutral ChannelSendInput → transport.send → delivery projection +
 *   sourceMessageId → legacy metadata dual-write (email) → safe outcome.
 *
 * A channel that is ENABLED in the vertical config but has no registered
 * transport fails soft with `transport_not_registered` — surfaced in the
 * message's delivery state, never a silent drop and never a fake send.
 */

import { db } from "@core/db"
import "./transport" // ensure built-in transports are registered
import { resolveChannelTransport } from "./transport/registry"
import type { ChannelSendInput } from "./transport/contracts"
import { recordOutboundSendResult } from "./delivery-service"
import { applyDeliveryEventToMessage } from "./delivery-service"
import { logInboxIntegrationEvent } from "./integration-events"
import { getInboxChannel } from "@core/inbox/channel-registry"

export interface SendConversationMessageOptions {
  workspaceId: string
  conversationId: string
  messageId: string
  content: string
  mode?: "reply" | "reply_all" | "forward"
  cc?: string[]
  bcc?: string[]
  /** Override/extra recipients (email reply-all extras & forward targets). */
  to?: string[]
  attachments?: Array<{ filename: string; url: string; contentType: string }>
  requestConfirmation?: boolean
  /** Marks a retry attempt (adds the legacy `emailRetryAt` metadata key). */
  isRetry?: boolean
}

export interface SendConversationMessageOutcome {
  /**
   * "sent"    — provider accepted the message.
   * "failed"  — send attempted and rejected (projected + surfaced).
   * "skipped" — send not attempted (no outbound capability, no transport,
   *             no recipient). Mirrors the legacy silent-return semantics
   *             but ALWAYS returns a machine-readable reason.
   */
  status: "sent" | "failed" | "skipped"
  errorCode: string | null
  errorMessage?: string | null
  externalMessageId?: string | null
  retryable?: boolean
}

/**
 * Transitional recipient resolution: email uses the contact's address; other
 * channels fall back to the contact's phone. Real channel integrations will
 * resolve recipients from the conversation's ExternalIdentity instead (the
 * WhatsApp mission) — this helper is the documented seam for that change.
 */
function resolveOutboundRecipient(
  channelKind: string,
  contact: { email: string | null; telefono: string | null },
): string | null {
  if (channelKind === "email") return contact.email?.trim() || null
  return contact.telefono?.trim() || contact.email?.trim() || null
}

export async function sendConversationMessage(
  options: SendConversationMessageOptions,
): Promise<SendConversationMessageOutcome> {
  const { workspaceId, conversationId, messageId } = options

  const conv = await db.conversation.findFirst({
    where: { id: conversationId, workspaceId },
    select: {
      channel: true,
      connectionId: true,
      contact: { select: { email: true, telefono: true } },
      connection: { select: { id: true, provider: true } },
    },
  })
  if (!conv) {
    return { status: "skipped", errorCode: "conversation_not_found" }
  }

  // ── Channel capability gate (replaces `channel !== "email"` guards) ──
  const definition = getInboxChannel(conv.channel)
  if (!definition || !definition.capabilities.outbound) {
    return { status: "skipped", errorCode: "channel_not_outbound" }
  }

  // ── Provider + transport resolution ──
  // Connection provider wins; email without a connection falls back to the
  // env-level Resend sender (exactly the legacy behaviour).
  const provider =
    conv.connection?.provider ?? (definition.id === "email" ? "resend" : null)
  const resolution = resolveChannelTransport({ channel: conv.channel, provider })
  if (!resolution.ok) {
    logInboxIntegrationEvent({
      event: "transport_missing",
      workspaceId,
      conversationId,
      messageId,
      channel: conv.channel,
      provider: provider ?? undefined,
      errorCode: resolution.reason,
    })
    if (resolution.reason === "transport_not_registered") {
      // Enabled ≠ integrated: surface an honest, actionable failure on the
      // message instead of silently dropping the operator's reply.
      await applyDeliveryEventToMessage(messageId, {
        type: "failed",
        at: new Date(),
        failureCode: "transport_not_registered",
      }).catch(() => null)
    }
    return { status: "skipped", errorCode: resolution.reason }
  }

  // ── Recipient ──
  const recipient = resolveOutboundRecipient(definition.kind, {
    email: conv.contact?.email ?? null,
    telefono: conv.contact?.telefono ?? null,
  })
  if (!recipient) {
    // Legacy behaviour: no recipient → no attempt, message stays pending.
    console.warn(
      `[outbound] No recipient for conv=${conversationId} channel=${conv.channel}; skipping send`,
    )
    return { status: "skipped", errorCode: "missing_recipient" }
  }

  // ── Neutral send input → transport ──
  const input: ChannelSendInput = {
    workspaceId,
    conversationId,
    messageId,
    connectionId: conv.connectionId,
    to: { address: recipient },
    text: options.content,
    ...(options.cc?.length ? { cc: options.cc } : {}),
    ...(options.bcc?.length ? { bcc: options.bcc } : {}),
    ...(options.to?.length ? { extraRecipients: options.to } : {}),
    ...(options.attachments?.length ? { attachments: options.attachments } : {}),
    channelData: {
      mode: options.mode ?? "reply",
      requestConfirmation: options.requestConfirmation === true,
    },
  }

  const result = await resolution.transport.send(input)

  // ── Delivery projection + provider id (shared monotonic helper) ──
  try {
    await recordOutboundSendResult({
      messageId,
      ok: result.accepted,
      providerMessageId: result.externalMessageId,
      failureCode: result.errorCode ?? "send_failed",
      at: result.sentAt ?? new Date(),
    })
  } catch (err) {
    logInboxIntegrationEvent({
      event: "delivery_projection_failed",
      workspaceId,
      conversationId,
      messageId,
      channel: conv.channel,
      provider: result.provider,
      errorCode: err instanceof Error ? err.name : "unknown",
    })
  }

  // ── Legacy metadata dual-write (email only — transitional fallback the
  //    read path still understands for historical rows) ──
  if (definition.id === "email") {
    try {
      const row = await db.message.findFirst({
        where: { id: messageId, workspaceId },
        select: { metadata: true },
      })
      let currentMeta: Record<string, unknown> = {}
      try {
        currentMeta = row?.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : {}
      } catch {
        currentMeta = {}
      }
      const fromAddress =
        typeof result.providerMetadata?.fromAddress === "string"
          ? result.providerMetadata.fromAddress
          : undefined
      await db.message.update({
        where: { id: messageId },
        data: {
          metadata: JSON.stringify({
            ...currentMeta,
            emailStatus: result.accepted ? "sent" : "failed",
            ...(result.externalMessageId ? { resendId: result.externalMessageId } : {}),
            ...(result.errorMessage ? { emailError: result.errorMessage } : {}),
            ...(fromAddress ? { fromAddress } : {}),
            emailAttemptedAt: new Date().toISOString(),
            ...(options.isRetry ? { emailRetryAt: new Date().toISOString() } : {}),
          }),
        },
      })
    } catch (metaErr) {
      console.error(`[outbound] Could not update message metadata msg=${messageId}:`, metaErr)
    }
  }

  if (result.accepted) {
    console.log(
      `[outbound] OK conv=${conversationId} msg=${messageId} channel=${conv.channel} provider=${result.provider} externalId=${result.externalMessageId ?? "(none)"}`,
    )
    return {
      status: "sent",
      errorCode: null,
      externalMessageId: result.externalMessageId,
    }
  }
  console.error(
    `[outbound] FAILED conv=${conversationId} msg=${messageId} channel=${conv.channel}: ${result.errorMessage ?? result.errorCode}`,
  )
  return {
    status: "failed",
    errorCode: result.errorCode,
    errorMessage: result.errorMessage ?? null,
    externalMessageId: null,
    retryable: result.retryable,
  }
}
