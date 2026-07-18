/**
 * 7F Calendar — pure date / grid math (no React, no lucide), so it is safe to
 * unit-test with `tsx --test`. Extracted from the previous single-file page.
 *
 * Month/weekday names are Intl-derived for an explicit `intlLocale` (callers
 * pass `toIntlLocale(locale)` from @core/i18n/format); the default is plain
 * "en" so pure callers/tests keep the canonical English output.
 */
import type { CalendarView } from "./types"

const DAY_MS = 86_400_000
/** 2024-01-01 is a Monday — reference anchor for Monday-first weekday names. */
const REF_MONDAY_UTC = Date.UTC(2024, 0, 1)

/** Monday-first weekday names for an Intl locale (short "Mon", narrow "M", long "Monday"). */
export function weekdayNames(
  intlLocale = "en",
  style: "long" | "short" | "narrow" = "short",
): string[] {
  const fmt = new Intl.DateTimeFormat(intlLocale, { weekday: style, timeZone: "UTC" })
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(REF_MONDAY_UTC + i * DAY_MS)))
}

/** January-first month names for an Intl locale. */
export function monthNames(intlLocale = "en", style: "long" | "short" = "long"): string[] {
  const fmt = new Intl.DateTimeFormat(intlLocale, { month: style, timeZone: "UTC" })
  return Array.from({ length: 12 }, (_, i) => fmt.format(new Date(Date.UTC(2024, i, 1))))
}

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

/** Capitalize the first character — locales like Spanish keep month/weekday
 *  names lowercase, but the calendar header is a title. No-op for English. */
function capitalize(value: string): string {
  return value ? value.charAt(0).toUpperCase() + value.slice(1) : value
}

/** View-aware header title, rendered with Intl names for `intlLocale`
 *  (default "en" keeps the canonical English output for pure callers/tests). */
export function headerTitle(currentDate: Date, view: CalendarView, intlLocale = "en"): string {
  if (view === "month") {
    return capitalize(
      new Intl.DateTimeFormat(intlLocale, { month: "long", year: "numeric" }).format(currentDate),
    )
  }
  if (view === "week") {
    const shortMonth = new Intl.DateTimeFormat(intlLocale, { month: "short" })
    const mon = getMonday(currentDate)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    const crossMonth = sun.getMonth() !== mon.getMonth()
    const sunPart = crossMonth ? `${shortMonth.format(sun)} ${sun.getDate()}` : `${sun.getDate()}`
    return capitalize(`${shortMonth.format(mon)} ${mon.getDate()} — ${sunPart}, ${sun.getFullYear()}`)
  }
  return capitalize(
    new Intl.DateTimeFormat(intlLocale, {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }).format(currentDate),
  )
}

export function minutesSinceMidnight(d: Date): number {
  return d.getHours() * 60 + d.getMinutes()
}
