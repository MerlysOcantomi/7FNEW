import { Resend } from "resend"

export interface SendEmailInput {
  to: string
  from: string
  subject: string
  text: string
  html?: string
}

export async function sendEmail(input: SendEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey?.trim()) {
    console.warn("[7F] sendEmail skipped: RESEND_API_KEY is not set")
    return
  }

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
    })
    if (error) {
      console.error("[7F] Resend send error:", error)
    }
  } catch (err) {
    console.error("[7F] sendEmail failed:", err)
  }
}
