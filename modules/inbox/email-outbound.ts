import { sendEmail } from "@core/email"

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

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export async function sendOutboundEmail(input: SendOutboundEmailInput): Promise<void> {
  const displayName = sanitizeDisplayName(input.workspaceName)
  const from = `${displayName} <inbox@7f.app>`
  const subjectBase = input.subject?.trim() || "New message"
  const subject = ensureRePrefix(subjectBase)

  const footerText = `Sent via Smart Inbox — ${displayName}`
  const bodyText = `${input.messageContent}\n\n---\n${footerText}`
  const footerEscaped = escapeHtml(`Sent via Smart Inbox — ${displayName}`)
  const bodyHtml = `<div style="font-family: system-ui, sans-serif; font-size: 14px; line-height: 1.5;">${escapeHtml(input.messageContent).split("\n").join("<br>")}</div><hr style="margin: 1.5em 0; border: none; border-top: 1px solid #e2e8f0;" /><p style="font-family: system-ui, sans-serif; font-size: 12px; color: #64748b;">${footerEscaped}</p>`

  await sendEmail({
    to: input.contactEmail,
    from,
    subject,
    text: bodyText,
    html: bodyHtml,
  })
}
