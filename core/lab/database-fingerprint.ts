/**
 * Mr Forte Lab — Turso database fingerprint (DEV-PREVIEW-01C).
 *
 * Proves the deployment is connected to the EXPECTED demo database, not
 * production, by comparing a SHA-256 of the normalized `TURSO_DATABASE_URL`
 * against a private configured digest — with `timingSafeEqual`, never string
 * comparison. The database NAME is never treated as proof of isolation; only
 * the exact fingerprint is.
 *
 * The auth token is never part of the fingerprint and the full URL is never
 * logged.
 */

import { createHash, timingSafeEqual } from "crypto"

const ALLOWED_PROTOCOLS = new Set(["libsql:", "https:", "http:", "file:"])

export type NormalizeTursoResult =
  | { ok: true; normalized: string }
  | { ok: false; reason: "empty" | "invalid-url" | "unsupported-scheme" }

/**
 * Deterministic normalization of a Turso/libSQL URL:
 *   - trim outer whitespace;
 *   - require a supported scheme (libsql/https/http/file);
 *   - lowercase the host (host is case-insensitive), keep the path (a path or
 *     db-name distinguishes different databases);
 *   - DROP the query string (may carry `authToken`) and any fragment.
 * The resulting string — scheme + host + path — is what gets hashed.
 */
export function normalizeTursoUrl(raw: string | undefined | null): NormalizeTursoResult {
  if (typeof raw !== "string") return { ok: false, reason: "empty" }
  const trimmed = raw.trim()
  if (trimmed.length === 0) return { ok: false, reason: "empty" }

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return { ok: false, reason: "invalid-url" }
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) return { ok: false, reason: "unsupported-scheme" }

  const normalized = `${url.protocol}//${url.host.toLowerCase()}${url.pathname}`
  return { ok: true, normalized }
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex")
}

/** SHA-256 of the normalized URL, or null if the URL cannot be normalized. */
export function computeTursoFingerprint(raw: string | undefined | null): string | null {
  const normalized = normalizeTursoUrl(raw)
  if (!normalized.ok) return null
  return sha256Hex(normalized.normalized)
}

/**
 * Constant-time check that `rawUrl` fingerprints to `expectedHex`. Fails closed
 * on an unnormalizable URL or a malformed expected digest.
 */
export function verifyTursoFingerprint(
  rawUrl: string | undefined | null,
  expectedHex: string | undefined | null,
): boolean {
  if (typeof expectedHex !== "string") return false
  const actual = computeTursoFingerprint(rawUrl)
  if (!actual) return false

  let expectedBuf: Buffer
  try {
    expectedBuf = Buffer.from(expectedHex.trim().toLowerCase(), "hex")
  } catch {
    return false
  }
  if (expectedBuf.length !== 32) return false
  const actualBuf = Buffer.from(actual, "hex")
  return timingSafeEqual(actualBuf, expectedBuf)
}
