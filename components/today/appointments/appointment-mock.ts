import type {
  Appointment,
  AppointmentDay,
  AppointmentGap,
} from "@modules/today/appointments"

/**
 * ISOLATED demo adapter for the appointment-first Today layout.
 *
 * ⚠️ DEMO DATA ONLY. There is no real appointment backend yet (see
 * modules/today/appointments.ts). This module is the single, clearly-named
 * place that produces mock bookings, used ONLY by the appointment layout while
 * it is in preview/disabled-by-default mode. It performs no I/O, registers no
 * provider, and is never mixed with real production data. When a real source
 * lands, swap the layout's data hook and delete this file — nothing else
 * depends on it.
 */

/** Build an ISO timestamp for *today* at a given local hour/minute. */
function at(hour: number, minute = 0): string {
  const d = new Date()
  d.setHours(hour, minute, 0, 0)
  return d.toISOString()
}

const STAFF_MULTI = [
  { id: "s1", name: "Lucía" },
  { id: "s2", name: "Marco" },
  { id: "s3", name: "Aisha" },
]

const STAFF_SOLO = [{ id: "s1", name: "Lucía" }]

function multiAppointments(): Appointment[] {
  return [
    { id: "a1", start: at(9, 0), end: at(9, 45), clientName: "Marina Velasco", service: "Haircut", staffId: "s1", staffName: "Lucía", status: "confirmed", price: 35 },
    { id: "a2", start: at(10, 0), end: at(11, 0), clientName: "Tomás Iglesias", service: "Color", staffId: "s1", staffName: "Lucía", status: "pending", price: 80 },
    { id: "a3", start: at(14, 0), end: at(15, 0), clientName: "Laura Méndez", service: "Balayage", staffId: "s1", staffName: "Lucía", status: "confirmed", price: 120 },
    { id: "a4", start: at(16, 0), end: at(16, 30), clientName: "Sofía Cano", service: "Blow-dry", staffId: "s1", staffName: "Lucía", status: "arrived", price: 25 },

    { id: "a5", start: at(9, 30), end: at(10, 15), clientName: "Andrés Pol", service: "Beard trim", staffId: "s2", staffName: "Marco", status: "confirmed", price: 20 },
    { id: "a6", start: at(11, 0), end: at(12, 0), clientName: "Diego Ramos", service: "Cut + beard", staffId: "s2", staffName: "Marco", status: "no_show", price: 40 },
    { id: "a7", start: at(13, 0), end: at(14, 0), clientName: "Pablo Ruiz", service: "Cut", staffId: "s2", staffName: "Marco", status: "confirmed", price: 30 },

    { id: "a8", start: at(10, 0), end: at(11, 30), clientName: "Carla Pix", service: "Gel nails", staffId: "s3", staffName: "Aisha", status: "pending", price: 45 },
    { id: "a9", start: at(12, 30), end: at(13, 15), clientName: "Nora Díaz", service: "Manicure", staffId: "s3", staffName: "Aisha", status: "confirmed", price: 30 },
    { id: "a10", start: at(15, 0), end: at(16, 0), clientName: "Elena Soto", service: "Pedicure", staffId: "s3", staffName: "Aisha", status: "cancelled", price: 35 },
  ]
}

function multiGaps(): AppointmentGap[] {
  return [
    { id: "g1", staffId: "s1", start: at(11, 0), end: at(12, 0) },
    { id: "g2", staffId: "s2", start: at(14, 0), end: at(15, 30) },
    { id: "g3", staffId: "s3", start: at(13, 15), end: at(15, 0) },
  ]
}

function soloAppointments(): Appointment[] {
  return [
    { id: "a1", start: at(9, 0), end: at(9, 45), clientName: "Marina Velasco", service: "Haircut", staffId: "s1", staffName: "Lucía", status: "confirmed", price: 35 },
    { id: "a2", start: at(10, 30), end: at(11, 30), clientName: "Tomás Iglesias", service: "Color", staffId: "s1", staffName: "Lucía", status: "pending", price: 80 },
    { id: "a3", start: at(13, 0), end: at(13, 45), clientName: "Sofía Cano", service: "Blow-dry", staffId: "s1", staffName: "Lucía", status: "arrived", price: 25 },
    { id: "a4", start: at(15, 0), end: at(16, 0), clientName: "Laura Méndez", service: "Balayage", staffId: "s1", staffName: "Lucía", status: "confirmed", price: 120 },
  ]
}

function soloGaps(): AppointmentGap[] {
  return [
    { id: "g1", staffId: "s1", start: at(11, 30), end: at(13, 0) },
    { id: "g2", staffId: "s1", start: at(16, 0), end: at(17, 30) },
  ]
}

/** Demo day. `staffMode` lets a reviewer preview both sub-layouts. */
export function getAppointmentDayMock(staffMode: "multi" | "solo" = "multi"): AppointmentDay {
  if (staffMode === "solo") {
    return {
      businessName: "Studio Mila",
      staff: STAFF_SOLO,
      appointments: soloAppointments(),
      gaps: soloGaps(),
    }
  }
  return {
    businessName: "Studio Mila",
    staff: STAFF_MULTI,
    appointments: multiAppointments(),
    gaps: multiGaps(),
  }
}
