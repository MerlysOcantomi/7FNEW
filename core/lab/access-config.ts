/**
 * Mr Forte Lab — access (level 2) configuration reader & validation
 * (DEV-PREVIEW-01B).
 *
 * Level 1 (infrastructure gate: flag, project, host, environment) lives in
 * `gate-policy.ts`. This is the SEPARATE level 2: the human access key, the
 * independent token-signing secret and the session TTL. Pure and env-injected
 * so every branch is unit-testable; the values themselves stay server-side.
 *
 * Fail-closed: any missing/malformed value returns a typed error. The reasons
 * are for tests and safe logs only — never surfaced to the visitor (the enter
 * form shows one generic message; see `app/lab/enter`).
 */

export const LAB_ACCESS_ENV_KEYS = {
  keyHash: "SEVENEF_LAB_ACCESS_KEY_SHA256",
  tokenSecret: "SEVENEF_LAB_ACCESS_TOKEN_SECRET",
  ttlMinutes: "SEVENEF_LAB_ACCESS_TTL_MINUTES",
  /** Reused from the auth stack ONLY to assert the lab secret differs from it. */
  authSecret: "AUTH_SECRET",
} as const

/** TTL bounds (minutes). Documented in docs/lab-preview.md. */
export const LAB_ACCESS_TTL = {
  min: 15,
  default: 120,
  max: 480,
} as const

/** Minimum entropy floor for the independent token secret (characters). */
export const LAB_ACCESS_TOKEN_SECRET_MIN_LENGTH = 32

export type LabAccessConfig = {
  /** Lowercased 64-char hex SHA-256 digest of the human access key. */
  keyHashHex: string
  /** Independent HS256 signing secret for the lab access token. */
  tokenSecret: string
  /** Validated session lifetime in minutes. */
  ttlMinutes: number
}

export type LabAccessConfigError =
  | "missing-key-hash"
  | "invalid-key-hash"
  | "missing-token-secret"
  | "weak-token-secret"
  | "token-secret-reuses-auth-secret"
  | "token-secret-matches-key-hash"
  | "invalid-ttl"

export type LabAccessConfigResult =
  | { ok: true; config: LabAccessConfig }
  | { ok: false; reason: LabAccessConfigError }

const HEX_64 = /^[0-9a-fA-F]{64}$/
const DECIMAL_INTEGER = /^\d+$/

/**
 * Parse and bound the TTL. Absent → documented default. Anything that is not a
 * plain positive decimal integer within [min, max] fails closed.
 */
export function parseLabTtlMinutes(
  raw: string | undefined,
): { ok: true; minutes: number } | { ok: false } {
  if (raw === undefined) return { ok: true, minutes: LAB_ACCESS_TTL.default }
  const trimmed = raw.trim()
  if (!DECIMAL_INTEGER.test(trimmed)) return { ok: false } // NaN, decimals, negatives, signs
  const minutes = Number.parseInt(trimmed, 10)
  if (!Number.isSafeInteger(minutes)) return { ok: false }
  if (minutes < LAB_ACCESS_TTL.min || minutes > LAB_ACCESS_TTL.max) return { ok: false }
  return { ok: true, minutes }
}

export function readLabAccessConfig(
  env: Record<string, string | undefined>,
): LabAccessConfigResult {
  // 1. Access key digest — exactly 64 hex chars.
  const keyHashRaw = env[LAB_ACCESS_ENV_KEYS.keyHash]
  if (!keyHashRaw || keyHashRaw.trim().length === 0) return { ok: false, reason: "missing-key-hash" }
  const keyHashHex = keyHashRaw.trim().toLowerCase()
  if (!HEX_64.test(keyHashHex)) return { ok: false, reason: "invalid-key-hash" }

  // 2. Independent token secret — present, strong, and distinct from other secrets.
  const tokenSecret = env[LAB_ACCESS_ENV_KEYS.tokenSecret]
  if (!tokenSecret || tokenSecret.length === 0) return { ok: false, reason: "missing-token-secret" }
  if (tokenSecret.length < LAB_ACCESS_TOKEN_SECRET_MIN_LENGTH) {
    return { ok: false, reason: "weak-token-secret" }
  }
  const authSecret = env[LAB_ACCESS_ENV_KEYS.authSecret]
  if (authSecret !== undefined && tokenSecret === authSecret) {
    return { ok: false, reason: "token-secret-reuses-auth-secret" }
  }
  if (tokenSecret.toLowerCase() === keyHashHex) {
    return { ok: false, reason: "token-secret-matches-key-hash" }
  }

  // 3. TTL.
  const ttl = parseLabTtlMinutes(env[LAB_ACCESS_ENV_KEYS.ttlMinutes])
  if (!ttl.ok) return { ok: false, reason: "invalid-ttl" }

  return { ok: true, config: { keyHashHex, tokenSecret, ttlMinutes: ttl.minutes } }
}
