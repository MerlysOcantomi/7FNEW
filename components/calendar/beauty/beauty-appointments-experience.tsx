"use client"

import { useMemo, useState } from "react"
import { CalendarDays, ChevronLeft, ChevronRight, Plus, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"
import { useI18n } from "@/components/i18n-provider"
import { toIntlLocale } from "@core/i18n/format"
import { Skeleton } from "@/components/ui/skeleton"
import { buildMonthDays, buildWeekDays, headerTitle, navigateDate } from "../grid"
import type { CalendarView } from "../types"
import { useBeautyAgenda } from "./use-beauty-agenda"
import { useAppointmentResources } from "./use-appointment-resources"
import type { BeautyAppointment } from "./appointment-model"
import { AppointmentDayView } from "./appointment-day-view"
import { AppointmentWeekView } from "./appointment-week-view"
import { AppointmentMonthView } from "./appointment-month-view"
import { AppointmentDetailSheet } from "./appointment-detail-sheet"
import {
  AppointmentFormDialog,
  type AppointmentFormSeed,
  type FormMode,
} from "./appointment-form-dialog"
import { formatDateParam } from "../grid"

const VIEWS: CalendarView[] = ["day", "week", "month"]

interface FormState {
  mode: FormMode
  seed: AppointmentFormSeed | null
}

/**
 * Finesse Beauty appointment experience — one of the two experiences over the
 * SHARED Calendar Engine (the other being the Core `CalendarShell`). It reads
 * the shared `/api/calendario/feed`, reuses the grid math + conflict detector,
 * and persists through the shared `/api/calendario` endpoints. Day / week /
 * month, create, detail, edit, reschedule and cancel — all on real `Evento`
 * data. No second engine, model, feed or conflict logic.
 */
export function BeautyAppointmentsExperience() {
  const { t, locale } = useI18n()
  const a = t.appointments
  const cal = t.calendar
  const intlLocale = toIntlLocale(locale)

  const [view, setView] = useState<CalendarView>("day")
  const [currentDate, setCurrentDate] = useState<Date>(() => new Date())
  const [refreshKey, setRefreshKey] = useState(0)
  const [selected, setSelected] = useState<BeautyAppointment | null>(null)
  const [form, setForm] = useState<FormState | null>(null)

  const today = new Date()
  const { appointments, loading, error, refetch } = useBeautyAgenda(view, currentDate, refreshKey)
  const resources = useAppointmentResources(form !== null)

  const weekDays = useMemo(() => buildWeekDays(currentDate), [currentDate])
  const monthDays = useMemo(() => buildMonthDays(currentDate), [currentDate])

  function bumpRefresh() {
    setRefreshKey((k) => k + 1)
    refetch()
  }

  function openDetail(id: string) {
    setSelected(appointments.find((appt) => appt.id === id) ?? null)
  }

  function openCreate() {
    setForm({ mode: "create", seed: null })
  }

  const periodLabel = headerTitle(currentDate, view, intlLocale)

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-2">
        <div className="mr-auto flex min-w-0 flex-col">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-foreground">{a.title}</h1>
            {!loading && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                {a.count(appointments.length)}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-muted-foreground">{periodLabel}</p>
        </div>

        {/* Date navigation */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
          <button
            type="button"
            aria-label={a.aria.previousPeriod}
            onClick={() => setCurrentDate((d) => navigateDate(d, view, -1))}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCurrentDate(new Date())}
            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-foreground hover:bg-accent"
          >
            <RotateCcw className="h-3 w-3" aria-hidden />
            {cal.today}
          </button>
          <button
            type="button"
            aria-label={a.aria.nextPeriod}
            onClick={() => setCurrentDate((d) => navigateDate(d, view, 1))}
            className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* View switcher */}
        <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5" aria-label={a.title}>
          {VIEWS.map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                view === v
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground",
              )}
            >
              {cal.views[v]}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[var(--accent-primary)] px-3 text-xs font-semibold text-background transition-opacity hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" /> <span className="hidden sm:inline">{a.new}</span>
        </button>
      </header>

      {/* Body */}
      <div className="min-h-0 flex-1">
        {loading ? (
          <div className="flex h-full flex-col gap-2 rounded-xl border border-border bg-card p-3" aria-busy="true" aria-label={a.states.loading}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : error ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 rounded-xl border border-border bg-card px-6 text-center">
            <CalendarDays className="h-8 w-8 text-muted-foreground" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-foreground">{a.states.errorTitle}</p>
              <p className="mt-1 max-w-[280px] text-xs text-muted-foreground">{a.states.errorBody}</p>
            </div>
            <button
              type="button"
              onClick={() => bumpRefresh()}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
            >
              {a.states.retry}
            </button>
          </div>
        ) : view === "day" ? (
          <AppointmentDayView
            date={currentDate}
            today={today}
            appointments={appointments}
            onOpen={openDetail}
            onCreate={openCreate}
          />
        ) : view === "week" ? (
          <AppointmentWeekView days={weekDays} today={today} appointments={appointments} onOpen={openDetail} />
        ) : (
          <AppointmentMonthView
            monthDays={monthDays}
            today={today}
            appointments={appointments}
            onOpen={openDetail}
            onSelectDay={(date) => {
              setCurrentDate(date)
              setView("day")
            }}
          />
        )}
      </div>

      {/* Detail */}
      <AppointmentDetailSheet
        appointment={selected}
        onClose={() => setSelected(null)}
        onEdit={(seed) => {
          setSelected(null)
          setForm({ mode: "edit", seed })
        }}
        onReschedule={(seed) => {
          setSelected(null)
          setForm({ mode: "reschedule", seed })
        }}
        onCancelled={bumpRefresh}
      />

      {/* Create / edit / reschedule */}
      {form && (
        <AppointmentFormDialog
          open
          mode={form.mode}
          seed={form.seed}
          defaultDate={formatDateParam(currentDate)}
          resources={resources}
          existing={appointments}
          onClose={() => setForm(null)}
          onSaved={bumpRefresh}
        />
      )}
    </div>
  )
}
