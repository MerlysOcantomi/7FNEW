"use client"

import Link from "next/link"
import { CalendarClock, CalendarRange, CheckSquare } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { toIntlLocale } from "@core/i18n/format"
import { DAY_WINDOW_END, DAY_WINDOW_START, isSameDay, minutesSinceMidnight } from "./grid"
import { statusLabel } from "./labels"
import { typeColors, typeIcons } from "./tokens"
import type { CalendarItem } from "./types"

const HOUR_PX = 52
const GUTTER_PX = 48
/** Off-hours boundaries — hours outside [BIZ_START, BIZ_END) get a faint tint. */
const BIZ_START = 8
const BIZ_END = 18

function fmtTime(d: Date, intlLocale: string): string {
  return d.toLocaleTimeString(intlLocale, { hour: "2-digit", minute: "2-digit" })
}

/** Day: a vertical hour timeline (TIME structure). Timed eventos are placed by
 *  their start/end; all-day items + deadlines (tareas/facturas/proyectos) sit in
 *  a top row. The visible window widens to fit any events outside 07–21. A left
 *  time-gutter, faint off-hours tint and per-event accent rail add depth without
 *  touching the placement math. */
export function DayView({
  date,
  items,
  today,
  selectedId,
  onSelect,
  onViewWeek,
}: {
  date: Date
  items: CalendarItem[]
  today: Date
  selectedId: string | null
  onSelect: (item: CalendarItem) => void
  onViewWeek: () => void
}) {
  const { t, locale } = useI18n()
  const cal = t.calendar
  const intlLocale = toIntlLocale(locale)
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

  const isEmpty = timed.length === 0 && allDay.length === 0
  const offTop = Math.min(BIZ_START, endH)
  const offBottom = Math.max(BIZ_END, startH)

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      {allDay.length > 0 && (
        <div className="shrink-0 border-b border-border p-2">
          <p className="mb-1 px-1 text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{cal.dayView.allDayDeadlines}</p>
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
        {isEmpty ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)] ring-1 ring-[var(--accent-muted-border)]">
              <CalendarClock className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm font-semibold text-foreground">{cal.dayView.emptyTitle}</p>
              <p className="mx-auto mt-1 max-w-[280px] text-[12px] leading-relaxed text-muted-foreground">
                {cal.dayView.emptyBody}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={onViewWeek}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <CalendarRange className="h-3.5 w-3.5" /> {cal.dayView.viewWeek}
              </button>
              <Link
                href="/tareas"
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
              >
                <CheckSquare className="h-3.5 w-3.5" /> {cal.dayView.openTasks}
              </Link>
            </div>
          </div>
        ) : (
          <div className="relative" style={{ height: totalPx }}>
            {/* Off-hours tint — depth cue for early-morning / evening blocks. */}
            {startH < BIZ_START && (
              <div
                className="absolute inset-x-0 bg-[var(--app-surface-subtle)]"
                style={{ top: 0, height: (offTop - startH) * HOUR_PX }}
                aria-hidden
              />
            )}
            {endH > BIZ_END && (
              <div
                className="absolute inset-x-0 bg-[var(--app-surface-subtle)]"
                style={{ top: (offBottom - startH) * HOUR_PX, height: (endH - offBottom) * HOUR_PX }}
                aria-hidden
              />
            )}

            {hours.map((h) => (
              <div key={h} className="absolute inset-x-0" style={{ top: (h - startH) * HOUR_PX }}>
                <div className="absolute right-0 border-t border-border/60" style={{ left: GUTTER_PX }} />
                <span className="absolute -top-[7px] left-0 w-[42px] pr-2 text-right font-mono text-[9px] text-muted-foreground">
                  {String(h).padStart(2, "0")}:00
                </span>
              </div>
            ))}

            {nowRatio >= 0 && nowRatio <= 1 && (
              <div
                className="absolute right-0 z-10 border-t-2 border-[var(--status-danger-text)]"
                style={{ top: nowRatio * totalPx, left: GUTTER_PX }}
              >
                <span className="absolute -left-[4px] -top-[5px] h-2.5 w-2.5 rounded-full bg-[var(--status-danger-text)]" />
              </div>
            )}

            {timed.map((item) => {
              const start = new Date(item.date)
              const startMin = minutesSinceMidnight(start) - startH * 60
              const hasEnd = item.endDate && !Number.isNaN(new Date(item.endDate).getTime())
              const end = hasEnd ? new Date(item.endDate as string) : null
              const endMin = end ? minutesSinceMidnight(end) - startH * 60 : startMin + 60
              const top = (startMin / totalMin) * totalPx
              const height = Math.max(26, ((endMin - startMin) / totalMin) * totalPx)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item)}
                  className={cn(
                    "absolute right-2 overflow-hidden rounded-lg border py-1 pl-3 pr-2 text-left transition-colors",
                    selectedId === item.id ? "border-border ring-1 ring-ring" : "border-transparent hover:border-border",
                  )}
                  style={{ top, height, left: GUTTER_PX + 4, backgroundColor: `color-mix(in srgb, ${typeColors[item.type]} 16%, var(--card))` }}
                >
                  <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: typeColors[item.type] }} aria-hidden />
                  <p className="truncate text-[11px] font-medium text-foreground">{item.title}</p>
                  <p className="truncate text-[9px] text-muted-foreground">
                    {fmtTime(start, intlLocale)}
                    {end ? ` – ${fmtTime(end, intlLocale)}` : ""}
                    {statusLabel(item, cal, t.statuses) ? ` · ${statusLabel(item, cal, t.statuses)}` : ""}
                  </p>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
