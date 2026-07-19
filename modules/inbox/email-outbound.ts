import { sendEmail, type SendEmailResult } from "@core/email"
import { sendEmailSmtp, type SmtpConnectionConfig } from "./email-smtp"
import { escapeHtml, wrapEmailHtml, resolveAckEmailConfig } from "@core/email-templates"
import { logActivity } from "@core/activity"
import { getTranslations, resolveLocaleFromConfig } from "@core/i18n"
import { buildOpenPixelUrl, buildConfirmReceiptUrl } from "@core/inbox-tracking"

export interface OutboundAttachment {
  filename: string
  url: string
  contentType: string
}

export type EmailSendMode = "reply" | "reply_all" | "forward"

/** Resolved sender info from a ChannelConnection, if available. */
export interface ConnectionSender {
  fromEmail: string
  fromName?: string | null
  /** When set, send via SMTP instead of Resend. */
  provider?: "resend" | "imap_smtp"
  smtpConfig?: SmtpConnectionConfig
  encryptedCredentials?: string
}

export interface SendOutboundEmailInput {
  workspaceName: string
  contactEmail: string
  subject: string
  messageContent: string
  /** Raw workspace.config JSON for locale resolution. */
  workspaceConfig?: string | null
  attachments?: OutboundAttachment[]
  cc?: string[]
  bcc?: string[]
  /** Override recipients (used by reply-all extra recipients or forward). */
  to?: string[]
  mode?: EmailSendMode
  /** Per-connection sender override. Takes priority over env vars. */
  connectionSender?: ConnectionSender | null
  /**
   * Open-tracking knobs. The caller decides whether the pixel should be embedded based on
   * workspace settings + per-message overrides. We only embed when both ids are present and
   * `enabled !== false`. The route is `/api/inbox/track/open/{token}.png`.
   *
   * `askConfirm` is the per-message receipt-confirmation toggle (Phase 3). When true and ids
   * are available, we add a visible "Confirm you received this" link near the footer that
   * points to `/api/inbox/track/confirm/{token}`.
   */
  tracking?: {
    enabled?: boolean
    askConfirm?: boolean
    messageId?: string
    workspaceId?: string
  }
  /**
   * RFC threading headers (INBOX-TRANSPORT-05): In-Reply-To / References of
   * the message being answered. Built by the EmailTransport from inbound
   * metadata; omitted sends go out unthreaded exactly as before.
   */
  threading?: {
    inReplyTo: string
    references: string[]
  } | null
}

function ensureRePrefix(subject: string): string {
  const trimmed = subject.trim()
  if (/^re:\s*/i.test(trimmed)) return trimmed
  return `Re: ${trimmed}`
}

function sanitizeDisplayName(name: string): string {
  return name.replace(/[\r\n]+/g, " ").trim() || "Business"
}

/**
 * Resolve the inbox sender address.
 *
 * Priority:
 *   1. connectionSender (from ChannelConnection.config) — per-connection override
 *   2. `displayName` (workspace name or ack config) + INBOX_FROM_EMAIL
 *   3. INBOX_FROM_NAME + INBOX_FROM_EMAIL  (global fallback with branding)
 *   4. RESEND_FROM_EMAIL                   (bare-minimum fallback)
 */
function resolveInboxFrom(displayName?: string, connectionSender?: ConnectionSender | null): string | undefined {
  if (connectionSender?.fromEmail) {
    const name = connectionSender.fromName || displayName || process.env.INBOX_FROM_NAME
    return name ? `${sanitizeDisplayName(name)} <${connectionSender.fromEmail}>` : connectionSender.fromEmail
  }

  const email = process.env.INBOX_FROM_EMAIL || process.env.RESEND_FROM_EMAIL
  if (!email) return undefined

  const name = displayName || process.env.INBOX_FROM_NAME
  return name ? `${sanitizeDisplayName(name)} <${email}>` : email
}

