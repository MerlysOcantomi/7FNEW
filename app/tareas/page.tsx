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

/** Elevated surfaces on shell canvas — same token family as inbox intelligence / app surfaces (not light cards). */
const shellCard =
  "rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] shadow-[var(--app-shadow-subtle)]"
const shellInset =
  "rounded-lg border border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
const shellText = "text-[var(--text-primary-light)]"
const shellMuted = "text-[var(--text-secondary-light)]"
/** List row on canvas — same fill family as cards, no extra outer shadow */
const shellRow =
  "rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-3.5 text-left transition-all hover:bg-[var(--app-surface-dark-elevated)] hover:shadow-[var(--app-shadow-subtle)]"

/* Status icons — shared status token tints */
const statusConfig: Record<string, { icon: typeof Circle; colorClass: string }> = {
  pendiente: { icon: Circle, colorClass: "text-[var(--text-secondary-light)]" },
  en_progreso: { icon: Clock, colorClass: "text-[var(--status-info-text)]" },
  revision: { icon: AlertTriangle, colorClass: "text-[var(--status-warning-text)]" },
  completada: { icon: CheckCircle2, colorClass: "text-[var(--status-success-text)]" },
  cancelada: { icon: Pause, colorClass: "text-[var(--text-secondary-light)]" },
}

