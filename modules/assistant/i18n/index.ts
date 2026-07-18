/**
 * Ask Finesse i18n — the assistant's localized catalogs.
 *
 * Mirrors the Finesse Marketing namespace (the vertical-namespace reference,
 * P4.MARKETING-5L): all five official locales are REAL, complete catalogs
 * (typed against `FinesseAssistantMessages`, enforced by `satisfies` + tests).
 * There is no English fallback inside this namespace: `parseLocale` only steps
 * in for an invalid/unknown EXTERNAL locale string, per the Core fallback
 * contract.
 */

import { parseLocale, type SupportedLocale } from "@core/i18n"
import type { FinesseAssistantMessages } from "./types"
import { es } from "./es"
import { en } from "./en"
import { de } from "./de"
import { fr } from "./fr"
import { it } from "./it"

export type {
  FinesseAssistantMessages,
  FinesseDynamicSuggestionMessages,
  FinesseSuggestionCopy,
  FinesseCountedSuggestionCopy,
} from "./types"

export const FINESSE_ASSISTANT_MESSAGES: Record<SupportedLocale, FinesseAssistantMessages> = {
  es,
  en,
  de,
  fr,
  it,
}

/**
 * Resolve the assistant catalog for the effective UI locale (as provided by
 * `useI18n()` / the Core resolution chain — never re-resolved here). Unknown
 * input normalizes through `parseLocale` (→ English), which only happens for
 * an invalid external locale, never for one of the five official codes.
 */
export function getFinesseAssistantMessages(
  locale: string | null | undefined,
): FinesseAssistantMessages {
  return FINESSE_ASSISTANT_MESSAGES[parseLocale(locale)]
}
