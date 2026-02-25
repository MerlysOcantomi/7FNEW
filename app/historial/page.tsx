"use client"

import { useState } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { cn } from "@/lib/utils"
import {
  History,
  Search,
  User,
  FolderKanban,
  FileText,
  CheckCircle2,
  MessageSquare,
  DollarSign,
  Upload,
  PenLine,
  UserPlus,
  Sparkles,
  Settings,
  ArrowRight,
  Calendar,
  Filter,
} from "lucide-react"

const historyEvents = [
  { id: "h-1", type: "tarea", actor: "Ana Rodriguez", action: "completo la tarea", target: "Disenar logotipo v3", project: "Rebranding Alpha Corp", client: "Alpha Corp", time: "Hace 30 min", date: "19 feb 2026", icon: CheckCircle2, color: "var(--tab-phases)" },
  { id: "h-2", type: "comentario", actor: "Maria Lopez", action: "dejo un comentario en", target: "Logotipo - Opciones iniciales", project: "Rebranding Alpha Corp", client: "Alpha Corp", time: "Hace 1h", date: "19 feb 2026", icon: MessageSquare, color: "var(--tab-info)" },
  { id: "h-3", type: "factura", actor: "Sistema", action: "registro pago de", target: "FAC-2026-017 ($45,000)", project: "Rebranding Alpha Corp", client: "Alpha Corp", time: "Hace 2h", date: "19 feb 2026", icon: DollarSign, color: "var(--tab-phases)" },
  { id: "h-4", type: "documento", actor: "Sofia Torres", action: "subio el archivo", target: "Materiales fotograficos.zip (128 MB)", project: "Catalogo Gamma Inc", client: "Gamma Inc", time: "Hace 3h", date: "19 feb 2026", icon: Upload, color: "var(--tab-docs)" },
  { id: "h-5", type: "entrada", actor: "Admin", action: "registro entrada manual:", target: "'Roberto confirmo fase 2 de Beta Labs'", project: "Portal Beta Labs", client: "Beta Labs", time: "Hace 4h", date: "19 feb 2026", icon: PenLine, color: "var(--tab-tasks)" },
  { id: "h-6", type: "ia", actor: "IA", action: "clasifico automaticamente nuevo lead:", target: "Nexus Solutions (prioridad alta)", project: null, client: "Nexus Solutions", time: "Hace 5h", date: "19 feb 2026", icon: Sparkles, color: "var(--tab-ai)" },
  { id: "h-7", type: "cliente", actor: "Sistema", action: "creo ficha de cliente:", target: "Nexus Solutions", project: null, client: "Nexus Solutions", time: "Hace 5h", date: "19 feb 2026", icon: UserPlus, color: "var(--tab-info)" },
  { id: "h-8", type: "tarea", actor: "Miguel Torres", action: "inicio trabajo en", target: "Implementar API de autenticacion", project: "Portal Beta Labs", client: "Beta Labs", time: "Hace 6h", date: "19 feb 2026", icon: ArrowRight, color: "var(--tab-tasks)" },
  { id: "h-9", type: "proyecto", actor: "Valentina Mora", action: "avanzo a Fase Diseno el proyecto", target: "Rebranding Alpha Corp", project: "Rebranding Alpha Corp", client: "Alpha Corp", time: "Hace 8h", date: "19 feb 2026", icon: FolderKanban, color: "var(--tab-phases)" },
  { id: "h-10", type: "config", actor: "Admin", action: "actualizo regla de clasificacion:", target: "Emails con 'cotizacion' -> Tipo: Prospecto", project: null, client: null, time: "Hace 1d", date: "18 feb 2026", icon: Settings, color: "var(--tab-docs)" },
  { id: "h-11", type: "factura", actor: "Sistema", action: "emitio factura", target: "FAC-2026-024 ($35,000) a Beta Labs", project: "Portal Beta Labs", client: "Beta Labs", time: "Hace 1d", date: "18 feb 2026", icon: DollarSign, color: "var(--tab-tasks)" },
  { id: "h-12", type: "comentario", actor: "Andres Ruiz", action: "solicito cambio de alcance en", target: "Sitio Delta Tech", project: "Sitio Delta Tech", client: "Delta Tech", time: "Hace 1d", date: "18 feb 2026", icon: MessageSquare, color: "var(--tab-review)" },
]

