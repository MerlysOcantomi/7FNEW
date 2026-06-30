"use client"

import { useCallback, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, Sparkles } from "lucide-react"
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
import { DayView } from "./day-view"
import { WeekView } from "./week-view"
import { MonthView } from "./month-view"
import { CalendarDetailPanel } from "./detail-panel"
import type { CalendarItem, CalendarView } from "./types"

const WIDE_MEDIA = "(min-width: 1024px)"
const PHONE_MEDIA = "(max-width: 640px)"

const VIEWS: { key: CalendarView; label: string }[] = [
  { key: "day", label: "Day" },
  { key: "week", label: "Week" },
  { key: "month", label: "Month" },
]

/**
 * Contained Calendar shell (PR1) — Day/Week/Month on the real feed, a basic
 * Docked detail panel, a time-first ledger strip and Time risks. Contained to
 * the AppShell viewport: header/strip shrink-0, body flex-1 min-h-0, views own
 * their internal scroll — the page/body never scrolls. Left navigator, lenses,
 * the full 5-mode panel, EventDNA and Schedule/Visual arrive in later PRs.
 */
export function CalendarShell() {
  const isWide = useMediaQuery(WIDE_MEDIA)
  const isPhone = useMediaQuery(PHONE_MEDIA)

  const [view, setView] = useState<CalendarView>("day")
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { items, loading } = useCalendarFeed(view, currentDate)
  const today = useMemo(() => new Date(), [])

  const getItemsForDate = useCallback(
    (d: Date) => items.filter((it) => isSameDay(new Date(it.date), d)),
    [items],
  )
  const monthDays = useMemo(() => buildMonthDays(currentDate), [currentDate])
  const weekDays = useMemo(() => buildWeekDays(currentDate), [currentDate])
  const dayItems = useMemo(() => getItemsForDate(currentDate), [getItemsForDate, currentDate])

  const selected = items.find((it) => it.id === selectedId) ?? null
  const onSelect = useCallback((it: CalendarItem) => setSelectedId((prev) => (prev === it.id ? prev : it.id)), [])
  const clearSelection = useCallback(() => setSelectedId(null), [])
  /** "Open date" CTA — jump the calendar to the item's day (Day view). */
  const openDate = useCallback((iso: string) => {
    const d = new Date(iso)
    if (!Number.isNaN(d.getTime())) {
      setCurrentDate(d)
      setView("day")
    }
  }, [])

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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* ===== HEADER ===== */}
      <header className="shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCurrentDate((d) => navigateDate(d, view, -1))}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label="Previous"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentDate((d) => navigateDate(d, view, 1))}
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
              onClick={() => setCurrentDate(new Date())}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
            >
              Today
            </button>
            <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  onClick={() => setView(v.key)}
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
      </header>

      {/* ===== BODY: view + Docked panel ===== */}
      <div className="mt-4 flex min-h-0 flex-1 gap-4">
        <div className="min-h-0 min-w-0 flex-1">
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

        {isWide && (
          <aside className="hidden min-h-0 w-[340px] shrink-0 lg:block">
            <div className="h-full min-h-0 overflow-hidden rounded-xl border border-border bg-card">
              <CalendarDetailPanel key={selected?.id ?? "none"} item={selected} today={today} onOpenDate={openDate} onClose={clearSelection} />
            </div>
          </aside>
        )}
      </div>

      {/* < lg: detail opens as a Sheet (existing pattern). */}
      <Sheet open={detailSheetOpen} onOpenChange={(open) => { if (!open) clearSelection() }}>
        <SheetContent
          side={isPhone ? "bottom" : "right"}
          className={cn(
            "flex w-full flex-col overflow-hidden border-border bg-card p-0 sm:max-w-md",
            isPhone && "h-[90dvh] max-h-[90dvh] rounded-t-2xl",
          )}
        >
          <SheetTitle className="sr-only">Time detail</SheetTitle>
          {selected && <CalendarDetailPanel key={selected.id} item={selected} today={today} onOpenDate={openDate} onClose={clearSelection} />}
        </SheetContent>
      </Sheet>
    </div>
  )
}
