"use client"

import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { toIntlLocale } from "@core/i18n/format"
import { isSameDay } from "../grid"
import type { BeautyAppointment } from "./appointment-model"
import { AppointmentCard } from "./appointment-card"

/**
 * Beauty week view — seven day columns for load comparison: each column shows
 * its citas (start-sorted) and a count so gaps and busy days read at a glance.
 * Today's column is highlighted. Columns keep a min width and scroll
 * horizontally on narrow screens (the day view stays the mobile-first surface).
 */
export function AppointmentWeekView({
  days,
  today,
  appointments,
  onOpen,
}: {
  days: Date[]
  today: Date
  appointments: BeautyAppointment[]
  onOpen: (id: string) => void
}) {
  const { locale } = useI18n()
  const intlLocale = toIntlLocale(locale)
  const weekdayFmt = new Intl.DateTimeFormat(intlLocale, { weekday: "short" })

  const byDay = (day: Date) => appointments.filter((appt) => isSameDay(appt.start, day))

  return (
    <div className="h-full min-h-0 overflow-auto rounded-xl border border-border bg-card">
      <div className="grid h-full min-w-[720px] grid-cols-7">
        {days.map((day, i) => {
          const dayAppts = byDay(day)
          const isToday = isSameDay(day, today)
          return (
            <div
              key={day.toISOString()}
              className={cn(
                "flex min-h-0 flex-col border-border",
                i < 6 && "border-r",
                isToday && "bg-[var(--accent-soft)]/40",
              )}
            >
              <div className="sticky top-0 z-10 flex items-baseline justify-between gap-1 border-b border-border bg-card/95 px-2 py-1.5 backdrop-blur">
                <span className="flex items-baseline gap-1">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {weekdayFmt.format(day)}
                  </span>
                  <span
                    className={cn(
                      "text-[13px] font-semibold tabular-nums",
                      isToday ? "text-[var(--accent-primary)]" : "text-foreground",
                    )}
                  >
                    {day.getDate()}
                  </span>
                </span>
                {dayAppts.length > 0 && (
                  <span className="rounded-full bg-accent px-1.5 text-[10px] font-medium text-muted-foreground">
                    {dayAppts.length}
                  </span>
                )}
              </div>
              <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-1.5">
                {dayAppts.length === 0 ? (
                  <span className="mt-2 text-center text-[10px] text-muted-foreground/70">·</span>
                ) : (
                  dayAppts.map((appt) => (
                    <AppointmentCard key={appt.id} appointment={appt} onOpen={onOpen} dense />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
