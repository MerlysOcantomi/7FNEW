/**
 * Beauty "Marketing" — vertical activation for the Finesse Marketing surface.
 *
 * Mirrors `modules/today/beauty-today.ts`: pure and DB-free, resolves entirely
 * from `verticalKey` (covering aliases salon/nails/… via the business type), so
 * `/contenido` keeps its generic core page untouched for every other vertical.
 *
 * All visible copy lives in the localized catalogs under
 * `modules/marketing/i18n` (five official locales, resolved from the effective
 * `useI18n()` locale — never a second locale resolution).
 *
 * DATA HONESTY: no Marketing backend exists yet (no photo storage, no Freya
 * generation, no channel integrations). The surface therefore runs on the
 * isolated demo adapter (`demo-data.ts`) and ALWAYS shows the localized
 * "Preview · sample data" chip; publish actions never simulate a real
 * publication — they move content to an honest "approved · channel pending"
 * state (see `modules/marketing/state.ts#approvePost`).
 *
 * Activation note: unlike the appointment Today (whose demo layout is gated to
 * explicit previews because it REPLACES real bookings), the Finesse Marketing
 * surface activates for real Beauty workspaces — it is the designed Marketing
 * home for the vertical, its demo layer is always labeled with the preview
 * chip, and no action ever simulates a real external publication.
 */

import { mapVerticalKeyToBusinessType } from "@core/personalization"

/** True when the vertical (or its salon/nails/… aliases) is a beauty workspace. */
export function isBeautyMarketingVertical(verticalKey: string | null | undefined): boolean {
  if (!verticalKey) return false
  return mapVerticalKeyToBusinessType(verticalKey) === "beauty"
}
