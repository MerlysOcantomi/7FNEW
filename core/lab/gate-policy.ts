/**
 * Mr Forte Lab preview gate — pure policy (DEV-PREVIEW-01A).
 *
 * Mirrors the Voice Lab precedent (`app/voice-lab/gate-policy.ts`): zero
 * imports of Next.js, the auth stack or the DB so every branch is trivially
 * testable. The server wiring lives in `gate.ts`.
 *
 * The Lab runs on a DEDICATED Vercel project. That project's stable deployment
 * is technically `VERCEL_ENV === "production"` — of that project, never of
 * Sevenef. The policy therefore identifies the project explicitly (private
 * expected project id + exact host allowlist) instead of banning "production".
 *
 * Fail-closed: EVERY condition must hold or the decision is a denial. Deny
 * reasons exist for tests, safe logs and internal diagnosis only — anonymous
 * visitors always receive a plain 404 with no hint of why (see `gate.ts`).
 */

export type LabGateInput = {
  /** SEVENEF_LAB_PREVIEW_ENABLED — must be exactly "true". */
  enabled: string | undefined
  /** SEVENEF_LAB_DEPLOYMENT_MODE — must be exactly "dedicated". */
  deploymentMode: string | undefined
  /** SEVENEF_LAB_EXPECTED_PROJECT_ID — private server config, never exposed. */
  expectedProjectId: string | undefined
  /** VERCEL_PROJECT_ID — injected by the platform, never client-controlled. */
  actualProjectId: string | undefined
  /** SEVENEF_LAB_ALLOWED_HOSTS — comma-separated exact hostnames (host[:port]). */
  allowedHosts: string | undefined
  /** Hostname of the current request, taken from trusted server APIs. */
  requestHost: string | undefined
  /** VERCEL_ENV — "production" | "preview" | "development" | undefined. */
  vercelEnv: string | undefined
  /**
   * SEVENEF_LAB_LOCAL_DEV_ENABLED — exact "true" opt-in so local `next dev`
   * (where VERCEL_ENV is absent) can pass the environment check. Every other
   * condition still applies, so this never weakens deployed guarantees.
   */
  localDevEnabled: string | undefined
}

export type LabGateDenyReason =
  | "disabled"
  | "invalid-mode"
  | "invalid-environment"
  | "missing-project-id"
  | "project-mismatch"
  | "invalid-configuration"
  | "missing-host"
  | "host-not-allowed"

export type LabGateDecision =
  | { allowed: true; mode: "dedicated"; normalizedHost: string }
  | { allowed: false; reason: LabGateDenyReason }

/** Vercel environments the dedicated Lab project may serve from. */
const DEPLOYED_VERCEL_ENVS: readonly string[] = ["production", "preview"]

function deny(reason: LabGateDenyReason): LabGateDecision {
  return { allowed: false, reason }
}

/**
 * Lowercase + trim a hostname (host[:port]). Returns null for anything that is
 * empty or could smuggle a path, userinfo, wildcard or whitespace — a valid
 * hostname never contains those characters.
 */
export function normalizeHost(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null
  const host = raw.trim().toLowerCase()
  if (host.length === 0) return null
  if (/[\s/\\@*?#]/.test(host)) return null
  return host
}

/**
 * Parse the comma-separated allowlist into normalized entries. Invalid entries
 * (empty, wildcard, whitespace…) are dropped, never widened.
 */
export function parseAllowedHosts(raw: string | undefined): string[] {
  if (typeof raw !== "string") return []
  return raw
    .split(",")
    .map((entry) => normalizeHost(entry))
    .filter((host): host is string => host !== null)
}

export function decideLabGate(input: LabGateInput): LabGateDecision {
  // 1. Explicit activation — exact string, no "1"/"yes"/"TRUE".
  if (input.enabled !== "true") return deny("disabled")

  // 2. Explicit dedicated-project mode.
  if (input.deploymentMode !== "dedicated") return deny("invalid-mode")

  // 3. Environment: production/preview of the DEDICATED project, or an
  //    explicit local-dev opt-in (VERCEL_ENV absent or "development").
  const vercelEnv = input.vercelEnv
  const isDeployedEnv = vercelEnv !== undefined && DEPLOYED_VERCEL_ENVS.includes(vercelEnv)
  const isLocalDev =
    input.localDevEnabled === "true" && (vercelEnv === undefined || vercelEnv === "development")
  if (!isDeployedEnv && !isLocalDev) return deny("invalid-environment")

  // 4. Project identity: both ids present and exactly equal.
  const expectedProjectId = input.expectedProjectId?.trim()
  const actualProjectId = input.actualProjectId?.trim()
  if (!expectedProjectId || !actualProjectId) return deny("missing-project-id")
  if (expectedProjectId !== actualProjectId) return deny("project-mismatch")

  // 5. Host allowlist: non-empty config and an exact full-hostname match.
  const allowedHosts = parseAllowedHosts(input.allowedHosts)
  if (allowedHosts.length === 0) return deny("invalid-configuration")
  const normalizedHost = normalizeHost(input.requestHost)
  if (!normalizedHost) return deny("missing-host")
  if (!allowedHosts.includes(normalizedHost)) return deny("host-not-allowed")

  return { allowed: true, mode: "dedicated", normalizedHost }
}

/**
 * Exact `/lab` namespace predicate for the middleware. Matches only `/lab`
 * and `/lab/...` — never `/laboratory`, `/labsomething` or `/api/lab` — so the
 * middleware exemption cannot silently grow into a generic bypass.
 */
export function isLabNamespacePath(pathname: string): boolean {
  return pathname === "/lab" || pathname.startsWith("/lab/")
}
