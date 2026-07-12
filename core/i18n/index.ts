export type { TranslationSet } from "./types"
export { SUPPORTED_LOCALES, DEFAULT_LOCALE, type SupportedLocale } from "./types"
export { parseLocale, isValidLocale } from "./locale"

import type { SupportedLocale, TranslationSet } from "./types"
import { DEFAULT_LOCALE } from "./types"
import { parseLocale } from "./locale"
import { en } from "./locales/en"
import { es } from "./locales/es"
import { de } from "./locales/de"

const LOCALE_MAP: Record<SupportedLocale, TranslationSet> = { en, es, de }

export function getTranslations(locale?: string | null): TranslationSet {
  const key = parseLocale(locale)
  return LOCALE_MAP[key]
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
