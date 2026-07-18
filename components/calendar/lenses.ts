/**
 * 7F Calendar — time-named lenses (pure, unit-testable).
 *
 * Lenses are honest filters over the CURRENTLY LOADED CalendarItem[] (the month
 * feed). Five are backed by real data (date predicates + derived time
 * conflicts); three are DEFERRED (no backing data yet) and are never selectable
 * and never show a fabricated count — the UI renders them disabled with an
 * honest "Not tracked yet" note.
 *
 * Scope note: counts/filters reflect the loaded month — Next days / Planning
 * horizon are month-scoped for PR2 (not a global future query). Honest, just
 * scoped.
 */
import type { CalendarMessages } from "@core/i18n/ui"
import { isSameDay } from "./grid"
import type { CalendarItem } from "./types"

export type LensKey =
  | "this-day"
  | "next-days"
  | "planning-horizon"
  | "time-conflicts"
  | "past-events"
  | "campaign-cycles"
  | "follow-up-moments"
  | "prep-windows"

export interface LensDef {
  key: LensKey
  /** Backed by real CalendarItem data today? Deferred lenses are disabled. */
  backed: boolean
}

/** Structure only — visible labels live in the `calendar.lenses` catalog. */
export const LENSES: LensDef[] = [
  { key: "this-day", backed: true },
  { key: "next-days", backed: true },
  { key: "planning-horizon", backed: true },
  { key: "time-conflicts", backed: true },
  { key: "past-events", backed: true },
  { key: "campaign-cycles", backed: false },
  { key: "follow-up-moments", backed: false },
  { key: "prep-windows", backed: false },
]

/** Stable lens keys → camelCase catalog keys (contract convention). */
const LENS_LABEL_KEY: Record<LensKey, keyof CalendarMessages["lenses"]["labels"]> = {
  "this-day": "thisDay",
  "next-days": "nextDays",
  "planning-horizon": "planningHorizon",
  "time-conflicts": "timeConflicts",
  "past-events": "pastEvents",
  "campaign-cycles": "campaignCycles",
  "follow-up-moments": "followUpMoments",
  "prep-windows": "prepWindows",
}

/** Localized label for a lens — pure lookup, callers pass `t.calendar.lenses.labels`. */
export function lensLabel(key: LensKey, labels: CalendarMessages["lenses"]["labels"]): string {
  return labels[LENS_LABEL_KEY[key]]
}

const DAY_MS = 86_400_000
const NEXT_DAYS = 7

function startOfDay(d: Date): number {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x.getTime()
}

function dayStartOf(item: CalendarItem): number {
  return startOfDay(new Date(item.date))
}

function isTimedEvento(item: CalendarItem): boolean {
  return item.type === "evento" && !item.allDay && !Number.isNaN(new Date(item.date).getTime())
}

/** [start, end) in ms for a timed evento; missing end → default 60-min slot. */
function span(item: CalendarItem): [number, number] {
  const s = new Date(item.date).getTime()
  const rawEnd =
    item.endDate && !Number.isNaN(new Date(item.endDate).getTime()) ? new Date(item.endDate).getTime() : s + 60 * 60 * 1000
  return [s, Math.max(rawEnd, s + 1)]
}

/**
 * IDs of timed eventos that overlap at least one OTHER timed evento on the same
 * day. Only real start/end times — never tasks or invoices.
 */
export function conflictingEventoIds(items: CalendarItem[]): Set<string> {
  const byDay = new Map<string, CalendarItem[]>()
  for (const e of items) {
    if (!isTimedEvento(e)) continue
    const d = new Date(e.date)
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
    const arr = byDay.get(key) ?? []
    arr.push(e)
    byDay.set(key, arr)
  }
  const ids = new Set<string>()
  for (const arr of byDay.values()) {
    for (let i = 0; i < arr.length; i++) {
      for (let j = i + 1; j < arr.length; j++) {
        const [s1, e1] = span(arr[i])
        const [s2, e2] = span(arr[j])
        if (s1 < e2 && s2 < e1) {
          ids.add(arr[i].id)
          ids.add(arr[j].id)
        }
      }
    }
  }
  return ids
}

/** Filter the items for a selected lens. Deferred (or unknown) lenses return []
 *  — the UI keeps them non-selectable, so this is defence-in-depth. */
export function applyLens(items: CalendarItem[], lens: LensKey | null, today: Date): CalendarItem[] {
  if (!lens) return items
  const t0 = startOfDay(today)
  switch (lens) {
    case "this-day":
      return items.filter((i) => isSameDay(new Date(i.date), today))
    case "next-days":
      return items.filter((i) => {
        const d0 = dayStartOf(i)
        return d0 > t0 && d0 <= t0 + NEXT_DAYS * DAY_MS
      })
    case "planning-horizon":
      return items.filter((i) => dayStartOf(i) > t0 + NEXT_DAYS * DAY_MS)
    case "time-conflicts": {
      const ids = conflictingEventoIds(items)
      return items.filter((i) => ids.has(i.id))
    }
    case "past-events":
      return items.filter((i) => dayStartOf(i) < t0)
    default:
      return []
  }
}

/** Real counts per lens over the loaded items. Deferred lenses are always 0
 *  (the UI never displays it — it shows the deferred note instead). */
export function lensCounts(items: CalendarItem[], today: Date): Record<LensKey, number> {
  const t0 = startOfDay(today)
  const count = (pred: (i: CalendarItem) => boolean) => items.reduce((n, i) => (pred(i) ? n + 1 : n), 0)
  return {
    "this-day": count((i) => isSameDay(new Date(i.date), today)),
    "next-days": count((i) => {
      const d0 = dayStartOf(i)
      return d0 > t0 && d0 <= t0 + NEXT_DAYS * DAY_MS
    }),
    "planning-horizon": count((i) => dayStartOf(i) > t0 + NEXT_DAYS * DAY_MS),
    "time-conflicts": conflictingEventoIds(items).size,
    "past-events": count((i) => dayStartOf(i) < t0),
    "campaign-cycles": 0,
    "follow-up-moments": 0,
    "prep-windows": 0,
  }
}
