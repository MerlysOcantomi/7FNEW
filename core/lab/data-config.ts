/**
 * Mr Forte Lab — application-data configuration (DEV-PREVIEW-01C).
 *
 * Level-3 config (workspace demo data + normal Sevenef session), separate from
 * the level-1 infrastructure gate and level-2 access session. Pure and
 * env-injected. It validates the demo-database fingerprint, the synthetic
 * identity coordinates and the normal-session `AUTH_SECRET` — including that
 * `AUTH_SECRET` is distinct from the lab access secret / key hash and is not
 * mirrored into any `NEXT_PUBLIC_*` variable.
 *
 * Reasons are internal (tests / safe logs). The visitor only ever sees a
 * generic "preview environment is not ready" message.
 */

import { LAB_DEMO_IDENTITY } from "./demo-identity"

export const LAB_DATA_ENV_KEYS = {
  enabled: "SEVENEF_LAB_DATA_ENABLED",
  expectedDbFingerprint: "SEVENEF_LAB_EXPECTED_DATABASE_URL_SHA256",
  userId: "SEVENEF_LAB_USER_ID",
  userEmail: "SEVENEF_LAB_USER_EMAIL",
  workspaceId: "SEVENEF_LAB_WORKSPACE_ID",
  workspaceSlug: "SEVENEF_LAB_WORKSPACE_SLUG",
  authSecret: "AUTH_SECRET",
  accessTokenSecret: "SEVENEF_LAB_ACCESS_TOKEN_SECRET",
  accessKeyHash: "SEVENEF_LAB_ACCESS_KEY_SHA256",
} as const

export const LAB_AUTH_SECRET_MIN_LENGTH = 32

export type LabDataConfig = {
  expectedDbFingerprint: string
  userId: string
  userEmail: string
  workspaceId: string
  workspaceSlug: string
  authSecret: string
}

export type LabDataConfigError =
  | "disabled"
  | "invalid-fingerprint-hash"
  | "invalid-identity"
  | "auth-secret-missing"
  | "auth-secret-weak"
  | "auth-secret-reuses-access-secret"
  | "auth-secret-matches-key-hash"
  | "auth-secret-exposed-public"

export type LabDataConfigResult =
  | { ok: true; config: LabDataConfig }
  | { ok: false; reason: LabDataConfigError }

const HEX_64 = /^[0-9a-fA-F]{64}$/

function nonEmpty(v: string | undefined, fallback: string): string {
  const t = typeof v === "string" ? v.trim() : ""
  return t.length > 0 ? t : fallback
}

export function readLabDataConfig(
  env: Record<string, string | undefined>,
): LabDataConfigResult {
  // 1. Explicit activation.
  if (env[LAB_DATA_ENV_KEYS.enabled] !== "true") return { ok: false, reason: "disabled" }

  // 2. Database fingerprint digest — exactly 64 hex chars.
  const fp = env[LAB_DATA_ENV_KEYS.expectedDbFingerprint]?.trim()
  if (!fp || !HEX_64.test(fp)) return { ok: false, reason: "invalid-fingerprint-hash" }

  // 3. Synthetic identity — defaults keep config small but stay explicit.
  const userId = nonEmpty(env[LAB_DATA_ENV_KEYS.userId], LAB_DEMO_IDENTITY.userId)
  const userEmail = nonEmpty(env[LAB_DATA_ENV_KEYS.userEmail], LAB_DEMO_IDENTITY.userEmail)
  const workspaceId = nonEmpty(env[LAB_DATA_ENV_KEYS.workspaceId], LAB_DEMO_IDENTITY.workspaceId)
  const workspaceSlug = nonEmpty(env[LAB_DATA_ENV_KEYS.workspaceSlug], LAB_DEMO_IDENTITY.workspaceSlug)
  // The demo email must stay on a reserved, non-routable TLD.
  if (!/^[^@\s]+@[^@\s]+\.invalid$/.test(userEmail)) return { ok: false, reason: "invalid-identity" }
  if (!userId || !workspaceId || !workspaceSlug) return { ok: false, reason: "invalid-identity" }

  // 4. Normal-session AUTH_SECRET — present, strong, and distinct from the
  //    level-2 secrets, and never mirrored into a public variable.
  const authSecret = env[LAB_DATA_ENV_KEYS.authSecret]
  if (!authSecret || authSecret.length === 0) return { ok: false, reason: "auth-secret-missing" }
  if (authSecret.length < LAB_AUTH_SECRET_MIN_LENGTH) return { ok: false, reason: "auth-secret-weak" }
  const accessSecret = env[LAB_DATA_ENV_KEYS.accessTokenSecret]
  if (accessSecret !== undefined && authSecret === accessSecret) {
    return { ok: false, reason: "auth-secret-reuses-access-secret" }
  }
  const keyHash = env[LAB_DATA_ENV_KEYS.accessKeyHash]
  if (keyHash !== undefined && authSecret.toLowerCase() === keyHash.trim().toLowerCase()) {
    return { ok: false, reason: "auth-secret-matches-key-hash" }
  }
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("NEXT_PUBLIC_") && value === authSecret) {
      return { ok: false, reason: "auth-secret-exposed-public" }
    }
  }

  return {
    ok: true,
    config: { expectedDbFingerprint: fp.toLowerCase(), userId, userEmail, workspaceId, workspaceSlug, authSecret },
  }
}
