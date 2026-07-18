import { NextRequest } from "next/server"
import { cookies } from "next/headers"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { isValidLocale } from "@core/i18n/locale"
import { LOCALE_COOKIE, buildLocaleCookieOptions } from "@core/i18n/cookie"

/**
 * Technical cookie-sync bridge for the 7f-locale cookie.
 *
 * Server Components must not write cookies, and `getRequestLocale()` is
 * read-only — when it reports `shouldSyncCookie`, the i18n provider calls this
 * handler to bring the cookie in line with the EFFECTIVE locale. This route:
 *   - validates against SUPPORTED_LOCALES (exact match, nothing else);
 *   - writes ONLY the cookie — it never touches `User.locale`, workspace
 *     config, or anything else;
 *   - makes no permission decisions and is deliberately session-optional:
 *     the cookie is a per-browser presentation hint (it also serves the
 *     anonymous chain), never an authorization input or a source of truth.
 *
 * Changing the PERSISTED personal preference goes through
 * `PUT /api/users/me/locale`, which syncs this cookie itself after a
 * successful database update.
 */
export async function PUT(request: NextRequest) {
  try {
    const body: unknown = await request.json().catch(() => ({}))
    const locale =
      body && typeof body === "object" && "locale" in body
        ? (body as { locale: unknown }).locale
        : undefined

    if (typeof locale !== "string" || !isValidLocale(locale)) {
      return errorResponse("VALIDATION_ERROR", "Locale no soportado")
    }

    const cookieStore = await cookies()
    cookieStore.set(LOCALE_COOKIE, locale, buildLocaleCookieOptions())

    return successResponse({ locale })
  } catch (error) {
    return handleError(error, "I18n")
  }
}
