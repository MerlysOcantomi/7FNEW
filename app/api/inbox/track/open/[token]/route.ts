import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { verifyTrackingToken, type TrackingTokenPayload } from "@core/inbox-tracking"
import { applyDeliveryEventToMessage } from "@modules/inbox/delivery-service"

/**
 * Public open-tracking endpoint. Always responds with a 1x1 transparent PNG, even when the
 * token is invalid, the message no longer exists, or any other error occurs. This matters for
 * privacy reasons: the recipient's email client must not reveal anything about the workspace
 * or the message via response codes/timing/headers.
 *
 * Security model:
 *  - The path token is HMAC-signed with AUTH_SECRET; raw message ids never appear in URLs.
 *  - Lookups are scoped by both `messageId` AND `workspaceId` from the token payload.
 *  - Only outbound, non-internal messages are updated. Internal notes never carry a pixel.
 *  - Cache headers prevent the pixel from being served from cache so re-opens stay countable.
 *
 * False-positive heuristics (Phase 2 MVP — purposely conservative):
 *  - User-Agent contains "GoogleImageProxy" / "ggpht" → openProxy=true (Gmail proxy fetch)
 *  - User-Agent contains "Apple" → openProxy=true (Apple Mail Privacy Protection prefetch)
 *  - User-Agent contains "Outlook"/"Microsoft" → openSuspect=true (link/image preview)
 *  - Hit < 3s after emailAttemptedAt → openSuspect=true (server prefetch likely)
 *  - Empty / curl / bot UA → openSuspect=true
 */

type Params = { params: Promise<{ token: string }> }

/** 1x1 transparent PNG, base64-encoded once at module load. */
const PIXEL_BUFFER = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAoAAv/lxKUAAAAASUVORK5CYII=",
  "base64",
)

const PIXEL_HEADERS = {
  "Content-Type": "image/png",
  "Content-Length": String(PIXEL_BUFFER.length),
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
  /** Defense in depth: tracking pixel must never be embedded as anything other than an image. */
  "X-Content-Type-Options": "nosniff",
  "Cross-Origin-Resource-Policy": "cross-origin",
}

/** Always returns the same pixel — used for both success and silent-failure paths. */
function pixelResponse() {
  return new NextResponse(new Uint8Array(PIXEL_BUFFER), {
    status: 200,
    headers: PIXEL_HEADERS,
  })
}

const PROXY_SIGNATURES = [
  /googleimageproxy/i,
  /ggpht/i,
  /yahoo.*mail.*proxy/i,
]

const APPLE_SIGNATURES = [/apple/i, /ios/i, /iphone/i, /ipad/i, /macintosh/i]
const MS_SIGNATURES = [/outlook/i, /microsoft/i]
const SUSPECT_SIGNATURES = [/curl/i, /python/i, /node-fetch/i, /headlesschrome/i, /bot/i, /spider/i]

interface OpenSignals {
  openProxy: boolean
  openSuspect: boolean
}

function classifyUserAgent(userAgent: string | null): OpenSignals {
  if (!userAgent) {
    /** Many proxies strip UA; treat as suspect rather than open to avoid inflating counts. */
    return { openProxy: false, openSuspect: true }
  }
  const ua = userAgent.toLowerCase()
  const isProxy = PROXY_SIGNATURES.some((re) => re.test(ua)) || APPLE_SIGNATURES.some((re) => re.test(ua))
  const isMs = MS_SIGNATURES.some((re) => re.test(ua))
  const isSuspect = SUSPECT_SIGNATURES.some((re) => re.test(ua))
  return {
    openProxy: isProxy,
    openSuspect: isMs || isSuspect,
  }
}

interface ExistingTrackingMeta {
  emailAttemptedAt?: string
  openedAt?: string
  lastOpenedAt?: string
  openCount?: number
  openProxy?: boolean
  openSuspect?: boolean
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { token: rawToken } = await params

    /** Strip the optional `.png` suffix used to make the URL look like an image. */
    const token = rawToken.endsWith(".png") ? rawToken.slice(0, -4) : rawToken
    const payload: TrackingTokenPayload | null = verifyTrackingToken(token)

    /**
     * Invalid/expired/forged tokens silently return the pixel with no DB writes. We deliberately
     * do not surface the failure to the caller — the goal is to be opaque to the recipient's
     * email client and to anyone scanning URLs.
     */
    if (!payload || payload.k !== "open") {
      return pixelResponse()
    }

    const { m: messageId, w: workspaceId } = payload

    const message = await db.message.findFirst({
      where: { id: messageId, workspaceId },
      select: { id: true, direction: true, isInternal: true, metadata: true },
    })

    if (!message || message.direction !== "outbound" || message.isInternal) {
      /** Defensive: never leak that the message was found via differing latency/codes. */
      return pixelResponse()
    }

    const userAgent = request.headers.get("user-agent")
    const { openProxy, openSuspect: suspectFromUa } = classifyUserAgent(userAgent)

    let currentMeta: ExistingTrackingMeta = {}
    if (message.metadata) {
      try {
        currentMeta = JSON.parse(message.metadata) as ExistingTrackingMeta
      } catch {
        /** Malformed metadata gets quietly replaced — better than crashing on every open. */
      }
    }

    /**
     * Sub-3s after attempted send → server-side prefetch (some clients pre-warm the pixel as
     * soon as the message hits the inbox). We still record the hit but flag it as suspect so
     * the UI can degrade to "Possibly opened" instead of confidently saying "Opened".
     */
    let openSuspect = suspectFromUa
    if (currentMeta.emailAttemptedAt) {
      const attemptedAt = Date.parse(currentMeta.emailAttemptedAt)
      if (Number.isFinite(attemptedAt) && Date.now() - attemptedAt < 3000) {
        openSuspect = true
      }
    }

    const now = new Date().toISOString()
    const previousCount = typeof currentMeta.openCount === "number" ? currentMeta.openCount : 0

    const updatedMeta = {
      ...currentMeta,
      openedAt: currentMeta.openedAt ?? now,
      lastOpenedAt: now,
      openCount: previousCount + 1,
      openProxy: Boolean(currentMeta.openProxy) || openProxy,
      openSuspect: Boolean(currentMeta.openSuspect) || openSuspect,
    }

    try {
      await db.message.update({
        where: { id: messageId },
        data: { metadata: JSON.stringify(updatedMeta) },
      })
    } catch (err) {
      /** Even DB write failures must return the pixel so the UA does not retry indefinitely. */
      console.error(`[inbox-tracking] Could not record open for msg=${messageId}:`, err)
    }

    /**
     * Dual-write (INBOX-DATA-04B): project the pixel open into the
     * normalized read columns with `readSource: "tracking_pixel"`. Suspect/
     * proxy heuristics stay metadata-only (same trust level the UI applies);
     * the projection helper guarantees a stronger source is never
     * downgraded by a later pixel hit.
     */
    try {
      await applyDeliveryEventToMessage(messageId, {
        type: "read",
        at: new Date(updatedMeta.openedAt ?? now),
        readSource: "tracking_pixel",
      })
    } catch (err) {
      console.error(`[inbox-tracking] Could not project read for msg=${messageId}:`, err)
    }

    return pixelResponse()
  } catch (err) {
    /** Last-resort safety net — never throw to the email client. */
    console.error("[inbox-tracking] Unexpected error in open endpoint:", err)
    return pixelResponse()
  }
}
