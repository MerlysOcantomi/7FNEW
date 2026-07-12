/**
 * Locale normalization helpers — leaf module.
 *
 * Depends only on `./types` (no locale dictionaries, no React, no Prisma), so it
 * is safe to import from both the legacy barrel (`./index`) and the new typed UI
 * namespace layer (`./ui`) without creating an import cycle.
 *
 * These helpers were previously defined inline in `./index`; they are extracted
 * here unchanged in behaviour and re-exported from `./index` to preserve the
 * existing public API.
 */

import { SUPPORTED_LOCALES, DEFAULT_LOCALE, type SupportedLocale } from "./types"

const SUPPORTED_SET = new Set<string>(SUPPORTED_LOCALES)

/**
 * Normalize a raw locale string to a supported locale.
 * Case-insensitive; regional variants strip to their prefix (`es-MX` → `es`).
 * Unknown / empty input → `DEFAULT_LOCALE`.
 */
export function parseLocale(raw?: string | null): SupportedLocale {
  if (!raw) return DEFAULT_LOCALE
  const lower = raw.trim().toLowerCase()
  if (SUPPORTED_SET.has(lower)) return lower as SupportedLocale
  const prefix = lower.split(/[-_]/)[0]
  if (SUPPORTED_SET.has(prefix)) return prefix as SupportedLocale
  return DEFAULT_LOCALE
}

/**
 * Type guard: `true` only for an exact supported-locale key (no case folding,
 * no prefix stripping) — matches the previous `raw in LOCALE_MAP` behaviour.
 */
export function isValidLocale(raw: string): raw is SupportedLocale {
  return SUPPORTED_SET.has(raw)
}
