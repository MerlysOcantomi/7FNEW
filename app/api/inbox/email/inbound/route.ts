import { NextRequest, NextResponse } from "next/server"
import { processInboundEmail } from "@modules/inbox/email-inbound"

export async function POST(request: NextRequest) {
  let rawBody: string | undefined

  try {
    // ---- webhook secret validation (required in production) ----
    const secret = process.env.RESEND_WEBHOOK_SECRET
    if (!secret) {
      console.error("[email-inbound-webhook] RESEND_WEBHOOK_SECRET is not configured — rejecting request")
      return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
    }
    const url = new URL(request.url)
    const qsSecret = url.searchParams.get("secret")
    const headerSecret = request.headers.get("x-webhook-secret")
    if (qsSecret !== secret && headerSecret !== secret) {
      console.warn("[email-inbound-webhook] Unauthorized request rejected")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // ---- parse body safely ----
    try {
      rawBody = await request.text()
    } catch {
      console.error("[email-inbound-webhook] Could not read request body")
      return NextResponse.json({ error: "Could not read body" }, { status: 400 })
    }

    let body: unknown
    try {
      body = JSON.parse(rawBody)
    } catch {
      console.error("[email-inbound-webhook] Invalid JSON body")
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    if (!body || typeof body !== "object") {
      console.warn("[email-inbound-webhook] Payload is not an object")
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
    }

    const payload = body as Record<string, unknown>
    const eventType = typeof payload.type === "string" ? payload.type : null

    if (eventType !== "email.received") {
      console.log(`[email-inbound-webhook] Skipped event type="${eventType}"`)
      return NextResponse.json({ ok: true, skipped: true })
    }

    const data = payload.data as Record<string, unknown> | undefined
    const emailId = typeof data?.email_id === "string" ? data.email_id : null

    if (!emailId) {
      console.error("[email-inbound-webhook] Missing or invalid data.email_id")
      return NextResponse.json({ error: "Missing data.email_id" }, { status: 400 })
    }

    // ---- process ----
    const result = await processInboundEmail(emailId)

    if (result.alreadyProcessed) {
      console.log(`[email-inbound-webhook] Duplicate skipped email=${emailId}`)
      return NextResponse.json({ ok: true, duplicate: true })
    }

    console.log(
      `[email-inbound-webhook] Processed email=${emailId} conv=${result.conversationId} matched_by=${result.matchedBy} new=${result.isNewConversation}`,
    )
    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[email-inbound-webhook] Unhandled error: ${message}`)
    return NextResponse.json({ error: "Internal processing error" }, { status: 500 })
  }
}
