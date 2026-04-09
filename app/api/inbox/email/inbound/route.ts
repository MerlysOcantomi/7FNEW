import { NextRequest, NextResponse } from "next/server"
import { processInboundEmail } from "@modules/inbox/email-inbound"

export async function POST(request: NextRequest) {
  // ---- webhook secret validation (query param or header) ----
  const secret = process.env.RESEND_WEBHOOK_SECRET
  if (secret) {
    const url = new URL(request.url)
    const qsSecret = url.searchParams.get("secret")
    const headerSecret = request.headers.get("x-webhook-secret")
    if (qsSecret !== secret && headerSecret !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  // ---- parse body ----
  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const payload = body as { type?: string; data?: { email_id?: string } }

  if (payload.type !== "email.received") {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const emailId = payload.data?.email_id
  if (!emailId || typeof emailId !== "string") {
    return NextResponse.json({ error: "Missing data.email_id" }, { status: 400 })
  }

  // ---- process ----
  try {
    const result = await processInboundEmail(emailId)

    if (result.alreadyProcessed) {
      console.log(`[email-inbound] Duplicate skipped: ${emailId}`)
      return NextResponse.json({ ok: true, duplicate: true })
    }

    console.log(
      `[email-inbound] Processed ${emailId} → conv=${result.conversationId} matched_by=${result.matchedBy} new=${result.isNewConversation}`,
    )
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[email-inbound] Error processing ${emailId}:`, message)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
