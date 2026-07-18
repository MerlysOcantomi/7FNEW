import type { CalendarMessages } from "../types"

/**
 * Spanish source for the `calendar` UI namespace.
 * P4.1 ships English values on purpose — no surface consumes this namespace
 * yet; the translation pass (Calendario vs Beauty "Agenda") belongs to the
 * Finesse pilot (P4.2). Typed parity enforced.
 */
export const calendar: CalendarMessages = {
  title: "Calendar",
  today: "Today",
  empty: "No events scheduled.",
}
