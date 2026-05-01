import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyTrackingToken, type TrackingTokenPayload } from "@core/inbox-tracking"

/**
 * Public manual receipt-confirmation endpoint. The customer clicks a CTA in the email body and
 * we record `confirmedReadAt` on the corresponding outbound Message. The endpoint is idempotent
 * (we never overwrite an existing timestamp) so multiple clicks are harmless.
 *
 * Privacy / safety:
 *  - Token is HMAC-signed with `kind: "confirm"`; pixel-kind tokens cannot reach this endpoint.
 *  - Lookups scoped by both messageId AND workspaceId from the token payload.
 *  - Only outbound, non-internal messages are updated.
 *  - Response is a static neutral HTML page that reveals nothing about workspace/conversation
 *    (no recipient name, no message preview, no IDs).
 *  - Errors and invalid tokens collapse into a generic "could not confirm" message; we never
 *    differentiate to avoid leaking existence/ownership of a message id.
 */

type Params = { params: Promise<{ token: string }> }

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  "X-Content-Type-Options": "nosniff",
  /** Strict-ish CSP to limit blast radius if an attacker ever finds an injection vector. */
  "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
  "Referrer-Policy": "no-referrer",
}

function renderPage(opts: { ok: boolean }) {
  const title = opts.ok ? "Confirmation recorded" : "Confirmation"
  const body = opts.ok
    ? "Thanks, your confirmation was recorded."
    : "We could not record this confirmation. You can safely close this tab."
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <meta name="robots" content="noindex,nofollow" />
  <title>${title}</title>
  <style>
    html,body{margin:0;padding:0;background:#f8fafc;color:#0f172a;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif}
    .wrap{min-height:100vh;display:grid;place-items:center;padding:24px}
    .card{max-width:420px;width:100%;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:32px;text-align:center;box-shadow:0 1px 2px rgba(15,23,42,0.04)}
    h1{margin:0 0 8px;font-size:18px;font-weight:600}
    p{margin:0;color:#475569;font-size:14px;line-height:1.6}
  </style>
</head>
<body>
  <div class="wrap"><div class="card"><h1>${title}</h1><p>${body}</p></div></div>
</body>
</html>`
  return new NextResponse(html, { status: 200, headers: HTML_HEADERS })
}

interface ExistingConfirmMeta {
  confirmedReadAt?: string
}

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { token } = await params
    const payload: TrackingTokenPayload | null = verifyTrackingToken(token)

    if (!payload || payload.k !== "confirm") {
      return renderPage({ ok: false })
    }

    const { m: messageId, w: workspaceId } = payload

    const message = await db.message.findFirst({
      where: { id: messageId, workspaceId },
      select: { id: true, direction: true, isInternal: true, metadata: true },
    })

    if (!message || message.direction !== "outbound" || message.isInternal) {
      /** Same neutral HTML — never differentiate to avoid leaking existence. */
      return renderPage({ ok: false })
    }

    let currentMeta: ExistingConfirmMeta & Record<string, unknown> = {}
    if (message.metadata) {
      try {
        currentMeta = JSON.parse(message.metadata) as ExistingConfirmMeta & Record<string, unknown>
      } catch {
        /** Malformed metadata gets quietly replaced. */
      }
    }

    /**
     * Idempotent: keep the original click time. Repeated visits do not bump confirmedReadAt
     * so the UI sees a stable "Confirmed received · {original time}" label.
     */
    if (!currentMeta.confirmedReadAt) {
      const updatedMeta = {
        ...currentMeta,
        confirmedReadAt: new Date().toISOString(),
      }
      try {
        await db.message.update({
          where: { id: messageId },
          data: { metadata: JSON.stringify(updatedMeta) },
        })
      } catch (err) {
        console.error(`[inbox-tracking] Could not record confirm for msg=${messageId}:`, err)
        /** Still render success page — the customer did click, blame is internal. */
      }
    }

    return renderPage({ ok: true })
  } catch (err) {
    console.error("[inbox-tracking] Unexpected error in confirm endpoint:", err)
    return renderPage({ ok: false })
  }
}
