/**
 * 7F Calendar — EventDNA derivations (pure, unit-testable; no React, no lucide).
 *
 * Turns a CalendarItem + "today" (+ a real, caller-supplied conflict signal)
 * into the honest, time-aware read-out the Intelligence Panel shows: what the
 * date MEANS, the timing RISK, and the suggested next ACTION. Every value is
 * derived from fields the feed already provides — no fabricated insights.
 *
 * Localization: each derivation takes the relevant slice of the `calendar`
 * catalog explicitly (components pass `t.calendar.dna.*`); the English
 * catalog is the pure default so tests and pure callers stay canonical.
 */
import type { CalendarMessages } from "@core/i18n/ui"
import { calendar as enCalendar } from "@core/i18n/ui/en/calendar"
import type { CalendarItem } from "./types"

const DAY_MS = 86_400_000

export function startOfDay(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

export interface DateMeaning {
  /** Human relative label: Today / Tomorrow / Yesterday / In 3 days / 2 days ago / In 2 weeks. */
  label: string
  /** Signed whole-day delta from today (past < 0 < future); NaN for a bad date. */
  relativeDays: number
}

export function deriveDateMeaning(
  dateISO: string,
  today: Date,
  m: CalendarMessages["dna"]["meaning"] = enCalendar.dna.meaning,
): DateMeaning {
  const day = startOfDay(new Date(dateISO))
  const t0 = startOfDay(today)
  if (Number.isNaN(day)) return { label: "—", relativeDays: NaN }
  const diff = Math.round((day - t0) / DAY_MS)
  const abs = Math.abs(diff)
  let label: string
  if (diff === 0) label = m.today
  else if (diff === 1) label = m.tomorrow
  else if (diff === -1) label = m.yesterday
  else if (abs < 7) label = diff > 0 ? m.inDays(diff) : m.agoDays(abs)
  else {
    const weeks = Math.round(abs / 7)
    label = diff > 0 ? m.inWeeks(weeks) : m.agoWeeks(weeks)
  }
  return { label, relativeDays: diff }
}

export type TimingRiskLevel = "overdue" | "conflict" | "due-today" | "none"
export type TimingRiskTone = "danger" | "warning" | "info" | "neutral"

export interface TimingRisk {
  level: TimingRiskLevel
  label: string
  tone: TimingRiskTone
  detail?: string
}

/** A past-dated tarea/factura that is still actionable (not done / paid / cancelled). */
export function isActionableOverdue(item: Pick<CalendarItem, "type" | "date" | "status">, today: Date): boolean {
  const day = startOfDay(new Date(item.date))
  const t0 = startOfDay(today)
  if (Number.isNaN(day) || day >= t0) return false
  if (item.type === "tarea") return item.status !== "completada" && item.status !== "cancelada"
  if (item.type === "factura") return item.status !== "pagada" && item.status !== "cancelada"
  return false
}

/**
 * Timing risk, most-urgent first: overdue (real past-due work) → conflict
 * (overlapping timed eventos) → due-today → none. Overdue only ever applies to
 * still-actionable tareas/facturas; conflict only to timed eventos.
 */
export function deriveTimingRisk(
  item: CalendarItem,
  today: Date,
  inConflict = false,
  m: CalendarMessages["dna"]["risks"] = enCalendar.dna.risks,
): TimingRisk {
  if (isActionableOverdue(item, today)) {
    const past = Math.round((startOfDay(today) - startOfDay(new Date(item.date))) / DAY_MS)
    return { level: "overdue", label: m.overdue, tone: "danger", detail: m.daysPastDue(past) }
  }
  if (inConflict) {
    return { level: "conflict", label: m.conflict, tone: "warning", detail: m.overlaps }
  }
  const day = startOfDay(new Date(item.date))
  if (!Number.isNaN(day) && day === startOfDay(today)) {
    return { level: "due-today", label: item.type === "evento" ? m.happeningToday : m.dueToday, tone: "info" }
  }
  return { level: "none", label: m.onTrack, tone: "neutral" }
}

export interface PrimaryCta {
  label: string
  /** Internal route → render as a Link. Absent → wire to onOpenDate (Go to date / View conflict). */
  href?: string
}

/**
 * Date- & module-aware next action (no fake/unavailable actions):
 *   • time conflict            → View conflict (back to the day where the overlap is visible)
 *   • due today                → Open in Today   (today's execution)
 *   • overdue task             → Open in Tasks   (pending/overdue work)
 *   • overdue invoice          → Open in Finance (payment-risk context)
 *   • future / past-inactive   → Go to date      (jump the calendar)
 * "View conflict" and "Go to date" return no href → the panel wires them to onOpenDate.
 */
export function primaryCta(
  item: CalendarItem,
  today: Date,
  inConflict = false,
  m: CalendarMessages["dna"]["cta"] = enCalendar.dna.cta,
): PrimaryCta {
  const day = startOfDay(new Date(item.date))
  const t0 = startOfDay(today)
  if (Number.isNaN(day)) return { label: m.goToDate }
  if (inConflict) return { label: m.viewConflict }
  if (day === t0) return { label: m.openInToday, href: "/today" }
  if (day < t0) {
    if (item.type === "tarea" && item.status !== "completada" && item.status !== "cancelada")
      return { label: m.openInTasks, href: "/tareas" }
    if (item.type === "factura" && item.status !== "pagada" && item.status !== "cancelada")
      return { label: m.openInFinance, href: "/finanzas" }
  }
  return { label: m.goToDate }
}
