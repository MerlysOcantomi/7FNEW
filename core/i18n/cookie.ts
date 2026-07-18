/**
 * 7f-locale cookie policy — single source for its name, options and write
 * plans. Pure module: no next/headers, no React, no Prisma.
 *
 * Semantics (docs/i18n-localization-architecture.md §7): the cookie is a
 * TECHNICAL MIRROR of the last effective locale — the first-paint hint and the
 * only pre-session signal. It is never an authority above `User.locale` and
 * never an authorization/security input: it only influences which language is
 * painted, not which data can be accessed.
 *
 * Writers: exclusively authorized Route Handlers —
 *   - PUT /api/users/me/locale  (after a successful DB update)
 *   - PUT /api/i18n/locale      (technical sync bridge, cookie only)
 * Server Components never write it. The client never reads it directly, which
 * is why it is `httpOnly: true`: the provider gets its locale from the server
 * resolution, so exposing the cookie to `document.cookie` would only widen the
 * surface without adding a consumer.
 */

import type { SupportedLocale } from "./types"
import { isValidLocale } from "./locale"

export const LOCALE_COOKIE = "7f-locale"

/** One year — a UI-language hint should survive long-lived sessions. */
export const LOCALE_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

/** Exact-match read: anything but a canonical supported code is ignored. */
export function readLocaleCookieValue(raw: string | null | undefined): SupportedLocale | null {
  return typeof raw === "string" && isValidLocale(raw) ? raw : null
}

/**
 * Cookie options shared by every writer. `isProduction` is injectable for
 * tests; callers omit it in real code.
 */
export function buildLocaleCookieOptions(
  isProduction: boolean = process.env.NODE_ENV === "production",
): {
  path: "/"
  sameSite: "lax"
  secure: boolean
  httpOnly: boolean
  maxAge: number
} {
  return {
    path: "/",
    sameSite: "lax",
    secure: isProduction,
    httpOnly: true,
    maxAge: LOCALE_COOKIE_MAX_AGE,
  }
}

/** Write plan for the cookie after a personal-locale update. */
export type LocaleCookieCommand =
  | { kind: "set"; value: SupportedLocale }
  | { kind: "delete" }

/**
 * After `User.locale` persists successfully: a concrete locale mirrors into
 * the cookie; clearing the preference (null) deletes the cookie so the next
 * request re-derives the hint from the effective resolution (workspace /
 * default) instead of pinning a stale personal value.
 */
export function planLocaleCookieAfterUserUpdate(
  locale: SupportedLocale | null,
): LocaleCookieCommand {
  return locale === null ? { kind: "delete" } : { kind: "set", value: locale }
}
