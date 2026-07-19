import { NextRequest, NextResponse } from "next/server"
import { db } from "@core/db"
import {
  isKnownWebhookProvider,
  resolveWebhookRouting,
} from "@modules/inbox/webhooks"
import { logInboxIntegrationEvent } from "@modules/inbox/integration-events"

/**
 * Provider webhook SKELETON (INBOX-TRANSPORT-05D) — routing infrastructure
 * for future channel integrations (Meta family, Twilio, TikTok). What it
 * does today, and ONLY this:
 *
 *   1. validate the provider segment;
 *   2. extract the provider account id from the minimal routing contract;
 *   3. resolve the ChannelConnection via [provider, providerAccountId]
 *      (the 04B index) — the tenant comes from the resolved row, never from
 *      the payload;
 *   4. answer honestly: `accepted: false` with a machine-readable reason.
 *      No payload is processed, nothing is ingested, nothing pretends to
 *      work. The real integration missions replace step 4 with signature
 *      verification + payload → InboundEnvelope → ingestInboundEnvelope.
 *
 * Response policy: always 200/404 with a JSON body. 200 + accepted:false
 * (instead of 4xx/5xx) for known providers avoids provider retry storms
 * while the integration is not live; unknown accounts are NOT
 * distinguishable from unimplemented processing (no existence leak).
 */

type Params = { params: Promise<{ provider: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { provider } = await params
  const normalized = provider.trim().toLowerCase()

  if (!isKnownWebhookProvider(normalized)) {
    logInboxIntegrationEvent({ event: "webhook_unknown_provider", provider: normalized })
    return NextResponse.json({ accepted: false, reason: "unknown_provider" }, { status: 404 })
  }

  let body: unknown = null
  try {
    body = await request.json()
  } catch {
    body = null
  }

  const routing = resolveWebhookRouting(normalized, body)
  if (!routing.ok) {
    logInboxIntegrationEvent({
      event: "webhook_unknown_account",
      provider: normalized,
      errorCode: routing.reason,
    })
    return NextResponse.json({ accepted: false, reason: routing.reason }, { status: 200 })
  }

  const connection = await db.channelConnection.findFirst({
    where: {
      provider: normalized,
      providerAccountId: routing.providerAccountId,
      status: "active",
    },
    select: { id: true, workspaceId: true, channelType: true },
  })

  if (!connection) {
    logInboxIntegrationEvent({
      event: "webhook_unknown_account",
      provider: normalized,
      providerAccountId: routing.providerAccountId,
    })
    // Same shape as the not-implemented answer — no account-existence leak.
    return NextResponse.json(
      { accepted: false, reason: "not_processed" },
      { status: 200 },
    )
  }

  /**
   * Connection resolved — the integration itself is NOT implemented yet.
   * Log with tenant context (ids only) so a prematurely-configured provider
   * is visible in observability, and answer honestly.
   */
  logInboxIntegrationEvent({
    event: "webhook_not_implemented",
    workspaceId: connection.workspaceId,
    connectionId: connection.id,
    channel: connection.channelType,
    provider: normalized,
    providerAccountId: routing.providerAccountId,
  })
  return NextResponse.json({ accepted: false, reason: "not_processed" }, { status: 200 })
}

/**
 * Provider verification handshakes (e.g. Meta's hub.challenge GET) require
 * per-connection verify tokens that only exist once a real integration is
 * configured — refusing now is the honest state.
 */
export async function GET() {
  return NextResponse.json(
    { accepted: false, reason: "verification_not_implemented" },
    { status: 405 },
  )
}
