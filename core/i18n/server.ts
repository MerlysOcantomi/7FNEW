/**
 * Server-side request-locale helper — STRICTLY READ-ONLY.
 *
 * `getRequestLocale()` may read session, user, workspace, headers and cookies,
 * and returns a serializable `RequestLocaleInfo`. It never writes cookies,
 * never touches the database beyond SELECTs, and has no side effects — Server
 * Components must not write cookies, so cookie synchronization is reported via
 * `shouldSyncCookie` and executed by authorized Route Handlers only.
 *
 * Server-only by construction: importing `next/headers` makes this module
 * unusable from Client Components (build-time error), which is the boundary we
 * want without adding the `server-only` package dependency.
 *
 * Active-workspace READ path: this deliberately does NOT call
 * `resolveRequiredWorkspace()` — that helper auto-writes the `wf_workspace`
 * cookie on its first-membership fallback, which is illegal during an RSC
 * render. `readActiveWorkspaceLocaleRaw` mirrors the exact same rules and
 * sources (wf_workspace cookie validated by membership, else first membership
 * by createdAt) with the write removed. The x-workspace-id header path is
 * API-only (needs a Request object) and does not apply to layout renders.
 */

import { cache } from "react"
import { cookies, headers } from "next/headers"
import { getSessionFromCookies } from "@core/auth/session"
import { db } from "@core/db"
import { WORKSPACE_COOKIE } from "@core/workspace-context"
import { LOCALE_COOKIE } from "./cookie"
import {
  readWorkspaceLocaleRaw,
  resolveRequestLocale,
  type RequestLocaleInfo,
} from "./resolve"

/**
 * Read-only mirror of the active-workspace resolution rules, returning the
 * RAW `Workspace.config.locale` (null when absent/invalid — never defaulted,
 * so source attribution stays honest).
 *
 * The catch is intentionally scoped to this step: a workspace problem must
 * degrade to "no workspace locale" (the chain falls through), not break the
 * root layout. Session/user/programming errors outside are NOT swallowed.
 */
async function readActiveWorkspaceLocaleRaw(userId: string): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const cookieWs = cookieStore.get(WORKSPACE_COOKIE)?.value

    let workspaceId: string | null = null
    if (cookieWs) {
      const member = await db.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId, workspaceId: cookieWs } },
        select: { workspaceId: true },
      })
      if (member) workspaceId = member.workspaceId
    }
    if (!workspaceId) {
      const first = await db.workspaceMember.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { workspaceId: true },
      })
      workspaceId = first?.workspaceId ?? null
    }
    if (!workspaceId) return null

    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { config: true },
    })
    return ws ? readWorkspaceLocaleRaw(ws.config) : null
  } catch {
    return null
  }
}

/**
 * Resolve the effective locale for the current request.
 *
 * Memoized per request via React `cache()` — layout, pages and nested RSCs
 * share one resolution; there is no cross-request or cross-tenant caching.
 * Tolerates: anonymous requests, users deleted mid-session (userLocale reads
 * as null and the chain falls through), users without a workspace, stale
 * workspace cookies, malformed configs and public routes.
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
      workspaceLocale: null,
      cookieLocale,
      acceptLanguage,
    })
  }

  const [userLocale, workspaceLocale] = await Promise.all([
    db.user
      .findUnique({ where: { id: session.userId }, select: { locale: true } })
      .then((user) => user?.locale ?? null),
    readActiveWorkspaceLocaleRaw(session.userId),
  ])

  return resolveRequestLocale({
    authenticated: true,
    userLocale,
    workspaceLocale,
    cookieLocale,
    acceptLanguage,
  })
})
