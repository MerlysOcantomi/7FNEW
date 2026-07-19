/**
 * EmailTransport (INBOX-TRANSPORT-05A) — the existing email behaviour
 * (Resend + SMTP/nodemailer, per-connection sender selection, attachment
 * mapping, tracking pixel) EXTRACTED behind the neutral ChannelTransport
 * contract. No behaviour change: the logic is the same code the send routes
 * ran inline before 05C rewired them through the outbound service.
 *
 * Registered for both email providers ("resend", "imap_smtp") — provider
 * selection between them stays where it always lived, inside
 * `sendOutboundEmail` (connectionSender + DEFAULT_OUTBOUND_PROVIDER).
 */

import { db } from "@core/db"
import {
  sendOutboundEmail,
  type ConnectionSender,
  type EmailSendMode,
  type OutboundAttachment,
  type SendOutboundEmailInput,
} from "../email-outbound"
import { buildEmailThreadingFromMetadata, type EmailThreadingHeaders } from "./email-threading"
import type {
  ChannelSendInput,
  ChannelSendResult,
  ChannelTransport,
} from "./contracts"

// ── Pure mapping helpers (unit-tested) ──────────────────────────────────────

export interface EmailConnectionRecord {
  provider: string
  config: string | null
  credentials: string | null
  externalAccountId: string | null
}

/**
 * Resolve the per-connection sender exactly as the legacy route did:
 * `config.fromEmail` → `externalAccountId` fallback; SMTP config +
 * encrypted credentials attached only for imap_smtp connections.
 */
export function buildConnectionSenderFromRecord(
  record: EmailConnectionRecord | null,
): ConnectionSender | null {
  if (!record) return null
  let cfg: Record<string, string> | null = null
  try {
    cfg = record.config ? (JSON.parse(record.config) as Record<string, string>) : null
  } catch {
    cfg = null
  }
  const fromEmail = cfg?.fromEmail || record.externalAccountId || ""
  if (!fromEmail) return null
  const sender: ConnectionSender = {
    fromEmail,
    fromName: cfg?.fromName || null,
    provider: record.provider as "resend" | "imap_smtp",
  }
  if (record.provider === "imap_smtp" && record.credentials && cfg) {
    sender.smtpConfig = {
      smtpHost: cfg.smtpHost || "",
      smtpPort: Number(cfg.smtpPort) || 465,
      smtpSecure: cfg.smtpSecure !== "false",
      fromEmail,
      fromName: cfg.fromName || null,
    }
    sender.encryptedCredentials = record.credentials
  }
  return sender
}

/** Workspace open-tracking toggle (default ON), as the legacy route read it. */
export function resolveOpenTrackingEnabled(workspaceConfig: string | null | undefined): boolean {
  if (!workspaceConfig) return true
  try {
    const parsed = JSON.parse(workspaceConfig) as { email?: { openTracking?: { enabled?: boolean } } }
    return parsed?.email?.openTracking?.enabled !== false
  } catch {
    return true
  }
}

export interface EmailSendContext {
  workspaceName: string
  workspaceConfig: string | null
  conversationSubject: string | null
  connectionSender: ConnectionSender | null
  threading?: EmailThreadingHeaders | null
}

/** Map the neutral send input + email context to `sendOutboundEmail` args. */
export function buildEmailSendArgs(
  input: ChannelSendInput,
  ctx: EmailSendContext,
): SendOutboundEmailInput {
  const mode = ((): EmailSendMode => {
    const raw = input.channelData?.mode
    return raw === "reply_all" || raw === "forward" ? raw : "reply"
  })()
  const attachments: OutboundAttachment[] | undefined =
    input.attachments && input.attachments.length > 0
      ? input.attachments.map((att) => ({
          filename: att.filename,
          url: att.url,
          contentType: att.contentType,
        }))
      : undefined
  return {
    workspaceName: ctx.workspaceName,
    contactEmail: input.to.address,
    subject: input.subject ?? ctx.conversationSubject ?? "",
    messageContent: input.text,
    workspaceConfig: ctx.workspaceConfig,
    mode,
    connectionSender: ctx.connectionSender,
    tracking: {
      enabled: resolveOpenTrackingEnabled(ctx.workspaceConfig),
      askConfirm: input.channelData?.requestConfirmation === true,
      messageId: input.messageId,
      workspaceId: input.workspaceId,
    },
    ...(ctx.threading ? { threading: ctx.threading } : {}),
    ...(attachments ? { attachments } : {}),
    ...(input.cc && input.cc.length > 0 ? { cc: input.cc } : {}),
    ...(input.bcc && input.bcc.length > 0 ? { bcc: input.bcc } : {}),
    ...(input.extraRecipients && input.extraRecipients.length > 0
      ? { to: input.extraRecipients }
      : {}),
  }
}

