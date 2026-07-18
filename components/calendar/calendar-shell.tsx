"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight, Loader2, PanelLeft, PanelRight, Sparkles, X } from "lucide-react"
import { cn } from "@/lib/utils"
import { useMediaQuery } from "@/hooks/use-media-query"
import { useI18n } from "@/components/i18n-provider"
import { toIntlLocale } from "@core/i18n/format"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
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
import { applyLens, conflictingEventoIds, lensLabel, type LensKey } from "./lenses"
import { DayView } from "./day-view"
import { WeekView } from "./week-view"
import { MonthView } from "./month-view"
import { CalendarIntelligencePanel } from "./intelligence-panel"
import { PanelModeSwitcher } from "./panel-mode-switcher"
import { DEFAULT_PANEL_MODE, PANEL_MODE_STORAGE_KEY, isPanelMode, type PanelMode } from "./panel-modes"
import { typeColors } from "./tokens"
import type { CalendarItem, CalendarView } from "./types"

const WIDE_MEDIA = "(min-width: 1024px)"
const NAV_MEDIA = "(min-width: 1280px)"
const PHONE_MEDIA = "(max-width: 640px)"

/** View order only — visible labels come from `t.calendar.views`. */
const VIEW_KEYS: CalendarView[] = ["day", "week", "month"]

/**
 * Contained Calendar shell — Day/Week/Month on the real feed, a left navigator
 * (mini-month + time-named lenses, PR2), a Docked detail panel, a time-first
 * ledger strip and Time risks. 3-column on desktop: navigator | workspace |
 * detail. Contained to the AppShell viewport — header/strip shrink-0, body
 * flex-1 min-h-0, each column owns its internal scroll; the page never scrolls.
 * The full 5-mode panel, EventDNA and Schedule/Visual arrive in later PRs.
 */
