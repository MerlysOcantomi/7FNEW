/**
 * 7F Calendar — humanized labels (pure, no React). The UI never shows raw DB
 * codes (pendiente, en_progreso, pagada, urgente, …): statuses/priorities
 * resolve through the shared `statuses` catalog via `resolveStatusLabel`, and
 * eventos use the calendar catalog's `eventTypes` vocabulary (reunion →
 * Meeting/Reunión). Components pass `t.calendar` / `t.statuses`; the English
 * catalogs are the pure defaults so tests and pure callers stay canonical.
 */
import { resolveStatusLabel, type CalendarMessages, type UIMessages } from "@core/i18n/ui"
import { calendar as enCalendar } from "@core/i18n/ui/en/calendar"
import { statuses as enStatuses } from "@core/i18n/ui/en/statuses"
import type { CalendarItem } from "./types"

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

export function eventTypeLabel(
  tipo: string | null | undefined,
  calendar: CalendarMessages = enCalendar,
): string {
  const key = (tipo ?? "").toLowerCase()
  const map = calendar.eventTypes as Record<string, string>
  return map[key] ?? (key ? capitalize(key) : calendar.eventTypes.evento)
}

/** Humanized status: eventos use their type vocabulary; every other item uses
 *  the shared status catalog. Never returns a raw DB code for known values. */
export function statusLabel(
  item: Pick<CalendarItem, "type" | "status">,
  calendar: CalendarMessages = enCalendar,
  statuses: UIMessages["statuses"] = enStatuses,
): string {
  if (item.type === "evento") return eventTypeLabel(item.status, calendar)
  return item.status ? resolveStatusLabel(statuses, item.status) : ""
}

export function priorityLabel(
  priority: string | null | undefined,
  statuses: UIMessages["statuses"] = enStatuses,
): string {
  return priority ? resolveStatusLabel(statuses, priority) : ""
}
