/**
 * Beauty "Hoy" — vertical activation for the Finesse appointment-first Today.
 *
 * Pure and DB-free: resolves entirely from `verticalKey`. All visible copy
 * lives in the localized catalogs under `modules/today/i18n` (English
 * canonical, Spanish complete), resolved from the effective `useI18n()`
 * locale — the profile/gate never carries a final language.
 *
 * MVP scope: this drives a VISIBLE Beauty "Hoy" over the existing mock data —
 * no backend, no AI, no real actions. The layout renders a localized
 * "Preview · sample data" chip so a real operator is never shown demo data as
 * real.
 */

import { mapVerticalKeyToBusinessType } from "@core/personalization"

export type { BeautyTodayMessages as BeautyTodayConfig } from "./i18n/types"

/** True when the vertical (or its salon/nails/… aliases) is a beauty workspace. */
export function isBeautyTodayVertical(verticalKey: string | null | undefined): boolean {
  if (!verticalKey) return false
  return mapVerticalKeyToBusinessType(verticalKey) === "beauty"
}
