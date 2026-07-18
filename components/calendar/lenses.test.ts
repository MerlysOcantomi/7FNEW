import { test } from "node:test"
import assert from "node:assert/strict"

import { calendar as enCalendar } from "@core/i18n/ui/en/calendar"
import { calendar as esCalendar } from "@core/i18n/ui/es/calendar"
import { applyLens, conflictingEventoIds, LENSES, lensCounts, lensLabel } from "./lenses"
import type { CalendarItem } from "./types"

const today = new Date(2026, 5, 24, 12, 0, 0) // Wed Jun 24 2026

function iso(y: number, mo: number, d: number, h = 0, mi = 0): string {
  return new Date(y, mo, d, h, mi, 0).toISOString()
}
function evento(id: string, startISO: string, endISO: string | null = null): CalendarItem {
  return { id, type: "evento", title: id, date: startISO, endDate: endISO, allDay: false, status: "reunion" }
}
function allDayItem(id: string, type: CalendarItem["type"], dateISO: string, status = "pendiente"): CalendarItem {
  return { id, type, title: id, date: dateISO, allDay: true, status }
}

const items: CalendarItem[] = [
  evento("A", iso(2026, 5, 24, 10, 0), iso(2026, 5, 24, 11, 0)), // today 10–11 (overlaps B)
  evento("B", iso(2026, 5, 24, 10, 30), iso(2026, 5, 24, 11, 30)), // today 10:30–11:30 (overlaps A)
  evento("C", iso(2026, 5, 24, 14, 0), iso(2026, 5, 24, 15, 0)), // today 14–15 (no overlap)
  allDayItem("T0", "tarea", iso(2026, 5, 24)), // today all-day deadline
  allDayItem("T1", "tarea", iso(2026, 5, 25)), // +1 day
  evento("E3", iso(2026, 5, 27, 9, 0), iso(2026, 5, 27, 9, 30)), // +3 days
  allDayItem("F10", "factura", iso(2026, 6, 4), "vencida"), // +10 days (Jul 4)
  allDayItem("P2", "tarea", iso(2026, 5, 22)), // -2 days
]

test("conflictingEventoIds: only overlapping TIMED eventos", () => {
  const ids = conflictingEventoIds(items)
  assert.equal(ids.has("A"), true)
  assert.equal(ids.has("B"), true)
  assert.equal(ids.has("C"), false) // no overlap
  assert.equal(ids.has("T0"), false) // all-day task is never a time conflict
  assert.equal(ids.size, 2)
})

test("lensCounts are real + date-scoped; deferred lenses are 0", () => {
  const c = lensCounts(items, today)
  assert.equal(c["this-day"], 4) // A,B,C,T0
  assert.equal(c["next-days"], 2) // T1 (+1), E3 (+3)
  assert.equal(c["planning-horizon"], 1) // F10 (+10)
  assert.equal(c["time-conflicts"], 2) // A,B
  assert.equal(c["past-events"], 1) // P2
  assert.equal(c["campaign-cycles"], 0)
  assert.equal(c["follow-up-moments"], 0)
  assert.equal(c["prep-windows"], 0)
})

test("applyLens filters honestly; deferred → []; null → all", () => {
  assert.deepEqual(applyLens(items, "this-day", today).map((i) => i.id).sort(), ["A", "B", "C", "T0"])
  assert.deepEqual(applyLens(items, "next-days", today).map((i) => i.id).sort(), ["E3", "T1"])
  assert.deepEqual(applyLens(items, "planning-horizon", today).map((i) => i.id), ["F10"])
  assert.deepEqual(applyLens(items, "time-conflicts", today).map((i) => i.id).sort(), ["A", "B"])
  assert.deepEqual(applyLens(items, "past-events", today).map((i) => i.id), ["P2"])
  assert.deepEqual(applyLens(items, "campaign-cycles", today), [])
  assert.equal(applyLens(items, null, today).length, items.length)
})

test("LENSES = 5 backed + 3 deferred", () => {
  assert.equal(LENSES.filter((l) => l.backed).length, 5)
  assert.equal(LENSES.filter((l) => !l.backed).length, 3)
})

test("lensLabel resolves every lens from the catalog; en/es really differ", () => {
  assert.equal(lensLabel("this-day", enCalendar.lenses.labels), "This day")
  assert.equal(lensLabel("time-conflicts", enCalendar.lenses.labels), "Time conflicts")
  assert.equal(lensLabel("this-day", esCalendar.lenses.labels), "Este día")
  for (const lens of LENSES) {
    const en = lensLabel(lens.key, enCalendar.lenses.labels)
    const es = lensLabel(lens.key, esCalendar.lenses.labels)
    assert.ok(en.length > 0 && es.length > 0, `empty label for ${lens.key}`)
    assert.notEqual(en, es, `${lens.key} label is not translated`)
  }
})