const PRIORITY_ROW_BADGE: Record<string, string> = {
  urgente: "bg-[var(--status-danger-bg)] text-[var(--status-danger-text)]",
  alta: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)]",
  media: "bg-[var(--status-info-bg)] text-[var(--status-info-text)]",
  baja: "bg-white/12 text-[var(--text-secondary-light)]",
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
          <div
            className={cn(
              "rounded-xl border border-primary/35 bg-[var(--app-surface-dark)] p-4 shadow-[var(--app-shadow-subtle)] ring-1 ring-[var(--accent-primary)]/22",
            )}
          >
            <p className={cn("text-xs font-medium uppercase tracking-wider", shellMuted)}>Needs attention</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", shellText)}>{urgentCount}</p>
            <p className={cn("mt-0.5 text-[10px]", shellMuted)}>Urgent / high · not done</p>
          </div>
          <div className={cn(shellCard, "p-4")}>
            <p className={cn("text-xs font-medium uppercase tracking-wider", shellMuted)}>Pending</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", shellText)}>{pendingCount}</p>
          </div>
          <div className={cn(shellCard, "p-4")}>
            <p className={cn("text-xs font-medium uppercase tracking-wider", shellMuted)}>In progress</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", shellText)}>{inProgressCount}</p>
          </div>
          <div className={cn(shellCard, "p-4")}>
            <p className={cn("text-xs font-medium uppercase tracking-wider", shellMuted)}>Total</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", shellText)}>{allTasks.length}</p>
          </div>
        </div>

        {/* Search + filters — single tray aligned with KPI surfaces */}
        <div className={cn(shellCard, "p-4")}>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className={cn("flex flex-1 items-center gap-2 px-3 py-2", shellInset)}>
                <Search className={cn("h-4 w-4 shrink-0", shellMuted)} />
                <input
                  type="text"
                  placeholder="Search task, project, or owner..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={cn(
                    "w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-secondary-light)]",
                    shellText,
                  )}
                />
              </div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <span
                  className={cn(
                    "flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider",
                    shellMuted,
                  )}
                >
                  <ListFilter className="h-3 w-3 shrink-0" />
                  Sort
                </span>
                <div className="flex rounded-lg border border-[var(--border-dark)] bg-black/25 p-0.5">
                  <button
                    type="button"
                    onClick={() => setSortBy("due")}
                    className={cn(
                      "min-h-9 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                      sortBy === "due"
                        ? "bg-[var(--accent-primary)]/45 text-white shadow-sm"
                        : cn(shellMuted, "hover:text-[var(--text-primary-light)]"),
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
                        ? "bg-[var(--accent-primary)]/45 text-white shadow-sm"
                        : cn(shellMuted, "hover:text-[var(--text-primary-light)]"),
                    )}
                  >
                    Priority
                  </button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border-dark)] pt-4">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setFilterStatus(s)}
                  className={cn(
                    "inline-flex h-9 items-center whitespace-nowrap rounded-full px-3 text-xs font-medium transition-colors",
                    filterStatus === s
                      ? "bg-[var(--accent-primary)]/45 text-white shadow-sm"
                      : cn(
                          "bg-white/[0.08] hover:bg-white/[0.12]",
                          shellMuted,
                          "hover:text-[var(--text-primary-light)]",
                        ),
                  )}
                >
                  {s === "all" ? "All" : displayLabel(s, estadoLabel)}
                </button>
              ))}
              <span className="mx-1 hidden h-6 w-px bg-[var(--border-dark)] sm:block" aria-hidden />
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger
                  size="sm"
                  className={cn(
                    "h-9 w-full min-w-[8.5rem] border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] sm:w-[140px]",
                    shellText,
                    "[&_svg]:text-[var(--text-secondary-light)]",
                  )}
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
                  className={cn(
                    "h-9 w-full min-w-[8.5rem] border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] sm:w-[160px]",
                    shellText,
                    "[&_svg]:text-[var(--text-secondary-light)]",
                  )}
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
                  className="border-[var(--border-dark)] bg-[var(--app-surface-dark)] text-[var(--text-primary-light)] hover:bg-[var(--app-surface-dark-elevated)]"
                />
              </div>
            </div>

            {loading && (
              <div
                className={cn(
                  shellCard,
                  "border-dashed border-[var(--border-dark)] p-12 text-center",
                )}
              >
                <p className={cn("text-sm font-medium", shellText)}>Loading...</p>
              </div>
            )}

            {!loading && error && (
              <div
                className={cn(
                  shellCard,
                  "border-dashed border-[var(--border-dark)] p-12 text-center",
                )}
              >
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            )}

            {!loading &&
              !error &&
              filtered.map((task: any) => {
                const StatusIcon = statusConfig[task.estado]?.icon || Circle
                const statusColor =
                  statusConfig[task.estado]?.colorClass || "text-[var(--text-secondary-light)]"
                const isSelected = selectedTask === task.id
                const prioClass = PRIORITY_ROW_BADGE[task.prioridad] ?? PRIORITY_ROW_BADGE.media
                return (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => handleRowActivate(task.id)}
                    className={cn(
                      "w-full",
                      shellRow,
                      isSelected
                        ? "border-[var(--accent-primary)]/45 shadow-[var(--app-shadow-subtle)] ring-1 ring-[var(--accent-primary)]/25"
                        : null,
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <StatusIcon className={cn("mt-0.5 h-4 w-4 shrink-0", statusColor)} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className={cn("text-sm font-medium", shellText)}>{task.titulo}</p>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", prioClass)}>
                            {displayLabel(task.prioridad ?? "", prioridadLabel)}
                          </span>
                        </div>
                        <div
                          className={cn(
                            "mt-1 flex flex-wrap items-center gap-2 text-[11px] sm:gap-3 sm:text-xs",
                            shellMuted,
                          )}
                        >
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
                      <ChevronRight className={cn("mt-0.5 h-4 w-4 shrink-0", shellMuted)} />
                    </div>
                  </button>
                )
              })}

            {!loading && !error && filtered.length === 0 && (
              <div
                className={cn(
                  shellCard,
                  "border-dashed border-[var(--border-dark)] p-12 text-center",
                )}
              >
                <CheckSquare className={cn("mx-auto mb-3 h-8 w-8 opacity-40", shellMuted)} />
                <p className={cn("text-sm font-medium", shellText)}>No tasks found</p>
                <p className={cn("mt-1 text-xs", shellMuted)}>
                  Adjust the filters or try another search term.
                </p>
              </div>
            )}
          </div>

          {isXl && selected && (
            <div className="xl:col-span-2">
              <div className={cn("overflow-hidden xl:sticky xl:top-6", shellCard)}>
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
            "flex w-full flex-col overflow-hidden border-[var(--border-dark)] bg-[var(--app-surface-dark)] p-0 sm:max-w-md",
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
