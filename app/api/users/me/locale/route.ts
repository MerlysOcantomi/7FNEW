import { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { getSessionFromCookies } from "@/lib/auth/session"
import { db } from "@/lib/db"
import { SUPPORTED_LOCALES } from "@core/i18n"
import { planUserLocaleUpdate } from "@core/i18n/user-locale"
import {
  LOCALE_COOKIE,
  buildLocaleCookieOptions,
  planLocaleCookieAfterUserUpdate,
} from "@core/i18n/cookie"

/**
 * Personal app-locale preference for the authenticated user.
 *
 * Self-scoped: every operation targets `session.userId`. There is no target
 * user parameter; a `userId` in the request body is ignored (see
 * `planUserLocaleUpdate`). No workspace/admin role is required — a user may
 * always read and change their own UI language.
 */

export async function GET() {
  try {
    const session = await getSessionFromCookies()
    if (!session) return errorResponse("UNAUTHORIZED", "No autenticado", 401)

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { locale: true },
    })
    if (!user) return errorResponse("NOT_FOUND", "Usuario no encontrado", 404)

    return successResponse({ locale: user.locale ?? null, supported: SUPPORTED_LOCALES })
  } catch (error) {
    return handleError(error, "User")
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSessionFromCookies()
    const body = await request.json().catch(() => ({}))

    const command = planUserLocaleUpdate(session, body)

    if (command.kind === "unauthorized") {
      return errorResponse("UNAUTHORIZED", "No autenticado", 401)
    }
    if (command.kind === "invalid") {
      return errorResponse(
        "VALIDATION_ERROR",
        `Locale no soportado. Opciones: ${SUPPORTED_LOCALES.join(", ")} o null`,
      )
    }

    await db.user.update({
      where: { id: command.userId },
      data: { locale: command.locale },
    })

    /**
     * Cookie mirror — ONLY after the database write succeeded (validation or
     * persistence failures above never touch the cookie). A concrete locale
     * is mirrored so the pre-session first paint matches; clearing the
     * preference deletes the cookie so the next request re-derives the hint
     * from the effective resolution instead of pinning a stale value.
     */
    const cookiePlan = planLocaleCookieAfterUserUpdate(command.locale)
    const cookieStore = await cookies()
    if (cookiePlan.kind === "set") {
      cookieStore.set(LOCALE_COOKIE, cookiePlan.value, buildLocaleCookieOptions())
    } else {
      cookieStore.delete(LOCALE_COOKIE)
    }

    return successResponse({ locale: command.locale })
  } catch (error) {
    return handleError(error, "User")
  }
}