export interface SendAcknowledgmentInput {
  workspaceName: string
  contactName: string | null
  contactEmail: string
  conversationSubject: string
  /** Raw workspace.config JSON — used to resolve per-workspace overrides. */
  workspaceConfig?: string | null
  /** Required for activity logging. */
  workspaceId: string
  conversationId: string
}

export async function sendAcknowledgmentEmail(input: SendAcknowledgmentInput): Promise<SendEmailResult> {
  const cfg = resolveAckEmailConfig(input.workspaceConfig)

  if (!cfg.enabled) {
    logActivity({
      module: "email",
      recordId: input.conversationId,
      type: "email_skipped",
      data: { kind: "acknowledgment", to: input.contactEmail, reason: "disabled_by_config" },
      workspaceId: input.workspaceId,
    }).catch(() => null)
    return { ok: true, id: undefined }
  }

  const t = getTranslations(cfg.locale)
  const displayName = cfg.senderName || sanitizeDisplayName(input.workspaceName)
  const greeting = escapeHtml(t.email.ack.greeting(input.contactName))
  const convSubject = input.conversationSubject || t.common.message
  const subject = cfg.subject || `Re: ${convSubject}`
  const heading = cfg.heading
  const body = cfg.body
  const footer = cfg.footer || `${displayName} — ${t.email.poweredBy}`
  const subjectLabel = t.email.ack.subjectLabel

  const html = wrapEmailHtml({
    body: `
      <p style="margin:0 0 16px"><strong>${greeting}</strong></p>
      <p style="margin:0 0 16px">${escapeHtml(heading)}</p>
      <div style="padding:12px 16px;background:#f3f4f6;border-radius:6px;margin:0 0 16px">
        <p style="margin:0;font-size:13px;color:#6b7280">${escapeHtml(subjectLabel)}</p>
        <p style="margin:4px 0 0;font-weight:600">${escapeHtml(convSubject)}</p>
      </div>
      <p style="margin:0;font-size:14px;color:#6b7280">${escapeHtml(body)}</p>`,
    footer,
    locale: cfg.locale,
  })

  const result = await sendEmail({
    to: input.contactEmail,
    from: resolveInboxFrom(displayName),
    subject,
    text: `${t.email.ack.greeting(input.contactName)}\n\n${heading}\n\n${subjectLabel}: ${convSubject}\n\n${body}\n\n— ${displayName}`,
    html,
  })

  logActivity({
    module: "email",
    recordId: input.conversationId,
    type: result.ok ? "email_sent" : "email_failed",
    data: {
      kind: "acknowledgment",
      to: input.contactEmail,
      resendId: result.id ?? null,
      error: result.error ?? null,
    },
    workspaceId: input.workspaceId,
  }).catch(() => null)

  return result
}

