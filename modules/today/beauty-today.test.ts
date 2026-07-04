import assert from "node:assert/strict"
import test from "node:test"
import { resolveBeautyTodayConfig } from "./beauty-today"
import {
  getBeautyAppointmentDayMock,
  getAppointmentDayMock,
} from "../../components/today/appointments/appointment-mock"
import { deriveAppointmentDay, type AppointmentStatus } from "./appointments"

const VALID_STATUSES: AppointmentStatus[] = ["confirmed", "pending", "arrived", "no_show", "cancelled"]

// ─── resolveBeautyTodayConfig ────────────────────────────────────────────────

test("beauty vertical → Spanish Finesse config", () => {
  const c = resolveBeautyTodayConfig("beauty")
  assert.ok(c)
  assert.equal(c?.brandTitle, "7F Beauty")
  assert.equal(c?.brandLine, "7F Beauty, powered by Finesse")
  assert.equal(c?.eyebrow, "Finesse · Beauty Intelligence")
  assert.equal(c?.previewChip, "Vista previa · datos de ejemplo")
  assert.equal(c?.statusLabels.no_show, "No asistió")
  assert.equal(c?.statusLabels.confirmed, "Confirmada")
  assert.equal(c?.ui.railTitle, "Flujo de Finesse")
  assert.equal(c?.extras.featuredServices.length, 4)
})

test("beauty aliases (salon/nails) → config; non-beauty/empty → null", () => {
  assert.ok(resolveBeautyTodayConfig("salon"))
  assert.ok(resolveBeautyTodayConfig("nails"))
  assert.equal(resolveBeautyTodayConfig("creative-agency"), null)
  assert.equal(resolveBeautyTodayConfig("construction"), null)
  assert.equal(resolveBeautyTodayConfig(null), null)
  assert.equal(resolveBeautyTodayConfig(undefined), null)
})

// ─── Beauty mock ─────────────────────────────────────────────────────────────

test("beauty mock: Spanish salon day, valid contract, all statuses valid", () => {
  const day = getBeautyAppointmentDayMock("multi")
  assert.equal(day.businessName, "Estudio Bella")
  assert.equal(day.staff.length, 3)
  assert.ok(day.appointments.length >= 6)
  assert.ok(day.gaps.length >= 1)
  for (const a of day.appointments) {
    assert.ok(VALID_STATUSES.includes(a.status), `invalid status ${a.status}`)
  }
  // Spanish services from the beauty catalog
  assert.ok(day.appointments.some((a) => a.service === "Manicura semipermanente"))
  // Derivation works (drives the summary pills)
  const d = deriveAppointmentDay(day)
  assert.equal(d.appointmentsCount, day.appointments.length)
  assert.ok(d.bookedValue > 0)
})

test("beauty mock solo variant → single provider", () => {
  const day = getBeautyAppointmentDayMock("solo")
  assert.equal(day.staff.length, 1)
})

test("NO REGRESSION: generic mock unchanged (English salon 'Studio Mila')", () => {
  const day = getAppointmentDayMock("multi")
  assert.equal(day.businessName, "Studio Mila")
  assert.equal(day.staff.length, 3)
})
