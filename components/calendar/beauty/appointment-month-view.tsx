"use client"

import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { toIntlLocale } from "@core/i18n/format"
import { isSameDay, weekdayNames } from "../grid"
import type { BeautyAppointment } from "./appointment-model"
import { fmtTime } from "./appointment-card"

const MAX_CHIPS = 2

/**
 * Beauty month overview — a real month summary (busy days + counts + a peek at
 * the first citas), NOT an unreadable list of everything. Each day cell opens
 * that day in the day view; chips open the appointment directly.
 */
export function AppointmentMonthView({
  monthDays,
  today,
  appointments,
  onOpen,
  onSelectDay,
}: {
  monthDays: { date: Date; inMonth: boolean }[]
  today: Date
  appointments: BeautyAppointment[]
  onOpen: (id: string) => void
  onSelectDay: (date: Date) => void
}) {
  const { t, locale } = useI18n()
  const a = t.appointments
  const intlLocale = toIntlLocale(locale)
  const names = weekdayNames(intlLocale, "short")
  const dayAppts = (day: Date) => appointments.filter((appt) => isSameDay(appt.start, day))

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid shrink-0 grid-cols-7 border-b border-border">
        {names.map((n) => (
          <div
            key={n}
            className="px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {n}
          </div>
        ))}
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-[repeat(auto-fit,minmax(0,1fr))]">
        {monthDays.map(({ date, inMonth }, i) => {
          const appts = dayAppts(date)
          const isToday = isSameDay(date, today)
          return (
            <div
              key={`${date.toISOString()}-${i}`}
              className={cn(
                "flex min-h-0 flex-col gap-0.5 border-b border-r border-border p-1",
                !inMonth && "bg-[var(--app-surface-subtle)]",
              )}
            >
              <button
                type="button"
                onClick={() => onSelectDay(date)}
                aria-label={new Intl.DateTimeFormat(intlLocale, { dateStyle: "full" }).format(date)}
                className="flex items-center justify-between rounded px-1 py-0.5 text-left hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span
                  className={cn(
                    "grid h-5 w-5 place-items-center rounded-full text-[11px] tabular-nums",
                    isToday
                      ? "bg-[var(--accent-primary)] font-semibold text-background"
                      : inMonth
                        ? "text-foreground"
                        : "text-muted-foreground/60",
                  )}
                >
                  {date.getDate()}
                </span>
                {appts.length > 0 && (
                  <span className="text-[10px] font-medium text-muted-foreground">{appts.length}</span>
                )}
              </button>
              <div className="flex min-h-0 flex-col gap-0.5 overflow-hidden">
                {appts.slice(0, MAX_CHIPS).map((appt) => (
                  <button
                    key={appt.id}
                    type="button"
                    onClick={() => onOpen(appt.id)}
                    aria-label={a.aria.openAppointment(appt.title)}
                    className={cn(
                      "flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                      appt.conflict && "text-[var(--status-danger-text)]",
                    )}
                    title={appt.title}
                  >
                    <span className="font-mono tabular-nums text-muted-foreground">
                      {fmtTime(appt.start, intlLocale)}
                    </span>
                    <span className="truncate text-foreground">{appt.title}</span>
                  </button>
                ))}
                {appts.length > MAX_CHIPS && (
                  <button
                    type="button"
                    onClick={() => onSelectDay(date)}
                    className="px-1 text-left text-[10px] text-muted-foreground hover:text-foreground"
                  >
                    {t.calendar.monthView.plusMore(appts.length - MAX_CHIPS)}
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
