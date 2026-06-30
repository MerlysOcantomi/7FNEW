"use client"

import { cn } from "@/lib/utils"
import { DAY_WINDOW_END, DAY_WINDOW_START, isSameDay, minutesSinceMidnight } from "./grid"
import { statusLabel } from "./labels"
import { typeColors, typeIcons } from "./tokens"
import type { CalendarItem } from "./types"

const HOUR_PX = 52

/** Day: a vertical hour timeline (TIME structure). Timed eventos are placed by
 *  their start/end; all-day items + deadlines (tareas/facturas/proyectos) sit in
 *  a top row. The visible window widens to fit any events outside 07–21. */
export function DayView({
  date,
  items,
  today,
  selectedId,
  onSelect,
}: {
  date: Date
  items: CalendarItem[]
  today: Date
  selectedId: string | null
  onSelect: (item: CalendarItem) => void
}) {
  const timed = items.filter((it) => it.type === "evento" && !it.allDay && !Number.isNaN(new Date(it.date).getTime()))
  const allDay = items.filter((it) => !(it.type === "evento" && !it.allDay))

  let startH = DAY_WINDOW_START
  let endH = DAY_WINDOW_END
  for (const e of timed) {
    const s = new Date(e.date).getHours()
    const en = e.endDate && !Number.isNaN(new Date(e.endDate).getTime()) ? new Date(e.endDate).getHours() + 1 : s + 1
    startH = Math.min(startH, s)
    endH = Math.max(endH, en)
  }
  startH = Math.max(0, startH)
  endH = Math.min(24, Math.max(endH, startH + 1))
  const span = endH - startH
  const totalMin = span * 60
  const totalPx = span * HOUR_PX
  const hours = Array.from({ length: span }, (_, i) => startH + i)
  const nowRatio = isSameDay(date, today) ? (minutesSinceMidnight(today) - startH * 60) / totalMin : -1

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      {allDay.length > 0 && (
        <div className="shrink-0 border-b border-border p-2">
          <p className="mb-1 px-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">All day · deadlines</p>
          <div className="flex flex-wrap gap-1.5">
            {allDay.map((item) => {
              const Icon = typeIcons[item.type]
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2 py-1 text-left transition-colors hover:border-border",
                    selectedId === item.id ? "border-border" : "border-transparent",
                  )}
                  style={{ backgroundColor: `color-mix(in srgb, ${typeColors[item.type]} 12%, transparent)` }}
                >
                  <Icon className="h-3 w-3 shrink-0" style={{ color: typeColors[item.type] }} />
                  <span className="max-w-[180px] truncate text-[11px] font-medium text-foreground">{item.title}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="relative" style={{ height: totalPx }}>
          {hours.map((h) => (
            <div key={h} className="absolute inset-x-0 border-t border-border/60" style={{ top: (h - startH) * HOUR_PX }}>
              <span className="absolute -top-2 left-1 bg-card px-1 font-mono text-[9px] text-muted-foreground">
                {String(h).padStart(2, "0")}:00
              </span>
            </div>
          ))}

          {nowRatio >= 0 && nowRatio <= 1 && (
            <div className="absolute inset-x-0 z-10 border-t-2 border-[var(--status-danger-text)]" style={{ top: nowRatio * totalPx }}>
              <span className="absolute -top-[5px] left-10 h-2.5 w-2.5 rounded-full bg-[var(--status-danger-text)]" />
            </div>
          )}

          {timed.map((item) => {
            const start = new Date(item.date)
            const startMin = minutesSinceMidnight(start) - startH * 60
            const hasEnd = item.endDate && !Number.isNaN(new Date(item.endDate).getTime())
            const endMin = hasEnd ? minutesSinceMidnight(new Date(item.endDate as string)) - startH * 60 : startMin + 60
            const top = (startMin / totalMin) * totalPx
            const height = Math.max(26, ((endMin - startMin) / totalMin) * totalPx)
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item)}
                className={cn(
                  "absolute left-12 right-2 overflow-hidden rounded-lg border px-2 py-1 text-left transition-colors",
                  selectedId === item.id ? "border-border ring-1 ring-ring" : "border-transparent hover:border-border",
                )}
                style={{ top, height, backgroundColor: `color-mix(in srgb, ${typeColors[item.type]} 16%, var(--card))` }}
              >
                <p className="truncate text-[11px] font-medium text-foreground">{item.title}</p>
                <p className="truncate text-[9px] text-muted-foreground">
                  {start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  {statusLabel(item) ? ` · ${statusLabel(item)}` : ""}
                </p>
              </button>
            )
          })}

          {timed.length === 0 && allDay.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-sm text-muted-foreground/50">No events this day</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
