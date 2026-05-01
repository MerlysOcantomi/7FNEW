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

/** Maximum acceptable token age — 90 days. Tokens older than this are considered stale. */
export const TRACKING_TOKEN_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

function getSecret(): string {
  return process.env.AUTH_SECRET ?? ""
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
  if (!getSecret()) {
    /**
     * Without AUTH_SECRET the HMAC degrades to "hmac of empty key", which is technically still
     * deterministic but trivially forgeable. We log loudly because this should never happen in
     * production; the email pipeline still continues so dev environments don't break.
     */
    console.warn("[inbox-tracking] AUTH_SECRET is not set — tracking tokens are insecure.")
  }
  const data = base64urlEncode(Buffer.from(JSON.stringify(payload), "utf8"))
  const sig = base64urlEncode(createHmac("sha256", getSecret()).update(data).digest())
  return `${data}.${sig}`
}

export function verifyTrackingToken(token: string): TrackingTokenPayload | null {
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

  const expectedSig = createHmac("sha256", getSecret()).update(data).digest()
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
  ) {
    return null
  }
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
  const token = signTrackingToken({
    m: messageId,
    w: workspaceId,
    k: "open",
    t: Date.now(),
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
  const token = signTrackingToken({
    m: messageId,
    w: workspaceId,
    k: "confirm",
    t: Date.now(),
  })
  return `${base}/api/inbox/track/confirm/${token}`
}
