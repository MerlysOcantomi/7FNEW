"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { cn } from "@/lib/utils"
import { displayLabel, estadoLabel, prioridadLabel, apiDelete } from "@/lib/api-client"
import { useFetch } from "@/hooks/use-fetch"
import {
  CheckSquare,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Pause,
  ChevronRight,
  Calendar,
  User,
  FolderKanban,
  Users,
  X,
  MoreHorizontal,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react"
import { TareaForm } from "@/components/forms/tarea-form"
import { ConfirmModal } from "@/components/confirm-modal"
import { toast } from "sonner"
import { CanEdit, CanDelete } from "@/components/role-gate"
import { ExportCSVButton } from "@/components/export-button"
import { TAREA_COLUMNS } from "@/lib/export/csv"

/* ── Status / priority config (API values as keys) ── */
const statusConfig: Record<string, { icon: typeof Circle; colorClass: string }> = {
  pendiente: { icon: Circle, colorClass: "text-muted-foreground" },
  en_progreso: { icon: Clock, colorClass: "text-chart-1" },
  revision: { icon: AlertTriangle, colorClass: "text-chart-3" },
  completada: { icon: CheckCircle2, colorClass: "text-chart-2" },
  cancelada: { icon: Pause, colorClass: "text-muted-foreground" },
}

const priorityColors: Record<string, string> = {
  urgente: "bg-[var(--tab-review)] text-foreground/70",
  alta: "bg-[var(--tab-review)] text-foreground/70",
  media: "bg-[var(--tab-tasks)] text-foreground/70",
  baja: "bg-[var(--tab-info)] text-foreground/70",
}

const STATUS_OPTIONS = ["todos", "pendiente", "en_progreso", "revision", "completada", "cancelada"] as const
const PRIORITY_OPTIONS = ["todas", "urgente", "alta", "media", "baja"] as const

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    const d = new Date(value)
    return isNaN(d.getTime()) ? value : d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return value
  }
}

