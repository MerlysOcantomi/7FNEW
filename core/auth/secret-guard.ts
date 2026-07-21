/**
 * Fail-closed policy for a missing `AUTH_SECRET` (DEV-PREVIEW-01D hardening).
 *
 * The initial audit found the middleware let `/api/*` requests through
 * (`NextResponse.next()`) when `AUTH_SECRET` was unset — a protected route
 * failing OPEN. A protected route must never become reachable because a secret
 * is missing.
 *
 * Pure and Next-free so the matrix is unit-testable. It is consulted only after
 * public assets, public paths and the `/lab` namespace have already been
 * allowed through, so any path reaching it is genuinely protected.
 */

export type MissingSecretDecision = "block-api" | "block-page"

/**
 * How to respond to a protected request when `AUTH_SECRET` is absent:
 *   - API routes → block with a generic 503 (never reach the handler);
 *   - pages → a safe unavailability response (the caller sends them to the
 *     public `/login?error=config`, which renders without a secret — no loop).
 * It never reveals the variable name, the secret, config or a stack.
 */
export function decideOnMissingSecret(pathname: string): MissingSecretDecision {
  return pathname.startsWith("/api/") ? "block-api" : "block-page"
}
