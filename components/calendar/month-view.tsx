"use client"

import { cn } from "@/lib/utils"
import { DAY_NAMES, DAY_NAMES_SHORT, isSameDay } from "./grid"
import { priorityDot, typeColors } from "./tokens"
import type { CalendarItem } from "./types"

/** Month grid: 6×7 (or 5×7) cells that SHARE height (grid-rows 1fr) — spacious,
 *  no fixed small min-heights. Cells preview up to 3 chips, then "+N more". */
export function MonthView({
  monthDays,
  getItemsForDate,
  today,
  selectedId,
  onSelect,
}: {
  monthDays: { date: Date; inMonth: boolean }[]
  getItemsForDate: (d: Date) => CalendarItem[]
  today: Date
  selectedId: string | null
  onSelect: (item: CalendarItem) => void
}) {
  const weeks = Math.max(1, monthDays.length / 7)
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border">
        {DAY_NAMES.map((d, i) => (
          <div key={i} className="px-2 py-2.5 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            <span className="hidden sm:inline">{d}</span>
            <span className="sm:hidden">{DAY_NAMES_SHORT[i]}</span>
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7" style={{ gridTemplateRows: `repeat(${weeks}, minmax(0, 1fr))` }}>
        {monthDays.map(({ date, inMonth }, idx) => {
          const dayItems = getItemsForDate(date)
          const isToday = isSameDay(date, today)
          return (
            <div
              key={idx}
              className={cn(
                "min-h-0 overflow-hidden border-b border-r border-border p-1.5",
                !inMonth && "bg-muted/20",
                idx % 7 === 6 && "border-r-0",
                idx >= monthDays.length - 7 && "border-b-0",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span
                  className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday ? "bg-foreground text-background" : inMonth ? "text-foreground" : "text-muted-foreground/50",
                  )}
                >
                  {date.getDate()}
                </span>
              </div>
              <div className="flex flex-col gap-0.5">
                {dayItems.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelect(item)}
                    className={cn(
                      "flex items-center gap-1 rounded px-1 py-0.5 text-left transition-colors hover:bg-accent/50",
                      selectedId === item.id && "bg-accent/60",
                    )}
                  >
                    {item.priority && (
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", priorityDot[item.priority] ?? "bg-[var(--status-neutral-text)]")} />
                    )}
                    <span className="truncate text-[10px] leading-tight" style={{ color: typeColors[item.type] }}>
                      {item.title}
                    </span>
                  </button>
                ))}
                {dayItems.length > 3 && (
                  <span className="px-1 text-[9px] text-muted-foreground">+{dayItems.length - 3} more</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
