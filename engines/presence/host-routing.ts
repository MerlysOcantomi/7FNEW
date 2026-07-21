/**
 * Sevenef Presence — custom-domain host routing (PRESENCE-03).
 *
 * Pure, Edge-safe decision for mapping an incoming custom hostname to the public
 * site route. This is the ONLY logic the middleware adds to the request path, so
 * it is designed to be safe-by-default and never touch the app's own traffic:
 *
 *   - FEATURE-OFF WITHOUT CONFIG: when no canonical app host is configured
 *     (`appHosts` empty), it returns `null` for everything. A deployment with no
 *     `NEXT_PUBLIC_APP_URL`/`NEXTAUTH_URL`/`VERCEL_URL` behaves exactly as before
 *     — no rewrite, no risk to existing routes/cookies/subdomains.
 *   - APP HOSTS ARE NEVER REWRITTEN: the canonical host(s), `*.vercel.app`,
 *     `localhost` and bare IPs fall through to normal routing.
 *   - INTERNAL PATHS ARE NEVER REWRITTEN: `_next`, api, static, auth, the site
 *     routes themselves, etc.
 *
 * Only a genuinely external custom hostname on an otherwise "root" path is
 * rewritten to `/sites/by-host/<host>`, where the Node route resolves the site
 * by VERIFIED domain (unverified/unknown → 404). DNS/TLS onboarding is out of
 * scope here.
 */

/** Lowercase a host and drop the port. */
export function normalizeHostHeader(hostHeader: string | null | undefined): string {
  if (!hostHeader) return ""
  return hostHeader.split(":")[0].trim().toLowerCase().replace(/\.$/, "")
}

/** Extract a comparable hostname from a full or bare URL string. */
export function hostFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`)
    return u.hostname.toLowerCase()
  } catch {
    return null
  }
}

const INTERNAL_PREFIXES = [
  "/_next",
  "/api",
  "/sites",
  "/favicon",
  "/public",
  "/login",
  "/cliente",
  "/widget",
  "/icon",
  "/apple-icon",
]

function isBareIp(host: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.includes(":")
}

export interface HostRewriteInput {
  hostHeader: string | null | undefined
  pathname: string
  /** Canonical app hostnames (already extracted from env URLs). */
  appHosts: string[]
}

export interface HostRewriteDecision {
  rewritePath: string
}

/**
 * Decide whether to rewrite a request to the public by-host site route. Returns
 * `null` to leave routing untouched (the common case). Pure and total.
 */
export function planHostRewrite(input: HostRewriteInput): HostRewriteDecision | null {
  const appHosts = input.appHosts.map((h) => h.toLowerCase()).filter(Boolean)
  // Feature is OFF unless the deployment declares its canonical host.
  if (appHosts.length === 0) return null

  const host = normalizeHostHeader(input.hostHeader)
  if (!host) return null

  // Never rewrite our own traffic.
  if (
    appHosts.includes(host) ||
    host === "localhost" ||
    host.endsWith(".vercel.app") ||
    isBareIp(host)
  ) {
    return null
  }

  // Never rewrite internal/app paths.
  if (INTERNAL_PREFIXES.some((p) => input.pathname === p || input.pathname.startsWith(p + "/") || input.pathname.startsWith(p))) {
    return null
  }

  return { rewritePath: `/sites/by-host/${encodeURIComponent(host)}` }
}

/** Build the canonical app-host allowlist from the environment. */
export function appHostsFromEnv(env: Record<string, string | undefined>): string[] {
  return [env.NEXT_PUBLIC_APP_URL, env.NEXTAUTH_URL, env.VERCEL_URL]
    .map((u) => hostFromUrl(u))
    .filter((h): h is string => !!h)
}
