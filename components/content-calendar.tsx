"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  ChevronLeft,
  ChevronRight,
  PenTool,
  Image,
  FileText,
  Video,
  Palette,
  Type,
} from "lucide-react"

/* ── Types ── */
export interface ContentItem {
  id: string
  title: string
  client: string
  clientId: string
  project: string
  projectId: string
  status: "idea" | "en-progreso" | "revision" | "aprobado" | "entregado" | "atrasado"
  date: string            // YYYY-MM-DD
  type: "diseno" | "copy" | "documento" | "pieza-creativa" | "video" | "fotografia"
  responsible: string
  priority: "alta" | "media" | "baja"
}

const typeIcons: Record<string, React.ReactNode> = {
  diseno: <Palette className="h-3 w-3" />,
  copy: <Type className="h-3 w-3" />,
  documento: <FileText className="h-3 w-3" />,
  "pieza-creativa": <PenTool className="h-3 w-3" />,
  video: <Video className="h-3 w-3" />,
  fotografia: <Image className="h-3 w-3" />,
}

const statusColors: Record<string, string> = {
  idea: "bg-muted text-muted-foreground",
  "en-progreso": "bg-[var(--tab-info)] text-foreground/70",
  revision: "bg-[var(--tab-tasks)] text-foreground/70",
  aprobado: "bg-[var(--tab-phases)] text-foreground/70",
  entregado: "bg-[var(--tab-docs)] text-foreground/70",
  atrasado: "bg-[var(--tab-review)] text-foreground/70",
}

const statusLabels: Record<string, string> = {
  idea: "Idea",
  "en-progreso": "In Progress",
  revision: "Review",
  aprobado: "Approved",
  entregado: "Delivered",
  atrasado: "Delayed",
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
]

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

/* ── Helpers ── */
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}

function getFirstDayOfWeek(year: number, month: number) {
  const day = new Date(year, month, 1).getDay()
  return day === 0 ? 6 : day - 1 // Monday = 0
}

interface ContentCalendarProps {
  items: ContentItem[]
}

