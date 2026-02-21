"use client"

import { useState, useMemo, useCallback } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { cn } from "@/lib/utils"
import { useFetch } from "@/hooks/use-fetch"
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CheckSquare,
  FolderKanban,
  Receipt,
  Clock,
  AlertTriangle,
  Sparkles,
  Loader2,
  X,
} from "lucide-react"

type CalendarView = "month" | "week" | "day"

interface CalendarItem {
  id: string
  type: "tarea" | "proyecto" | "factura" | "evento"
  title: string
  date: string
  status: string
  priority?: string
  extra?: string
}

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]
const DAY_NAMES = ["Lun", "Mar", "Mie", "Jue", "Vie", "Sab", "Dom"]
const DAY_NAMES_FULL = ["Lunes", "Martes", "Miercoles", "Jueves", "Viernes", "Sabado", "Domingo"]

function formatDateParam(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function getMonday(d: Date): Date {
  const date = new Date(d)
  const day = date.getDay()
  const diff = (day + 6) % 7
  date.setDate(date.getDate() - diff)
  return date
}

const typeColors: Record<string, string> = {
  tarea: "var(--tab-tasks)",
  proyecto: "var(--tab-phases)",
  factura: "var(--tab-billing)",
  evento: "var(--tab-info)",
}

const typeIcons: Record<string, typeof CheckSquare> = {
  tarea: CheckSquare,
  proyecto: FolderKanban,
  factura: Receipt,
  evento: CalendarIcon,
}

const priorityDot: Record<string, string> = {
  urgente: "bg-red-500",
  alta: "bg-orange-500",
  media: "bg-yellow-500",
  baja: "bg-green-500",
}

export default function CalendarioPage() {
  const [view, setView] = useState<CalendarView>("month")
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedItem, setSelectedItem] = useState<CalendarItem | null>(null)
  const [aiSuggestion, setAiSuggestion] = useState("")
  const [aiLoading, setAiLoading] = useState(false)

  const dateParam = formatDateParam(currentDate)
  const { data, loading } = useFetch<any>(`/api/calendario/feed?view=${view}&date=${dateParam}`)

  const items = useMemo<CalendarItem[]>(() => {
    if (!data) return []
    const result: CalendarItem[] = []

    if (data.tareas) {
      for (const t of data.tareas) {
        if (t.fechaLimite) {
          result.push({
            id: t.id,
            type: "tarea",
            title: t.titulo,
            date: t.fechaLimite,
            status: t.estado,
            priority: t.prioridad,
            extra: t.proyecto?.nombre,
          })
        }
      }
    }

    if (data.proyectos) {
      for (const p of data.proyectos) {
        result.push({
          id: p.id,
          type: "proyecto",
          title: p.nombre,
          date: p.fechaInicio ?? p.fechaFin ?? p.createdAt,
          status: p.estado,
          extra: p.cliente?.nombre,
        })
      }
    }

    if (data.facturas) {
      for (const f of data.facturas) {
        if (f.fechaVencimiento) {
          result.push({
            id: f.id,
            type: "factura",
            title: `Factura ${f.numero}`,
            date: f.fechaVencimiento,
            status: f.estado,
            extra: f.cliente?.nombre ? `${f.cliente.nombre} · $${f.total}` : `$${f.total}`,
          })
        }
      }
    }

    if (data.eventos) {
      for (const e of data.eventos) {
        result.push({
          id: e.id,
          type: "evento",
          title: e.titulo,
          date: e.fechaInicio,
          status: e.tipo,
          extra: e.proyecto?.nombre,
        })
      }
    }

    return result
  }, [data])

  const getItemsForDate = useCallback(
    (date: Date) => items.filter((item) => isSameDay(new Date(item.date), date)),
    [items]
  )

  // Navigation
  function navigate(direction: number) {
    const next = new Date(currentDate)
    if (view === "month") next.setMonth(next.getMonth() + direction)
    else if (view === "week") next.setDate(next.getDate() + 7 * direction)
    else next.setDate(next.getDate() + direction)
    setCurrentDate(next)
  }

  function goToday() {
    setCurrentDate(new Date())
  }

  // AI suggestion for selected item
  async function getAISuggestion(item: CalendarItem) {
    setAiLoading(true)
    setAiSuggestion("")
    try {
      const prompt =
        item.type === "tarea"
          ? `Analiza esta tarea: "${item.title}" (estado: ${item.status}, prioridad: ${item.priority ?? "N/A"}, fecha: ${new Date(item.date).toLocaleDateString()}). Sugiere acciones inmediatas.`
          : item.type === "factura"
            ? `Analiza esta factura: "${item.title}" (estado: ${item.status}, ${item.extra ?? ""}, vencimiento: ${new Date(item.date).toLocaleDateString()}). Sugiere acciones de cobranza.`
            : `Analiza el estado de "${item.title}" (tipo: ${item.type}, estado: ${item.status}). Sugiere acciones.`

      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, mode: "operativo" }),
      })
      const json = await res.json()
      if (json.success) setAiSuggestion(json.data.result)
    } catch {
      setAiSuggestion("Error al obtener sugerencia de IA.")
    } finally {
      setAiLoading(false)
    }
  }

  // ── Calendar grid data ──
  const monthDays = useMemo(() => {
    const year = currentDate.getFullYear()
    const month = currentDate.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)

    const startOffset = (firstDay.getDay() + 6) % 7
    const days: { date: Date; inMonth: boolean }[] = []

    for (let i = startOffset - 1; i >= 0; i--) {
      const d = new Date(year, month, -i)
      days.push({ date: d, inMonth: false })
    }
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push({ date: new Date(year, month, i), inMonth: true })
    }
    const remaining = 7 - (days.length % 7)
    if (remaining < 7) {
      for (let i = 1; i <= remaining; i++) {
        days.push({ date: new Date(year, month + 1, i), inMonth: false })
      }
    }
    return days
  }, [currentDate])

  const weekDays = useMemo(() => {
    const monday = getMonday(currentDate)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }, [currentDate])

  const today = new Date()

  // Header title
  const headerTitle =
    view === "month"
      ? `${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`
      : view === "week"
        ? (() => {
            const mon = weekDays[0]
            const sun = weekDays[6]
            return `${mon.getDate()} ${MONTH_NAMES[mon.getMonth()].slice(0, 3)} — ${sun.getDate()} ${MONTH_NAMES[sun.getMonth()].slice(0, 3)} ${sun.getFullYear()}`
          })()
        : `${DAY_NAMES_FULL[(currentDate.getDay() + 6) % 7]} ${currentDate.getDate()} de ${MONTH_NAMES[currentDate.getMonth()]} ${currentDate.getFullYear()}`

  return (
    <AppShell currentSection="calendario" breadcrumbs={[{ label: "7F" }, { label: "Calendario" }]}>
      <SectionPage title="Calendario" description="Vista unificada de tareas, proyectos, facturas y eventos.">

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => navigate(1)} className="flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors">
              <ChevronRight className="h-4 w-4" />
            </button>
            <h2 className="text-lg font-semibold text-foreground ml-2">{headerTitle}</h2>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground ml-2" />}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={goToday} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors">
              Hoy
            </button>
            <div className="flex items-center gap-0.5 rounded-lg border border-border p-0.5">
              {(["month", "week", "day"] as CalendarView[]).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    view === v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {v === "month" ? "Mes" : v === "week" ? "Semana" : "Dia"}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          {/* Main calendar area */}
          <div className="flex-1 min-w-0">

            {/* ── Month view ── */}
            {view === "month" && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="grid grid-cols-7 border-b border-border">
                  {DAY_NAMES.map((d) => (
                    <div key={d} className="px-2 py-2.5 text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7">
                  {monthDays.map(({ date, inMonth }, idx) => {
                    const dayItems = getItemsForDate(date)
                    const isToday = isSameDay(date, today)
                    return (
                      <div
                        key={idx}
                        className={cn(
                          "min-h-[90px] border-b border-r border-border p-1.5 transition-colors",
                          !inMonth && "bg-muted/20",
                          idx % 7 === 6 && "border-r-0"
                        )}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className={cn(
                            "text-xs font-medium",
                            isToday ? "flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-background" : inMonth ? "text-foreground" : "text-muted-foreground/50"
                          )}>
                            {date.getDate()}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          {dayItems.slice(0, 3).map((item) => (
                            <button
                              key={item.id}
                              onClick={() => { setSelectedItem(item); setAiSuggestion("") }}
                              className="flex items-center gap-1 rounded px-1 py-0.5 text-left hover:bg-accent/50 transition-colors group"
                            >
                              {item.priority && (
                                <span className={cn("h-1.5 w-1.5 rounded-full flex-shrink-0", priorityDot[item.priority] ?? "bg-gray-400")} />
                              )}
                              <span className="text-[10px] truncate text-foreground leading-tight" style={{ color: typeColors[item.type] }}>
                                {item.title}
                              </span>
                            </button>
                          ))}
                          {dayItems.length > 3 && (
                            <span className="text-[9px] text-muted-foreground px-1">+{dayItems.length - 3} mas</span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Week view ── */}
            {view === "week" && (
              <div className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="grid grid-cols-7 border-b border-border">
                  {weekDays.map((d, i) => (
                    <div key={i} className={cn("px-3 py-3 text-center border-r border-border last:border-r-0", isSameDay(d, today) && "bg-foreground/5")}>
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{DAY_NAMES[i]}</p>
                      <p className={cn(
                        "text-lg font-semibold mt-0.5",
                        isSameDay(d, today) ? "text-foreground" : "text-foreground/70"
                      )}>{d.getDate()}</p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 min-h-[400px]">
                  {weekDays.map((d, i) => {
                    const dayItems = getItemsForDate(d)
                    return (
                      <div key={i} className={cn("p-2 border-r border-border last:border-r-0 flex flex-col gap-1.5", isSameDay(d, today) && "bg-foreground/5")}>
                        {dayItems.map((item) => {
                          const Icon = typeIcons[item.type]
                          return (
                            <button
                              key={item.id}
                              onClick={() => { setSelectedItem(item); setAiSuggestion("") }}
                              className="flex items-start gap-1.5 rounded-lg p-2 text-left hover:bg-accent/50 transition-colors border border-transparent hover:border-border"
                              style={{ backgroundColor: `color-mix(in srgb, ${typeColors[item.type]} 10%, transparent)` }}
                            >
                              <Icon className="h-3 w-3 flex-shrink-0 mt-0.5" style={{ color: typeColors[item.type] }} />
                              <div className="min-w-0">
                                <p className="text-[11px] font-medium text-foreground truncate">{item.title}</p>
                                <p className="text-[9px] text-muted-foreground">{item.status}</p>
                              </div>
                            </button>
                          )
                        })}
                        {dayItems.length === 0 && (
                          <p className="text-[10px] text-muted-foreground/40 text-center mt-4">Sin items</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Day view ── */}
            {view === "day" && (
              <div className="rounded-xl border border-border bg-card p-5">
                {(() => {
                  const dayItems = getItemsForDate(currentDate)
                  if (dayItems.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                        <CalendarIcon className="h-8 w-8 mb-3 opacity-40" />
                        <p className="text-sm">No hay elementos para este dia</p>
                      </div>
                    )
                  }

                  const grouped: Record<string, CalendarItem[]> = {}
                  for (const item of dayItems) {
                    if (!grouped[item.type]) grouped[item.type] = []
                    grouped[item.type].push(item)
                  }

                  return (
                    <div className="flex flex-col gap-4">
                      {Object.entries(grouped).map(([type, typeItems]) => {
                        const Icon = typeIcons[type]
                        return (
                          <div key={type}>
                            <div className="flex items-center gap-2 mb-2">
                              <Icon className="h-4 w-4" style={{ color: typeColors[type] }} />
                              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                                {type === "tarea" ? "Tareas" : type === "proyecto" ? "Proyectos" : type === "factura" ? "Facturas" : "Eventos"}
                              </p>
                              <span className="text-[10px] text-muted-foreground">({typeItems.length})</span>
                            </div>
                            <div className="flex flex-col gap-1.5">
                              {typeItems.map((item) => (
                                <button
                                  key={item.id}
                                  onClick={() => { setSelectedItem(item); setAiSuggestion("") }}
                                  className={cn(
                                    "flex items-center gap-3 rounded-lg border border-border px-4 py-3 text-left hover:bg-muted/20 transition-colors",
                                    selectedItem?.id === item.id && "ring-2 ring-ring"
                                  )}
                                >
                                  {item.priority && (
                                    <span className={cn("h-2.5 w-2.5 rounded-full flex-shrink-0", priorityDot[item.priority] ?? "bg-gray-400")} />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground">{item.title}</p>
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="text-[10px] text-muted-foreground">{item.status}</span>
                                      {item.extra && <><span className="text-[10px] text-muted-foreground">·</span><span className="text-[10px] text-muted-foreground">{item.extra}</span></>}
                                    </div>
                                  </div>
                                  <span className="text-[10px] text-muted-foreground flex-shrink-0">
                                    {new Date(item.date).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )
                })()}
              </div>
            )}
          </div>

          {/* ── Side panel ── */}
          <div className="hidden lg:flex flex-col gap-3 w-80 flex-shrink-0">
            {/* Today's items */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
                Hoy · {today.getDate()} {MONTH_NAMES[today.getMonth()].slice(0, 3)}
              </p>
              {(() => {
                const todayItems = getItemsForDate(today)
                if (todayItems.length === 0) {
                  return <p className="text-xs text-muted-foreground">Sin elementos para hoy</p>
                }
                return (
                  <div className="flex flex-col gap-1.5">
                    {todayItems.slice(0, 6).map((item) => {
                      const Icon = typeIcons[item.type]
                      return (
                        <button
                          key={item.id}
                          onClick={() => { setSelectedItem(item); setAiSuggestion("") }}
                          className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-accent/50 transition-colors"
                        >
                          <Icon className="h-3 w-3 flex-shrink-0" style={{ color: typeColors[item.type] }} />
                          <span className="text-xs text-foreground truncate">{item.title}</span>
                        </button>
                      )
                    })}
                  </div>
                )
              })()}
            </div>

            {/* Selected item detail */}
            {selectedItem && (
              <div className="rounded-xl border border-border bg-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Detalle</p>
                  <button onClick={() => setSelectedItem(null)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex items-start gap-2 mb-3">
                  {(() => { const Icon = typeIcons[selectedItem.type]; return <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" style={{ color: typeColors[selectedItem.type] }} /> })()}
                  <div>
                    <p className="text-sm font-medium text-foreground">{selectedItem.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="rounded-full px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: typeColors[selectedItem.type], color: "var(--foreground)", opacity: 0.7 }}>
                        {selectedItem.type}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{selectedItem.status}</span>
                      {selectedItem.priority && <span className="text-[10px] text-muted-foreground">· {selectedItem.priority}</span>}
                    </div>
                    {selectedItem.extra && <p className="text-[10px] text-muted-foreground mt-1">{selectedItem.extra}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(selectedItem.date).toLocaleDateString("es", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
                  </div>
                </div>

                <button
                  onClick={() => getAISuggestion(selectedItem)}
                  disabled={aiLoading}
                  className={cn(
                    "flex items-center gap-2 w-full justify-center rounded-lg px-3 py-2 text-xs font-medium transition-all",
                    aiLoading ? "bg-muted text-muted-foreground cursor-not-allowed" : "bg-foreground text-background hover:opacity-80"
                  )}
                >
                  {aiLoading ? <><Loader2 className="h-3 w-3 animate-spin" /> Analizando...</> : <><Sparkles className="h-3 w-3" /> Sugerencia IA</>}
                </button>

                {aiSuggestion && (
                  <div className="mt-3 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                    <p className="text-[10px] font-medium text-muted-foreground mb-1">Motor IA</p>
                    <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{aiSuggestion}</p>
                  </div>
                )}
              </div>
            )}

            {/* Alerts */}
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">Alertas</p>
              {(() => {
                const now = new Date()
                const overdueTareas = items.filter((i) => i.type === "tarea" && new Date(i.date) < now && i.status !== "completada" && i.status !== "cancelada")
                const overdueFacturas = items.filter((i) => i.type === "factura" && new Date(i.date) < now && i.status !== "pagada" && i.status !== "cancelada")

                if (overdueTareas.length === 0 && overdueFacturas.length === 0) {
                  return <p className="text-xs text-muted-foreground">Sin alertas activas</p>
                }

                return (
                  <div className="flex flex-col gap-2">
                    {overdueTareas.length > 0 && (
                      <div className="flex items-start gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] font-medium text-destructive">{overdueTareas.length} tarea{overdueTareas.length > 1 ? "s" : ""} vencida{overdueTareas.length > 1 ? "s" : ""}</p>
                          {overdueTareas.slice(0, 3).map((t) => (
                            <p key={t.id} className="text-[10px] text-destructive/70 truncate">{t.title}</p>
                          ))}
                        </div>
                      </div>
                    )}
                    {overdueFacturas.length > 0 && (
                      <div className="flex items-start gap-2 rounded-lg border border-orange-500/20 bg-orange-500/5 px-3 py-2">
                        <Clock className="h-3.5 w-3.5 text-orange-500 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-[10px] font-medium text-orange-600">{overdueFacturas.length} factura{overdueFacturas.length > 1 ? "s" : ""} vencida{overdueFacturas.length > 1 ? "s" : ""}</p>
                          {overdueFacturas.slice(0, 3).map((f) => (
                            <p key={f.id} className="text-[10px] text-orange-500/70 truncate">{f.title}</p>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      </SectionPage>
    </AppShell>
  )
}
