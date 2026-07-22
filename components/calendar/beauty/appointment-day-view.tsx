"use client"

import { AlertTriangle, CalendarClock, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { toIntlLocale } from "@core/i18n/format"
import { DAY_WINDOW_END, DAY_WINDOW_START, isSameDay, minutesSinceMidnight } from "../grid"
import type { BeautyAppointment } from "./appointment-model"
import { fmtTime } from "./appointment-card"

const HOUR_PX = 56
const GUTTER_PX = 48
const BIZ_START = 8
const BIZ_END = 20

/**
 * Beauty day agenda — a vertical hour timeline of the day's citas, mirroring the
 * Core calendar's day placement math (`minutesSinceMidnight`, the 07–21 window
 * that widens to fit) and its NOW line, but rendered as appointment blocks.
 * Mobile-first: this is the default view and works as a single scrollable column.
 */
export function AppointmentDayView({
  date,
  today,
  appointments,
  onOpen,
  onCreate,
}: {
  date: Date
  today: Date
  appointments: BeautyAppointment[]
  onOpen: (id: string) => void
  onCreate: () => void
}) {
  const { t, locale } = useI18n()
  const a = t.appointments
  const intlLocale = toIntlLocale(locale)

  let startH = DAY_WINDOW_START
  let endH = DAY_WINDOW_END
  for (const appt of appointments) {
    const s = appt.start.getHours()
    const e = appt.end ? appt.end.getHours() + 1 : s + 1
    startH = Math.min(startH, s)
    endH = Math.max(endH, e)
  }
  startH = Math.max(0, startH)
  endH = Math.min(24, Math.max(endH, startH + 1))
  const span = endH - startH
  const totalMin = span * 60
  const totalPx = span * HOUR_PX
  const hours = Array.from({ length: span }, (_, i) => startH + i)
  const nowRatio = isSameDay(date, today)
    ? (minutesSinceMidnight(today) - startH * 60) / totalMin
    : -1

  if (appointments.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 text-center">
        <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-primary)] ring-1 ring-[var(--accent-muted-border)]">
          <CalendarClock className="h-6 w-6" />
        </span>
        <div>
          <p className="text-sm font-semibold text-foreground">{a.states.emptyDayTitle}</p>
          <p className="mx-auto mt-1 max-w-[280px] text-[12px] leading-relaxed text-muted-foreground">
            {a.states.emptyDayBody}
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-opacity hover:opacity-80"
        >
          <Plus className="h-3.5 w-3.5" /> {a.new}
        </button>
      </div>
    )
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto rounded-xl border border-border bg-card">
      <div className="relative" style={{ height: totalPx }}>
        {startH < BIZ_START && (
          <div
            className="absolute inset-x-0 bg-[var(--app-surface-subtle)]"
            style={{ top: 0, height: (Math.min(BIZ_START, endH) - startH) * HOUR_PX }}
            aria-hidden
          />
        )}
        {endH > BIZ_END && (
          <div
            className="absolute inset-x-0 bg-[var(--app-surface-subtle)]"
            style={{
              top: (Math.max(BIZ_END, startH) - startH) * HOUR_PX,
              height: (endH - Math.max(BIZ_END, startH)) * HOUR_PX,
            }}
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

        {appointments.map((appt) => {
          const startMin = minutesSinceMidnight(appt.start) - startH * 60
          const endMin = appt.end ? minutesSinceMidnight(appt.end) - startH * 60 : startMin + 60
          const top = (startMin / totalMin) * totalPx
          const height = Math.max(30, ((endMin - startMin) / totalMin) * totalPx)
          const accent = appt.conflict ? "var(--status-danger-text)" : "var(--accent-primary)"
          return (
            <button
              key={appt.id}
              type="button"
              onClick={() => onOpen(appt.id)}
              aria-label={a.aria.openAppointment(appt.title)}
              className={cn(
                "absolute right-2 overflow-hidden rounded-lg border py-1 pl-3 pr-2 text-left transition-colors hover:border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                appt.phase === "past" ? "opacity-70" : "opacity-100",
              )}
              style={{
                top,
                height,
                left: GUTTER_PX + 4,
                borderColor: "var(--border)",
                backgroundColor: `color-mix(in srgb, ${accent} 14%, var(--card))`,
              }}
            >
              <span className="absolute inset-y-0 left-0 w-[3px]" style={{ backgroundColor: accent }} aria-hidden />
              <p className="truncate text-[11px] font-semibold text-foreground">{appt.title}</p>
              <p className="truncate text-[9px] text-muted-foreground">
                {fmtTime(appt.start, intlLocale)}
                {appt.end ? ` – ${fmtTime(appt.end, intlLocale)}` : ""}
                {appt.clientName ? ` · ${appt.clientName}` : ""}
              </p>
              {appt.conflict && (
                <span className="absolute right-1 top-1 text-[var(--status-danger-text)]" aria-label={a.conflict}>
                  <AlertTriangle className="h-3 w-3" />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
