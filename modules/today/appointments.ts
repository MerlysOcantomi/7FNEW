/**
 * Appointment-first Today — data contract.
 *
 * There is NO real appointment backend yet: `Evento` carries title + start/end
 * only (no client / service / staff / status / price). This is the small,
 * explicit contract the appointment layout renders against; a real source (a
 * dedicated endpoint or an extended `/api/today`) will populate it later.
 *
 * Until then the ONLY producer is the isolated demo adapter in
 * `components/today/appointments/appointment-mock.ts`. It is never mixed with
 * real production data — the appointment layout is gated and defaults off, so a
 * real operator never sees these mock bookings.
 */
export type AppointmentStatus =
  | "confirmed"
  | "pending"
  | "arrived"
  | "no_show"
  | "cancelled"

export interface AppointmentStaff {
  id: string
  name: string
}

export interface Appointment {
  id: string
  /** ISO 8601 start. */
  start: string
  /** ISO 8601 end. */
  end: string
  clientName: string
  service: string
  staffId: string
  staffName: string
  status: AppointmentStatus
  /** Optional booked value in the workspace currency (minor unit not assumed). */
  price?: number
}

/** A free slot on a staff member's agenda (drives "open gap" affordances). */
export interface AppointmentGap {
  id: string
  staffId: string
  start: string
  end: string
}

export interface AppointmentDay {
  businessName: string
  staff: AppointmentStaff[]
  appointments: Appointment[]
  gaps: AppointmentGap[]
}

export interface AppointmentDerived {
  appointmentsCount: number
  unconfirmedCount: number
  noShowCount: number
  openGaps: number
  bookedValue: number
  staffCount: number
}

/** Statuses that count toward booked value (a confirmed/expected booking). */
const BOOKED_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  "confirmed",
  "arrived",
  "pending",
])

export function deriveAppointmentDay(day: AppointmentDay): AppointmentDerived {
  let bookedValue = 0
  let unconfirmedCount = 0
  let noShowCount = 0

  for (const a of day.appointments) {
    if (a.status === "pending") unconfirmedCount += 1
    if (a.status === "no_show") noShowCount += 1
    if (BOOKED_STATUSES.has(a.status) && typeof a.price === "number") {
      bookedValue += a.price
    }
  }

  return {
    appointmentsCount: day.appointments.length,
    unconfirmedCount,
    noShowCount,
    openGaps: day.gaps.length,
    bookedValue,
    staffCount: day.staff.length,
  }
}
