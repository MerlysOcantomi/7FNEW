/**
 * Finesse Beauty appointments — pure projection over the shared Calendar Engine.
 * Appointment V2 enriches Evento without introducing a second calendar entity.
 */
import type { CalendarItem } from "../types"

export const APPOINTMENT_TIPO = "cita"

export type AppointmentPhase = "past" | "current" | "upcoming"
export type AppointmentLifecycleStatus =
  | "pending"
  | "confirmed"
  | "arrived"
  | "completed"
  | "no_show"
  | "cancelled"

export interface BeautyAppointment {
  id: string
  title: string
  start: Date
  end: Date | null
  clientName: string | null
  durationMinutes: number | null
  phase: AppointmentPhase
  conflict: boolean

  serviceId: string | null
  serviceName: string | null
  servicePrice: number | null
  serviceCurrency: string | null
  assignedUserId: string | null
  lifecycleStatus: AppointmentLifecycleStatus | null
  origin: string | null
}

export function appointmentPhase(start: Date, end: Date | null, now: Date): AppointmentPhase {
  if (start.getTime() > now.getTime()) return "upcoming"
  if (end !== null && end.getTime() > now.getTime()) return "current"
  return "past"
}

export function durationMinutes(start: Date, end: Date | null): number | null {
  if (!end) return null
  const ms = end.getTime() - start.getTime()
  return ms > 0 ? Math.round(ms / 60000) : null
}

function lifecycleStatus(value: string | null | undefined): AppointmentLifecycleStatus | null {
  switch (value) {
    case "pending":
    case "confirmed":
    case "arrived":
    case "completed":
    case "no_show":
    case "cancelled":
      return value
    default:
      return null
  }
}

function appointmentConflictIds(items: CalendarItem[]): Set<string> {
  const timed = items.filter(
    (item) =>
      item.type === "evento" &&
      !item.allDay &&
      item.appointmentStatus !== "cancelled" &&
      !Number.isNaN(new Date(item.date).getTime()),
  )
  const ids = new Set<string>()

  for (let i = 0; i < timed.length; i++) {
    for (let j = i + 1; j < timed.length; j++) {
      const a = timed[i]
      const b = timed[j]

      // Two structured citas assigned to different known professionals are
      // independently bookable. Generic events and legacy/unassigned citas
      // remain workspace-wide blockers because their resource is unknown.
      if (
        a.status === APPOINTMENT_TIPO &&
        b.status === APPOINTMENT_TIPO &&
        a.assignedUserId &&
        b.assignedUserId &&
        a.assignedUserId !== b.assignedUserId
      ) {
        continue
      }

      const aStart = new Date(a.date).getTime()
      const bStart = new Date(b.date).getTime()
      const aEnd =
        a.endDate && !Number.isNaN(new Date(a.endDate).getTime())
          ? new Date(a.endDate).getTime()
          : aStart + 60 * 60 * 1000
      const bEnd =
        b.endDate && !Number.isNaN(new Date(b.endDate).getTime())
          ? new Date(b.endDate).getTime()
          : bStart + 60 * 60 * 1000

      if (aStart < bEnd && bStart < aEnd) {
        ids.add(a.id)
        ids.add(b.id)
      }
    }
  }

  return ids
}

export function toBeautyAppointments(items: CalendarItem[], now: Date): BeautyAppointment[] {
  const conflicts = appointmentConflictIds(items)

  return items
    .filter(
      (item) =>
        item.type === "evento" &&
        item.status === APPOINTMENT_TIPO &&
        !item.allDay &&
        !Number.isNaN(new Date(item.date).getTime()),
    )
    .map((item) => {
      const start = new Date(item.date)
      const end =
        item.endDate && !Number.isNaN(new Date(item.endDate).getTime())
          ? new Date(item.endDate)
          : null

      return {
        id: item.id,
        title: item.title,
        start,
        end,
        clientName: item.clientName ?? null,
        durationMinutes:
          item.durationMinutes ?? durationMinutes(start, end),
        phase: appointmentPhase(start, end, now),
        conflict: conflicts.has(item.id),
        serviceId: item.serviceId ?? null,
        serviceName: item.serviceNameSnapshot ?? item.title ?? null,
        servicePrice: item.servicePrice ?? null,
        serviceCurrency: item.serviceCurrency ?? null,
        assignedUserId: item.assignedUserId ?? null,
        lifecycleStatus: lifecycleStatus(item.appointmentStatus),
        origin: item.origin ?? null,
      }
    })
    .sort((a, b) => a.start.getTime() - b.start.getTime())
}

export function phaseCounts(
  appointments: BeautyAppointment[],
): Record<AppointmentPhase, number> {
  return appointments.reduce(
    (acc, appointment) => {
      acc[appointment.phase] += 1
      return acc
    },
    { past: 0, current: 0, upcoming: 0 } as Record<AppointmentPhase, number>,
  )
}
