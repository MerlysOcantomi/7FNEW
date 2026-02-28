"use client"

import { useState, useMemo } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { StatCard } from "@/components/stat-card"
import {
  FolderKanban,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  ArrowUpRight,
  Calendar,
  Building,
  Pencil,
  Trash2,
  Plus,
  MoreHorizontal,
  Lock,
  Globe,
  Users,
} from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { ProyectoForm } from "@/components/forms/proyecto-form"
import { ConfirmModal } from "@/components/confirm-modal"
import { useFetch } from "@/hooks/use-fetch"
import { apiDelete, estadoLabel, prioridadLabel, displayLabel } from "@/lib/api-client"
import { toast } from "sonner"
import { CanEdit, CanDelete } from "@/components/role-gate"
import { ExportCSVButton } from "@/components/export-button"
import { PROYECTO_COLUMNS } from "@/lib/export/csv"

const statusOptions = [
  { value: "Todos", api: "" },
  { value: "En progreso", api: "en_progreso" },
  { value: "Revision", api: "revision" },
  { value: "Planificacion", api: "planificacion" },
  { value: "Completado", api: "completado" },
]

const statusColors: Record<string, string> = {
  "En progreso": "bg-[var(--tab-info)] text-foreground/70",
  "En revisión": "bg-[var(--tab-review)] text-foreground/70",
  "Planificación": "bg-[var(--tab-tasks)] text-foreground/70",
  Completado: "bg-[var(--tab-phases)] text-foreground/70",
  Planificacion: "bg-[var(--tab-tasks)] text-foreground/70",
  Revision: "bg-[var(--tab-review)] text-foreground/70",
}

const priorityColors: Record<string, string> = {
  Alta: "bg-[var(--tab-review)]/60 text-foreground/60",
  Media: "bg-[var(--tab-tasks)]/60 text-foreground/60",
  Baja: "bg-muted text-muted-foreground",
  Urgente: "bg-[var(--tab-review)]/80 text-foreground/80",
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—"
  try {
    const d = new Date(dateStr)
    if (Number.isNaN(d.getTime())) return dateStr
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return dateStr
  }
}

const priorityOptions = [
  { value: "Todas", api: "" },
  { value: "Urgente", api: "urgente" },
  { value: "Alta", api: "alta" },
  { value: "Media", api: "media" },
  { value: "Baja", api: "baja" },
]

const sortOptions = [
  { value: "Reciente", sortBy: "createdAt", sortOrder: "desc" },
  { value: "Antiguo", sortBy: "createdAt", sortOrder: "asc" },
  { value: "A-Z", sortBy: "nombre", sortOrder: "asc" },
  { value: "Z-A", sortBy: "nombre", sortOrder: "desc" },
  { value: "Progreso ↑", sortBy: "progreso", sortOrder: "asc" },
  { value: "Progreso ↓", sortBy: "progreso", sortOrder: "desc" },
]

