/**
 * Finesse "Mi salón" i18n — the overview's localized catalogs.
 *
 * English is canonical; Spanish is a complete real translation. de/fr/it are
 * not offered inside Finesse yet (P4.FINESSE-ENES §2) — until their catalogs
 * exist across every Finesse surface, `getBeautyOverviewMessages` resolves
 * them to English so the experience is never mixed. `parseLocale` also
 * normalizes invalid external locales to English.
 */

import { parseLocale } from "@core/i18n"
import type { BeautyOverviewMessages } from "./types"
import { en } from "./en"
import { es } from "./es"

export type { BeautyOverviewMessages } from "./types"

const CATALOGS: Partial<Record<string, BeautyOverviewMessages>> = { en, es }

/** Resolve the overview catalog for the effective UI locale. */
export function getBeautyOverviewMessages(
  locale: string | null | undefined,
): BeautyOverviewMessages {
  return CATALOGS[parseLocale(locale)] ?? en
}
