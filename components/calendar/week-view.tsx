"use client"

import { cn } from "@/lib/utils"
import { DAY_NAMES, isSameDay } from "./grid"
import { typeColors, typeIcons } from "./tokens"
import type { CalendarItem } from "./types"

function timeLabel(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
}

/** Week: 7 spacious fill-height columns. All-day/deadline chips first, then
 *  timed eventos as time-stamped cards (sorted by start). Scrolls-x on narrow. */
export function WeekView({
  weekDays,
  getItemsForDate,
  today,
  selectedId,
  onSelect,
}: {
  weekDays: Date[]
  getItemsForDate: (d: Date) => CalendarItem[]
  today: Date
  selectedId: string | null
  onSelect: (item: CalendarItem) => void
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="min-h-0 flex-1 overflow-x-auto">
        <div className="grid h-full min-w-[700px] grid-cols-7">
          {weekDays.map((d, i) => {
            const dayItems = getItemsForDate(d)
            const timed = dayItems
              .filter((it) => it.type === "evento" && !it.allDay && !Number.isNaN(new Date(it.date).getTime()))
              .sort((a, b) => +new Date(a.date) - +new Date(b.date))
            const allDay = dayItems.filter((it) => !(it.type === "evento" && !it.allDay))
            const isToday = isSameDay(d, today)
            return (
              <div
                key={i}
                className={cn(
                  "flex min-h-0 flex-col border-r border-border last:border-r-0",
                  isToday && "bg-[var(--accent-primary)]/[0.06]",
                )}
              >
                <div className={cn("shrink-0 border-b border-border px-3 py-2.5 text-center")}>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{DAY_NAMES[i]}</p>
                  <p className={cn("mt-0.5 text-lg font-semibold", isToday ? "text-[var(--accent-primary)]" : "text-foreground/70")}>
                    {d.getDate()}
                  </p>
                </div>
                <div className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto p-2">
                  {allDay.map((item) => {
                    const Icon = typeIcons[item.type]
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelect(item)}
                        className={cn(
                          "flex items-start gap-1.5 rounded-lg border p-2 text-left transition-colors hover:border-border hover:bg-accent/50",
                          selectedId === item.id ? "border-border bg-accent/60" : "border-transparent",
                        )}
                        style={selectedId === item.id ? undefined : { backgroundColor: `color-mix(in srgb, ${typeColors[item.type]} 10%, transparent)` }}
                      >
                        <Icon className="mt-0.5 h-3 w-3 shrink-0" style={{ color: typeColors[item.type] }} />
                        <div className="min-w-0">
                          <p className="truncate text-[11px] font-medium text-foreground">{item.title}</p>
                          <p className="text-[9px] text-muted-foreground">{item.status}</p>
                        </div>
                      </button>
                    )
                  })}
                  {timed.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelect(item)}
                      className={cn(
                        "flex items-start gap-1.5 rounded-lg border p-2 text-left transition-colors hover:border-border hover:bg-accent/50",
                        selectedId === item.id ? "border-border bg-accent/60" : "border-transparent",
                      )}
                      style={selectedId === item.id ? undefined : { backgroundColor: `color-mix(in srgb, ${typeColors[item.type]} 10%, transparent)` }}
                    >
                      <span className="mt-0.5 shrink-0 font-mono text-[9px] text-muted-foreground">{timeLabel(item.date)}</span>
                      <p className="min-w-0 truncate text-[11px] font-medium text-foreground">{item.title}</p>
                    </button>
                  ))}
                  {dayItems.length === 0 && <p className="mt-4 text-center text-[10px] text-muted-foreground/40">Open</p>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
