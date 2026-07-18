/**
 * Server-side request-locale helper — STRICTLY READ-ONLY.
 *
 * `getRequestLocale()` may read session, user, headers and cookies, and
 * returns a serializable `RequestLocaleInfo`. It never writes cookies, never
 * touches the database beyond SELECTs, and has no side effects — Server
 * Components must not write cookies, so cookie synchronization is reported via
 * `shouldSyncCookie` and executed by authorized Route Handlers only.
 *
 * The active workspace is deliberately NOT consulted (P4.FINESSE-ENES): the
 * workspace language governs customer-facing output only, never the personal
 * interface. The chain is User.locale → Accept-Language → English.
 *
 * Server-only by construction: importing `next/headers` makes this module
 * unusable from Client Components (build-time error), which is the boundary we
 * want without adding the `server-only` package dependency.
 */

import { cache } from "react"
import { cookies, headers } from "next/headers"
import { getSessionFromCookies } from "@core/auth/session"
import { db } from "@core/db"
import { LOCALE_COOKIE } from "./cookie"
import { resolveRequestLocale, type RequestLocaleInfo } from "./resolve"

/**
 * Resolve the effective locale for the current request.
 *
 * Memoized per request via React `cache()` — layout, pages and nested RSCs
 * share one resolution; there is no cross-request or cross-tenant caching.
 * Tolerates: anonymous requests, users deleted mid-session (userLocale reads
 * as null and the chain falls through to the browser language) and public
 * routes.
 */
export const getRequestLocale = cache(async (): Promise<RequestLocaleInfo> => {
  const [cookieStore, headerStore] = await Promise.all([cookies(), headers()])
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value ?? null
  const acceptLanguage = headerStore.get("accept-language")

  const session = await getSessionFromCookies()
  if (!session) {
    return resolveRequestLocale({
      authenticated: false,
      userLocale: null,
      cookieLocale,
      acceptLanguage,
    })
  }

  const userLocale = await db.user
    .findUnique({ where: { id: session.userId }, select: { locale: true } })
    .then((user) => user?.locale ?? null)

  return resolveRequestLocale({
    authenticated: true,
    userLocale,
    cookieLocale,
    acceptLanguage,
  })
})
