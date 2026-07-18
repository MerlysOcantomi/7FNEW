import assert from "node:assert/strict"
import test from "node:test"
import { isBeautyTodayVertical } from "./beauty-today"
import { getBeautyTodayMessages } from "./i18n"
import {
  getBeautyAppointmentDayMock,
  getAppointmentDayMock,
} from "../../components/today/appointments/appointment-mock"
import { deriveAppointmentDay, type AppointmentStatus } from "./appointments"

const VALID_STATUSES: AppointmentStatus[] = ["confirmed", "pending", "arrived", "no_show", "cancelled"]

// ─── Vertical gate + localized catalogs ──────────────────────────────────────

test("beauty vertical gate + localized Finesse catalogs (en canonical, es complete)", () => {
  assert.ok(isBeautyTodayVertical("beauty"))
  const es = getBeautyTodayMessages("es")
  const en = getBeautyTodayMessages("en")
  // Brand lines are proper nouns, identical across locales.
  for (const c of [es, en]) {
    assert.equal(c.brandTitle, "7F Beauty")
    assert.equal(c.brandLine, "7F Beauty, powered by Finesse")
    assert.equal(c.eyebrow, "Finesse · Beauty Intelligence")
    assert.equal(c.extras.featuredServices.length, 4)
  }
  // Internal status VALUES stay stable; only labels localize.
  assert.equal(es.previewChip, "Vista previa · datos de ejemplo")
  assert.equal(es.statusLabels.no_show, "No asistió")
  assert.equal(es.statusLabels.confirmed, "Confirmada")
  assert.equal(en.previewChip, "Preview · sample data")
  assert.equal(en.statusLabels.no_show, "No-show")
  assert.equal(en.statusLabels.confirmed, "Confirmed")
  // Real translations, never copies; no banned gendered noun.
  assert.notEqual(es.studio.intro, en.studio.intro)
  assert.notEqual(es.demo.assistantNote, en.demo.assistantNote)
  for (const c of [es, en]) assert.ok(!/clienta\b/i.test(JSON.stringify(c)))
  // de/fr/it are not offered inside Finesse yet → English, never mixed.
  assert.equal(getBeautyTodayMessages("de").locale, "en")
  assert.equal(getBeautyTodayMessages("xx").locale, "en")
})

test("beauty aliases (salon/nails) activate; non-beauty/empty do not", () => {
  assert.ok(isBeautyTodayVertical("salon"))
  assert.ok(isBeautyTodayVertical("nails"))
  assert.equal(isBeautyTodayVertical("creative-agency"), false)
  assert.equal(isBeautyTodayVertical("construction"), false)
  assert.equal(isBeautyTodayVertical(null), false)
  assert.equal(isBeautyTodayVertical(undefined), false)
})

// ─── Beauty mock ─────────────────────────────────────────────────────────────

test("beauty mock: Spanish default day, valid contract, all statuses valid", () => {
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

test("beauty mock localizes service names from the catalog, keeps names/structure", () => {
  const en = getBeautyTodayMessages("en")
  const es = getBeautyTodayMessages("es")
  const dayEn = getBeautyAppointmentDayMock("multi", en.demo.services)
  const dayEs = getBeautyAppointmentDayMock("multi", es.demo.services)
  assert.ok(dayEn.appointments.some((a) => a.service === "Semi-permanent manicure"))
  assert.ok(dayEs.appointments.some((a) => a.service === "Manicura semipermanente"))
  // Structure and client names identical across locales.
  assert.deepEqual(
    dayEn.appointments.map((a) => [a.id, a.clientName, a.status, a.price]),
    dayEs.appointments.map((a) => [a.id, a.clientName, a.status, a.price]),
  )
})

test("NO REGRESSION: generic mock unchanged (English salon 'Studio Mila')", () => {
  const day = getAppointmentDayMock("multi")
  assert.equal(day.businessName, "Studio Mila")
  assert.equal(day.staff.length, 3)
})
