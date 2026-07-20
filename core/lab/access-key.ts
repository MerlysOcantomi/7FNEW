/**
 * Mr Forte Lab — constant-time access-key verification (DEV-PREVIEW-01B).
 *
 * The human key is never stored in plaintext: config holds its SHA-256 digest
 * (`SEVENEF_LAB_ACCESS_KEY_SHA256`). The visitor submits the original key; we
 * hash the EXACT input (no trimming) and compare digests with
 * `timingSafeEqual` over fixed-length buffers — never string equality.
 *
 * The function returns only a boolean. It never returns, logs or throws the
 * key, either digest, or any derived value.
 */

import { createHash, timingSafeEqual } from "crypto"

/** Upper bound on submitted key length before we spend work hashing it. */
export const LAB_ACCESS_KEY_MAX_LENGTH = 512

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex")
}

/**
 * True iff SHA-256(submitted) equals the configured digest. Fails closed on
 * non-string, empty or over-long input, or a malformed configured digest.
 * Input is compared EXACTLY — leading/trailing spaces are significant.
 */
export function verifyLabAccessKey(submitted: unknown, configuredHashHex: string): boolean {
  if (typeof submitted !== "string") return false
  if (submitted.length === 0 || submitted.length > LAB_ACCESS_KEY_MAX_LENGTH) return false

  let configuredDigest: Buffer
  try {
    configuredDigest = Buffer.from(configuredHashHex, "hex")
  } catch {
    return false
  }
  // A SHA-256 digest is exactly 32 bytes; anything else is misconfiguration.
  if (configuredDigest.length !== 32) return false

  const submittedDigest = createHash("sha256").update(submitted, "utf8").digest()
  // Both operands are fixed 32-byte buffers, so timingSafeEqual never throws.
  return timingSafeEqual(submittedDigest, configuredDigest)
}
