/**
 * Common inbound ingestion pipeline (INBOX-TRANSPORT-05B). Every inbound
 * message — regardless of channel — flows through the same steps:
 *
 *   validate → verify connection/tenant → dedup → identity → contact →
 *   conversation → Message → MessageAttachment → notify + intelligence.
 *
 * Channel-specific knowledge enters ONLY through `IngestionHooks`, provided
 * by the adapter (email keeps its RFC threading, address-based contact reuse
 * and legacy metadata dedup as hooks). The pipeline itself never parses
 * provider payloads, never auto-merges ambiguous identities, and keeps every
 * query workspace-scoped.
 */

import { db } from "@core/db"
import { runConversationIntelligence } from "../intelligence"
import { notifyInboundMessage } from "@core/notifications/inbox"
import { addMessage } from "../service"
import { createMessageAttachments } from "../attachment-service"
import { buildIdentityDescriptor } from "../identity-resolution"
import { ensureContactForIdentity, recordInboundIdentity } from "../identity-service"
import { logInboxIntegrationEvent } from "../integration-events"
import {
  extractThreadHintMessageIds,
  validateInboundEnvelope,
  type InboundEnvelope,
} from "./envelope"

export interface IngestionMatch {
  conversationId: string
  matchedBy: string
}

export interface IngestionHooks {
  /**
   * Channel-specific duplicate detection beyond the normalized
   * `sourceMessageId` column (email: legacy metadata substring fallback).
   */
  findDuplicate?(ctx: {
    workspaceId: string
    envelope: InboundEnvelope
  }): Promise<{ messageId: string; conversationId: string } | null>
  /**
   * Channel-specific contact resolution (email: reuse by sender address).
   * Returning null falls back to identity-based resolution (confirmed
   * primary contact, else ONE provisional contact per identity).
   */
  resolveContact?(ctx: { workspaceId: string; envelope: InboundEnvelope }): Promise<string | null>
  /** Channel-specific conversation matching (email: RFC thread + reopen). */
  matchConversation?(ctx: {
    workspaceId: string
    contactId: string
    envelope: InboundEnvelope
  }): Promise<IngestionMatch | null>
  /** Extra fields persisted into `Message.metadata` (email RFC fields). */
  buildMessageMetadata?(envelope: InboundEnvelope): Record<string, unknown>
  /** Post-persist side effects (adapter activity logs, acks). */
  afterPersist?(ctx: {
    workspaceId: string
    conversationId: string
    messageId: string
    contactId: string
    isNewConversation: boolean
    matchedBy: string
  }): Promise<void>
}

export interface IngestInboundEnvelopeResult {
  conversationId: string
  messageId: string
  contactId: string
  isNewConversation: boolean
  matchedBy: string
  alreadyProcessed?: boolean
}

