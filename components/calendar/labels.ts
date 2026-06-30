/**
 * 7F Calendar — humanized labels. Reuses the shared English maps so the UI
 * never shows raw DB codes (pendiente, en_progreso, pagada, urgente, …).
 * Eventos use their own `tipo` vocabulary (reunion → Meeting), which the shared
 * estado map doesn't cover.
 */
import { displayLabel, estadoLabel, prioridadLabel } from "@/lib/api-client"
import type { CalendarItem } from "./types"

const EVENT_TYPE_LABEL: Record<string, string> = {
  reunion: "Meeting",
  entrega: "Delivery",
  llamada: "Call",
  cita: "Appointment",
  evento: "Event",
}

function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

export function eventTypeLabel(tipo: string | null | undefined): string {
  const key = (tipo ?? "").toLowerCase()
  return EVENT_TYPE_LABEL[key] ?? (key ? capitalize(key) : "Event")
}

/** Humanized status: eventos use their type vocabulary; every other item uses
 *  the shared English estado map. Never returns a raw DB code. */
export function statusLabel(item: Pick<CalendarItem, "type" | "status">): string {
  if (item.type === "evento") return eventTypeLabel(item.status)
  return item.status ? displayLabel(item.status, estadoLabel) : ""
}

export function priorityLabel(priority: string | null | undefined): string {
  return priority ? displayLabel(priority, prioridadLabel) : ""
}
