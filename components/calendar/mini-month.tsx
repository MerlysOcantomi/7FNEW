"use client"

import { Fragment, useMemo } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { toIntlLocale } from "@core/i18n/format"
import { buildMonthDays, formatDateParam, isSameDay, isoWeek, monthNames, weekdayNames } from "./grid"

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
  const { t, locale } = useI18n()
  const cal = t.calendar
  const intlLocale = toIntlLocale(locale)
  const months = useMemo(() => monthNames(intlLocale, "long"), [intlLocale])
  const dayNamesNarrow = useMemo(() => weekdayNames(intlLocale, "narrow"), [intlLocale])
  const monthTitle = `${months[month.getMonth()]} ${month.getFullYear()}`
  const weeks = toWeeks(buildMonthDays(month))

  return (
    <div className="select-none">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[13px] font-semibold text-foreground">
          {monthTitle.charAt(0).toUpperCase() + monthTitle.slice(1)}
        </p>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onPrevMonth}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={cal.miniMonth.prevMonthAria}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={onNextMonth}
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={cal.miniMonth.nextMonthAria}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-8 gap-y-0.5 text-center">
        <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground/50">{cal.miniMonth.wk}</span>
        {dayNamesNarrow.map((d, i) => (
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
                      ? "bg-foreground font-semibold text-background shadow-sm"
                      : isSelected
                        ? "bg-[var(--accent-soft)] font-semibold text-foreground ring-1 ring-[var(--accent-muted-border)]"
                        : inMonth
                          ? "text-foreground/80 hover:bg-[var(--app-surface-hover)]"
                          : "text-muted-foreground/35 hover:bg-[var(--app-surface-hover)]",
                  )}
                  aria-label={date.toLocaleDateString(intlLocale, { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                  aria-current={isToday ? "date" : undefined}
                >
                  <span className="leading-none">{date.getDate()}</span>
                  {dayDots.length > 0 && (
                    <span className="absolute bottom-[3px] flex items-center gap-[1.5px]">
                      {dayDots.map((color, di) => (
                        <span
                          key={di}
                          className="h-[3.5px] w-[3.5px] rounded-full ring-[0.5px] ring-black/5"
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
