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

/**
 * Context-aware protocol policy (DEV-PREVIEW-01D). 01C accepted `file:` and
 * `http:` so local development could point at a file/localhost database. In a
 * real deployment those must be refused BEFORE connecting — only a remote
 * `libsql:`/`https:` Turso URL is allowed. Local schemes are permitted only
 * when the explicit local-dev opt-in is on AND we are not on a deployment.
 */
export type TursoUrlPolicyResult =
  | { ok: true }
  | {
      ok: false
      reason: "empty" | "invalid-url" | "unsupported-scheme" | "local-url-in-deployment" | "local-url-not-opted-in"
    }

const REMOTE_SCHEMES = new Set(["libsql:", "https:"])
const LOCAL_SCHEMES = new Set(["file:", "http:"])

function isLocalHttpHost(host: string): boolean {
  const h = host.toLowerCase()
  return h === "localhost" || h.startsWith("localhost:") || h === "127.0.0.1" || h.startsWith("127.0.0.1:")
}

/**
 * Whether `rawUrl` may be used given the environment. Deployment vs local is
 * derived from the same signals as the 01A gate: a deployment is VERCEL_ENV in
 * {production, preview}; local requires SEVENEF_LAB_LOCAL_DEV_ENABLED==="true"
 * with VERCEL_ENV absent/development. Pure and env-injected.
 */
export function assertTursoUrlAllowed(
  rawUrl: string | undefined | null,
  env: Record<string, string | undefined>,
): TursoUrlPolicyResult {
  if (typeof rawUrl !== "string" || rawUrl.trim().length === 0) return { ok: false, reason: "empty" }
  let url: URL
  try {
    url = new URL(rawUrl.trim())
  } catch {
    return { ok: false, reason: "invalid-url" }
  }
  if (!REMOTE_SCHEMES.has(url.protocol) && !LOCAL_SCHEMES.has(url.protocol)) {
    return { ok: false, reason: "unsupported-scheme" }
  }

  const vercelEnv = env.VERCEL_ENV
  const isDeployment = vercelEnv === "production" || vercelEnv === "preview" || env.VERCEL === "1"
  const localOptIn =
    env.SEVENEF_LAB_LOCAL_DEV_ENABLED === "true" && (vercelEnv === undefined || vercelEnv === "development")

  if (REMOTE_SCHEMES.has(url.protocol)) return { ok: true }

  // Local scheme (file: / http:).
  if (url.protocol === "http:" && !isLocalHttpHost(url.host)) {
    // Remote http is never acceptable (would be plaintext to a remote host).
    return { ok: false, reason: isDeployment ? "local-url-in-deployment" : "unsupported-scheme" }
  }
  if (isDeployment) return { ok: false, reason: "local-url-in-deployment" }
  if (!localOptIn) return { ok: false, reason: "local-url-not-opted-in" }
  return { ok: true }
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