export function CalendarShell() {
  const { t, locale } = useI18n()
  const cal = t.calendar
  const intlLocale = toIntlLocale(locale)
  const isWide = useMediaQuery(WIDE_MEDIA)
  const isNav = useMediaQuery(NAV_MEDIA)
  const isPhone = useMediaQuery(PHONE_MEDIA)

  const [view, setView] = useState<CalendarView>("day")
  const [currentDate, setCurrentDate] = useState(() => new Date())
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activeLens, setActiveLens] = useState<LensKey | null>(null)
  const [navOpen, setNavOpen] = useState(false)
  const [panelMode, setPanelMode] = useState<PanelMode>(DEFAULT_PANEL_MODE)

  // Panel mode persists per-browser; read after mount so SSR markup stays stable.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(PANEL_MODE_STORAGE_KEY)
      if (isPanelMode(saved)) setPanelMode(saved)
    } catch {
      /* localStorage unavailable — keep the default */
    }
  }, [])
  const setPanelModePersisted = useCallback((m: PanelMode) => {
    setPanelMode(m)
    try {
      window.localStorage.setItem(PANEL_MODE_STORAGE_KEY, m)
    } catch {
      /* ignore persistence failures */
    }
  }, [])

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
  // Real time-conflict signal for EventDNA — overlapping TIMED eventos only.
  const conflictIds = useMemo(() => conflictingEventoIds(items), [items])
  const selectedInConflict = selected ? conflictIds.has(selected.id) : false
  const onSelect = useCallback((it: CalendarItem) => setSelectedId((prev) => (prev === it.id ? prev : it.id)), [])
  const clearSelection = useCallback(() => setSelectedId(null), [])

  // Any explicit navigation clears the lens — it's a momentary "show me X across
  // this month" filter, so we never strand the user on a stale/empty scope.
  const goPrev = useCallback(() => { setActiveLens(null); setCurrentDate((d) => navigateDate(d, view, -1)) }, [view])
  const goNext = useCallback(() => { setActiveLens(null); setCurrentDate((d) => navigateDate(d, view, 1)) }, [view])
  // "Today" — jump to the REAL current day in Day view, drop any active lens, and
  // drop a selection that isn't on today. (It previously only nudged currentDate
  // within the active view, so from Week/Month — or when already on the current
  // period — it produced no visible change and felt broken.)
  const goToday = useCallback(() => {
    const now = new Date()
    setActiveLens(null)
    setView("day")
    setCurrentDate(now)
    if (selected && !isSameDay(new Date(selected.date), now)) setSelectedId(null)
  }, [selected])
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

  const scopeLabel =
    view === "month" ? cal.ledger.thisMonth : view === "week" ? cal.ledger.weekScope(isoWeek(currentDate)) : cal.ledger.thisDay
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

  const activeLensLabel = activeLens ? lensLabel(activeLens, cal.lenses.labels) : null

  // Time-intelligence framing line under the title + the focused-day label for
  // the panel's open-time guidance (both descriptive/real — no fabricated data).
  const subtitle = cal.subtitles[view]
  const dayLabel = currentDate.toLocaleDateString(intlLocale, { weekday: "short", month: "short", day: "numeric" })
  // You're "on today" only when the Day view is showing the real current day —
  // that's when the Today button has nothing left to do, so it reads as active.
  const isOnToday = view === "day" && isSameDay(currentDate, today)

  // Empty-state signal for the panel (real focused-day count + active lens context).
  const emptyHint = {
    dayCount: dayItems.length,
    dayLabel,
    lens: activeLensLabel ? { label: activeLensLabel, count: lensedItems.length } : null,
  }
  // Panel container by mode: Docked/Compact/Collapsed live in the right column;
  // Overlay floats as a Sheet; Expanded as a centered Dialog; mobile/tablet Sheet.
  const sheetPanelOpen = Boolean(selected) && (!isWide || panelMode === "overlay")
  const dialogPanelOpen = isWide && panelMode === "expanded" && Boolean(selected)

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
        <div className="mb-1.5 flex items-center gap-2">
          <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-primary)]">
            {cal.title}
          </p>
          <span className="inline-flex items-center gap-1 rounded-full border border-[var(--accent-muted-border)] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[9px] font-medium text-[var(--accent-primary)]">
            <Sparkles className="h-2.5 w-2.5" /> {cal.timeIntelligence}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setNavOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground xl:hidden"
              aria-label={cal.nav.openNavigatorAria}
            >
              <PanelLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goPrev}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={cal.nav.previousAria}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={goNext}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              aria-label={cal.nav.nextAria}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="ml-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{headerTitle(currentDate, view, intlLocale)}</h1>
                {loading && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
              </div>
              <p className="text-[11px] text-muted-foreground">{subtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToday}
              aria-pressed={isOnToday}
              className={cn(
                "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
                isOnToday
                  ? "border-[var(--accent-muted-border)] bg-[var(--accent-soft)] text-[var(--accent-primary)]"
                  : "border-border text-foreground hover:bg-accent",
              )}
            >
              {cal.today}
            </button>
            <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
              {VIEW_KEYS.map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => pickView(key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    view === key ? "bg-[var(--app-surface-active)] text-foreground" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {cal.views[key]}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Time ledger — segmented, real feed counts only (no to-do briefing). */}
        <div className="mt-3 flex flex-wrap items-stretch divide-x divide-border overflow-hidden rounded-lg border border-border bg-[var(--app-surface-dark-elevated)] text-xs">
          <div className="flex items-center gap-2 px-3 py-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{cal.ledger.scope}</span>
              <span className="text-[12px] font-semibold text-foreground">{scopeLabel}</span>
            </div>
          </div>
          <div className="flex items-center px-3 py-2">
            <div className="flex flex-col leading-tight">
              <span className="text-[9px] font-medium uppercase tracking-wider text-muted-foreground">{cal.ledger.scheduled}</span>
              <span className="text-[12px] font-semibold tabular-nums text-foreground">{items.length}</span>
            </div>
          </div>
          {overdue.length > 0 && (
            <div className="flex items-center px-3 py-2">
              <div className="flex flex-col leading-tight">
                <span className="text-[9px] font-medium uppercase tracking-wider text-[var(--status-danger-text)]/80">
                  {cal.ledger.timeRisks(overdue.length)}
                </span>
                <span className="text-[12px] font-semibold tabular-nums text-[var(--status-danger-text)]">{overdue.length}</span>
              </div>
            </div>
          )}
        </div>

        {/* Active lens — honest, shows the count actually rendered; X to clear. */}
        {activeLensLabel && (
          <div className="mt-2 flex items-center">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--accent-primary)]/30 bg-[var(--accent-primary)]/10 px-2.5 py-1 text-[11px] font-medium text-foreground">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent-primary)]" />
              {activeLensLabel}
              <span className="text-muted-foreground">· {cal.lenses.shown(lensedItems.length)}</span>
              <button
                type="button"
                onClick={() => setActiveLens(null)}
                className="ml-0.5 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={cal.lenses.clearAria}
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
          <DayView date={currentDate} items={dayItems} today={today} selectedId={selectedId} onSelect={onSelect} onViewWeek={() => pickView("week")} />
        )}
        {view === "week" && (
          <WeekView weekDays={weekDays} getItemsForDate={getItemsForDate} today={today} selectedId={selectedId} onSelect={onSelect} />
        )}
        {view === "month" && (
          <MonthView monthDays={monthDays} getItemsForDate={getItemsForDate} today={today} selectedId={selectedId} onSelect={onSelect} />
        )}
      </div>
      </div>

      {/* ===== RIGHT REGION — Intelligence Panel, mode-aware (lg+) ===== */}
      {isWide && (panelMode === "docked" || panelMode === "compact") && (
        <aside className={cn("hidden min-h-0 shrink-0 lg:block", panelMode === "compact" ? "w-[300px]" : "w-[340px]")}>
          <div className="h-full min-h-0 overflow-hidden rounded-xl border border-border bg-card">
            <CalendarIntelligencePanel
              key={selected?.id ?? "none"}
              item={selected}
              today={today}
              inConflict={selectedInConflict}
              onOpenDate={openDate}
              onClose={selected ? clearSelection : undefined}
              mode={panelMode}
              onModeChange={setPanelModePersisted}
              emptyHint={emptyHint}
            />
          </div>
        </aside>
      )}
      {/* Collapsed / Overlay / Expanded → a thin rail keeps the 3-column grid stable. */}
      {isWide && (panelMode === "collapsed" || panelMode === "overlay" || panelMode === "expanded") && (
        <aside className="hidden min-h-0 w-[52px] shrink-0 lg:flex">
          <div className="flex h-full w-full flex-col items-center gap-3 rounded-xl border border-border bg-card py-3">
            <PanelModeSwitcher value={panelMode} onChange={setPanelModePersisted} />
            {panelMode === "collapsed" && selected && (
              <button
                type="button"
                onClick={() => setPanelModePersisted("docked")}
                aria-label={cal.panel.showDetails}
                title={cal.panel.showDetails}
                className="relative flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <PanelRight className="h-3.5 w-3.5" />
                <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full" style={{ backgroundColor: typeColors[selected.type] }} />
              </button>
            )}
            <span className="mt-auto rotate-180 text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground/50 [writing-mode:vertical-rl]">
              {cal.timeIntelligence}
            </span>
          </div>
        </aside>
      )}

      {/* < xl: navigator opens as a left Sheet. */}
      <Sheet open={navOpen && !isNav} onOpenChange={setNavOpen}>
        <SheetContent side="left" className="w-[280px] max-w-[85vw] border-border bg-card p-0">
          <SheetTitle className="sr-only">{cal.nav.navigatorTitle}</SheetTitle>
          {navigatorEl}
        </SheetContent>
      </Sheet>

      {/* Panel as a Sheet — mobile/tablet always, plus desktop Overlay mode.
          Container owns the close button → closing clears the selection. */}
      <Sheet open={sheetPanelOpen} onOpenChange={(open) => { if (!open) clearSelection() }}>
        <SheetContent
          side={isPhone ? "bottom" : "right"}
          className={cn(
            "flex w-full flex-col overflow-hidden border-border bg-card p-0 sm:max-w-md",
            isPhone && "h-[90dvh] max-h-[90dvh] rounded-t-2xl",
          )}
        >
          <SheetTitle className="sr-only">{cal.timeIntelligence}</SheetTitle>
          {selected && (
            <CalendarIntelligencePanel
              key={selected.id}
              item={selected}
              today={today}
              inConflict={selectedInConflict}
              onOpenDate={openDate}
              mode={panelMode}
              onModeChange={setPanelModePersisted}
              showSwitcher={isWide}
              emptyHint={emptyHint}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Desktop Expanded mode → centered Dialog. */}
      <Dialog open={dialogPanelOpen} onOpenChange={(open) => { if (!open) clearSelection() }}>
        <DialogContent className="flex h-[80vh] max-w-2xl flex-col overflow-hidden p-0">
          <DialogTitle className="sr-only">{cal.timeIntelligence}</DialogTitle>
          {selected && (
            <CalendarIntelligencePanel
              key={selected.id}
              item={selected}
              today={today}
              inConflict={selectedInConflict}
              onOpenDate={openDate}
              mode={panelMode}
              onModeChange={setPanelModePersisted}
              emptyHint={emptyHint}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
