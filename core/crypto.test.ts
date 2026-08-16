/**
 * CORE-02B — adversarial tests for the channel-credential crypto (F-AUTH-02).
 *
 * Pure and deterministic: no database, no network. Every secret below is a
 * SYNTHETIC test value; no real credential appears anywhere. The environment
 * variables touched by a test are saved before and restored after each test,
 * so no state leaks between tests or into other files.
 */

import assert from "node:assert/strict"
import test, { beforeEach, afterEach } from "node:test"
import { createCipheriv, randomBytes, scryptSync } from "node:crypto"
import { encryptText, decryptText, encryptJson, decryptJson } from "./crypto"

// Mirrors the constants in core/crypto.ts — a format test below fails if the
// implementation drifts from them silently.
const SALT = "7f-channel-credentials"
const IV_LENGTH = 16

const SYNTHETIC_KEY = "synthetic-channel-key-for-tests-only"

const savedEnv: Record<string, string | undefined> = {}
const TOUCHED_VARS = ["CHANNEL_ENCRYPTION_KEY", "AUTH_SECRET"] as const

beforeEach(() => {
  for (const name of TOUCHED_VARS) savedEnv[name] = process.env[name]
  delete process.env.CHANNEL_ENCRYPTION_KEY
  delete process.env.AUTH_SECRET
})

afterEach(() => {
  for (const name of TOUCHED_VARS) {
    if (savedEnv[name] === undefined) delete process.env[name]
    else process.env[name] = savedEnv[name]
  }
})

/** Build a payload in the historical format (iv + tag + ciphertext, hex) with an arbitrary raw key. */
function encryptWithRawKey(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("hex")
}

test("encrypt fails closed when CHANNEL_ENCRYPTION_KEY is absent", () => {
  assert.throws(() => encryptText("secret-password"), /not configured/)
})

test("encrypt fails closed when CHANNEL_ENCRYPTION_KEY is empty or whitespace", () => {
  process.env.CHANNEL_ENCRYPTION_KEY = ""
  assert.throws(() => encryptText("secret-password"))
  process.env.CHANNEL_ENCRYPTION_KEY = "   "
  assert.throws(() => encryptText("secret-password"))
})

test("decrypt fails closed when CHANNEL_ENCRYPTION_KEY is absent", () => {
  assert.throws(() => decryptText("00".repeat(48)))
})

test("AUTH_SECRET alone no longer enables encryption (no key reuse)", () => {
  process.env.AUTH_SECRET = "synthetic-auth-secret-for-tests"
  assert.throws(() => encryptText("secret-password"), /not configured/)
  assert.throws(() => decryptText("00".repeat(48)))
})

test("the failure never includes the secret value", () => {
  process.env.AUTH_SECRET = "sentinel-auth-value-must-not-leak"
  try {
    encryptText("x")
    assert.fail("must have thrown")
  } catch (err) {
    const text = `${err instanceof Error ? err.message + (err.stack ?? "") : String(err)}`
    assert.ok(!text.includes("sentinel-auth-value-must-not-leak"))
  }
})

test("the all-zero fallback key is gone: a zero-key payload never decrypts", () => {
  const zeroKeyPayload = encryptWithRawKey(Buffer.alloc(32, 0), "mailbox-password")
  // Without a configured key: fails closed, not silently readable.
  assert.throws(() => decryptText(zeroKeyPayload))
  // With a real key configured: the GCM auth tag rejects the zero-key payload.
  process.env.CHANNEL_ENCRYPTION_KEY = SYNTHETIC_KEY
  assert.throws(() => decryptText(zeroKeyPayload))
})

test("round-trip works with a valid synthetic key", () => {
  process.env.CHANNEL_ENCRYPTION_KEY = SYNTHETIC_KEY
  const payload = encryptText("hola-mundo-¢øñ-unicode")
  assert.equal(decryptText(payload), "hola-mundo-¢øñ-unicode")
})

test("encryptJson/decryptJson round-trip preserves structure", () => {
  process.env.CHANNEL_ENCRYPTION_KEY = SYNTHETIC_KEY
  const creds = { email: "test@example.test", password: "synthetic-pass" }
  assert.deepEqual(decryptJson(encryptJson(creds)), creds)
})

test("two encryptions of the same text differ (random IV) and both decrypt", () => {
  process.env.CHANNEL_ENCRYPTION_KEY = SYNTHETIC_KEY
  const a = encryptText("same-text")
  const b = encryptText("same-text")
  assert.notEqual(a, b)
  assert.equal(decryptText(a), "same-text")
  assert.equal(decryptText(b), "same-text")
})

test("a wrong key does not decrypt the payload", () => {
  process.env.CHANNEL_ENCRYPTION_KEY = SYNTHETIC_KEY
  const payload = encryptText("secret")
  process.env.CHANNEL_ENCRYPTION_KEY = "a-different-synthetic-key"
  assert.throws(() => decryptText(payload))
})

test("historical payload format stays valid (scrypt derivation + iv/tag/ct layout)", () => {
  // A payload built EXTERNALLY with the historical construction — scrypt over
  // the constant salt, iv + tag + ciphertext in hex — must decrypt when
  // CHANNEL_ENCRYPTION_KEY carries the same key material. This is the
  // compatibility contract for rows encrypted before CORE-02B.
  const historicalSecret = "historical-secret-material"
  const historicalKey = scryptSync(historicalSecret, SALT, 32)
  const payload = encryptWithRawKey(historicalKey, "pre-existing-credential")

  process.env.CHANNEL_ENCRYPTION_KEY = historicalSecret
  assert.equal(decryptText(payload), "pre-existing-credential")

  // And the payload the module produces today keeps the same layout.
  const fresh = encryptText("layout-check")
  assert.equal(Buffer.from(fresh, "hex").length, IV_LENGTH + 16 + Buffer.byteLength("layout-check"))
})