const typeFilters = ["Todos", "Tarea", "Comentario", "Factura", "Documento", "Entrada", "IA", "Cliente", "Proyecto", "Config"]

export default function HistorialPage() {
  const [activeFilter, setActiveFilter] = useState("Todos")
  const [search, setSearch] = useState("")

  const filtered = historyEvents.filter((e) => {
    if (activeFilter !== "Todos" && e.type !== activeFilter.toLowerCase()) return false
    if (search) {
      const q = search.toLowerCase()
      if (!e.actor.toLowerCase().includes(q) && !e.target.toLowerCase().includes(q) && !(e.client || "").toLowerCase().includes(q)) return false
    }
    return true
  })

  // Group by date
  const grouped = filtered.reduce<Record<string, typeof historyEvents>>((acc, event) => {
    const date = event.date
    if (!acc[date]) acc[date] = []
    acc[date].push(event)
    return acc
  }, {})

  return (
    <AppShell currentSection="historial" breadcrumbs={[{ label: "7F" }, { label: "Historial" }]}>
      <SectionPage title="Historial" description="Log unificado de toda la actividad del sistema. Cada accion, mensaje, cambio y evento registrado cronologicamente.">

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Eventos hoy", value: historyEvents.filter(e => e.date === "19 feb 2026").length, icon: Calendar, color: "#7C3AED" },
            { label: "Acciones IA", value: historyEvents.filter(e => e.type === "ia").length, icon: Sparkles, color: "#6D28D9" },
            { label: "Actores unicos", value: new Set(historyEvents.map(e => e.actor)).size, icon: User, color: "#9333EA" },
            { label: "Total registros", value: historyEvents.length, icon: History, color: "#64748B" },
          ].map((s) => {
            const Icon = s.icon
            return (
              <div key={s.label} className="rounded-xl p-5 transition-all duration-200 hover:-translate-y-0.5" style={{ backgroundColor: s.color }}>
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-1">
                    <p className="text-[11px] font-medium uppercase tracking-wider text-white/70">{s.label}</p>
                    <p className="text-3xl font-bold text-white">{s.value}</p>
                  </div>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15">
                    <Icon className="h-5 w-5 text-white" />
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar en historial..."
              className="w-full rounded-lg bg-muted/50 pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {typeFilters.map((f) => (
              <button
                key={f}
                onClick={() => setActiveFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                  activeFilter === f ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div className="flex flex-col gap-8">
          {Object.entries(grouped).map(([date, events]) => (
            <div key={date}>
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">{date}</h3>
                <span className="text-xs text-muted-foreground">{events.length} eventos</span>
              </div>

              <div className="relative ml-4 border-l-2 border-border pl-6 flex flex-col gap-0">
                {events.map((event) => {
                  const EventIcon = event.icon
                  return (
                    <div key={event.id} className="relative pb-5 last:pb-0">
                      {/* Timeline dot */}
                      <div
                        className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-background"
                        style={{ backgroundColor: event.color }}
                      >
                        <EventIcon className="h-3 w-3 text-foreground/60" />
                      </div>

                      <div className="rounded-xl border border-border bg-card shadow-sm px-4 py-3 hover:bg-muted/40 transition-colors group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm text-foreground leading-relaxed">
                              <span className="font-medium group-hover:text-primary">{event.actor}</span>
                              {" "}{event.action}{" "}
                              <span className="font-medium">{event.target}</span>
                            </p>
                            <div className="flex items-center gap-3 mt-1 flex-wrap">
                              {event.client && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <User className="h-2.5 w-2.5" />{event.client}
                                </span>
                              )}
                              {event.project && (
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  <FolderKanban className="h-2.5 w-2.5" />{event.project}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground flex-shrink-0">{event.time}</span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="rounded-xl border border-border bg-card shadow-sm p-8 text-center">
            <History className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Sin eventos para este filtro</p>
          </div>
        )}
      </SectionPage>
    </AppShell>
  )
}