export async function sendOutboundEmail(input: SendOutboundEmailInput): Promise<SendEmailResult> {
  const t = getTranslations(resolveLocaleFromConfig(input.workspaceConfig))
  const displayName = sanitizeDisplayName(input.workspaceName)
  const mode = input.mode ?? "reply"

  const subjectBase = input.subject?.trim() || t.email.outbound.defaultSubject
  const subject = mode === "forward"
    ? ensureFwdPrefix(subjectBase)
    : ensureRePrefix(subjectBase)

  const footerText = t.email.outbound.footer(displayName)
  const bodyText = `${input.messageContent}\n\n---\n${footerText}`
  const footerEscaped = escapeHtml(footerText)

  /**
   * Open-tracking pixel: only injected for outbound replies when the caller explicitly opts-in
   * AND we successfully signed a token (which requires AUTH_SECRET + a public base URL). In any
   * other case we skip — a missing pixel is preferable to a broken `<img>` in the email body.
   */
  const pixelUrl = input.tracking?.enabled && input.tracking.messageId && input.tracking.workspaceId
    ? buildOpenPixelUrl(input.tracking.messageId, input.tracking.workspaceId)
    : null
  const trackingPixelHtml = pixelUrl
    ? `<img src="${pixelUrl}" alt="" width="1" height="1" style="display:block;border:0;width:1px;height:1px;max-height:1px;max-width:1px;overflow:hidden;opacity:0" />`
    : ""

  /**
   * Receipt-confirmation CTA: opt-in per message, never on by default. We only render the link
   * when the caller asked for it AND we could sign a confirm-kind token. The endpoint is
   * idempotent so the customer can click multiple times without side effects.
   */
  const confirmUrl = input.tracking?.askConfirm && input.tracking.messageId && input.tracking.workspaceId
    ? buildConfirmReceiptUrl(input.tracking.messageId, input.tracking.workspaceId)
    : null
  const confirmHtml = confirmUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0 0"><tr><td><a href="${confirmUrl}" target="_blank" rel="noopener" style="display:inline-block;padding:10px 18px;border-radius:6px;background:#4f46e5;color:#ffffff;text-decoration:none;font-family:system-ui,-apple-system,sans-serif;font-size:13px;font-weight:600;">Confirm you received this</a></td></tr><tr><td style="padding-top:6px;font-family:system-ui,-apple-system,sans-serif;font-size:11px;color:#94a3b8;">A single click is enough — no further action needed.</td></tr></table>`
    : ""

  const bodyHtml = `<div style="font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.5;">${escapeHtml(input.messageContent).split("\n").join("<br>")}</div>${confirmHtml}<hr style="margin: 1.5em 0; border: none; border-top: 1px solid #e2e8f0;" /><p style="font-family: system-ui, sans-serif; font-size: 12px; color: #64748b;">${footerEscaped}</p>${trackingPixelHtml}`

  const recipients = resolveRecipients(input)
  const cs = input.connectionSender

  const outboundProvider = process.env.DEFAULT_OUTBOUND_PROVIDER || "resend"

  const commonPayload = {
    subject,
    text: bodyText,
    html: bodyHtml,
    ...(input.cc?.length ? { cc: input.cc } : {}),
    ...(input.bcc?.length ? { bcc: input.bcc } : {}),
    ...(input.attachments?.length
      ? {
          attachments: input.attachments.map((a) => ({
            filename: a.filename,
            path: a.url,
            contentType: a.contentType,
          })),
        }
      : {}),
  }

  if (
    outboundProvider === "connection_smtp" &&
    cs?.provider === "imap_smtp" &&
    cs.smtpConfig &&
    cs.encryptedCredentials
  ) {
    console.log(`[email-outbound] Sending via SMTP (connection provider)`)
    return sendEmailSmtp({
      connectionConfig: cs.smtpConfig,
      encryptedCredentials: cs.encryptedCredentials,
      to: recipients,
      ...(input.threading
        ? { inReplyTo: input.threading.inReplyTo, references: input.threading.references }
        : {}),
      ...commonPayload,
    })
  }

  if (cs?.provider === "imap_smtp") {
    console.log(`[email-outbound] Connection is imap_smtp but outbound=${outboundProvider}, using Resend`)
  }

  const from = resolveInboxFrom(displayName, cs)
  console.log(`[email-outbound] Sending via Resend from=${from}`)
  return sendEmail({
    to: recipients,
    from,
    ...(input.threading
      ? {
          headers: {
            "In-Reply-To": input.threading.inReplyTo,
            References: input.threading.references.join(" "),
          },
        }
      : {}),
    ...commonPayload,
  })
}

function ensureFwdPrefix(subject: string): string {
  const trimmed = subject.trim()
  if (/^fwd?:\s*/i.test(trimmed)) return trimmed
  return `Fwd: ${trimmed}`
}

function resolveRecipients(input: SendOutboundEmailInput): string | string[] {
  const mode = input.mode ?? "reply"

  if (mode === "forward") {
    return input.to?.length ? input.to : input.contactEmail
  }

  if (mode === "reply_all" && input.to?.length) {
    const all = new Set([input.contactEmail, ...input.to])
    return [...all]
  }

  return input.contactEmail
}
