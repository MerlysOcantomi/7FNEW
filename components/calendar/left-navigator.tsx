"use client"

import { useMemo } from "react"
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CalendarRange,
  History,
  Hourglass,
  Megaphone,
  Repeat,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { formatDateParam } from "./grid"
import { LENSES, lensCounts, lensLabel, type LensKey } from "./lenses"
import { MiniMonth } from "./mini-month"
import { typeColors } from "./tokens"
import type { CalendarItem, CalendarItemType } from "./types"

/** Canonical dot order so a day's colored dots are stable regardless of feed order. */
const TYPE_ORDER: CalendarItemType[] = ["evento", "tarea", "factura", "proyecto"]

/** A glyph per lens — turns the list into a recognisable control system. */
const LENS_ICONS: Record<LensKey, LucideIcon> = {
  "this-day": CalendarCheck,
  "next-days": CalendarRange,
  "planning-horizon": CalendarClock,
  "time-conflicts": AlertTriangle,
  "past-events": History,
  "campaign-cycles": Megaphone,
  "follow-up-moments": Repeat,
  "prep-windows": Hourglass,
}

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

const BACKED_LENSES = LENSES.filter((l) => l.backed)
const DEFERRED_LENSES = LENSES.filter((l) => !l.backed)

/**
 * Left navigator — mini-month picker + time-named lenses, driven entirely by the
 * loaded month feed. Backed lenses are a real control surface: icon + label +
 * live month-scoped count, with a clear active state. Deferred lenses sit under
 * a "Coming soon" divider, disabled with an honest "Not tracked yet" note (no
 * fabricated counts, never selectable).
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
  const { t } = useI18n()
  const cal = t.calendar
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
          {cal.lenses.heading}
        </p>
        <div className="flex flex-col gap-0.5">
          {BACKED_LENSES.map((lens) => {
            const Icon = LENS_ICONS[lens.key]
            const active = activeLens === lens.key
            return (
              <button
                key={lens.key}
                type="button"
                onClick={() => onLensChange(lens.key)}
                aria-pressed={active}
                className={cn(
                  "relative flex items-center gap-2 rounded-md py-1.5 pl-2.5 pr-2 text-left text-[12px] transition-colors",
                  active
                    ? "bg-[var(--accent-soft)] font-medium text-foreground"
                    : "text-foreground/80 hover:bg-[var(--app-surface-hover)] hover:text-foreground",
                )}
              >
                {active && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-[var(--accent-primary)]" />}
                <Icon className={cn("h-3.5 w-3.5 shrink-0", active ? "text-[var(--accent-primary)]" : "text-muted-foreground")} />
                <span className="flex-1 truncate">{lensLabel(lens.key, cal.lenses.labels)}</span>
                <span
                  className={cn(
                    "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium tabular-nums",
                    active ? "bg-[var(--accent-primary)] text-[var(--accent-on-dark)]" : "bg-muted text-muted-foreground",
                  )}
                >
                  {counts[lens.key]}
                </span>
              </button>
            )
          })}
        </div>

        <div className="mb-2 mt-3 flex items-center gap-2 px-1">
          <span className="h-px flex-1 bg-border" />
          <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">{cal.lenses.comingSoon}</span>
          <span className="h-px flex-1 bg-border" />
        </div>

        <div className="flex flex-col gap-0.5">
          {DEFERRED_LENSES.map((lens) => {
            const Icon = LENS_ICONS[lens.key]
            return (
              <div
                key={lens.key}
                aria-disabled="true"
                title={cal.lenses.notTracked}
                className="flex cursor-not-allowed items-center gap-2 rounded-md py-1.5 pl-2.5 pr-2 text-[12px] opacity-60"
              >
                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/60" />
                <span className="flex-1 truncate text-muted-foreground">{lensLabel(lens.key, cal.lenses.labels)}</span>
                <span className="shrink-0 text-[9px] italic text-muted-foreground/70">{cal.lenses.notTracked}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