export async function ingestInboundEnvelope(
  envelope: InboundEnvelope,
  hooks: IngestionHooks = {},
): Promise<IngestInboundEnvelopeResult> {
  // ---- 1. Validate ----
  const problems = validateInboundEnvelope(envelope)
  if (problems.length > 0) {
    logInboxIntegrationEvent({
      event: "envelope_invalid",
      workspaceId: envelope.workspaceId,
      channel: envelope.channel,
      provider: envelope.provider,
      errorCode: problems.join(","),
    })
    throw new Error(`Inbound envelope invalid: ${problems.join(", ")}`)
  }
  const workspaceId = envelope.workspaceId
  const connectionId = envelope.connectionId ?? null

  // ---- 2. Verify connection ↔ tenant (never trust a mismatched pair) ----
  if (connectionId) {
    const connection = await db.channelConnection.findFirst({
      where: { id: connectionId, workspaceId },
      select: { id: true },
    })
    if (!connection) {
      logInboxIntegrationEvent({
        event: "connection_mismatch",
        workspaceId,
        connectionId,
        channel: envelope.channel,
        provider: envelope.provider,
      })
      throw new Error("Inbound envelope: connectionId does not belong to workspaceId")
    }
  }

  // ---- 3/4. Contact & identity (contact first — mirrors legacy semantics:
  // a duplicate still refreshes the contact's lastSeenAt) ----
  let contactId = (await hooks.resolveContact?.({ workspaceId, envelope })) ?? null

  const descriptor = buildIdentityDescriptor({
    channel: envelope.channel,
    kind: envelope.senderIdentity.kind,
    rawValue: envelope.senderIdentity.externalId ?? envelope.senderIdentity.rawValue,
    provider: envelope.provider,
    providerAccountId: envelope.providerAccountId ?? null,
    connectionId,
  })
  let identityId: string | null = null
  if (descriptor) {
    try {
      const recorded = await recordInboundIdentity({
        workspaceId,
        descriptor,
        displayValue: envelope.senderIdentity.displayName ?? envelope.senderIdentity.rawValue,
        contactId,
      })
      identityId = recorded.identityId
    } catch (err) {
      logInboxIntegrationEvent({
        event: "identity_write_failed",
        workspaceId,
        connectionId: connectionId ?? undefined,
        channel: envelope.channel,
        provider: envelope.provider,
        errorCode: err instanceof Error ? err.name : "unknown",
      })
    }
  }
  if (!contactId && identityId) {
    contactId = await ensureContactForIdentity({
      workspaceId,
      identityId,
      displayName: envelope.senderIdentity.displayName ?? null,
    })
  }
  if (!contactId) {
    throw new Error("Inbound envelope: could not resolve or create a contact")
  }

  // ---- 5. Dedup (normalized column first, then adapter fallback) ----
  const columnDuplicate = await db.message.findFirst({
    where: {
      workspaceId,
      direction: "inbound",
      sourceMessageId: envelope.externalMessageId,
      ...(connectionId ? { connectionId } : {}),
    },
    select: { id: true, conversationId: true },
  })
  const duplicate =
    columnDuplicate ??
    (await hooks.findDuplicate?.({ workspaceId, envelope }).then(
      (hit) => hit && { id: hit.messageId, conversationId: hit.conversationId },
    )) ??
    null
  if (duplicate) {
    logInboxIntegrationEvent({
      event: "duplicate_inbound",
      workspaceId,
      connectionId: connectionId ?? undefined,
      conversationId: duplicate.conversationId,
      messageId: duplicate.id,
      channel: envelope.channel,
      provider: envelope.provider,
    })
    return {
      conversationId: duplicate.conversationId,
      messageId: duplicate.id,
      contactId,
      isNewConversation: false,
      matchedBy: "duplicate",
      alreadyProcessed: true,
    }
  }

  // ---- 6. Conversation (adapter hook → generic thread hint → active → new) ----
  let match = (await hooks.matchConversation?.({ workspaceId, contactId, envelope })) ?? null
  if (!match) {
    const hintIds = extractThreadHintMessageIds(envelope)
    if (hintIds.length > 0) {
      const threadMessage = await db.message.findFirst({
        where: { workspaceId, sourceMessageId: { in: hintIds } },
        select: { conversationId: true },
      })
      if (threadMessage) {
        match = { conversationId: threadMessage.conversationId, matchedBy: "external-thread" }
      }
    }
  }
  if (!match) {
    const active = await db.conversation.findFirst({
      where: {
        workspaceId,
        contactId,
        channel: envelope.channel,
        status: { notIn: ["closed", "archived", "trashed"] },
      },
      orderBy: { lastMessageAt: "desc" },
      select: { id: true },
    })
    if (active) match = { conversationId: active.id, matchedBy: "contact-active" }
  }

  let conversationId: string
  let isNewConversation = false
  let matchedBy: string
  if (match) {
    conversationId = match.conversationId
    matchedBy = match.matchedBy
  } else {
    const created = await db.conversation.create({
      data: {
        workspaceId,
        contactId,
        connectionId,
        channel: envelope.channel,
        source: envelope.conversationSource ?? envelope.channel,
        status: "new",
        subject: envelope.subject ?? null,
        isPublic: envelope.isPublic ?? true,
        lastMessageAt: envelope.receivedAt ?? new Date(),
        messageCount: 0,
      },
      select: { id: true },
    })
    conversationId = created.id
    isNewConversation = true
    matchedBy = "new"
  }

  // ---- 7. Message ----
  const message = await addMessage({
    workspaceId,
    conversationId,
    role: "visitor",
    direction: "inbound",
    content: envelope.text?.trim() || "(no text)",
    contentType: "text",
    connectionId,
    sourceMessageId: envelope.externalMessageId,
    metadata: {
      source: envelope.provider,
      sourceId: envelope.externalMessageId,
      ...(hooks.buildMessageMetadata?.(envelope) ?? {}),
      ...(connectionId ? { connectionId } : {}),
      ...(envelope.attachments && envelope.attachments.length > 0
        ? { attachments: envelope.attachments }
        : {}),
    },
  })
  if (!message) throw new Error("Failed to create inbound message")

  // ---- 8. Attachments (best-effort, never blocks ingestion) ----
  if (envelope.attachments && envelope.attachments.length > 0) {
    try {
      await createMessageAttachments({
        workspaceId,
        messageId: message.id,
        provider: envelope.provider,
        attachments: envelope.attachments,
      })
    } catch (err) {
      logInboxIntegrationEvent({
        event: "attachment_write_failed",
        workspaceId,
        messageId: message.id,
        channel: envelope.channel,
        provider: envelope.provider,
        errorCode: err instanceof Error ? err.name : "unknown",
      })
    }
  }

  // ---- 9. Post-persist (notification + AI triage, fire-and-forget) ----
  db.conversation
    .findFirst({
      where: { id: conversationId, workspaceId },
      select: { assignedTo: true, subject: true, channel: true, contact: { select: { nombre: true } } },
    })
    .then((conv) => {
      if (!conv) return
      return notifyInboundMessage({
        workspaceId,
        conversationId,
        subject: conv.subject,
        contactName: conv.contact?.nombre,
        channel: conv.channel,
        assignedTo: conv.assignedTo,
      })
    })
    .catch(() => null)

  runConversationIntelligence({ workspaceId, conversationId, trigger: "message_post" }).catch(
    (err) => {
      console.error(`[ingest:${envelope.provider}] Intelligence failed conv=${conversationId}:`, err)
    },
  )

  await hooks
    .afterPersist?.({
      workspaceId,
      conversationId,
      messageId: message.id,
      contactId,
      isNewConversation,
      matchedBy,
    })
    ?.catch(() => null)

  return { conversationId, messageId: message.id, contactId, isNewConversation, matchedBy }
}
