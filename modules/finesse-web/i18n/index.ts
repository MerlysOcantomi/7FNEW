/**
 * Finesse public landing i18n (FINESSE-WEB-01). Same resolver shape as the
 * other Finesse module catalogs: `parseLocale` normalizes any external value,
 * es/en are real catalogs, everything else resolves to English so the page is
 * never a mix of languages.
 */

import { parseLocale } from "@core/i18n"
import type { FinesseLandingMessages } from "./types"
import { en } from "./en"
import { es } from "./es"

export type { FinesseLandingMessages } from "./types"

const CATALOGS: Partial<Record<string, FinesseLandingMessages>> = { en, es }

export function getFinesseLandingMessages(locale: string | null | undefined): FinesseLandingMessages {
  return CATALOGS[parseLocale(locale)] ?? en
}
