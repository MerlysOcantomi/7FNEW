"use client"

import { useCallback, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, PanelLeft, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  buildMonthDays,
  buildWeekDays,
  headerTitle,
  isSameDay,
  isoWeek,
  navigateDate,
} from "./grid"
import { useCalendarFeed } from "./use-calendar-feed"
import { CalendarLeftNavigator } from "./left-navigator"
import { LENSES, applyLens, type LensKey } from "./lenses"
import { DayView } from "./day-view"
import { WeekView } from "./week-view"
import { MonthView } from "./month-view"
import { CalendarDetailPanel } from "./detail-panel"
import type { CalendarItem, CalendarView } from "./types"

const WIDE_MEDIA = "(min-width: 1024px)"
const NAV_MEDIA = "(min-width: 1280px)"
const PHONE_MEDIA = "(max-width: 640px)"

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
]

/**
 * Contained Calendar shell — Day/Week/Month on the real feed, a left navigator
 * (mini-month + time-named lenses, PR2), a Docked detail panel, a time-first
 * ledger strip and Time risks. 3-column on desktop: navigator | workspace |
 * detail. Contained to the AppShell viewport — header/strip shrink-0, body
 * flex-1 min-h-0, each column owns its internal scroll; the page never scrolls.
 * The full 5-mode panel, EventDNA and Schedule/Visual arrive in later PRs.
 */
