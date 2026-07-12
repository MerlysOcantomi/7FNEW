/**
 * Personal user app-locale persistence policy — pure, no I/O.
 *
 * Kept separate from `./locale` (general locale normalization: parseLocale /
 * isValidLocale) on purpose: normalizing an arbitrary language string and
 * deciding what may be *persisted as a user's personal preference* are
 * different responsibilities.
 *
 * Persistence rule: store only canonical `SUPPORTED_LOCALES` codes ("en" | "es"
 * | "de") or `null` ("no explicit personal preference"). Regional codes such as
 * "es-MX" / "de-CH" are rejected here — they may be normalized during future
 * detection/resolution, but the stored personal preference stays canonical.
 *
 * No React, no Prisma, no import from `./index`. Depends only on `./locale`
 * and `./types`.
 */

import { isValidLocale } from "./locale"
import type { SupportedLocale } from "./types"

/** Result of validating a candidate personal-locale value. */
export type UserLocaleParse =
  | { ok: true; value: SupportedLocale | null }
  | { ok: false }

/**
 * Validate a raw personal-locale value for persistence.
 * - exact "en" | "es" | "de"  → { ok: true, value }
 * - null                      → { ok: true, value: null } (clear preference)
 * - anything else (including "", "fr", "es-MX", undefined, numbers, objects)
 *                             → { ok: false }
 */
export function parseUserLocalePreference(raw: unknown): UserLocaleParse {
  if (raw === null) return { ok: true, value: null }
  if (typeof raw === "string" && isValidLocale(raw)) return { ok: true, value: raw }
  return { ok: false }
}

/** Minimal session shape this policy needs. */
export interface UserLocaleSession {
  userId: string
}

/**
 * Command produced by {@link planUserLocaleUpdate} for the route to execute.
 * `update` is the only branch that writes; its `userId` is always the session
 * user.
 */
export type UserLocaleCommand =
  | { kind: "unauthorized" }
  | { kind: "invalid" }
  | { kind: "update"; userId: string; locale: SupportedLocale | null }

/**
 * Pure orchestration for `PUT /api/users/me/locale`.
 *
 * Self-scoped by construction: the target user is ALWAYS `session.userId`. Any
 * `userId` present in the request body is never read and cannot redirect the
 * update to another user. Returns `unauthorized` when there is no session and
 * `invalid` when the locale is not persistable — in both cases the caller must
 * NOT perform a database write.
 */
export function planUserLocaleUpdate(
  session: UserLocaleSession | null,
  body: unknown,
): UserLocaleCommand {
  if (!session) return { kind: "unauthorized" }

  const rawLocale =
    body && typeof body === "object" && "locale" in body
      ? (body as { locale: unknown }).locale
      : undefined

  const parsed = parseUserLocalePreference(rawLocale)
  if (!parsed.ok) return { kind: "invalid" }

  return { kind: "update", userId: session.userId, locale: parsed.value }
}
