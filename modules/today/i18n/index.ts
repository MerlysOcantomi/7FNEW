/**
 * Finesse "Hoy" i18n — the Beauty Today localized catalogs.
 *
 * English is canonical; Spanish is a complete real translation. de/fr/it are
 * not offered inside Finesse yet (P4.FINESSE-ENES §2) — they resolve to
 * English so the experience is never mixed. `parseLocale` also normalizes
 * invalid external locales to English.
 */

import { parseLocale } from "@core/i18n"
import type { BeautyTodayMessages } from "./types"
import { en } from "./en"
import { es } from "./es"

export type { BeautyTodayMessages } from "./types"

const CATALOGS: Partial<Record<string, BeautyTodayMessages>> = { en, es }

/** Resolve the Beauty Today catalog for the effective UI locale. */
export function getBeautyTodayMessages(locale: string | null | undefined): BeautyTodayMessages {
  return CATALOGS[parseLocale(locale)] ?? en
}
