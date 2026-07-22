/**
 * Finesse Beauty appointments — pure projection over the shared Calendar Engine.
 *
 * A Beauty appointment is NOT a new entity: it is a `CalendarItem` of
 * `type: "evento"` whose persisted `Evento.tipo` is `"cita"` (the same
 * discriminator Beauty Today already reads). This module derives the Beauty
 * view-model from the SHARED feed items and reuses the engine's conflict
 * detector — it introduces no second model, feed, query or conflict engine.
 *
 * HONESTY: `Evento` has no attendance/confirmation column, so an appointment
 * carries only a TIME-DERIVED `phase` (past/current/upcoming) — never a
 * confirmed/completed/no-show claim. It has no price, so none is derived. The
 * `title`/`clientName` are the operator's own text, kept verbatim.
 */
import { conflictingEventoIds } from "../lenses"
import type { CalendarItem } from "../types"

/** Persisted `Evento.tipo` value that marks a Beauty appointment. */
export const APPOINTMENT_TIPO = "cita"

/** Time-derived only — never an attendance statement. */
export type AppointmentPhase = "past" | "current" | "upcoming"

export interface BeautyAppointment {
  id: string
  /** `Evento.titulo` — the operator's own text (usually the service). Verbatim. */
  title: string
  start: Date
  /** `null` when the cita has no known end (no duration can be derived). */
  end: Date | null
  clientName: string | null
  /** Minutes between start and end; `null` when the cita has no end. */
  durationMinutes: number | null
  phase: AppointmentPhase
  /** Overlaps another timed event — from the SHARED `conflictingEventoIds`. */
  conflict: boolean
}

/** Phase from the clock alone. A started cita with no end is "past" (a time
 *  statement — guessing it is still running would be invention). */
export function appointmentPhase(start: Date, end: Date | null, now: Date): AppointmentPhase {
  if (start.getTime() > now.getTime()) return "upcoming"
  if (end !== null && end.getTime() > now.getTime()) return "current"
  return "past"
}

/** Whole minutes of a cita, or `null` when it has no (valid) end. */
export function durationMinutes(start: Date, end: Date | null): number | null {
  if (!end) return null
  const ms = end.getTime() - start.getTime()
  return ms > 0 ? Math.round(ms / 60000) : null
}

/**
 * Project shared feed items into timed Beauty appointments, sorted by start.
 * Conflicts are computed by the shared engine over ALL timed events in the
 * range (a cita legitimately conflicts with any other booked time), then read
 * back per appointment.
 */
export function toBeautyAppointments(items: CalendarItem[], now: Date): BeautyAppointment[] {
  const conflicts = conflictingEventoIds(items)
  return items
    .filter(
      (it) =>
        it.type === "evento" &&
        it.status === APPOINTMENT_TIPO &&
        !it.allDay &&
        !Number.isNaN(new Date(it.date).getTime()),
    )
    .map((it) => {
      const start = new Date(it.date)
      const end =
        it.endDate && !Number.isNaN(new Date(it.endDate).getTime()) ? new Date(it.endDate) : null
      return {
        id: it.id,
        title: it.title,
        start,
        end,
        clientName: it.clientName ?? null,
        durationMinutes: durationMinutes(start, end),
        phase: appointmentPhase(start, end, now),
        conflict: conflicts.has(it.id),
      }
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())
}

/** Count of appointments in each time-derived phase (for header/summary chips). */
export function phaseCounts(appointments: BeautyAppointment[]): Record<AppointmentPhase, number> {
  return appointments.reduce(
    (acc, a) => {
      acc[a.phase] += 1
      return acc
    },
    { past: 0, current: 0, upcoming: 0 } as Record<AppointmentPhase, number>,
  )
}
