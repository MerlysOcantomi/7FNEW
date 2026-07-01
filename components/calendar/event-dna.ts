/**
 * 7F Calendar — EventDNA derivations (pure, unit-testable; no React, no lucide).
 *
 * Turns a CalendarItem + "today" (+ a real, caller-supplied conflict signal)
 * into the honest, time-aware read-out the Intelligence Panel shows: what the
 * date MEANS, the timing RISK, and the suggested next ACTION. Every value is
 * derived from fields the feed already provides — no fabricated insights.
 */
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

export function deriveDateMeaning(dateISO: string, today: Date): DateMeaning {
  const day = startOfDay(new Date(dateISO))
  const t0 = startOfDay(today)
  if (Number.isNaN(day)) return { label: "—", relativeDays: NaN }
  const diff = Math.round((day - t0) / DAY_MS)
  const abs = Math.abs(diff)
  let label: string
  if (diff === 0) label = "Today"
  else if (diff === 1) label = "Tomorrow"
  else if (diff === -1) label = "Yesterday"
  else if (abs < 7) label = diff > 0 ? `In ${diff} days` : `${abs} days ago`
  else {
    const weeks = Math.round(abs / 7)
    const unit = weeks === 1 ? "week" : "weeks"
    label = diff > 0 ? `In ${weeks} ${unit}` : `${weeks} ${unit} ago`
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
export function deriveTimingRisk(item: CalendarItem, today: Date, inConflict = false): TimingRisk {
  if (isActionableOverdue(item, today)) {
    const past = Math.round((startOfDay(today) - startOfDay(new Date(item.date))) / DAY_MS)
    return { level: "overdue", label: "Overdue", tone: "danger", detail: past === 1 ? "1 day past due" : `${past} days past due` }
  }
  if (inConflict) {
    return { level: "conflict", label: "Time conflict", tone: "warning", detail: "Overlaps another event" }
  }
  const day = startOfDay(new Date(item.date))
  if (!Number.isNaN(day) && day === startOfDay(today)) {
    return { level: "due-today", label: item.type === "evento" ? "Happening today" : "Due today", tone: "info" }
  }
  return { level: "none", label: "On track", tone: "neutral" }
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
export function primaryCta(item: CalendarItem, today: Date, inConflict = false): PrimaryCta {
  const day = startOfDay(new Date(item.date))
  const t0 = startOfDay(today)
  if (Number.isNaN(day)) return { label: "Go to date" }
  if (inConflict) return { label: "View conflict" }
  if (day === t0) return { label: "Open in Today", href: "/today" }
  if (day < t0) {
    if (item.type === "tarea" && item.status !== "completada" && item.status !== "cancelada")
      return { label: "Open in Tasks", href: "/tareas" }
    if (item.type === "factura" && item.status !== "pagada" && item.status !== "cancelada")
      return { label: "Open in Finance", href: "/finanzas" }
  }
  return { label: "Go to date" }
}
