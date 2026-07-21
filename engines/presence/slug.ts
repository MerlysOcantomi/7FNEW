/**
 * Sevenef Presence — slug & hostname normalization (PRESENCE-02).
 *
 * Pure, DB-free rules for turning free input into a safe, canonical slug (for
 * the Sevenef-managed subdomain namespace) or hostname (for custom domains).
 * The persistence layer stores ONLY normalized values, and uniqueness is
 * enforced at the DB level (`PresenceSite.slug`, `PresenceDomain.hostname` are
 * `@unique`) — never trusting interface-level checks alone.
 */

/** DNS label limit; also our slug limit. */
const MAX_SLUG_LENGTH = 63

/**
 * Normalize a slug: lowercase, ASCII-ish, hyphen-separated, no leading/trailing
 * or repeated hyphens, capped at 63 chars. Returns "" when nothing usable
 * remains (the caller must reject empty slugs).
 */
export function normalizeSlug(input: string): string {
  return input
    .normalize("NFKD") // decompose accents; the alnum filter below drops the marks
    .toLowerCase()
    .trim()
    .replace(/[\s_]+/g, "-") // spaces/underscores → hyphen
    .replace(/[^a-z0-9-]/g, "") // drop everything else (incl. combining marks)
    .replace(/-+/g, "-") // collapse repeats
    .replace(/^-+|-+$/g, "") // trim hyphens
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "") // re-trim if slice landed on a hyphen
}

/** A slug is valid iff it equals its normalized form and is non-empty. */
export function isValidSlug(slug: string): boolean {
  if (!slug) return false
  return /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/.test(slug)
}

/**
 * Normalize a hostname: strip scheme/path/port, lowercase, drop the trailing
 * dot and any leading/trailing whitespace. Returns "" when nothing usable
 * remains. Does NOT strip `www.` — `www.x.com` and `x.com` are distinct hosts.
 */
export function normalizeHostname(input: string): string {
  let host = input.trim().toLowerCase()
  // Strip scheme if a full URL was pasted.
  host = host.replace(/^[a-z][a-z0-9+.-]*:\/\//, "")
  // Strip any path, query or fragment.
  host = host.replace(/[/?#].*$/, "")
  // Strip a port.
  host = host.replace(/:\d+$/, "")
  // Strip a single trailing dot (root label).
  host = host.replace(/\.$/, "")
  return host
}

/**
 * Validate a hostname as a plausible public FQDN: at least two labels, each
 * label 1–63 chars of `[a-z0-9-]` not starting/ending with a hyphen, total
 * ≤ 253 chars. Intentionally conservative — the DB uniqueness + verification
 * flow are the real safety net.
 */
export function isValidHostname(hostname: string): boolean {
  if (!hostname || hostname.length > 253) return false
  const labels = hostname.split(".")
  if (labels.length < 2) return false
  const label = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/
  return labels.every((l) => label.test(l))
}
