/**
 * Mr Forte Lab — server-side request-origin validation for the enter action
 * (DEV-PREVIEW-01B). Pure so it is unit-testable; the wiring reads the real
 * headers.
 *
 * The submitting request must come from the SAME host the infrastructure gate
 * already approved. We never trust a hostname carried in the form body, and we
 * never derive the redirect target from a query parameter.
 */

import { normalizeHost } from "./gate-policy"

export type OriginCheckInput = {
  /** `Origin` request header (browser-set, not user-controllable in the body). */
  origin: string | undefined | null
  /** The gate-approved request host (already validated against the allowlist). */
  requestHost: string
  /** Whether a secure (https) context is expected (deployments) or not (local). */
  requireHttps: boolean
}

/**
 * True iff the Origin header is present, well-formed, uses the expected scheme
 * and its host exactly matches the approved request host.
 */
export function isTrustedLabOrigin(input: OriginCheckInput): boolean {
  if (typeof input.origin !== "string" || input.origin.length === 0) return false

  let url: URL
  try {
    url = new URL(input.origin)
  } catch {
    return false
  }

  const expectedProtocol = input.requireHttps ? "https:" : "http:"
  if (url.protocol !== expectedProtocol) return false

  const originHost = normalizeHost(url.host)
  const approvedHost = normalizeHost(input.requestHost)
  if (!originHost || !approvedHost) return false
  return originHost === approvedHost
}
