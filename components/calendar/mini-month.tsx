"use client"

import { Fragment } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { DAY_NAMES_SHORT, MONTH_NAMES, buildMonthDays, formatDateParam, isSameDay, isoWeek } from "./grid"

/** Chunk the flat month grid into Monday-first weeks of 7. */
function toWeeks(days: { date: Date; inMonth: boolean }[]): { date: Date; inMonth: boolean }[][] {
  const weeks: { date: Date; inMonth: boolean }[][] = []
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7))
  return weeks
}

/**
 * Compact month picker for the left navigator. Real event-day dots (one per
 * distinct type, max 3) come from the loaded month feed — never fabricated.
 * Clicking a day asks the shell to "show me this day" (Day view).
 */
export function MiniMonth({
  month,
  today,
  selectedDate,
  dots,
  onPrevMonth,
  onNextMonth,
  onSelectDay,
}: {
  month: Date
  today: Date
  selectedDate: Date
  /** dayKey (formatDateParam) → up to 3 distinct type colors present that day. */
  dots: Map<string, string[]>
  onPrevMonth: () => void
  onNextMonth: () => void
  onSelectDay: (d: Date) => void
}) {
  const weeks = toWeeks(buildMonthDays(month))

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-foreground">
          {MONTH_NAMES[month.getMonth()]} {month.getFullYear()}
        </p>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onPrevMonth}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Next month"
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-y-0.5 text-center">
        <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/50">Wk</span>
        {DAY_NAMES_SHORT.map((d, i) => (
          <span key={i} className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/60">
            {d}
          </span>
        ))}

        {weeks.map((week) => (
          <Fragment key={formatDateParam(week[0].date)}>
            <span className="flex h-6 items-center justify-center font-mono text-[9px] text-muted-foreground/40">
              {isoWeek(week[0].date)}
            </span>
            {week.map(({ date, inMonth }) => {
              const isToday = isSameDay(date, today)
              const isSelected = !isToday && isSameDay(date, selectedDate)
              const dayDots = dots.get(formatDateParam(date)) ?? []
              return (
                <button
                  key={formatDateParam(date)}
                  type="button"
                  onClick={() => onSelectDay(date)}
                  className={cn(
                    "relative mx-auto flex h-6 w-6 flex-col items-center justify-center rounded-md text-[11px] transition-colors",
                    isToday
                      ? "bg-foreground font-semibold text-background"
                      : isSelected
                        ? "bg-[var(--app-surface-active)] font-medium text-foreground"
                        : inMonth
                          ? "text-foreground/80 hover:bg-accent"
                          : "text-muted-foreground/35 hover:bg-accent",
                  )}
                  aria-label={date.toDateString()}
                  aria-current={isToday ? "date" : undefined}
                >
                  <span className="leading-none">{date.getDate()}</span>
                  {dayDots.length > 0 && (
                    <span className="absolute bottom-0.5 flex items-center gap-[1px]">
                      {dayDots.map((color, di) => (
                        <span
                          key={di}
                          className="h-[3px] w-[3px] rounded-full"
                          style={{ backgroundColor: isToday ? "var(--background)" : color }}
                        />
                      ))}
                    </span>
                  )}
                </button>
              )
            })}
          </Fragment>
        ))}
      </div>
    </div>
  )
}
