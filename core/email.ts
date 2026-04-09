import { Resend } from "resend"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmailAttachment {
  filename: string
  /** Public URL — Resend will fetch the file at send time. */
  path?: string
  /** Raw binary content. */
  content?: Buffer
  contentType?: string
}

export interface SendEmailInput {
  to: string | string[]
  subject: string
  text: string
  html?: string
  /** Defaults to RESEND_FROM_EMAIL env var when omitted. */
  from?: string
  replyTo?: string
  cc?: string[]
  bcc?: string[]
  attachments?: EmailAttachment[]
}

export interface SendEmailResult {
  ok: boolean
  /** Resend message id when successful. */
  id?: string
  error?: string
}

// ---------------------------------------------------------------------------
// Singleton client
// ---------------------------------------------------------------------------

let _resend: Resend | null = null

function getResend(): Resend | null {
  if (_resend) return _resend
  const key = process.env.RESEND_API_KEY
  if (!key?.trim()) return null
  _resend = new Resend(key)
  return _resend
}

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------

const EMAIL_SEND_TIMEOUT_MS = 15_000

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    promise.then(resolve, reject).finally(() => clearTimeout(timer))
  })
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const resend = getResend()
  if (!resend) {
    console.warn("[email-send] Skipped: RESEND_API_KEY is not set")
    return { ok: false, error: "RESEND_API_KEY is not configured" }
  }

  const from = input.from ?? process.env.RESEND_FROM_EMAIL
  if (!from) {
    return { ok: false, error: "No sender address: set RESEND_FROM_EMAIL or pass `from`" }
  }

  const to = Array.isArray(input.to) ? input.to.join(", ") : input.to

  try {
    const { data, error } = await withTimeout(
      resend.emails.send({
        from,
        to: input.to,
        subject: input.subject,
        text: input.text,
        html: input.html,
        replyTo: input.replyTo,
        ...(input.cc?.length ? { cc: input.cc } : {}),
        ...(input.bcc?.length ? { bcc: input.bcc } : {}),
        ...(input.attachments?.length
          ? {
              attachments: input.attachments.map((a) => ({
                filename: a.filename,
                path: a.path,
                content: a.content,
                content_type: a.contentType,
              })),
            }
          : {}),
      }),
      EMAIL_SEND_TIMEOUT_MS,
      "Resend.emails.send",
    )

    if (error) {
      console.error(`[email-send] Resend API error to=${to} subject="${input.subject}":`, error.message)
      return { ok: false, error: error.message }
    }

    console.log(`[email-send] OK to=${to} id=${data?.id}`)
    return { ok: true, id: data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[email-send] Failed to=${to} subject="${input.subject}": ${message}`)
    return { ok: false, error: message }
  }
}
