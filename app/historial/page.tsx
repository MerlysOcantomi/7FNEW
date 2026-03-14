"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { useFetch } from "@/hooks/use-fetch"
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
  Calendar,
  Loader2,
  AlertTriangle,
  FileEdit,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActivityEntry {
  id: string
  module: string
  recordId: string
  type: string
  userId: string | null
  userName: string | null
  userEmail: string | null
  data: { label?: string; comment?: string; field?: string; oldValue?: unknown; newValue?: unknown; changes?: { field: string; oldValue: unknown; newValue: unknown }[] } | null
  createdAt: string
}

const MODULE_LABELS: Record<string, string> = {
  clientes: "Cliente",
  proyectos: "Proyecto",
  tareas: "Tarea",
  facturacion: "Factura",
  documentos: "Documento",
  contenido: "Contenido",
}

const MODULE_ICONS: Record<string, LucideIcon> = {
  clientes: User,
  proyectos: FolderKanban,
  tareas: CheckCircle2,
  facturacion: DollarSign,
  documentos: FileText,
  contenido: FileEdit,
}

const TYPE_LABELS: Record<string, string> = {
  created: "Creado",
  updated: "Actualizado",
  deleted: "Eliminado",
  comment: "Comentario",
  status_change: "Cambio de estado",
  assigned: "Asignado",
  unassigned: "Desasignado",
}

function getModuleHref(module: string, recordId: string): string | null {
  if (module === "clientes") return `/clientes/${recordId}`
  if (module === "proyectos") return `/proyectos/${recordId}`
  if (module === "tareas") return `/tareas/${recordId}`
  if (module === "facturacion") return `/facturacion/${recordId}`
  return null
}

function formatTimeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (diff < 60) return "Hace un momento"
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`
  if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} días`
  return new Date(dateStr).toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })
}

function formatDateKey(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })
}

function getActionLabel(entry: ActivityEntry): string {
  const data = entry.data
  switch (entry.type) {
    case "created":
      return data?.label ? `creó ${data.label}` : "creó registro"
    case "deleted":
      return data?.label ? `eliminó ${data.label}` : "eliminó registro"
    case "comment":
      return data?.comment ? `comentó: ${(data.comment as string).slice(0, 60)}${(data.comment as string).length > 60 ? "…" : ""}` : "dejó un comentario"
    case "status_change":
      return data?.field ? `cambió ${data.field}: ${data.oldValue} → ${data.newValue}` : "cambió estado"
    case "assigned":
      return "asignó responsable"
    case "unassigned":
      return "desasignó responsable"
    case "updated":
      return data?.label ? `actualizó ${data.label}` : "realizó cambios"
    default:
      return entry.type
  }
}

// ── Page ─────────────────────────────────────────────────────────────────────

const MODULE_FILTERS = ["Todos", "clientes", "proyectos", "tareas", "facturacion", "documentos"]
const TYPE_FILTERS = ["Todos", "created", "updated", "deleted", "comment", "status_change"]

