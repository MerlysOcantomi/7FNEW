/**
 * Sevenef Presence — reception security utilities (PRESENCE-FANNY-01).
 *
 * Pure, testable primitives that protect the PUBLIC reception API against spam,
 * oversized/HTML/script payloads and prompt-injection surface. The API route
 * owns the (per-instance, in-memory) rate-limit store and wiring; these
 * functions hold the logic so it can be unit-tested.
 */

/** Max characters accepted for a visitor chat message. */
export const MAX_MESSAGE_LENGTH = 2000

/**
 * Strip HTML/scripts and control chars from visitor text and cap the length.
 * Removes tags entirely (no rich text on the public surface), neutralizing XSS
 * and reducing prompt-injection markup. Returns a plain, trimmed string.
 */
export function sanitizeVisitorText(raw: unknown, max: number = MAX_MESSAGE_LENGTH): string {
  if (typeof raw !== "string") return ""
  return raw
    .replace(/<[^>]*>/g, " ") // drop any tags
    .replace(/[\u0000-\u001f\u007f]/g, " ") // control chars
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
}

/** A validated visitor session id: opaque, url-safe, bounded length. */
export function isValidVisitorId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9._-]{8,128}$/.test(id)
}

// ---------------------------------------------------------------------------
// Rate limiting (sliding window; pure over an injected store)
// ---------------------------------------------------------------------------

export interface RateLimitOptions {
  windowMs: number
  max: number
}

export const DEFAULT_RATE_LIMIT: RateLimitOptions = { windowMs: 60_000, max: 20 }

/**
 * Sliding-window rate limit over a caller-owned `Map<string, number[]>` store.
 * Pure w.r.t. the injected `now`, so it is deterministic in tests. Mirrors the
 * repo's voice-route pattern (best-effort, per-instance — not durable). Mutates
 * the store; returns true when the key is over the limit.
 */
export function isRateLimited(
  store: Map<string, number[]>,
  key: string,
  now: number,
  opts: RateLimitOptions = DEFAULT_RATE_LIMIT,
): boolean {
  const hits = (store.get(key) ?? []).filter((t) => now - t < opts.windowMs)
  hits.push(now)
  store.set(key, hits)
  return hits.length > opts.max
}
