"use client"

import { useState, useMemo, useCallback } from "react"
import { AppShell } from "@/components/app-shell"
import { SectionPage } from "@/components/section-page"
import { TaskContextualPanel, type TaskRecord } from "@/components/tasks/task-contextual-panel"
import { useMediaQuery } from "@/hooks/use-media-query"
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
  Plus,
  ListFilter,
} from "lucide-react"
import { TareaForm } from "@/components/forms/tarea-form"
import { ConfirmModal } from "@/components/confirm-modal"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { ExportCSVButton } from "@/components/export-button"
import { TAREA_COLUMNS } from "@/lib/export/csv"

const XL_MEDIA = "(min-width: 1280px)"
const PHONE_MEDIA = "(max-width: 640px)"

/* Status icons — shared status token tints */
const statusConfig: Record<string, { icon: typeof Circle; colorClass: string }> = {
  pendiente: { icon: Circle, colorClass: "text-muted-foreground" },
  en_progreso: { icon: Clock, colorClass: "text-[var(--status-info-text)]" },
  revision: { icon: AlertTriangle, colorClass: "text-[var(--status-warning-text)]" },
  completada: { icon: CheckCircle2, colorClass: "text-[var(--status-success-text)]" },
  cancelada: { icon: Pause, colorClass: "text-muted-foreground" },
}

const PRIORITY_ROW_BADGE: Record<string, string> = {
  urgente: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  alta: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  media: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  baja: "bg-[var(--status-neutral-bg)] text-[var(--status-neutral-text)]",
}

const STATUS_OPTIONS = ["all", "pendiente", "en_progreso", "revision", "completada", "cancelada"] as const
const PRIORITY_OPTIONS = ["all", "urgente", "alta", "media", "baja"] as const

function formatDate(value: string | null | undefined): string {
  if (!value) return "—"
  try {
    const d = new Date(value)
    return isNaN(d.getTime()) ? value : d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return value
  }
}

