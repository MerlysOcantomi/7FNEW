export type { TranslationSet } from "./types"
export { SUPPORTED_LOCALES, DEFAULT_LOCALE, FALLBACK_LOCALE, type SupportedLocale } from "./types"
export { parseLocale, isValidLocale } from "./locale"

import type { SupportedLocale, TranslationSet } from "./types"
import { DEFAULT_LOCALE, FALLBACK_LOCALE } from "./types"
import { parseLocale } from "./locale"
import { en } from "./locales/en"
import { es } from "./locales/es"
import { de } from "./locales/de"

/**
 * Fully-translated legacy sets. PARTIAL by design: fr/it are official locales
 * whose email/notification content honestly falls back to English below —
 * never English copies masquerading as translations.
 */
const LOCALE_MAP: Partial<Record<SupportedLocale, TranslationSet>> = { en, es, de }

export function getTranslations(locale?: string | null): TranslationSet {
  const key = parseLocale(locale)
  // Explicit English fallback for official locales without a legacy set yet
  // (fr/it). The returned set's own `.locale` field states the CONTENT
  // language honestly — callers that stamp <html lang> should use it.
  return LOCALE_MAP[key] ?? LOCALE_MAP[FALLBACK_LOCALE]!
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
