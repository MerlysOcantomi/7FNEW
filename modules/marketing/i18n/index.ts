/**
 * Finesse Marketing i18n — the vertical's localized catalogs.
 *
 * All five official locales are REAL, complete catalogs (typed against
 * `BeautyMarketingMessages`, enforced by `satisfies` + tests). There is no
 * English fallback inside this namespace: `parseLocale` only steps in for an
 * invalid/unknown EXTERNAL locale string, per the Core fallback contract.
 */

import { parseLocale, type SupportedLocale } from "@core/i18n"
import type { BeautyMarketingMessages } from "./types"
import { es } from "./es"
import { en } from "./en"
import { de } from "./de"
import { fr } from "./fr"
import { it } from "./it"

export type {
  BeautyMarketingMessages,
  MarketingDraftTemplates,
  MarketingDemoContent,
} from "./types"

export const MARKETING_MESSAGES: Record<SupportedLocale, BeautyMarketingMessages> = {
  es,
  en,
  de,
  fr,
  it,
}

/**
 * Resolve the Marketing catalog for the effective UI locale (as provided by
 * `useI18n()` / the Core resolution chain — never re-resolved here). Unknown
 * input normalizes through `parseLocale` (→ English), which only happens for
 * an invalid external locale, never for one of the five official codes.
 */
export function getBeautyMarketingMessages(
  locale: string | null | undefined,
): BeautyMarketingMessages {
  return MARKETING_MESSAGES[parseLocale(locale)]
}