export default function ProyectosPage() {
  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState("Todos")
  const [filterPriority, setFilterPriority] = useState("Todas")
  const [filterClienteId, setFilterClienteId] = useState("")
  const [sortIdx, setSortIdx] = useState(0)
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<any>(null)
  const [deleteItem, setDeleteItem] = useState<any>(null)

  const { data: clientesRaw } = useFetch<any>("/api/clientes?pageSize=100")
  const clientes: any[] = Array.isArray(clientesRaw) ? clientesRaw : clientesRaw?.data ?? []

  async function handleDelete() {
    if (!deleteItem) return
    try {
      await apiDelete(`/api/proyectos/${deleteItem.id}`)
      toast.success("Proyecto eliminado")
      refetch()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar")
    } finally {
      setDeleteItem(null)
    }
  }

  const apiEstado = statusOptions.find((o) => o.value === filterStatus)?.api ?? ""
  const apiPrioridad = priorityOptions.find((o) => o.value === filterPriority)?.api ?? ""
  const currentSort = sortOptions[sortIdx]
  const url = useMemo(() => {
    const params = new URLSearchParams()
    if (apiEstado) params.set("estado", apiEstado)
    if (apiPrioridad) params.set("prioridad", apiPrioridad)
    if (search.trim()) params.set("search", search.trim())
    if (currentSort.sortBy) params.set("sortBy", currentSort.sortBy)
    if (currentSort.sortOrder) params.set("sortOrder", currentSort.sortOrder)
    const q = params.toString()
    return `/api/proyectos${q ? `?${q}` : ""}`
  }, [apiEstado, apiPrioridad, search, currentSort])

  const { data, loading, error, refetch } = useFetch<any>(url)

  const projects: any[] = Array.isArray(data) ? data : (data && data.data) ? data.data : []

  const totalProjects = projects.length
  const inProgress = projects.filter((p: any) => p.estado === "en_progreso").length
  const completed = projects.filter((p: any) => p.estado === "completado").length
  const inReview = projects.filter((p: any) => p.estado === "revision").length

  const statusDisplay = (estado: string) => displayLabel(estado, estadoLabel)
  const priorityDisplay = (prioridad: string) => displayLabel(prioridad, prioridadLabel)

  return (
    <AppShell
      currentSection="proyectos"
      breadcrumbs={[{ label: "7F" }, { label: "Proyectos" }]}
    >
      <SectionPage
        title="Proyectos"
        description="Gestiona todos los proyectos activos, su progreso, plazos y equipos asignados."
      >
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total proyectos" value={String(totalProjects)} icon={FolderKanban} />
          <StatCard label="En progreso" value={String(inProgress)} icon={Clock} />
          <StatCard label="Completados" value={String(completed)} icon={CheckCircle} />
          <StatCard label="En revision" value={String(inReview)} icon={AlertCircle} />
        </div>

        {/* Search + Filters */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar por nombre o cliente..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-border bg-card pl-9 pr-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
          <CanEdit>
            <button
              onClick={() => { setEditingItem(null); setFormOpen(true) }}
              className="flex items-center gap-2 rounded-lg bg-foreground px-4 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-80 whitespace-nowrap flex-shrink-0"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo proyecto
            </button>
          </CanEdit>
          <ExportCSVButton
            data={projects}
            columns={PROYECTO_COLUMNS}
            filename={`proyectos-${new Date().toISOString().slice(0, 10)}`}
          />
          <div className="flex items-center gap-1.5 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            {statusOptions.map((status) => (
              <button
                key={status.value}
                onClick={() => setFilterStatus(status.value)}
                className={cn(
                  "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors whitespace-nowrap border",
                  filterStatus === status.value
                    ? "border-foreground/20 bg-foreground text-background"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/20"
                )}
              >
                {status.value}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={filterPriority}
              onChange={(e) => setFilterPriority(e.target.value)}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none"
            >
              {priorityOptions.map((o) => (
                <option key={o.value} value={o.value}>{o.value === "Todas" ? "Prioridad" : o.value}</option>
              ))}
            </select>
            <select
              value={sortIdx}
              onChange={(e) => setSortIdx(Number(e.target.value))}
              className="rounded-lg border border-border bg-card px-3 py-2 text-xs font-medium text-foreground outline-none"
            >
              {sortOptions.map((o, i) => (
                <option key={o.value} value={i}>{o.value}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">Cargando proyectos...</p>
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-sm text-destructive">{error}</p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-xs font-medium text-foreground underline underline-offset-2"
            >
              Reintentar
            </button>
          </div>
        )}

        {/* Project grid */}
        {!loading && !error && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project: any) => {
              const estadoDisplay = statusDisplay(project.estado ?? "")
              const prioridadDisplayVal = priorityDisplay(project.prioridad ?? "")
              const clientName = project.cliente?.nombre ?? (project.clienteId ? String(project.clienteId) : "—")
              const taskCount = Array.isArray(project.tareas) ? project.tareas.length : null
              return (
                <div
                  key={project.id}
                  className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4 transition-shadow hover:shadow-sm group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold text-foreground group-hover:text-foreground/80 truncate text-pretty">
                        {project.nombre}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground">
                        <Building className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{clientName}</span>
                      </div>
                    </div>
                    <span className={cn(
                      "rounded-full px-2.5 py-0.5 text-[10px] font-medium flex-shrink-0",
                      statusColors[estadoDisplay] || "bg-muted text-muted-foreground"
                    )}>
                      {estadoDisplay}
                    </span>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">Progreso general</span>
                      <span className="text-xs font-semibold text-foreground">{project.progreso ?? 0}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{
                          width: `${project.progreso ?? 0}%`,
                          backgroundColor: (project.progreso ?? 0) === 100
                            ? "var(--tab-phases)"
                            : (project.progreso ?? 0) >= 60
                              ? "var(--tab-info)"
                              : "var(--tab-tasks)",
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3 flex-shrink-0" />
                      <span>{formatDate(project.fechaInicio)} - {formatDate(project.fechaFin)}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-muted/50 py-1.5">
                      <p className="text-xs font-semibold text-foreground">
                        {project.presupuesto != null ? `$${Number(project.presupuesto).toLocaleString("es-MX")}` : "—"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Presupuesto</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 py-1.5">
                      <p className="text-xs font-semibold text-foreground">{taskCount != null ? taskCount : "—"}</p>
                      <p className="text-[10px] text-muted-foreground">Tareas</p>
                    </div>
                    <div className="rounded-lg bg-muted/50 py-1.5">
                      <p className="text-xs font-semibold text-foreground">
                        <span className={cn(
                          "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                          priorityColors[prioridadDisplayVal] || "bg-muted text-muted-foreground"
                        )}>
                          {prioridadDisplayVal}
                        </span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">Prioridad</p>
                    </div>
                  </div>

                  {/* Tags */}
                  {project.tags && (
                    <div className="flex flex-wrap gap-1">
                      {project.tags.split(",").filter(Boolean).slice(0, 3).map((tag: string, i: number) => (
                        <span key={i} className="rounded-full bg-blue-500/10 px-2 py-0.5 text-[10px] font-medium text-blue-600 dark:text-blue-400">
                          {tag.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Custom ID + Assigned + Visibility */}
                  {(project.customId || project.assignedTo || (project.visibility && project.visibility !== "public")) && (
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      {project.customId && <span className="font-mono bg-muted px-1.5 py-0.5 rounded">{project.customId}</span>}
                      {project.assignedTo && <span>→ {project.assignedTo}</span>}
                      {project.visibility === "private" && <span className="flex items-center gap-0.5 text-red-500"><Lock className="h-3 w-3" /> Privado</span>}
                      {project.visibility === "custom" && <span className="flex items-center gap-0.5 text-amber-500"><Users className="h-3 w-3" /> Restringido</span>}
                    </div>
                  )}

                  <div className="flex items-center gap-1 border-t border-border pt-3">
                    <Link href={`/proyectos/${project.id}`} className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-2 text-xs font-medium text-foreground hover:bg-muted transition-colors">
                      Ver proyecto <ArrowUpRight className="h-3 w-3" />
                    </Link>
                    <CanEdit>
                      <button onClick={() => { setEditingItem(project); setFormOpen(true) }} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-foreground transition-colors" aria-label="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    </CanEdit>
                    <CanDelete>
                      <button onClick={() => setDeleteItem(project)} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-accent hover:text-destructive transition-colors" aria-label="Eliminar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </CanDelete>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && projects.length === 0 && (
          <div className="text-center py-12">
            <FolderKanban className="h-8 w-8 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">No se encontraron proyectos con los filtros seleccionados.</p>
            <button
              onClick={() => { setSearch(""); setFilterStatus("Todos") }}
              className="mt-2 text-xs font-medium text-foreground underline underline-offset-2"
            >
              Limpiar filtros
            </button>
          </div>
        )}

        <ProyectoForm
          open={formOpen}
          onClose={() => { setFormOpen(false); setEditingItem(null) }}
          onSuccess={refetch}
          data={editingItem}
        />
        <ConfirmModal
          open={!!deleteItem}
          title="Eliminar proyecto"
          description={`¿Seguro que quieres eliminar "${deleteItem?.nombre}"? Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar"
          variant="danger"
          onConfirm={handleDelete}
          onCancel={() => setDeleteItem(null)}
        />
      </SectionPage>
    </AppShell>
  )
}