export default function TareasPage() {
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("todos")
  const [filterPriority, setFilterPriority] = useState<string>("todas")
  const [filterClient, setFilterClient] = useState("Todos")
  const [selectedTask, setSelectedTask] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<"due" | "priority">("due")
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deleteItem, setDeleteItem] = useState<any>(null)

  const query = new URLSearchParams()
  if (search.trim()) query.set("search", search.trim())
  if (filterStatus !== "todos") query.set("estado", filterStatus)
  if (filterPriority !== "todas") query.set("prioridad", filterPriority)
  const qs = query.toString()
  const url = qs ? `/api/tareas?${qs}` : "/api/tareas"

  const { data: apiData, loading, error, refetch } = useFetch<any>(url)
  const allTasks = Array.isArray(apiData) ? apiData : []

  const clients = useMemo(() => {
    const set = new Set<string>()
    allTasks.forEach((t: any) => {
      const name = t.cliente?.nombre
      if (name) set.add(name)
    })
    return ["Todos", ...Array.from(set).sort()]
  }, [allTasks])

  const filtered = useMemo(() => {
    let list = allTasks.filter((t: any) => {
      const matchClient = filterClient === "Todos" || (t.cliente?.nombre === filterClient)
      return matchClient
    })
    if (sortBy === "due") {
      list = [...list].sort((a: any, b: any) => {
        const da = new Date(a.fechaLimite || 0).getTime()
        const db = new Date(b.fechaLimite || 0).getTime()
        return da - db
      })
    } else {
      const order: Record<string, number> = { urgente: 0, alta: 1, media: 2, baja: 3 }
      list = [...list].sort((a: any, b: any) => (order[a.prioridad] ?? 99) - (order[b.prioridad] ?? 99))
    }
    return list
  }, [allTasks, filterClient, sortBy])

  const selected = allTasks.find((t: any) => t.id === selectedTask)

  const pendingCount = allTasks.filter((t: any) => t.estado === "pendiente").length
  const inProgressCount = allTasks.filter((t: any) => t.estado === "en_progreso").length
  const urgentCount = allTasks.filter((t: any) => (t.prioridad === "alta" || t.prioridad === "urgente") && t.estado !== "completada").length

  async function handleDelete() {
    if (!deleteItem) return
    try {
      await apiDelete(`/api/tareas/${deleteItem.id}`)
      toast.success("Tarea eliminada")
      refetch()
      if (selectedTask === deleteItem.id) setSelectedTask(null)
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar")
    } finally {
      setDeleteItem(null)
    }
  }

  return (
    <AppShell currentSection="tareas" breadcrumbs={[{ label: "7F" }, { label: "Tareas" }]}>
      <SectionPage title="Tareas" description="Vista global de todas las tareas de todos los proyectos y clientes del sistema.">

        {/* Stats */}
        <div className="grid grid-cols-1 min-[480px]:grid-cols-2 xl:grid-cols-4 gap-3">
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{allTasks.length}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pendientes</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{pendingCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">En progreso</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{inProgressCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Urgentes</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{urgentCount}</p>
          </div>
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-card px-3 py-2">
              <Search className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <input
                type="text"
                placeholder="Buscar tarea, proyecto o responsable..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s)}
                className={cn(
                  "rounded-full px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-medium transition-colors whitespace-nowrap",
                  filterStatus === s ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {s === "todos" ? "Todos" : displayLabel(s, estadoLabel)}
              </button>
            ))}
            <span className="hidden sm:block mx-1 h-4 w-px bg-border" />
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] sm:text-xs font-medium text-foreground outline-none w-full sm:w-auto"
            >
              <option value="todas">Prioridad</option>
              {PRIORITY_OPTIONS.filter((p) => p !== "todas").map((p) => (
                <option key={p} value={p}>{displayLabel(p, prioridadLabel)}</option>
              ))}
            </select>
            <select
              value={filterClient}
              onChange={(e) => setFilterClient(e.target.value)}
              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-[11px] sm:text-xs font-medium text-foreground outline-none w-full sm:w-auto"
            >
              {clients.map((c) => (
                <option key={c} value={c}>{c === "Todos" ? "Cliente" : c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Task list + detail panel */}
        <div className="grid gap-4 xl:grid-cols-5">
          <div className={cn("flex flex-col gap-2", selected ? "lg:col-span-3" : "lg:col-span-5")}>
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{loading ? "Cargando..." : `${filtered.length} tareas`}</p>
              <div className="scale-90 sm:scale-100 origin-right">
                <ExportCSVButton
                  data={filtered}
                  columns={TAREA_COLUMNS}
                  filename={`tareas-${new Date().toISOString().slice(0, 10)}`}
                />
              </div>
            </div>

            {loading && (
              <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                <p className="text-sm font-medium text-foreground">Cargando...</p>
              </div>
            )}

            {!loading && error && (
              <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            )}

            {!loading && !error && filtered.map((task: any) => {
              const StatusIcon = statusConfig[task.estado]?.icon || Circle
              const statusColor = statusConfig[task.estado]?.colorClass || "text-muted-foreground"
              const isSelected = selectedTask === task.id
              return (
                <button
                  key={task.id}
                  onClick={() => setSelectedTask(isSelected ? null : task.id)}
                  className={cn(
                    "w-full rounded-xl border bg-card px-4 py-3.5 text-left transition-all hover:shadow-sm",
                    isSelected ? "border-foreground/30 shadow-sm" : "border-border"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <StatusIcon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", statusColor)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium text-foreground">{task.titulo}</p>
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", priorityColors[task.prioridad] || priorityColors.media)}>
                          {displayLabel(task.prioridad ?? "", prioridadLabel)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 mt-1 text-[11px] sm:text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><FolderKanban className="h-3 w-3" />{task.proyecto?.nombre ?? "—"}</span>
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{task.cliente?.nombre ?? "—"}</span>
                        <span className="flex items-center gap-1"><User className="h-3 w-3" />{task.usuario?.nombre ?? "—"}</span>
                        <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{formatDate(task.fechaLimite)}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  </div>
                </button>
              )
            })}
            {!loading && !error && filtered.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                <CheckSquare className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm font-medium text-foreground">No se encontraron tareas</p>
                <p className="text-xs text-muted-foreground mt-1">Ajusta los filtros o busca con otro termino.</p>
              </div>
            )}
          </div>

          {selected && (
            <div className="xl:col-span-2">
              <div className="rounded-xl border border-border bg-card xl:sticky xl:top-6">
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <h3 className="text-sm font-semibold text-foreground">Detalle de tarea</h3>
                  <button onClick={() => setSelectedTask(null)} className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label="Cerrar">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="p-5 flex flex-col gap-4">
                  <div>
                    <p className="text-base font-semibold text-foreground">{selected.titulo}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-medium", priorityColors[selected.prioridad] || priorityColors.media)}>
                        {displayLabel(selected.prioridad ?? "", prioridadLabel)}
                      </span>
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                        {displayLabel(selected.estado ?? "", estadoLabel)}
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DetailField label="Proyecto" value={selected.proyecto?.nombre ?? "—"} />
                    <DetailField label="Cliente" value={selected.cliente?.nombre ?? "—"} />
                    <DetailField label="Responsable" value={selected.usuario?.nombre ?? "—"} />
                    <DetailField label="Fecha limite" value={formatDate(selected.fechaLimite)} />
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">Descripcion</p>
                    <p className="text-sm text-foreground/70 leading-relaxed">{selected.descripcion || "Sin descripcion."}</p>
                  </div>
                  <div className="flex items-center gap-2 pt-2 border-t border-border">
                    {selected.proyectoId && (
                      <Link href={`/proyectos/${selected.proyectoId}`} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors">
                        <FolderKanban className="h-3 w-3" /> Ver proyecto
                      </Link>
                    )}
                    {selected.clienteId && (
                      <Link href={`/clientes/${selected.clienteId}`} className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors">
                        <Users className="h-3 w-3" /> Ver cliente
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </SectionPage>
    </AppShell>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium text-foreground">{value}</p>
    </div>
  )
}
