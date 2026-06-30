"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import { formatDateParam } from "./grid"
import { LENSES, lensCounts, type LensKey } from "./lenses"
import { MiniMonth } from "./mini-month"
import { typeColors } from "./tokens"
import type { CalendarItem, CalendarItemType } from "./types"

/** Canonical dot order so a day's colored dots are stable regardless of feed order. */
const TYPE_ORDER: CalendarItemType[] = ["evento", "tarea", "factura", "proyecto"]

/** dayKey → up to 3 distinct type colors present that day (real feed, no mocks). */
function buildDots(items: CalendarItem[]): Map<string, string[]> {
  const byDay = new Map<string, Set<CalendarItemType>>()
  for (const it of items) {
    const d = new Date(it.date)
    if (Number.isNaN(d.getTime())) continue
    const key = formatDateParam(d)
    const set = byDay.get(key) ?? new Set<CalendarItemType>()
    set.add(it.type)
    byDay.set(key, set)
  }
  const out = new Map<string, string[]>()
  for (const [key, types] of byDay) {
    const ordered = TYPE_ORDER.filter((t) => types.has(t)).slice(0, 3)
    out.set(key, ordered.map((t) => typeColors[t]))
  }
  return out
}

/**
 * Left navigator (PR2) — mini-month picker + time-named lenses, driven entirely
 * by the loaded month feed. Backed lenses show a real, month-scoped count and
 * toggle the active filter; deferred lenses render disabled with an honest
 * "Not tracked yet" note (no fabricated counts, never selectable).
 */
export function CalendarLeftNavigator({
  currentDate,
  today,
  selectedDate,
  monthItems,
  activeLens,
  onLensChange,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
}: {
  currentDate: Date
  today: Date
  selectedDate: Date
  monthItems: CalendarItem[]
  activeLens: LensKey | null
  onLensChange: (key: LensKey) => void
  onSelectDay: (d: Date) => void
  onPrevMonth: () => void
  onNextMonth: () => void
}) {
  const dots = useMemo(() => buildDots(monthItems), [monthItems])
  const counts = useMemo(() => lensCounts(monthItems, today), [monthItems, today])

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto p-4">
      <MiniMonth
        month={currentDate}
        today={today}
        selectedDate={selectedDate}
        dots={dots}
        onPrevMonth={onPrevMonth}
        onNextMonth={onNextMonth}
        onSelectDay={onSelectDay}
      />

      <div className="min-h-0">
        <p className="mb-2 px-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Lenses
        </p>
        <div className="flex flex-col gap-0.5">
          {LENSES.map((lens) =>
            lens.backed ? (
              <button
                key={lens.key}
                type="button"
                onClick={() => onLensChange(lens.key)}
                aria-pressed={activeLens === lens.key}
                className={cn(
                  "flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[12px] transition-colors",
                  activeLens === lens.key
                    ? "bg-[var(--app-surface-active)] font-medium text-foreground"
                    : "text-foreground/80 hover:bg-accent hover:text-foreground",
                )}
              >
                <span className="truncate">{lens.label}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                    activeLens === lens.key ? "bg-background/70 text-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {counts[lens.key]}
                </span>
              </button>
            ) : (
              <div
                key={lens.key}
                aria-disabled="true"
                title="Not tracked yet"
                className="flex cursor-not-allowed items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[12px] opacity-55"
              >
                <span className="truncate text-muted-foreground">{lens.label}</span>
                <span className="shrink-0 text-[9px] italic text-muted-foreground/70">{lens.deferredNote}</span>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  )
}
