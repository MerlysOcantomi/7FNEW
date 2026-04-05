export type { TranslationSet } from "./types"
export { SUPPORTED_LOCALES, DEFAULT_LOCALE, type SupportedLocale } from "./types"

import type { SupportedLocale, TranslationSet } from "./types"
import { DEFAULT_LOCALE } from "./types"
import { en } from "./locales/en"
import { es } from "./locales/es"
import { de } from "./locales/de"

const LOCALE_MAP: Record<SupportedLocale, TranslationSet> = { en, es, de }

export function getTranslations(locale?: string | null): TranslationSet {
  const key = parseLocale(locale)
  return LOCALE_MAP[key]
}

export function parseLocale(raw?: string | null): SupportedLocale {
  if (!raw) return DEFAULT_LOCALE
  const lower = raw.trim().toLowerCase()
  if (lower in LOCALE_MAP) return lower as SupportedLocale
  const prefix = lower.split(/[-_]/)[0]
  if (prefix in LOCALE_MAP) return prefix as SupportedLocale
  return DEFAULT_LOCALE
}

export function isValidLocale(raw: string): raw is SupportedLocale {
  return raw in LOCALE_MAP
}

/**
 * Extracts the locale from a raw workspace config JSON string.
 * Expected path: { locale: "es" } at the root level.
 */
export function resolveLocaleFromConfig(configJson: string | null | undefined): SupportedLocale {
  if (!configJson) return DEFAULT_LOCALE
  try {
    const parsed = JSON.parse(configJson)
    return parseLocale(parsed?.locale)
  } catch {
    return DEFAULT_LOCALE
  }
}