export default function TareasPage() {
  const isXl = useMediaQuery(XL_MEDIA)
  const isPhone = useMediaQuery(PHONE_MEDIA)

  const [search, setSearch] = useState("")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterPriority, setFilterPriority] = useState<string>("all")
  const [filterClient, setFilterClient] = useState("All")
  const [sortBy, setSortBy] = useState<"due" | "priority">("due")
  const [selectedTask, setSelectedTask] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<TaskRecord | null>(null)
  const [deleteItem, setDeleteItem] = useState<TaskRecord | null>(null)

  const query = new URLSearchParams()
  if (search.trim()) query.set("search", search.trim())
  if (filterStatus !== "all") query.set("estado", filterStatus)
  if (filterPriority !== "all") query.set("prioridad", filterPriority)
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
    return ["All", ...Array.from(set).sort()]
  }, [allTasks])

  const filtered = useMemo(() => {
    let list = allTasks.filter((t: any) => filterClient === "All" || t.cliente?.nombre === filterClient)
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

  const selected = allTasks.find((t: any) => t.id === selectedTask) as TaskRecord | undefined

  const pendingCount = allTasks.filter((t: any) => t.estado === "pendiente").length
  const inProgressCount = allTasks.filter((t: any) => t.estado === "en_progreso").length
  const urgentCount = allTasks.filter(
    (t: any) => (t.prioridad === "alta" || t.prioridad === "urgente") && t.estado !== "completada",
  ).length

  const handleRowActivate = useCallback((taskId: string) => {
    setSelectedTask((prev) => (prev === taskId ? null : taskId))
  }, [])

  const clearSelection = useCallback(() => setSelectedTask(null), [])

  async function handleDelete() {
    if (!deleteItem?.id) return
    try {
      await apiDelete(`/api/tareas/${deleteItem.id}`)
      toast.success("Task deleted")
      refetch()
      if (selectedTask === deleteItem.id) clearSelection()
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleteItem(null)
    }
  }

  const detailSheetOpen = Boolean(selected && !isXl)

  return (
    <AppShell currentSection="tareas" breadcrumbs={[{ label: "7F" }, { label: "Tasks" }]}>
      <SectionPage
        tone="canvas"
        title="Tasks"
        description="Execution hub — scan, prioritize, and act on work across every project and client."
      >
      <div className="flex flex-col gap-8">
        {/* Toolbar: new task */}
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button type="button" size="sm" onClick={() => { setEditingItem(null); setFormOpen(true) }}>
            <Plus className="h-4 w-4" />
            New task
          </Button>
        </div>

        {/* Stats — urgent first as primary tier */}
        <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-primary/25 bg-card p-4 shadow-sm ring-1 ring-primary/15">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Needs attention</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{urgentCount}</p>
            <p className="mt-0.5 text-[10px] text-muted-foreground">Urgent / high · not done</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Pending</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{pendingCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">In progress</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{inProgressCount}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">{allTasks.length}</p>
          </div>
        </div>

        {/* Search + filters — single tray aligned with KPI surfaces */}
        <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-background px-3 py-2 shadow-[inset_0_1px_0_rgba(15,23,42,0.04)]">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search task, project, or owner..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <ListFilter className="h-3 w-3 shrink-0" />
                  Sort
                </span>
                <div className="flex rounded-lg border border-border bg-muted/50 p-0.5">
                  <button
                    type="button"
                    onClick={() => setSortBy("due")}
                    className={cn(
                      "min-h-9 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      sortBy === "due"
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Due date
                  </button>
                  <button
                    type="button"
                    onClick={() => setSortBy("priority")}
                    className={cn(
                      "min-h-9 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      sortBy === "priority"
                        ? "bg-foreground text-background shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    Priority
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-border pt-4">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    "inline-flex h-9 items-center whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors",
                    filterStatus === s
                      ? "bg-foreground text-background shadow-sm"
                      : "bg-muted text-muted-foreground hover:text-foreground",
                  )}
                >
                  {s === "all" ? "All" : displayLabel(s, estadoLabel)}
                </button>
              ))}
              <span className="mx-1 hidden h-6 w-px bg-border sm:block" aria-hidden />
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger
                  size="sm"
                  className="h-9 w-full min-w-[8.5rem] border-border bg-background shadow-[inset_0_1px_0_rgba(15,23,42,0.04)] sm:w-[140px]"
                >
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {PRIORITY_OPTIONS.filter((p) => p !== "all").map((p) => (
                    <SelectItem key={p} value={p}>
                      {displayLabel(p, prioridadLabel)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger
                  size="sm"
                  className="h-9 w-full min-w-[8.5rem] border-border bg-background shadow-[inset_0_1px_0_rgba(15,23,42,0.04)] sm:w-[160px]"
                >
                  <SelectValue placeholder="Client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c === "All" ? "All clients" : c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Master-detail: xl+ inline column; &lt;xl sheet */}
        <div className={cn("grid gap-4", isXl && selected ? "xl:grid-cols-5" : "xl:grid-cols-1")}>
          <div className={cn("flex flex-col gap-2", isXl && selected ? "xl:col-span-3" : "xl:col-span-full")}>
            <div className="flex items-center justify-between">
              <p className="text-xs text-[var(--text-secondary-light)]">
                {loading ? "Loading..." : `${filtered.length} tasks`}
              </p>
              <div className="origin-right scale-90 sm:scale-100">
                <ExportCSVButton
                  data={filtered}
                  columns={TAREA_COLUMNS}
                  filename={`tasks-${new Date().toISOString().slice(0, 10)}`}
                  label="Export CSV"
                />
              </div>
            </div>

            {loading && (
              <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                <p className="text-sm font-medium text-foreground">Loading...</p>
              </div>
            )}

            {!loading && error && (
              <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            )}

            {!loading &&
              !error &&
              filtered.map((task: any) => {
                const StatusIcon = statusConfig[task.estado]?.icon || Circle
                const statusColor = statusConfig[task.estado]?.colorClass || "text-muted-foreground"
                const isSelected = selectedTask === task.id
                const prioClass = PRIORITY_ROW_BADGE[task.prioridad] ?? PRIORITY_ROW_BADGE.media
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handleRowActivate(task.id)}
                    className={cn(
                      "w-full rounded-xl border bg-card px-4 py-3.5 text-left transition-all hover:shadow-sm",
                      isSelected ? "border-primary/35 shadow-sm ring-1 ring-primary/15" : "border-border",
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <StatusIcon className={cn("mt-0.5 h-4 w-4 shrink-0", statusColor)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{task.titulo}</p>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", prioClass)}>
                            {displayLabel(task.prioridad ?? "", prioridadLabel)}
                          </span>
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground sm:gap-3 sm:text-xs">
                          <span className="flex items-center gap-1">
                            <FolderKanban className="h-3 w-3 shrink-0" />
                            {task.proyecto?.nombre ?? "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3 shrink-0" />
                            {task.cliente?.nombre ?? "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3 shrink-0" />
                            {task.usuario?.nombre ?? "—"}
                          </span>
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3 shrink-0" />
                            {formatDate(task.fechaLimite)}
                          </span>
                        </div>
                      </div>
                      <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </div>
                  </button>
                )
              })}

            {!loading && !error && filtered.length === 0 && (
              <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center">
                <CheckSquare className="mx-auto mb-3 h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm font-medium text-foreground">No tasks found</p>
                <p className="mt-1 text-xs text-muted-foreground">Adjust the filters or try another search term.</p>
              </div>
            )}
          </div>

          {isXl && selected && (
            <div className="xl:col-span-2">
              <div className="overflow-hidden rounded-xl border border-border bg-card xl:sticky xl:top-6">
                <TaskContextualPanel
                  task={selected}
                  onTaskUpdated={() => refetch()}
                  onClose={clearSelection}
                  onEdit={() => {
                    setEditingItem(selected)
                    setFormOpen(true)
                  }}
                  onRequestDelete={() => setDeleteItem(selected)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      </SectionPage>

      {/* &lt; xl: contextual sheet (same panel body) */}
      <Sheet
        open={detailSheetOpen}
        onOpenChange={(open) => {
          if (!open) clearSelection()
        }}
      >
        <SheetContent
          side={isPhone ? "bottom" : "right"}
          className={cn(
            "flex w-full flex-col overflow-hidden p-0 sm:max-w-md",
            isPhone && "h-[90dvh] max-h-[90dvh] rounded-t-2xl",
          )}
        >
          <SheetTitle className="sr-only">Task details</SheetTitle>
          {selected && (
            <TaskContextualPanel
              task={selected}
              onTaskUpdated={() => refetch()}
              onClose={clearSelection}
              onEdit={() => {
                setEditingItem(selected)
                setFormOpen(true)
              }}
              onRequestDelete={() => setDeleteItem(selected)}
            />
          )}
        </SheetContent>
      </Sheet>

      <TareaForm
        open={formOpen}
        onClose={() => {
          setFormOpen(false)
          setEditingItem(null)
        }}
        onSuccess={() => {
          refetch()
          setFormOpen(false)
          setEditingItem(null)
        }}
        data={editingItem ?? undefined}
      />

      <ConfirmModal
        open={!!deleteItem}
        title="Delete task?"
        description={
          deleteItem ? `“${deleteItem.titulo ?? ""}” will be removed permanently.` : ""
        }
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setDeleteItem(null)}
        onConfirm={() => void handleDelete()}
      />
    </AppShell>
  )
}
