/**
 * Sevenef Presence — public social links (PRESENCE-03-SOCIAL-01).
 *
 * Pure, DB-free normalization of the Business Profile's public social handles
 * into safe, public URLs. This is a PUBLIC LINK concept only — it is completely
 * independent from `ChannelConnection` (a connected, authorized messaging
 * channel). Adding a social URL here NEVER creates a channel.
 *
 * Security & display rules (a field renders only when ALL hold):
 *   - non-empty after trim;
 *   - normalizes to a URL (username → the platform's canonical profile URL, or a
 *     pasted URL that parses);
 *   - the URL's host belongs to that platform's own domain(s);
 *   - the scheme is http/https (forced to https) — never javascript:, data:, etc.
 * Anything else yields `null` and renders NOTHING (no icon, link, placeholder,
 * empty slot or visible error).
 */

export interface PresenceSocialPlatform {
  key: string
  /** Brand label (not translated). */
  label: string
  /** Allowed public hostnames (bare, without `www.`). */
  hostnames: string[]
  /** Build a canonical profile URL from a bare username. */
  usernameUrl: (username: string) => string
}

/** The supported platforms, in the order they render. */
export const PRESENCE_SOCIAL_PLATFORMS: readonly PresenceSocialPlatform[] = [
  { key: "instagram", label: "Instagram", hostnames: ["instagram.com"], usernameUrl: (u) => `https://instagram.com/${u}` },
  { key: "facebook", label: "Facebook", hostnames: ["facebook.com", "fb.com"], usernameUrl: (u) => `https://facebook.com/${u}` },
  { key: "tiktok", label: "TikTok", hostnames: ["tiktok.com"], usernameUrl: (u) => `https://www.tiktok.com/@${u}` },
  { key: "youtube", label: "YouTube", hostnames: ["youtube.com", "youtu.be"], usernameUrl: (u) => `https://youtube.com/@${u}` },
  { key: "linkedin", label: "LinkedIn", hostnames: ["linkedin.com"], usernameUrl: (u) => `https://www.linkedin.com/company/${u}` },
  { key: "pinterest", label: "Pinterest", hostnames: ["pinterest.com"], usernameUrl: (u) => `https://pinterest.com/${u}` },
  { key: "threads", label: "Threads", hostnames: ["threads.net"], usernameUrl: (u) => `https://www.threads.net/@${u}` },
  { key: "x", label: "X", hostnames: ["x.com", "twitter.com"], usernameUrl: (u) => `https://x.com/${u}` },
]

export const PRESENCE_SOCIAL_KEYS: readonly string[] = PRESENCE_SOCIAL_PLATFORMS.map((p) => p.key)

const PLATFORM_BY_KEY = new Map(PRESENCE_SOCIAL_PLATFORMS.map((p) => [p.key, p]))

function hostMatches(host: string, hostnames: string[]): boolean {
  const h = host.toLowerCase().replace(/^www\./, "")
  return hostnames.some((allowed) => h === allowed || h.endsWith("." + allowed))
}

/**
 * Normalize one raw value for a platform into a safe public URL, or `null` if it
 * is empty, invalid, insecure, or points at a different platform.
 */
export function normalizeSocialLink(platformKey: string, raw: string | null | undefined): string | null {
  const platform = PLATFORM_BY_KEY.get(platformKey)
  if (!platform || typeof raw !== "string") return null
  const value = raw.trim()
  if (!value) return null

  const hasScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(value)
  const mentionsDomain = platform.hostnames.some((h) => value.toLowerCase().includes(h))

  // URL form (pasted link or a bare "domain/path").
  if (hasScheme || mentionsDomain) {
    let url: URL
    try {
      url = new URL(hasScheme ? value : `https://${value}`)
    } catch {
      return null
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null
    if (!hostMatches(url.hostname, platform.hostnames)) return null
    url.protocol = "https:"
    // Drop query/hash for a clean canonical profile link.
    url.search = ""
    url.hash = ""
    return url.toString().replace(/\/$/, "")
  }

  // Username form (`@handle` or bare handle). Usernames may contain dots
  // (e.g. TikTok "estudio.aurora") but nothing that could break out of a path.
  const username = value.replace(/^@+/, "")
  if (!/^[A-Za-z0-9._-]{1,40}$/.test(username)) return null
  return platform.usernameUrl(username)
}

export interface PresenceSocialLink {
  platform: string
  label: string
  href: string
}

/**
 * Normalize a raw social record (from the Business Profile) into validated
 * public links, in platform display order. Unknown keys and invalid values are
 * dropped. Total and pure.
 */
export function normalizeSocialLinks(
  raw: Record<string, string> | null | undefined,
): PresenceSocialLink[] {
  if (!raw || typeof raw !== "object") return []
  const out: PresenceSocialLink[] = []
  for (const platform of PRESENCE_SOCIAL_PLATFORMS) {
    const href = normalizeSocialLink(platform.key, raw[platform.key])
    if (href) out.push({ platform: platform.key, label: platform.label, href })
  }
  return out
}

/** Reduce validated links to the `{platform: url}` map used by the content source. */
export function socialLinksToMap(links: PresenceSocialLink[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const l of links) map[l.platform] = l.href
  return map
}

/**
 * Rebuild ordered, labelled links from a `{platform: url}` map (already
 * validated URLs from the content source). Only known platforms are included;
 * order follows `PRESENCE_SOCIAL_PLATFORMS`.
 */
export function socialMapToLinks(map: Record<string, string> | null | undefined): PresenceSocialLink[] {
  if (!map) return []
  const out: PresenceSocialLink[] = []
  for (const platform of PRESENCE_SOCIAL_PLATFORMS) {
    const href = map[platform.key]
    if (typeof href === "string" && href) out.push({ platform: platform.key, label: platform.label, href })
  }
  return out
}

/**
 * The valid public social links prepared for an assistant (Fanny) to reference
 * — e.g. "You can see our work on Instagram." Returns only validated, public
 * links; never raw/invalid input, never connected-channel data.
 */
export function publicSocialForAssistant(
  raw: Record<string, string> | null | undefined,
): PresenceSocialLink[] {
  return normalizeSocialLinks(raw)
}
