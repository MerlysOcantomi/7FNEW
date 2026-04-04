import { NextResponse } from "next/server"
import { sendEmail } from "@/core/email"

export async function GET() {
  const from = process.env.RESEND_FROM_EMAIL
  if (!from) {
    return NextResponse.json(
      { ok: false, error: "RESEND_FROM_EMAIL is not configured" },
      { status: 500 },
    )
  }

  const to = "mfajmsa@gmail.com"

  try {
    await sendEmail({
      to,
      from,
      subject: "Test Resend 7F",
      text: "This is a test email sent from the 7F platform via Resend.",
      html: `
        <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:32px">
          <h2 style="margin:0 0 16px">7F &mdash; Email Test</h2>
          <p style="color:#555;line-height:1.6">
            If you're reading this, Resend is correctly configured for the
            <strong>7F</strong> platform deployed on Vercel.
          </p>
          <p style="margin-top:24px;font-size:13px;color:#999">
            Sent at ${new Date().toISOString()}
          </p>
        </div>`,
    })

    return NextResponse.json({ ok: true, to, from })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