export default function HistorialPage() {
  const [moduleFilter, setModuleFilter] = useState("Todos")
  const [typeFilter, setTypeFilter] = useState("Todos")
  const [search, setSearch] = useState("")

  const params = new URLSearchParams()
  params.set("limit", "100")
  if (moduleFilter !== "Todos") params.set("module", moduleFilter)
  if (typeFilter !== "Todos") params.set("type", typeFilter)
  if (search.trim()) params.set("search", search.trim())

  const url = `/api/activity?${params.toString()}`
  const { data: rawData, loading, error, refetch } = useFetch<ActivityEntry[]>(url)

  const activities = useMemo(() => {
    if (!Array.isArray(rawData)) return []
    return rawData
  }, [rawData])

  const filtered = activities

  const grouped = useMemo(() => {
    const acc: Record<string, ActivityEntry[]> = {}
    for (const event of filtered) {
      const key = formatDateKey(event.createdAt)
      if (!acc[key]) acc[key] = []
      acc[key].push(event)
    }
    return acc
  }, [filtered])

  const stats = useMemo(() => {
    const today = new Date().toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" })
    const todayCount = filtered.filter((e) => formatDateKey(e.createdAt) === today).length
    const commentCount = filtered.filter((e) => e.type === "comment").length
    const uniqueActors = new Set(filtered.map((e) => e.userName || e.userEmail || "Sistema")).size
    return { todayCount, commentCount, uniqueActors, total: filtered.length }
  }, [filtered])

  return (
    <AppShell currentSection="historial" breadcrumbs={[{ label: "7F" }, { label: "Historial" }]}>
      <SectionPage
        title="Historial"
        description="Log unificado de toda la actividad del workspace. Cada acción, cambio y evento registrado cronológicamente."
      >
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Eventos hoy</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{loading ? "—" : stats.todayCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Comentarios</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{loading ? "—" : stats.commentCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Actores únicos</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{loading ? "—" : stats.uniqueActors}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total registros</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{loading ? "—" : stats.total}</p>
          </div>
        </div>

        {/* Search + filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por texto, usuario o entidad..."
              className="w-full rounded-lg border border-border bg-card pl-10 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Módulo:</span>
            {MODULE_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setModuleFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                  moduleFilter === f ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "Todos" ? "Todos" : MODULE_LABELS[f] ?? f}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-2 mr-1">Acción:</span>
            {TYPE_FILTERS.map((f) => (
              <button
                key={f}
                onClick={() => setTypeFilter(f)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap",
                  typeFilter === f ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {f === "Todos" ? "Todos" : TYPE_LABELS[f] ?? f}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-border bg-card">
            <Loader2 className="h-10 w-10 animate-spin text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">Cargando actividad...</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-border bg-card">
            <AlertTriangle className="h-10 w-10 text-destructive mb-3" />
            <p className="text-sm font-medium text-foreground mb-1">Error al cargar el historial</p>
            <p className="text-sm text-muted-foreground mb-4">{error}</p>
            <button
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium hover:bg-muted transition-colors"
            >
              Reintentar
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 rounded-xl border border-dashed border-border bg-card/50">
            <History className="h-12 w-12 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">Sin actividad registrada</p>
            <p className="text-xs text-muted-foreground mt-1 text-center max-w-sm">
              La actividad de clientes, proyectos, tareas, facturación y documentos aparecerá aquí.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {Object.entries(grouped).map(([date, events]) => (
              <div key={date}>
                <div className="flex items-center gap-2 mb-4">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold text-foreground">{date}</h3>
                  <span className="text-xs text-muted-foreground">{events.length} eventos</span>
                </div>

                <div className="relative ml-4 border-l-2 border-border pl-6 flex flex-col gap-0">
                  {events.map((event) => {
                    const EventIcon = MODULE_ICONS[event.module] ?? MessageSquare
                    const href = getModuleHref(event.module, event.recordId)
                    const actionLabel = getActionLabel(event)
                    const actor = event.userName ?? event.userEmail ?? "Sistema"

                    return (
                      <div key={event.id} className="relative pb-5 last:pb-0">
                        <div
                          className="absolute -left-[31px] flex h-6 w-6 items-center justify-center rounded-full border-2 border-background bg-muted"
                        >
                          <EventIcon className="h-3 w-3 text-muted-foreground" />
                        </div>

                        <div className="rounded-xl border border-border bg-card px-4 py-3 hover:shadow-sm transition-shadow">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm text-foreground leading-relaxed">
                                <span className="font-medium">{actor}</span> {actionLabel}
                              </p>
                              <div className="flex items-center gap-3 mt-1 flex-wrap">
                                <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                                  {MODULE_LABELS[event.module] ?? event.module}
                                </span>
                                {event.type !== "comment" && event.data?.label && (
                                  <span className="text-[10px] text-muted-foreground truncate max-w-[200px]">
                                    {event.data.label}
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-shrink-0">
                              {href && (
                                <Link
                                  href={href}
                                  className="text-xs text-primary hover:underline font-medium"
                                >
                                  Ver
                                </Link>
                              )}
                              <span className="text-xs text-muted-foreground">{formatTimeAgo(event.createdAt)}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionPage>
    </AppShell>
  )
}
