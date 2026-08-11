import { test } from "node:test"
import assert from "node:assert/strict"

import {
  APPOINTMENT_TIPO,
  appointmentPhase,
  durationMinutes,
  phaseCounts,
  toBeautyAppointments,
} from "./appointment-model"
import type { CalendarItem } from "../types"

function iso(y: number, mo: number, d: number, h = 0, mi = 0): string {
  return new Date(y, mo, d, h, mi, 0).toISOString()
}

function cita(id: string, startISO: string, endISO: string | null, clientName?: string): CalendarItem {
  return {
    id,
    type: "evento",
    title: id,
    date: startISO,
    endDate: endISO,
    allDay: false,
    status: APPOINTMENT_TIPO,
    clientName,
  }
}

const now = new Date(2026, 5, 24, 12, 0, 0) // Wed Jun 24 2026, 12:00

test("appointmentPhase is time-derived only (never an attendance claim)", () => {
  const start = new Date(2026, 5, 24, 13, 0)
  assert.equal(appointmentPhase(start, new Date(2026, 5, 24, 14, 0), now), "upcoming")
  const running = new Date(2026, 5, 24, 11, 30)
  assert.equal(appointmentPhase(running, new Date(2026, 5, 24, 12, 30), now), "current")
  const done = new Date(2026, 5, 24, 9, 0)
  assert.equal(appointmentPhase(done, new Date(2026, 5, 24, 10, 0), now), "past")
  // Started, no known end → past (never guessed as ongoing).
  assert.equal(appointmentPhase(running, null, now), "past")
})

test("durationMinutes derives from start/end, null without an end", () => {
  assert.equal(durationMinutes(new Date(2026, 5, 24, 10, 0), new Date(2026, 5, 24, 10, 45)), 45)
  assert.equal(durationMinutes(new Date(2026, 5, 24, 10, 0), null), null)
  // Non-positive spans are treated as unknown, not negative.
  assert.equal(durationMinutes(new Date(2026, 5, 24, 10, 0), new Date(2026, 5, 24, 9, 0)), null)
})

test("toBeautyAppointments keeps only timed citas, verbatim title + client, sorted", () => {
  const items: CalendarItem[] = [
    cita("C2", iso(2026, 5, 24, 15, 0), iso(2026, 5, 24, 16, 0), "María"),
    cita("C1", iso(2026, 5, 24, 9, 0), iso(2026, 5, 24, 10, 0), "Ana"),
    // Not a cita — a generic meeting — must be excluded.
    { id: "M", type: "evento", title: "M", date: iso(2026, 5, 24, 11, 0), endDate: null, allDay: false, status: "reunion" },
    // A tarea deadline — excluded.
    { id: "T", type: "tarea", title: "T", date: iso(2026, 5, 24), allDay: true, status: "pendiente" },
    // An all-day cita — excluded from the timed timeline.
    { id: "AD", type: "evento", title: "AD", date: iso(2026, 5, 24), endDate: null, allDay: true, status: "cita" },
  ]
  const out = toBeautyAppointments(items, now)
  assert.deepEqual(
    out.map((a) => a.id),
    ["C1", "C2"],
  )
  assert.equal(out[0].title, "C1")
  assert.equal(out[0].clientName, "Ana")
  assert.equal(out[1].clientName, "María")
})

test("toBeautyAppointments flags conflicts via the shared engine (cita vs any event)", () => {
  const items: CalendarItem[] = [
    cita("A", iso(2026, 5, 24, 10, 0), iso(2026, 5, 24, 11, 0)),
    // Overlapping generic meeting — a cita conflicts with any booked time.
    { id: "B", type: "evento", title: "B", date: iso(2026, 5, 24, 10, 30), endDate: iso(2026, 5, 24, 11, 30), allDay: false, status: "reunion" },
    cita("C", iso(2026, 5, 24, 14, 0), iso(2026, 5, 24, 15, 0)),
  ]
  const out = toBeautyAppointments(items, now)
  const a = out.find((x) => x.id === "A")
  const c = out.find((x) => x.id === "C")
  assert.equal(a?.conflict, true)
  assert.equal(c?.conflict, false)
})

test("phaseCounts buckets appointments by time-derived phase", () => {
  const items: CalendarItem[] = [
    cita("past", iso(2026, 5, 24, 8, 0), iso(2026, 5, 24, 9, 0)),
    cita("now", iso(2026, 5, 24, 11, 30), iso(2026, 5, 24, 12, 30)),
    cita("next", iso(2026, 5, 24, 15, 0), iso(2026, 5, 24, 16, 0)),
  ]
  const counts = phaseCounts(toBeautyAppointments(items, now))
  assert.deepEqual(counts, { past: 1, current: 1, upcoming: 1 })
})
