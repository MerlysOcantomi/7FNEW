import nodemailer from "nodemailer"
import type { SendEmailResult } from "@core/email"
import { decryptJson } from "@core/crypto"

export interface SmtpConnectionConfig {
  smtpHost: string
  smtpPort: number
  smtpSecure: boolean
  fromEmail: string
  fromName?: string | null
}

export interface SmtpCredentials {
  email: string
  password: string
}

export interface SmtpSendInput {
  connectionConfig: SmtpConnectionConfig
  encryptedCredentials: string
  to: string | string[]
  subject: string
  text: string
  html?: string
  replyTo?: string
  cc?: string[]
  bcc?: string[]
  attachments?: Array<{ filename: string; path?: string; content?: Buffer; contentType?: string }>
}

const SMTP_TIMEOUT_MS = 20_000

/**
 * Send an email via SMTP using credentials from a ChannelConnection.
 * This is the counterpart to core/email.ts (Resend) for imap_smtp connections.
 */
export async function sendEmailSmtp(input: SmtpSendInput): Promise<SendEmailResult> {
  let creds: SmtpCredentials
  try {
    creds = decryptJson<SmtpCredentials>(input.encryptedCredentials)
  } catch {
    return { ok: false, error: "Failed to decrypt SMTP credentials" }
  }

  const cfg = input.connectionConfig
  const from = cfg.fromName
    ? `${cfg.fromName.replace(/[\r\n]+/g, " ").trim()} <${cfg.fromEmail}>`
    : cfg.fromEmail

  const transport = nodemailer.createTransport({
    host: cfg.smtpHost,
    port: cfg.smtpPort,
    secure: cfg.smtpSecure,
    auth: { user: creds.email, pass: creds.password },
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    tls: { rejectUnauthorized: false },
  })

  try {
    const info = await transport.sendMail({
      from,
      to: Array.isArray(input.to) ? input.to.join(", ") : input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
      cc: input.cc?.join(", "),
      bcc: input.bcc?.join(", "),
      attachments: input.attachments?.map((a) => ({
        filename: a.filename,
        path: a.path,
        content: a.content,
        contentType: a.contentType,
      })),
    })

    const messageId = info.messageId || info.response || undefined
    console.log(`[email-smtp] OK to=${input.to} messageId=${messageId}`)
    return { ok: true, id: messageId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[email-smtp] Failed to=${input.to}: ${message}`)
    return { ok: false, error: message }
  } finally {
    transport.close()
  }
}
