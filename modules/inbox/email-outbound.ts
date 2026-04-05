import { sendEmail, type SendEmailResult } from "@core/email"
import { escapeHtml, wrapEmailHtml, resolveAckEmailConfig } from "@core/email-templates"
import { logActivity } from "@core/activity"

export interface SendOutboundEmailInput {
  workspaceName: string
  contactEmail: string
  subject: string
  messageContent: string
}

function ensureRePrefix(subject: string): string {
  const trimmed = subject.trim()
  if (/^re:\s*/i.test(trimmed)) return trimmed
  return `Re: ${trimmed}`
}

function sanitizeDisplayName(name: string): string {
  return name.replace(/[\r\n]+/g, " ").trim() || "Business"
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
      type: "email_sent",
      data: { kind: "acknowledgment", to: input.contactEmail, skipped: true, reason: "disabled_by_config" },
      workspaceId: input.workspaceId,
    }).catch(() => null)
    return { ok: true, id: undefined }
  }

  const displayName = cfg.senderName || sanitizeDisplayName(input.workspaceName)
  const greeting = input.contactName ? `Hi ${escapeHtml(input.contactName)},` : "Hi,"
  const convSubject = input.conversationSubject || "Your message"
  const subject = cfg.subject || `Re: ${convSubject}`
  const heading = cfg.heading
  const body = cfg.body
  const footer = cfg.footer || `${displayName} — Powered by 7F`

  const html = wrapEmailHtml({
    body: `
      <p style="margin:0 0 16px"><strong>${greeting}</strong></p>
      <p style="margin:0 0 16px">${escapeHtml(heading)}</p>
      <div style="padding:12px 16px;background:#f3f4f6;border-radius:6px;margin:0 0 16px">
        <p style="margin:0;font-size:13px;color:#6b7280">Subject</p>
        <p style="margin:4px 0 0;font-weight:600">${escapeHtml(convSubject)}</p>
      </div>
      <p style="margin:0;font-size:14px;color:#6b7280">${escapeHtml(body)}</p>`,
    footer,
  })

  const result = await sendEmail({
    to: input.contactEmail,
    subject,
    text: `${greeting}\n\n${heading}\n\nSubject: ${convSubject}\n\n${body}\n\n— ${displayName}`,
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
  const displayName = sanitizeDisplayName(input.workspaceName)
  const from = `${displayName} <inbox@7f.app>`
  const subjectBase = input.subject?.trim() || "New message"
  const subject = ensureRePrefix(subjectBase)

  const footerText = `Sent via Smart Inbox — ${displayName}`
  const bodyText = `${input.messageContent}\n\n---\n${footerText}`
  const footerEscaped = escapeHtml(`Sent via Smart Inbox — ${displayName}`)
  const bodyHtml = `<div style="font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.5;">${escapeHtml(input.messageContent).split("\n").join("<br>")}</div><hr style="margin: 1.5em 0; border: none; border-top: 1px solid #e2e8f0;" /><p style="font-family: system-ui, sans-serif; font-size: 12px; color: #64748b;">${footerEscaped}</p>`

  return sendEmail({
    to: input.contactEmail,
    from,
    subject,
    text: bodyText,
    html: bodyHtml,
  })
}