export function ContentCalendar({ items }: ContentCalendarProps) {
  const [viewMode, setViewMode] = useState<"month" | "week">("month")
  const [currentDate, setCurrentDate] = useState(new Date(2026, 1, 19)) // Feb 2026
  const [selectedDay, setSelectedDay] = useState<string | null>(null)

  const year = currentDate.getFullYear()
  const month = currentDate.getMonth()

  const prev = () => {
    if (viewMode === "month") setCurrentDate(new Date(year, month - 1, 1))
    else setCurrentDate(new Date(currentDate.getTime() - 7 * 24 * 60 * 60 * 1000))
  }
  const next = () => {
    if (viewMode === "month") setCurrentDate(new Date(year, month + 1, 1))
    else setCurrentDate(new Date(currentDate.getTime() + 7 * 24 * 60 * 60 * 1000))
  }

  /* ── Month view ── */
  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfWeek(year, month)
  const todayStr = "2026-02-19"

  const itemsByDate = useMemo(() => {
    const map: Record<string, ContentItem[]> = {}
    items.forEach(item => {
      if (!map[item.date]) map[item.date] = []
      map[item.date].push(item)
    })
    return map
  }, [items])

  /* ── Week view helpers ── */
  const weekStart = useMemo(() => {
    const d = new Date(currentDate)
    const day = d.getDay()
    const diff = d.getDate() - (day === 0 ? 6 : day - 1)
    return new Date(d.setDate(diff))
  }, [currentDate])

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart)
      d.setDate(weekStart.getDate() + i)
      return d
    })
  }, [weekStart])

  const fmtDate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`

  const selectedItems = selectedDay ? (itemsByDate[selectedDay] || []) : []

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <button onClick={prev} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Anterior">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <h3 className="text-base font-semibold text-foreground min-w-[160px] text-center">
            {viewMode === "month"
              ? `${MONTH_NAMES[month]} ${year}`
              : `${weekDays[0].getDate()} - ${weekDays[6].getDate()} ${MONTH_NAMES[weekDays[0].getMonth()]} ${year}`}
          </h3>
          <button onClick={next} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" aria-label="Siguiente">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setViewMode("month")}
            className={cn("px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "month" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
          >
            Mes
          </button>
          <button
            onClick={() => setViewMode("week")}
            className={cn("px-3 py-1.5 text-xs font-medium transition-colors", viewMode === "week" ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
          >
            Semana
          </button>
        </div>
      </div>

      {/* Month Grid */}
      {viewMode === "month" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-border">
            {DAY_NAMES.map(d => (
              <div key={d} className="px-2 py-2.5 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          {/* Days */}
          <div className="grid grid-cols-7">
            {/* Empty leading cells */}
            {Array.from({ length: firstDay }, (_, i) => (
              <div key={`empty-${i}`} className="min-h-[88px] border-b border-r border-border bg-muted/20 p-1.5" />
            ))}
            {/* Day cells */}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1
              const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`
              const dayItems = itemsByDate[dateStr] || []
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDay
              const isWeekend = ((firstDay + i) % 7 >= 5)

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  className={cn(
                    "min-h-[88px] border-b border-r border-border p-1.5 text-left transition-colors flex flex-col",
                    isWeekend && "bg-muted/10",
                    isSelected && "bg-[var(--tab-info)]/20 ring-1 ring-inset ring-[var(--tab-info)]",
                    !isSelected && "hover:bg-muted/30"
                  )}
                >
                  <span className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium",
                    isToday ? "bg-foreground text-background" : "text-foreground"
                  )}>
                    {day}
                  </span>
                  <div className="flex flex-col gap-0.5 mt-1 overflow-hidden flex-1">
                    {dayItems.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        className={cn("rounded px-1 py-0.5 text-[10px] leading-tight truncate font-medium", statusColors[item.status])}
                        title={item.title}
                      >
                        <span className="hidden md:inline">{item.title}</span>
                        <span className="md:hidden">{typeIcons[item.type]}</span>
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <span className="text-[10px] text-muted-foreground px-1">+{dayItems.length - 3} mas</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Week view */}
      {viewMode === "week" && (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-7 divide-x divide-border">
            {weekDays.map((d) => {
              const dateStr = fmtDate(d)
              const dayItems = itemsByDate[dateStr] || []
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDay

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDay(isSelected ? null : dateStr)}
                  className={cn(
                    "min-h-[240px] p-2 text-left transition-colors flex flex-col",
                    isSelected && "bg-[var(--tab-info)]/20",
                    !isSelected && "hover:bg-muted/30"
                  )}
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                      {DAY_NAMES[weekDays.indexOf(d)]}
                    </span>
                    <span className={cn(
                      "flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold",
                      isToday ? "bg-foreground text-background" : "text-foreground"
                    )}>
                      {d.getDate()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5 flex-1">
                    {dayItems.map((item) => (
                      <div
                        key={item.id}
                        className={cn("rounded-lg px-2 py-1.5 text-[11px] leading-tight", statusColors[item.status])}
                      >
                        <p className="font-medium truncate">{item.title}</p>
                        <p className="opacity-70 truncate mt-0.5">{item.client}</p>
                      </div>
                    ))}
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Selected day detail */}
      {selectedDay && (
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-semibold text-foreground">
              {new Date(selectedDay + "T12:00:00").toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </h4>
            <span className="text-xs text-muted-foreground">{selectedItems.length} elementos</span>
          </div>
          {selectedItems.length > 0 ? (
            <div className="flex flex-col gap-2">
              {selectedItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-muted-foreground flex-shrink-0">
                    {typeIcons[item.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                      <Link href={`/clientes/${item.clientId}`} className="hover:text-foreground transition-colors">{item.client}</Link>
                      <span>&middot;</span>
                      <Link href={`/proyectos/${item.projectId}`} className="hover:text-foreground transition-colors">{item.project}</Link>
                      <span>&middot;</span>
                      <span>{item.responsible}</span>
                    </div>
                  </div>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-medium flex-shrink-0", statusColors[item.status])}>
                    {statusLabels[item.status]}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">No content for this day</p>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap">
        {Object.entries(statusLabels).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className={cn("h-2.5 w-2.5 rounded-full", statusColors[key].split(" ")[0])} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}
