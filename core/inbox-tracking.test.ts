/**
 * INBOX-FIX-02 — tracking tokens are the ONLY guard of the public
 * `/api/inbox/track/*` routes (the recipient's mail client has no session),
 * so signing/verification must fail closed without a usable AUTH_SECRET.
 * Pure: no DB, no network; all secrets here are synthetic.
 */

import assert from "node:assert/strict"
import test, { afterEach, beforeEach } from "node:test"
import { createHmac } from "node:crypto"
import {
  __setTrackingClockForTests,
  buildConfirmReceiptUrl,
  buildOpenPixelUrl,
  isTrackingSigningAvailable,
  signTrackingToken,
  TRACKING_TOKEN_MAX_AGE_MS,
  verifyTrackingToken,
  type TrackingTokenPayload,
} from "./inbox-tracking"

const SECRET = "inbox-tracking-test-secret-synthetic"
const saved: { secret: string | undefined; appUrl: string | undefined } = { secret: undefined, appUrl: undefined }

beforeEach(() => {
  saved.secret = process.env.AUTH_SECRET
  saved.appUrl = process.env.NEXT_PUBLIC_APP_URL
  process.env.AUTH_SECRET = SECRET
  process.env.NEXT_PUBLIC_APP_URL = "https://app.example.test"
  __setTrackingClockForTests(() => NOW)
})
afterEach(() => {
  __setTrackingClockForTests(null)
  if (saved.secret === undefined) delete process.env.AUTH_SECRET
  else process.env.AUTH_SECRET = saved.secret
  if (saved.appUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL
  else process.env.NEXT_PUBLIC_APP_URL = saved.appUrl
})

/** Fixed "now" so age checks are deterministic; the payload was issued one hour earlier. */
const NOW = 1_800_000_000_000
const PAYLOAD: TrackingTokenPayload = { m: "msg_1", w: "ws_1", k: "open", t: NOW - 60 * 60 * 1000 }

function base64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

/** A token signed with an arbitrary key — what an attacker could produce. */
function forge(payload: TrackingTokenPayload, key: string): string {
  const data = base64url(Buffer.from(JSON.stringify(payload), "utf8"))
  const sig = base64url(createHmac("sha256", key).update(data).digest())
  return `${data}.${sig}`
}

test("round trip: a token signed with the configured secret verifies to its payload", () => {
  const token = signTrackingToken(PAYLOAD)
  assert.deepEqual(verifyTrackingToken(token), PAYLOAD)
  assert.equal(isTrackingSigningAvailable(), true)
})

test("wrong key, tampered payload and malformed tokens are rejected", () => {
  assert.equal(verifyTrackingToken(forge(PAYLOAD, "another-key")), null)
  const token = signTrackingToken(PAYLOAD)
  const [data, sig] = token.split(".")
  const tampered = `${base64url(Buffer.from(JSON.stringify({ ...PAYLOAD, m: "msg_2" }), "utf8"))}.${sig}`
  assert.equal(verifyTrackingToken(tampered), null)
  assert.equal(verifyTrackingToken(data), null)
  assert.equal(verifyTrackingToken(`${data}.`), null)
  assert.equal(verifyTrackingToken(""), null)
  assert.equal(verifyTrackingToken("not-a-token"), null)
})

test("without AUTH_SECRET nothing verifies — not even a token HMAC'd over the empty key", () => {
  const forgedWithEmptyKey = forge(PAYLOAD, "")
  delete process.env.AUTH_SECRET
  assert.equal(isTrackingSigningAvailable(), false)
  assert.equal(verifyTrackingToken(forgedWithEmptyKey), null)
  process.env.AUTH_SECRET = "   "
  assert.equal(isTrackingSigningAvailable(), false)
  assert.equal(verifyTrackingToken(forgedWithEmptyKey), null)
})

test("without AUTH_SECRET signing throws and the email link builders skip tracking (null)", () => {
  delete process.env.AUTH_SECRET
  assert.throws(() => signTrackingToken(PAYLOAD), /AUTH_SECRET/)
  assert.equal(buildOpenPixelUrl("msg_1", "ws_1"), null)
  assert.equal(buildConfirmReceiptUrl("msg_1", "ws_1"), null)
})

test("with a secret and a base URL the builders emit public tracking URLs whose tokens verify", () => {
  const pixel = buildOpenPixelUrl("msg_1", "ws_1")
  const confirm = buildConfirmReceiptUrl("msg_1", "ws_1")
  assert.ok(pixel?.startsWith("https://app.example.test/api/inbox/track/open/"))
  assert.ok(pixel?.endsWith(".png"))
  assert.ok(confirm?.startsWith("https://app.example.test/api/inbox/track/confirm/"))
  const pixelToken = pixel!.slice(pixel!.lastIndexOf("/") + 1).replace(/\.png$/, "")
  const confirmToken = confirm!.slice(confirm!.lastIndexOf("/") + 1)
  assert.equal(verifyTrackingToken(pixelToken)?.k, "open")
  assert.equal(verifyTrackingToken(confirmToken)?.k, "confirm")
})

test("stale tokens are rejected once older than TRACKING_TOKEN_MAX_AGE_MS; fresh ones verify", () => {
  const fresh = signTrackingToken({ ...PAYLOAD, t: NOW - TRACKING_TOKEN_MAX_AGE_MS + 1000 })
  assert.deepEqual(verifyTrackingToken(fresh)?.m, "msg_1")
  const stale = signTrackingToken({ ...PAYLOAD, t: NOW - TRACKING_TOKEN_MAX_AGE_MS - 1000 })
  assert.equal(verifyTrackingToken(stale), null)
  // Far-future issued-at (beyond the skew allowance) is invalid too.
  const future = signTrackingToken({ ...PAYLOAD, t: NOW + 2 * 24 * 60 * 60 * 1000 })
  assert.equal(verifyTrackingToken(future), null)
  // Non-finite issued-at never verifies.
  const nan = signTrackingToken({ ...PAYLOAD, t: Number.NaN })
  assert.equal(verifyTrackingToken(nan), null)
})