export function CalendarShell() {
  const isWide = useMediaQuery(WIDE_MEDIA)
  const isNav = useMediaQuery(NAV_MEDIA)
  const isPhone = useMediaQuery(PHONE_MEDIA)

  const [view, setView] = useState<CalendarView>("day")
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeLens, setActiveLens] = useState<LensKey | null>(null)
  const [navOpen, setNavOpen] = useState(false)

  const { items, loading } = useCalendarFeed(view, currentDate)
  // The navigator overview always needs the month feed; in Month view the active
  // feed already IS the month, so skip the duplicate request (enabled: false).
  const monthFeed = useCalendarFeed("month", currentDate, view !== "month")
  const monthItems = view === "month" ? items : monthFeed.items
  const today = useMemo(() => new Date(), [])

  // Active lens filters the loaded feed (honest + month-scoped — see lenses.ts).
  const lensedItems = useMemo(() => applyLens(items, activeLens, today), [items, activeLens, today])

  const getItemsForDate = useCallback(
    (d: Date) => lensedItems.filter((it) => isSameDay(new Date(it.date), d)),
    [lensedItems],
  )
  const monthDays = useMemo(() => buildMonthDays(currentDate), [currentDate])
  const weekDays = useMemo(() => buildWeekDays(currentDate), [currentDate])
  const dayItems = useMemo(() => getItemsForDate(currentDate), [getItemsForDate, currentDate])

  // Selection resolves over the UNfiltered feed so an active lens never hides an
  // already-open item from the detail panel.
  const selected = items.find((it) => it.id === selectedId) ?? null
  const onSelect = useCallback((it: CalendarItem) => setSelectedId((prev) => (prev === it.id ? prev : it.id)), [])
  const clearSelection = useCallback(() => setSelectedId(null), [])

  // Any explicit navigation clears the lens — it's a momentary "show me X across
  // this month" filter, so we never strand the user on a stale/empty scope.
  const goPrev = useCallback(() => { setActiveLens(null); setCurrentDate((d) => navigateDate(d, view, -1)) }, [view])
  const goNext = useCallback(() => { setActiveLens(null); setCurrentDate((d) => navigateDate(d, view, 1)) }, [view])
  const goToday = useCallback(() => { setActiveLens(null); setCurrentDate(new Date()) }, [])
  const pickView = useCallback((v: CalendarView) => { setActiveLens(null); setView(v) }, [])

  /** "Go to date" CTA — jump the calendar to the item's day (Day view). */
  const openDate = useCallback((iso: string) => {
    const d = new Date(iso)
    if (!Number.isNaN(d.getTime())) {
      setActiveLens(null)
      setCurrentDate(d)
      setView("day")
    }
  }, [])

  // Mini-month: clicking a day shows that day (Day view); paging ‹ › browses
  // months. The constructor form avoids the setMonth() day-overflow skip
  // (e.g. Jan 31 → "Feb" landing in March) and clamps to the month's last day.
  const selectDay = useCallback((d: Date) => {
    setActiveLens(null)
    setCurrentDate(d)
    setView("day")
    setNavOpen(false)
  }, [])
  const stepMonth = useCallback((delta: number) => {
    setActiveLens(null)
    setCurrentDate((d) => {
      const target = new Date(d.getFullYear(), d.getMonth() + delta, 1)
      const daysInTarget = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate()
      target.setDate(Math.min(d.getDate(), daysInTarget))
      return target
    })
  }, [])
  const prevMonth = useCallback(() => stepMonth(-1), [stepMonth])
  const nextMonth = useCallback(() => stepMonth(1), [stepMonth])

  // Lens click → filter the month canvas (counts are month-scoped, so the result
  // belongs on the month view where it matches the navigator badge 1:1).
  const toggleLens = useCallback((key: LensKey) => {
    const next = activeLens === key ? null : key
    setActiveLens(next)
    if (next) setView("month")
    setNavOpen(false)
  }, [activeLens])

  const scopeLabel = view === "month" ? "This month" : view === "week" ? `Week ${isoWeek(currentDate)}` : "This day"
  // Time risks — real overdue tareas/facturas in the loaded scope (no mocks).
  const overdue = useMemo(() => {
    const now = new Date()
    return items.filter(
      (i) =>
        new Date(i.date) < now &&
        ((i.type === "tarea" && i.status !== "completada" && i.status !== "cancelada") ||
          (i.type === "factura" && i.status !== "pagada" && i.status !== "cancelada")),
    )
  }, [items])

  const detailSheetOpen = Boolean(selected && !isWide)
  const activeLensDef = activeLens ? LENSES.find((l) => l.key === activeLens) ?? null : null

  // Single navigator element reused by the persistent column and the Sheet.
  const navigatorEl = (
    <CalendarLeftNavigator
      currentDate={currentDate}
      today={today}
      selectedDate={currentDate}
      monthItems={monthItems}
      activeLens={activeLens}
      onLensChange={toggleLens}
      onSelectDay={selectDay}
      onPrevMonth={prevMonth}
      onNextMonth={nextMonth}
    />
  )

  return (
    <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:gap-4">
      {/* ===== LEFT NAVIGATOR — persistent full-height column (xl+); Sheet below ===== */}
      <aside className="hidden min-h-0 shrink-0 overflow-hidden rounded-xl border border-border bg-card xl:flex xl:w-[240px]">
        {navigatorEl}
      </aside>

      {/* ===== MAIN WORKSPACE — header + view live here ONLY; never spans the panels ===== */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {/* ===== HEADER ===== */}
      <header className="shrink-0">
        <p className="mb-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-primary)]">
          Calendar
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground xl:hidden"
              aria-label="Open navigator"
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goPrev}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Next"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <h1 className="ml-1 text-xl font-semibold tracking-tight text-foreground">{headerTitle(currentDate, view)}</h1>
            {loading && <Loader2 className="ml-1 h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToday}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              Today
            </button>
            <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => pickView(v.key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    view === v.key ? "bg-[var(--app-surface-active)] text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Time ledger — real feed counts, not a to-do briefing. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-border bg-card px-3 py-2 text-xs">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
          <span className="font-medium text-foreground">{scopeLabel}</span>
          <span className="text-muted-foreground">· {items.length} scheduled</span>
          {overdue.length > 0 && (
            <span className="text-destructive">· {overdue.length} time risk{overdue.length > 1 ? "s" : ""}</span>
          )}
        </div>

        {/* Active lens — honest, shows the count actually rendered; X to clear. */}
        {activeLensDef && (
          <div className="mt-2 flex items-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-2.5 py-1 text-[11px] font-medium text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)]" />
              {activeLensDef.label}
              <span className="text-muted-foreground">· {lensedItems.length} shown</span>
              <button
                type="button"
                onClick={() => setActiveLens(null)}
                className="ml-0.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label="Clear lens"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          </div>
        )}
      </header>

      {/* ===== BODY: the active view (owns its internal scroll) ===== */}
      <div className="mt-4 flex min-h-0 min-w-0 flex-1 flex-col">
        {view === "day" && (
          <DayView date={currentDate} items={dayItems} today={today} selectedId={selectedId} onSelect={onSelect} />
        )}
        {view === "week" && (
          <WeekView weekDays={weekDays} getItemsForDate={getItemsForDate} today={today} selectedId={selectedId} onSelect={onSelect} />
        )}
        {view === "month" && (
          <MonthView monthDays={monthDays} getItemsForDate={getItemsForDate} today={today} selectedId={selectedId} onSelect={onSelect} />
        )}
      </div>
      </div>

      {/* ===== RIGHT PANEL — full-height column beside the workspace (lg+) ===== */}
      {isWide && (
        <aside className="hidden min-h-0 w-[340px] shrink-0 lg:block">
          <div className="h-full min-h-0 overflow-hidden rounded-xl border border-border bg-card">
            <CalendarDetailPanel key={selected?.id ?? "none"} item={selected} today={today} onOpenDate={openDate} onClose={clearSelection} />
          </div>
        </aside>
      )}

      {/* < xl: navigator opens as a left Sheet. */}
      <Sheet open={navOpen && !isNav} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-[280px] max-w-[85vw] border-border bg-card p-0">
          <SheetTitle className="sr-only">Calendar navigator</SheetTitle>
          {navigatorEl}
        </SheetContent>
      </Sheet>

      {/* < lg: detail opens as a Sheet (existing pattern). */}
      <Sheet open={detailSheetOpen} onOpenChange={(open) => { if (!open) clearSelection() }}>
        <SheetContent
          side={isPhone ? "bottom" : "right"}
          className={cn(
            "flex w-full flex-col overflow-hidden border-border bg-card p-0 sm:max-w-md",
            isPhone && "h-[90dvh] max-h-[90dvh] rounded-t-2xl",
          )}
        >
          <SheetTitle className="sr-only">Details</SheetTitle>
          {selected && <CalendarDetailPanel key={selected.id} item={selected} today={today} onOpenDate={openDate} onClose={clearSelection} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}
