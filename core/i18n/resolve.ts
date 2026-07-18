/**
 * Pure request-locale resolution — leaf logic, no React, no Prisma, no next/*.
 *
 * Two chains, decided in docs/i18n-localization-architecture.md §7:
 *
 *   Authenticated: User.locale → Workspace.config.locale → Accept-Language → en
 *   Anonymous:     cookie 7f-locale → Accept-Language → en
 *
 * The cookie NEVER participates in the authenticated chain — it is a technical
 * mirror of the resolution result, not an authority. `resolveRequestLocale`
 * compares it against the effective locale only to report `shouldSyncCookie`.
 *
 * All inputs arrive as already-loaded raw values (strings from DB/headers/
 * cookies); the I/O lives in `./server`. Depends only on `./types` and
 * `./locale` so both server and tests can import it without side effects.
 */

import { DEFAULT_LOCALE, type SupportedLocale } from "./types"
import { isValidLocale } from "./locale"

/** Where the effective locale came from. */
export type LocaleSource =
  | "user"
  | "workspace"
  | "cookie"
  | "accept-language"
  | "default"

export interface ResolvedLocale {
  locale: SupportedLocale
  source: LocaleSource
}

/** Exact-match validation for persisted/raw values ("es" yes, "es-MX" no). */
function pickValid(raw: string | null | undefined): SupportedLocale | null {
  return typeof raw === "string" && isValidLocale(raw) ? raw : null
}

/**
 * Parse an `Accept-Language` header into the best SUPPORTED locale, or null.
 *
 * Handles lists with quality values ("de-CH,de;q=0.9,en;q=0.8"), casing,
 * whitespace, regional variants (de-CH → de), broken entries and `*` (skipped —
 * a wildcard carries no language information we can act on). Entries are
 * ordered by q descending, ties keeping header order; the first entry that
 * maps onto a supported locale (exact or by prefix) wins. Unsupported and
 * malformed entries are ignored. Returns null when nothing usable remains —
 * callers fall through to their next chain step.
 */
export function parseAcceptLanguage(header: string | null | undefined): SupportedLocale | null {
  if (!header || typeof header !== "string") return null

  const entries: Array<{ tag: string; q: number; index: number }> = []
  const parts = header.split(",")
  for (let index = 0; index < parts.length; index++) {
    const segments = parts[index].trim().split(";")
    const tag = segments[0]?.trim().toLowerCase()
    if (!tag || tag === "*") continue

    let q = 1
    for (const param of segments.slice(1)) {
      const [key, value] = param.split("=").map((s) => s.trim().toLowerCase())
      if (key === "q") {
        const parsed = Number.parseFloat(value)
        // Malformed q → drop the entry rather than guess its priority.
        if (!Number.isFinite(parsed)) q = -1
        else q = parsed
      }
    }
    if (q <= 0) continue

    entries.push({ tag, q, index })
  }

  entries.sort((a, b) => (b.q !== a.q ? b.q - a.q : a.index - b.index))

  for (const { tag } of entries) {
    if (isValidLocale(tag)) return tag
    const prefix = tag.split("-")[0]
    if (isValidLocale(prefix)) return prefix
  }
  return null
}

/**
 * Read the RAW workspace locale from the `Workspace.config` JSON string.
 *
 * Unlike the legacy `resolveLocaleFromConfig` (which always defaults to "en"),
 * this returns null when the config has no locale — the distinction is what
 * lets `resolveRequestLocale` attribute the source honestly ("workspace" vs
 * "accept-language"/"default").
 */
export function readWorkspaceLocaleRaw(configJson: string | null | undefined): string | null {
  if (!configJson) return null
  try {
    const parsed: unknown = JSON.parse(configJson)
    if (parsed && typeof parsed === "object" && "locale" in parsed) {
      const value = (parsed as { locale: unknown }).locale
      if (typeof value === "string" && value.trim()) return value
    }
  } catch {
    // Malformed workspace config is a data problem, not a render problem.
  }
  return null
}

/** Authenticated chain. The cookie is deliberately NOT an input. */
export function resolveAuthenticatedLocale(input: {
  userLocale: string | null | undefined
  workspaceLocale: string | null | undefined
  acceptLanguage: string | null | undefined
}): ResolvedLocale {
  const user = pickValid(input.userLocale)
  if (user) return { locale: user, source: "user" }

  const workspace = pickValid(input.workspaceLocale)
  if (workspace) return { locale: workspace, source: "workspace" }

  const header = parseAcceptLanguage(input.acceptLanguage)
  if (header) return { locale: header, source: "accept-language" }

  return { locale: DEFAULT_LOCALE, source: "default" }
}

/** Anonymous chain. An invalid cookie is ignored, never "repaired" here. */
export function resolveAnonymousLocale(input: {
  cookieLocale: string | null | undefined
  acceptLanguage: string | null | undefined
}): ResolvedLocale {
  const cookie = pickValid(input.cookieLocale)
  if (cookie) return { locale: cookie, source: "cookie" }

  const header = parseAcceptLanguage(input.acceptLanguage)
  if (header) return { locale: header, source: "accept-language" }

  return { locale: DEFAULT_LOCALE, source: "default" }
}

/**
 * Full request-locale result — everything the app shell needs, all
 * serializable (safe to pass from a Server Component to the client provider).
 */
export interface RequestLocaleInfo extends ResolvedLocale {
  authenticated: boolean
  /** Persisted personal preference (null = none / anonymous). */
  userLocale: SupportedLocale | null
  /**
   * True when the 7f-locale cookie should be brought in line with the
   * effective locale. Reported only — the resolver never writes; the client
   * provider asks the cookie-bridge Route Handler to sync.
   */
  shouldSyncCookie: boolean
}

/**
 * Combine both chains into the final per-request result.
 *
 * Cookie-sync semantics:
 * - authenticated: sync when the cookie is missing OR differs from the
 *   effective locale (so the pre-session first paint matches next time);
 * - anonymous: sync only when a cookie EXISTS and disagrees (writing a cookie
 *   for every cold anonymous visit would be pointless churn — Accept-Language
 *   already produced the right first paint).
 */
export function resolveRequestLocale(input: {
  authenticated: boolean
  userLocale: string | null | undefined
  workspaceLocale: string | null | undefined
  cookieLocale: string | null | undefined
  acceptLanguage: string | null | undefined
}): RequestLocaleInfo {
  const base = input.authenticated
    ? resolveAuthenticatedLocale(input)
    : resolveAnonymousLocale(input)

  const cookie = pickValid(input.cookieLocale)
  const shouldSyncCookie = input.authenticated
    ? cookie !== base.locale
    : input.cookieLocale != null && cookie !== base.locale

  return {
    ...base,
    authenticated: input.authenticated,
    userLocale: pickValid(input.userLocale),
    shouldSyncCookie,
  }
}
