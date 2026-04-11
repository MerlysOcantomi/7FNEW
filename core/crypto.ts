import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 16
const TAG_LENGTH = 16
const SALT = "7f-channel-credentials"

/**
 * Derive a 32-byte key from AUTH_SECRET using scrypt.
 * Falls back to a zero-filled key in dev if AUTH_SECRET is missing (logged as warning).
 */
function deriveKey(): Buffer {
  const secret = process.env.AUTH_SECRET
  if (!secret) {
    console.warn("[crypto] AUTH_SECRET is not set — credentials will use insecure fallback key")
    return Buffer.alloc(32, 0)
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
