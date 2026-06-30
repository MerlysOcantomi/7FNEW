/**
 * 7F Calendar — pure date / grid math (no React, no lucide), so it is safe to
 * unit-test with `tsx --test`. Extracted from the previous single-file page.
 */
import type { CalendarView } from "./types"

export const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]
export const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
export const DAY_NAMES_SHORT = ["M", "T", "W", "T", "F", "S", "S"]
export const DAY_NAMES_FULL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]

/** Default visible window for the Day timeline when no events force it wider. */
export const DAY_WINDOW_START = 7
export const DAY_WINDOW_END = 21

export function formatDateParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** Monday-based start of the week containing `d`. */
export function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day + 6) % 7
  date.setDate(date.getDate() - diff)
  date.setHours(0, 0, 0, 0)
  return date
}

/** ISO-8601 week number (Mon-based). */
export function isoWeek(d: Date): number {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const dayNum = (date.getUTCDay() + 6) % 7
  date.setUTCDate(date.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  return 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
}

/** 6×7 (or 5×7) grid of days covering the month of `currentDate`, Monday-first,
 *  padded with leading/trailing days so the length is a multiple of 7. */
export function buildMonthDays(currentDate: Date): { date: Date; inMonth: boolean }[] {
  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startOffset = (firstDay.getDay() + 6) % 7
  const days: { date: Date; inMonth: boolean }[] = []

  for (let i = startOffset - 1; i >= 0; i--) {
    days.push({ date: new Date(year, month, -i), inMonth: false })
  }
  for (let i = 1; i <= lastDay.getDate(); i++) {
    days.push({ date: new Date(year, month, i), inMonth: true })
  }
  const remaining = (7 - (days.length % 7)) % 7
  for (let i = 1; i <= remaining; i++) {
    days.push({ date: new Date(year, month + 1, i), inMonth: false })
  }
  return days
}

/** Mon–Sun of the week containing `currentDate`. */
export function buildWeekDays(currentDate: Date): Date[] {
  const monday = getMonday(currentDate)
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return d
  })
}

/** Step the focused date forward/back by one unit of the active view. */
export function navigateDate(currentDate: Date, view: CalendarView, dir: number): Date {
  const next = new Date(currentDate)
  if (view === "month") next.setMonth(next.getMonth() + dir)
  else if (view === "week") next.setDate(next.getDate() + 7 * dir)
  else next.setDate(next.getDate() + dir)
  return next
}

export function headerTitle(currentDate: Date, view: CalendarView): string {
  if (view === "month") {
    return `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
  }
  if (view === "week") {
    const mon = getMonday(currentDate)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    const crossMonth = sun.getMonth() !== mon.getMonth()
    const sunPart = crossMonth ? `${MONTH_NAMES[sun.getMonth()].slice(0, 3)} ${sun.getDate()}` : `${sun.getDate()}`
    return `${MONTH_NAMES[mon.getMonth()].slice(0, 3)} ${mon.getDate()} — ${sunPart}, ${sun.getFullYear()}`
  }
  return `${DAY_NAMES_FULL[(currentDate.getDay() + 6) % 7]}, ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getDate()}, ${currentDate.getFullYear()}`
}

export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}
