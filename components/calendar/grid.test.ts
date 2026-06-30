import { test } from "node:test"
import assert from "node:assert/strict"

import {
  buildMonthDays,
  buildWeekDays,
  formatDateParam,
  getMonday,
  headerTitle,
  isoWeek,
  isSameDay,
  navigateDate,
} from "./grid"

test("formatDateParam zero-pads to YYYY-MM-DD (local)", () => {
  assert.equal(formatDateParam(new Date(2026, 0, 5)), "2026-01-05")
  assert.equal(formatDateParam(new Date(2026, 11, 31)), "2026-12-31")
})

test("isSameDay compares calendar day only", () => {
  assert.equal(isSameDay(new Date(2026, 5, 24, 9), new Date(2026, 5, 24, 23)), true)
  assert.equal(isSameDay(new Date(2026, 5, 24), new Date(2026, 5, 25)), false)
})

test("getMonday returns the Monday at 00:00 of the week", () => {
  // 2026-06-24 is a Wednesday → Monday is 2026-06-22.
  const mon = getMonday(new Date(2026, 5, 24, 15, 30))
  assert.equal(mon.getFullYear(), 2026)
  assert.equal(mon.getMonth(), 5)
  assert.equal(mon.getDate(), 22)
  assert.equal(mon.getHours(), 0)
  assert.equal(mon.getMinutes(), 0)
})

test("buildWeekDays returns 7 days Mon→Sun", () => {
  const days = buildWeekDays(new Date(2026, 5, 24))
  assert.equal(days.length, 7)
  assert.equal(days[0].getDate(), 22) // Monday
  assert.equal(days[6].getDate(), 28) // Sunday
})

test("buildMonthDays length is a multiple of 7 and contains the 1st", () => {
  const days = buildMonthDays(new Date(2026, 5, 15)) // June 2026
  assert.equal(days.length % 7, 0)
  const firsts = days.filter((d) => d.inMonth && d.date.getDate() === 1 && d.date.getMonth() === 5)
  assert.equal(firsts.length, 1)
  // First cell is a Monday (Monday-first grid).
  assert.equal((days[0].date.getDay() + 6) % 7, 0)
})

test("navigateDate steps by the active view", () => {
  const base = new Date(2026, 5, 15)
  assert.equal(navigateDate(base, "month", 1).getMonth(), 6)
  assert.equal(navigateDate(base, "month", -1).getMonth(), 4)
  assert.equal(navigateDate(base, "week", 1).getDate(), 22)
  assert.equal(navigateDate(base, "day", 1).getDate(), 16)
  assert.equal(navigateDate(base, "day", -1).getDate(), 14)
})

test("isoWeek matches known ISO week numbers", () => {
  assert.equal(isoWeek(new Date(2026, 0, 1)), 1) // 2026-01-01 (Thu) → W01
  assert.equal(isoWeek(new Date(2026, 5, 24)), 26) // 2026-06-24 → W26
})

test("headerTitle is view-aware and English", () => {
  assert.equal(headerTitle(new Date(2026, 5, 15), "month"), "June 2026")
  assert.match(headerTitle(new Date(2026, 5, 24), "week"), /Jun 22 — 28, 2026/)
  assert.equal(headerTitle(new Date(2026, 5, 24), "day"), "Wednesday, June 24, 2026")
})
