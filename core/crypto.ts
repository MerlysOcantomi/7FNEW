import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const TAG_LENGTH = 16
const SALT = "7f-channel-credentials"

/**
 * Derive the 32-byte channel-credential key from CHANNEL_ENCRYPTION_KEY
 * using scrypt (CORE-02B, closes F-AUTH-02).
 *
 * Fail-closed contract:
 *   - The key comes EXCLUSIVELY from `CHANNEL_ENCRYPTION_KEY`. `AUTH_SECRET`
 *     is no longer consulted — session signing and credential encryption are
 *     separate security purposes and must not share key material.
 *   - A missing, empty or whitespace-only value throws instead of falling
 *     back. The all-zero `Buffer.alloc(32, 0)` fallback is gone: it made
 *     every stored credential decryptable from a DB dump alone.
 *   - The error message never includes the secret's value.
 *
 * Compatibility: the derivation (scrypt over the same constant salt) and the
 * payload format are unchanged, so setting `CHANNEL_ENCRYPTION_KEY` to the
 * historical key material keeps existing ciphertexts decryptable. Rotating
 * the key and re-encrypting existing rows is a separate, controlled mission.
 *
 * The environment variable is read at call time, never at module scope, so
 * importing this module stays safe in builds and tests without credentials.
 */
function deriveKey(): Buffer {
  const secret = process.env.CHANNEL_ENCRYPTION_KEY
  if (!secret || secret.trim().length === 0) {
    throw new Error("Channel credential encryption is not configured")
  }
  return scryptSync(secret, SALT, 32)
}

/**
 * Encrypt a plaintext string. Returns a hex-encoded payload: iv + tag + ciphertext.
 */
export function encryptText(plaintext: string): string {
  const key = deriveKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString("hex")
}

/**
 * Decrypt a hex-encoded payload produced by `encryptText`.
 */
export function decryptText(payload: string): string {
  const key = deriveKey()
  const data = Buffer.from(payload, "hex")
  const iv = data.subarray(0, IV_LENGTH)
  const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext) + decipher.final("utf8")
}

/** Encrypt a JSON-serializable object. */
export function encryptJson(obj: unknown): string {
  return encryptText(JSON.stringify(obj))
}

/** Decrypt back to a parsed object. */
export function decryptJson<T = unknown>(payload: string): T {
  return JSON.parse(decryptText(payload)) as T
}
