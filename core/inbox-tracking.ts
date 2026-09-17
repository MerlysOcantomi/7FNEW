import { createHmac, timingSafeEqual } from "crypto"

/**
 * Inbox open-tracking helpers.
 *
 * Generates and verifies short signed tokens used to identify a Message in public-facing
 * tracking endpoints (the email's invisible pixel). The raw `messageId` is embedded inside
 * a base64url payload and protected by an HMAC-SHA256 signature derived from `AUTH_SECRET`.
 *
 * Properties:
 *  - The customer's email client never sees the raw `messageId` (it lives inside the payload).
 *  - Without `AUTH_SECRET` no valid token can be forged.
 *  - Rotating `AUTH_SECRET` invalidates every previously issued token (intentional).
 *
 * Tokens are NOT encrypted, only signed. Anyone in possession of a token can decode the
 * payload to read messageId/workspaceId. The signature only guarantees authenticity.
 * That's acceptable here because the tracking endpoint never returns those values back.
 */

export type TrackingKind = "open" | "confirm"

export interface TrackingTokenPayload {
  /** Message id this token belongs to. */
  m: string
  /** Workspace id used to scope DB lookups defensively. */
  w: string
  /** Token kind — "open" for the pixel, "confirm" reserved for Phase 3 manual receipt. */
  k: TrackingKind
  /** Issued-at epoch ms; lets us optionally reject stale tokens later. */
  t: number
}

/** Maximum acceptable token age — 90 days. Older tokens are rejected by `verifyTrackingToken`. */
export const TRACKING_TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000
/** Clock-skew allowance for tokens whose issued-at lies in the future (1 day). */
export const TRACKING_TOKEN_FUTURE_SKEW_MS = 24 * 60 * 60 * 1000

/** Injectable clock for tests; production uses the real clock. */
let now: () => number = () => Date.now()
export function __setTrackingClockForTests(clock: (() => number) | null): void {
  now = clock ?? (() => Date.now())
}

/**
 * The signing secret, or `null` when unusable (INBOX-FIX-02, mirrors the
 * middleware's CORE-02B.1 rule): absent or whitespace-only means NO token can
 * be signed or verified — never an HMAC over a blank key, which any client
 * could forge. The tracking routes are public (the recipient's mail client
 * has no session), so this fail-closed guard is what protects them.
 */
function getSecret(): string | null {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.trim().length === 0) return null
  return secret
}

/** True when tracking tokens can be signed/verified in this environment. */
export function isTrackingSigningAvailable(): boolean {
  return getSecret() !== null
}

function base64urlEncode(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function base64urlDecode(value: string): Buffer {
  const pad = (4 - (value.length % 4)) % 4
  const b64 = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat(pad)
  return Buffer.from(b64, "base64")
}

export function signTrackingToken(payload: TrackingTokenPayload): string {
  const secret = getSecret()
  if (!secret) {
    /**
     * Fail closed: a token signed over a blank key would be trivially forgeable and the
     * public tracking routes would accept it. Callers that embed links (`buildOpenPixelUrl`,
     * `buildConfirmReceiptUrl`) check `isTrackingSigningAvailable()` first and simply skip
     * tracking, so the email pipeline never reaches this throw in a misconfigured dev env.
     */
    throw new Error("[inbox-tracking] AUTH_SECRET is not set — cannot sign tracking tokens.")
  }
  const data = base64urlEncode(Buffer.from(JSON.stringify(payload), "utf8"))
  const sig = base64urlEncode(createHmac("sha256", secret).update(data).digest())
  return `${data}.${sig}`
}

export function verifyTrackingToken(token: string): TrackingTokenPayload | null {
  /** No usable secret → nothing verifies. Never fall back to an empty-key HMAC. */
  const secret = getSecret()
  if (!secret) return null
  if (!token || typeof token !== "string") return null
  const dot = token.indexOf(".")
  if (dot <= 0 || dot === token.length - 1) return null
  const data = token.slice(0, dot)
  const providedSigB64 = token.slice(dot + 1)

  let providedSig: Buffer
  try {
    providedSig = base64urlDecode(providedSigB64)
  } catch {
    return null
  }

  const expectedSig = createHmac("sha256", secret).update(data).digest()
  if (expectedSig.length !== providedSig.length) return null
  /** Constant-time comparison defends against timing attacks even though the surface is small. */
  let equal = false
  try {
    equal = timingSafeEqual(expectedSig, providedSig)
  } catch {
    return null
  }
  if (!equal) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(base64urlDecode(data).toString("utf8"))
  } catch {
    return null
  }
  if (
    !parsed
    || typeof parsed !== "object"
    || typeof (parsed as TrackingTokenPayload).m !== "string"
    || typeof (parsed as TrackingTokenPayload).w !== "string"
    || ((parsed as TrackingTokenPayload).k !== "open" && (parsed as TrackingTokenPayload).k !== "confirm")
    || typeof (parsed as TrackingTokenPayload).t !== "number"
    || !Number.isFinite((parsed as TrackingTokenPayload).t)
  ) {
    return null
  }
  /**
   * Stale tokens are rejected (INBOX-FIX-02): now that the routes are reachable
   * by anyone holding a link, a pixel/confirm URL must stop counting after
   * `TRACKING_TOKEN_MAX_AGE_MS`. Tokens "from the future" (clock skew beyond a
   * generous margin) are treated as invalid too.
   */
  const age = now() - (parsed as TrackingTokenPayload).t
  if (age > TRACKING_TOKEN_MAX_AGE_MS || age < -TRACKING_TOKEN_FUTURE_SKEW_MS) return null
  return parsed as TrackingTokenPayload
}

/**
 * Resolve the public-facing base URL used to host tracking endpoints. Falls back to env vars in
 * order of preference; on Vercel `VERCEL_URL` is provided without protocol so we prefix `https://`.
 * Returns empty string if nothing is configured (callers must skip pixel injection in that case).
 */
export function getAppBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL
  if (explicit) return explicit.replace(/\/+$/, "")
  const vercel = process.env.VERCEL_URL
  if (vercel) {
    return vercel.startsWith("http") ? vercel.replace(/\/+$/, "") : `https://${vercel.replace(/\/+$/, "")}`
  }
  return ""
}

/**
 * Build the tracking-pixel URL for an outbound message. Returns null if no base URL is
 * configured, signaling the caller to skip pixel injection (no broken absolute URLs in the
 * email body).
 */
export function buildOpenPixelUrl(messageId: string, workspaceId: string): string | null {
  const base = getAppBaseUrl()
  if (!base) return null
  if (!isTrackingSigningAvailable()) return null
  const token = signTrackingToken({
    m: messageId,
    w: workspaceId,
    k: "open",
    t: now(),
  })
  return `${base}/api/inbox/track/open/${token}.png`
}

/**
 * Build the manual receipt-confirmation URL. Same signing scheme as the pixel but with
 * `kind: "confirm"`, so the two endpoints can never accept each other's tokens. Returns null
 * when no base URL is configured (caller skips the link).
 */
export function buildConfirmReceiptUrl(messageId: string, workspaceId: string): string | null {
  const base = getAppBaseUrl()
  if (!base) return null
  if (!isTrackingSigningAvailable()) return null
  const token = signTrackingToken({
    m: messageId,
    w: workspaceId,
    k: "confirm",
    t: now(),
  })
  return `${base}/api/inbox/track/confirm/${token}`
}