/** Map the email send result into the neutral, projection-ready shape. */
export function mapEmailSendResult(
  result: { ok: boolean; id?: string; error?: string },
  provider: string,
  at: Date,
): ChannelSendResult {
  if (result.ok) {
    return {
      accepted: true,
      externalMessageId: result.id ?? null,
      provider,
      initialDeliveryStatus: "sent",
      sentAt: at,
      errorCode: null,
      retryable: false,
      providerMetadata: result.id ? { providerMessageId: result.id } : {},
    }
  }
  return {
    accepted: false,
    externalMessageId: null,
    provider,
    initialDeliveryStatus: "failed",
    sentAt: null,
    errorCode: "email_send_failed",
    errorMessage: result.error ?? "Email delivery failed",
    // Send failures are transient by default (provider/network) — the retry
    // route has always allowed re-attempting any failed email.
    retryable: true,
  }
}

// ── Transport implementation ────────────────────────────────────────────────

class EmailTransport implements ChannelTransport {
  readonly channel = "email" as const
  constructor(readonly provider: string) {}

  async send(input: ChannelSendInput): Promise<ChannelSendResult> {
    const recipient = input.to.address.trim()
    if (!recipient || !recipient.includes("@")) {
      return {
        accepted: false,
        externalMessageId: null,
        provider: this.provider,
        initialDeliveryStatus: "failed",
        sentAt: null,
        errorCode: "missing_recipient",
        errorMessage: "Recipient email address is missing or invalid",
        retryable: false,
      }
    }

    const conv = await db.conversation.findFirst({
      where: { id: input.conversationId, workspaceId: input.workspaceId },
      select: {
        subject: true,
        connectionId: true,
        workspace: { select: { nombre: true, config: true } },
      },
    })
    if (!conv) {
      return {
        accepted: false,
        externalMessageId: null,
        provider: this.provider,
        initialDeliveryStatus: "failed",
        sentAt: null,
        errorCode: "conversation_not_found",
        errorMessage: "Conversation not found in workspace",
        retryable: false,
      }
    }

    /**
     * Workspace-scoped connection lookup (defense-in-depth against
     * cross-tenant sender leaks — see the historical comment in the messages
     * route this logic was extracted from). Missing/foreign connections fall
     * back to the env-level sender inside `sendOutboundEmail`.
     */
    const connectionId = input.connectionId ?? conv.connectionId
    let connectionSender: ConnectionSender | null = null
    if (connectionId) {
      const record = await db.channelConnection.findFirst({
        where: { id: connectionId, workspaceId: input.workspaceId },
        select: { provider: true, config: true, credentials: true, externalAccountId: true },
      })
      connectionSender = buildConnectionSenderFromRecord(record)
    }

    /**
     * RFC threading (05C): reply headers derive from the conversation's
     * latest inbound email metadata — email-specific knowledge stays inside
     * this transport, never in the neutral outbound service.
     */
    let threading: EmailThreadingHeaders | null = null
    const mode = input.channelData?.mode
    if (mode !== "forward") {
      const lastInbound = await db.message.findFirst({
        where: {
          conversationId: input.conversationId,
          workspaceId: input.workspaceId,
          direction: "inbound",
          isInternal: false,
        },
        orderBy: { createdAt: "desc" },
        select: { metadata: true },
      })
      threading = buildEmailThreadingFromMetadata(lastInbound?.metadata ?? null)
    }

    const args = buildEmailSendArgs(input, {
      workspaceName: conv.workspace.nombre,
      workspaceConfig: conv.workspace.config,
      conversationSubject: conv.subject,
      connectionSender,
      threading,
    })

    try {
      const result = await sendOutboundEmail(args)
      return mapEmailSendResult(result, this.provider, new Date())
    } catch (err) {
      return mapEmailSendResult(
        { ok: false, error: err instanceof Error ? err.message : "Email service unavailable" },
        this.provider,
        new Date(),
      )
    }
  }
}

export function createEmailTransports(): ChannelTransport[] {
  return [new EmailTransport("resend"), new EmailTransport("imap_smtp")]
}
