"use client"

import { useState, useMemo, useCallback } from "react"
import { AppShell } from "@/components/app-shell"
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
  ChevronDown,
  FolderKanban,
  User,
  Users,
  Plus,
  ListFilter,
  Sparkles,
  Cpu,
  Play,
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
import {
  groupWorkQueue,
  pickCurrentFocus,
  type WorkQueueSectionKey,
} from "@modules/tareas/work-queue"

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

/** Section/accent tones mapped onto existing Midnight status tokens. */
type Tone = "danger" | "warning" | "success" | "accent" | "info" | "muted"
const TONE: Record<Tone, { text: string; dot: string; softBg: string }> = {
  danger: { text: "text-[var(--status-danger-text)]", dot: "bg-[var(--status-danger-text)]", softBg: "bg-[var(--status-danger-bg)]" },
  warning: { text: "text-[var(--status-warning-text)]", dot: "bg-[var(--status-warning-text)]", softBg: "bg-[var(--status-warning-bg)]" },
  success: { text: "text-[var(--status-success-text)]", dot: "bg-[var(--status-success-text)]", softBg: "bg-[var(--status-success-bg)]" },
  info: { text: "text-[var(--status-info-text)]", dot: "bg-[var(--status-info-text)]", softBg: "bg-[var(--status-info-bg)]" },
  accent: { text: "text-[var(--accent-primary)]", dot: "bg-[var(--accent-primary)]", softBg: "bg-[var(--accent-primary)]/12" },
  muted: { text: "text-[var(--text-secondary-light)]", dot: "bg-[var(--text-secondary-light)]", softBg: "bg-white/8" },
}

const SECTION_META: Record<WorkQueueSectionKey, { label: string; tone: Tone; hint: string }> = {
  attention: { label: "Needs attention", tone: "danger", hint: "resolve these first" },
  ready: { label: "Ready to do", tone: "success", hint: "clear — no blockers" },
  risks: { label: "Risks & delays", tone: "warning", hint: "in review or overdue" },
}

const STATUS_OPTIONS = ["all", "pendiente", "en_progreso", "revision", "completada", "cancelada"] as const
const PRIORITY_OPTIONS = ["all", "urgente", "alta", "media", "baja"] as const

function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

function isSameDay(a: number, b: number): boolean {
  const da = new Date(a)
  const db = new Date(b)
  return da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth() && da.getDate() === db.getDate()
}

/** Due-date label + tone, derived from the real `fechaLimite`. Past calendar
 *  days read as "Overdue", today reads as "Due today", everything else is a date. */
function formatDue(value: string | null | undefined, now: number): { label: string; tone: Tone } {
  if (!value) return { label: "No date", tone: "muted" }
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return { label: "No date", tone: "muted" }
  const dateStr = new Date(t).toLocaleDateString("en-US", { day: "numeric", month: "short" })
  if (t < startOfDay(now)) return { label: `Overdue · ${dateStr}`, tone: "danger" }
  if (isSameDay(t, now)) return { label: "Due today", tone: "warning" }
  return { label: dateStr, tone: "muted" }
}

/** Primary verb for a task, derived from `estado`. The real state mutations
 *  live in the contextual panel; this is the affordance label. */
function actionLabel(estado: string | null | undefined): string {
  switch ((estado ?? "").toLowerCase()) {
    case "pendiente":
      return "Start now"
    case "en_progreso":
      return "Continue"
    case "revision":
      return "Review"
    default:
      return "Open"
  }
}

function MetaItem({ icon: Icon, value }: { icon: typeof User; value: string }) {
  return (
    <span className="flex items-center gap-1">
      <Icon className="h-3 w-3 shrink-0" />
      {value}
    </span>
  )
}

/** A single counter in the smart summary bar. */
function SummaryCell({
  value,
  label,
  tone,
  emphasis,
}: {
  value: number
  label: string
  tone: Tone
  emphasis?: boolean
}) {
  const active = value > 0
  return (
    <div
      className={cn(
        shellCard,
        "flex flex-col gap-1.5 px-3.5 py-3",
        emphasis && active && "ring-1 ring-[var(--accent-primary)]/22",
      )}
    >
      <div className="flex items-center gap-2">
        <span className={cn("h-1.5 w-1.5 rounded-full", active ? TONE[tone].dot : "bg-[var(--text-secondary-light)]/40")} />
        <span className={cn("text-xl font-semibold tabular-nums", active ? shellText : shellMuted)}>{value}</span>
      </div>
      <span className={cn("text-[11px] leading-tight", shellMuted)}>{label}</span>
    </div>
  )
}

/** Section header (dot · label · count · hint). */
function SectionHeader({
  label,
  tone,
  count,
  hint,
}: {
  label: string
  tone: Tone
  count: number
  hint?: string
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2.5">
      <span className={cn("h-1.5 w-1.5 rounded-full", TONE[tone].dot)} />
      <h2 className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", TONE[tone].text)}>{label}</h2>
      <span className="inline-grid h-5 min-w-[20px] place-items-center rounded-md bg-white/[0.08] px-1.5 text-[11px] font-semibold text-[var(--text-secondary-light)] tabular-nums">
        {count}
      </span>
      {hint ? <span className={cn("text-[11px] italic", shellMuted)}>{hint}</span> : null}
    </div>
  )
}

/** A work-queue task card. Selecting it opens the contextual panel where
 *  the real state mutations (Start / Complete / Edit / Delete) live. */
function WorkTaskCard({
  task,
  selected,
  now,
  onSelect,
}: {
  task: TaskRecord
  selected: boolean
  now: number
  onSelect: (id: string) => void
}) {
  const StatusIcon = statusConfig[task.estado ?? ""]?.icon || Circle
  const statusColor = statusConfig[task.estado ?? ""]?.colorClass || "text-[var(--text-secondary-light)]"
  const prioClass = PRIORITY_ROW_BADGE[task.prioridad ?? ""] ?? PRIORITY_ROW_BADGE.media
  const due = formatDue(task.fechaLimite, now)
  return (
    <button
      type="button"
      onClick={() => onSelect(task.id)}
      className={cn(
        "w-full",
        shellRow,
        selected
          ? "border-[var(--accent-primary)]/45 shadow-[var(--app-shadow-subtle)] ring-1 ring-[var(--accent-primary)]/25"
          : null,
      )}
    >
      <div className="flex items-start gap-3">
        <StatusIcon className={cn("mt-0.5 h-4 w-4 shrink-0", statusColor)} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className={cn("min-w-0 flex-1 text-sm font-medium", shellText)}>{task.titulo}</p>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-medium", prioClass)}>
              {displayLabel(task.prioridad ?? "", prioridadLabel)}
            </span>
            <span className={cn("font-mono text-[11px] font-medium tabular-nums", TONE[due.tone].text)}>{due.label}</span>
          </div>
          <div className={cn("mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]", shellMuted)}>
            <MetaItem icon={FolderKanban} value={task.proyecto?.nombre ?? "—"} />
            <MetaItem icon={Users} value={task.cliente?.nombre ?? "—"} />
            <MetaItem icon={User} value={task.usuario?.nombre ?? "—"} />
          </div>
        </div>
        <ChevronRight className={cn("mt-0.5 h-4 w-4 shrink-0", shellMuted)} />
      </div>
    </button>
  )
}

/** Prepared-but-empty lane (Proposed by Fanny / Suggested by 7F). These have
 *  no legacy backing yet, so they show an honest empty state instead of a
 *  fabricated count. */
function EmptyLane({
  label,
  tone,
  icon: Icon,
  body,
}: {
  label: string
  tone: Tone
  icon: typeof Sparkles
  body: string
}) {
  return (
    <section>
      <SectionHeader label={label} tone={tone} count={0} />
      <div className="flex items-start gap-3 rounded-xl border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark)]/40 px-4 py-4">
        <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg", TONE[tone].softBg, TONE[tone].text)}>
          <Icon className="h-4 w-4" />
        </span>
        <p className={cn("text-[12.5px] leading-relaxed", shellMuted)}>{body}</p>
      </div>
    </section>
  )
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
  const [showCompleted, setShowCompleted] = useState(false)

  const query = new URLSearchParams()
  if (search.trim()) query.set("search", search.trim())
  if (filterStatus !== "all") query.set("estado", filterStatus)
  if (filterPriority !== "all") query.set("prioridad", filterPriority)
  const qs = query.toString()
  const url = qs ? `/api/tareas?${qs}` : "/api/tareas"

  const { data: apiData, loading, error, refetch } = useFetch<any>(url)
  const allTasks = Array.isArray(apiData) ? apiData : []

  /** Stable "now" for overdue/due-today bucketing — computed once on mount
   *  so `groups`/`focus` don't recompute on every render. */
  const now = useMemo(() => Date.now(), [])

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

  /** Work-queue grouping + protagonist — pure, derived from real fields. */
  const groups = useMemo(() => groupWorkQueue(filtered, now), [filtered, now])
  const focus = useMemo(() => pickCurrentFocus(filtered, now), [filtered, now])
  const counts = {
    attention: groups.attention.length,
    ready: groups.ready.length,
    risks: groups.risks.length,
    completed: groups.completed.length,
  }
  const activeTotal = counts.attention + counts.ready + counts.risks

  const selected = allTasks.find((t: any) => t.id === selectedTask) as TaskRecord | undefined

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

  /** AI-first lead line — honest summary of the queue, no fabricated data. */
  const summaryLine = (() => {
    if (loading) return "Reading your work queue…"
    if (error) return "Couldn't load the work queue."
    if (allTasks.length === 0) return "No tasks yet — create your first one to start the queue."
    const parts: string[] = []
    if (counts.attention) parts.push(`${counts.attention} need${counts.attention === 1 ? "s" : ""} attention`)
    if (counts.risks) parts.push(`${counts.risks} at risk`)
    if (counts.ready) parts.push(`${counts.ready} ready`)
    const lead = parts.length ? parts.join(" · ") : "You're all clear"
    return focus ? `${lead}. Start with “${focus.task.titulo}”.` : `${lead}.`
  })()

  return (
    <AppShell
      currentSection="tareas"
      breadcrumbs={[{ label: "7F" }, { label: "Tasks" }]}
      contentClassName="min-h-0 flex-1 max-w-[1500px]"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* ===== HEADER ===== */}
        <header className="shrink-0">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--text-secondary-light)]">
                Work Queue
              </p>
              <h1 className={cn("mt-1.5 text-2xl font-semibold tracking-tight text-balance", shellText)}>Tasks</h1>
              <p className={cn("mt-1 text-sm", shellMuted)}>Work system · all your work, not just today</p>
              <p className={cn("mt-2 flex items-start gap-2 text-[13px] leading-relaxed", shellMuted)}>
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
                <span>{summaryLine}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="origin-right scale-90 sm:scale-100">
                <ExportCSVButton
                  data={filtered}
                  columns={TAREA_COLUMNS}
                  filename={`tasks-${new Date().toISOString().slice(0, 10)}`}
                  label="Export CSV"
                  className="border-[var(--border-dark)] bg-[var(--app-surface-dark)] text-[var(--text-primary-light)] hover:bg-[var(--app-surface-dark-elevated)]"
                />
              </div>
              <Button type="button" size="sm" onClick={() => { setEditingItem(null); setFormOpen(true) }}>
                <Plus className="h-4 w-4" />
                New task
              </Button>
            </div>
          </div>

          {/* ===== SMART SUMMARY BAR ===== */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <SummaryCell value={counts.attention} label="Needs attention" tone="danger" emphasis />
            <SummaryCell value={counts.ready} label="Ready" tone="success" />
            <SummaryCell value={counts.risks} label="Risks & delays" tone="warning" />
            <SummaryCell value={0} label="Proposed by Fanny" tone="accent" />
            <SummaryCell value={0} label="Suggested by 7F" tone="info" />
          </div>

          {/* ===== SEARCH + FILTERS ===== */}
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className={cn("flex min-w-[180px] flex-1 items-center gap-2 px-3 py-2", shellInset)}>
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
            <div className="flex flex-wrap items-center gap-2">
              <span className={cn("flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider", shellMuted)}>
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
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger
                  size="sm"
                  className={cn(
                    "h-9 w-full min-w-[8rem] border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] sm:w-[140px]",
                    shellText,
                    "[&_svg]:text-[var(--text-secondary-light)]",
                  )}
                >
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  {STATUS_OPTIONS.filter((s) => s !== "all").map((s) => (
                    <SelectItem key={s} value={s}>
                      {displayLabel(s, estadoLabel)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={filterPriority} onValueChange={setFilterPriority}>
                <SelectTrigger
                  size="sm"
                  className={cn(
                    "h-9 w-full min-w-[8rem] border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] sm:w-[140px]",
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
                    "h-9 w-full min-w-[8rem] border-[var(--border-dark)] bg-[var(--app-surface-dark-elevated)] sm:w-[160px]",
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
        </header>

        {/* ===== BODY: work sections + contextual panel ===== */}
        <div className="mt-5 flex min-h-0 flex-1 gap-4">
          {/* WORK SECTIONS (internal scroll) */}
          <div className="-mr-1 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pr-1 pb-2">
            {loading && (
              <div className={cn(shellCard, "border-dashed border-[var(--border-dark)] p-12 text-center")}>
                <p className={cn("text-sm font-medium", shellText)}>Loading...</p>
              </div>
            )}

            {!loading && error && (
              <div className={cn(shellCard, "border-dashed border-[var(--border-dark)] p-12 text-center")}>
                <p className="text-sm font-medium text-destructive">{error}</p>
              </div>
            )}

            {!loading && !error && (
              <>
                {/* CURRENT FOCUS */}
                {focus && (
                  <button
                    type="button"
                    onClick={() => handleRowActivate(focus.task.id)}
                    className={cn(
                      "relative w-full overflow-hidden rounded-2xl border border-[var(--accent-primary)]/35 bg-[var(--app-surface-dark)] p-5 text-left shadow-[var(--app-shadow-subtle)] ring-1 ring-[var(--accent-primary)]/15 transition-all",
                      "hover:ring-[var(--accent-primary)]/30",
                    )}
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(139,92,255,0.18),transparent_70%)]"
                    />
                    <div className="relative flex items-start gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--status-danger-text)] opacity-60" />
                            <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--status-danger-text)]" />
                          </span>
                          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-primary)]">
                            Current focus
                          </span>
                          <span className={cn("text-[11px]", shellMuted)}>· start here</span>
                        </div>
                        <p className={cn("text-base font-semibold leading-snug", shellText)}>{focus.task.titulo}</p>
                        <p className={cn("mt-1.5 max-w-xl text-[13px] leading-relaxed", shellMuted)}>{focus.reason}</p>
                        <div className={cn("mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]", shellMuted)}>
                          <MetaItem icon={FolderKanban} value={focus.task.proyecto?.nombre ?? "—"} />
                          <MetaItem icon={Users} value={focus.task.cliente?.nombre ?? "No client"} />
                          <span className={cn("font-mono font-medium", TONE[formatDue(focus.task.fechaLimite, now).tone].text)}>
                            {formatDue(focus.task.fechaLimite, now).label}
                          </span>
                        </div>
                      </div>
                      <span className="hidden shrink-0 items-center gap-2 self-center rounded-lg bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--app-shadow-subtle)] sm:inline-flex">
                        <Play className="h-4 w-4" />
                        {actionLabel(focus.task.estado)}
                      </span>
                    </div>
                  </button>
                )}

                {/* ATTENTION / READY / RISKS — only render when populated */}
                {(["attention", "risks", "ready"] as WorkQueueSectionKey[]).map((key) => {
                  const items = groups[key]
                  if (items.length === 0) return null
                  const meta = SECTION_META[key]
                  return (
                    <section key={key}>
                      <SectionHeader label={meta.label} tone={meta.tone} count={items.length} hint={meta.hint} />
                      <div className="flex flex-col gap-2">
                        {items.map((task: TaskRecord) => (
                          <WorkTaskCard
                            key={task.id}
                            task={task}
                            selected={selectedTask === task.id}
                            now={now}
                            onSelect={handleRowActivate}
                          />
                        ))}
                      </div>
                    </section>
                  )
                })}

                {/* All-clear state when there is data but no active work */}
                {activeTotal === 0 && allTasks.length > 0 && (
                  <div className={cn(shellCard, "border-dashed border-[var(--border-dark)] p-10 text-center")}>
                    <CheckCircle2 className={cn("mx-auto mb-3 h-8 w-8", TONE.success.text)} />
                    <p className={cn("text-sm font-medium", shellText)}>No active work in this view</p>
                    <p className={cn("mt-1 text-xs", shellMuted)}>Adjust the filters, or enjoy the clear queue.</p>
                  </div>
                )}

                {/* Truly empty (no tasks at all) */}
                {allTasks.length === 0 && (
                  <div className={cn(shellCard, "border-dashed border-[var(--border-dark)] p-12 text-center")}>
                    <CheckSquare className={cn("mx-auto mb-3 h-8 w-8 opacity-40", shellMuted)} />
                    <p className={cn("text-sm font-medium", shellText)}>No tasks found</p>
                    <p className={cn("mt-1 text-xs", shellMuted)}>Create a task or adjust the filters.</p>
                  </div>
                )}

                {/* PROPOSED BY FANNY — prepared empty lane (reuses WorkspaceTask proposals in a later PR) */}
                <EmptyLane
                  label="Proposed by Fanny"
                  tone="accent"
                  icon={Sparkles}
                  body="Tasks Fanny drafts from Inbox conversations, follow-ups, and signals will land here for you to approve. Nothing proposed right now."
                />

                {/* SUGGESTED BY 7F — prepared empty lane (system suggestions land here later) */}
                <EmptyLane
                  label="Suggested by 7F"
                  tone="info"
                  icon={Cpu}
                  body="7F will surface cleanups here — duplicates, stale tasks, and stuck work worth a second look. No suggestions yet."
                />

                {/* RECENTLY COMPLETED — collapsed */}
                {counts.completed > 0 && (
                  <section>
                    <button
                      type="button"
                      onClick={() => setShowCompleted((v) => !v)}
                      className="flex items-center gap-2"
                    >
                      <ChevronDown
                        className={cn("h-3.5 w-3.5 transition-transform", shellMuted, showCompleted ? "" : "-rotate-90")}
                      />
                      <span className={cn("text-[11px] font-semibold uppercase tracking-[0.12em]", shellMuted)}>
                        Recently completed
                      </span>
                      <span className="inline-grid h-5 min-w-[20px] place-items-center rounded-md bg-white/[0.08] px-1.5 text-[11px] font-semibold text-[var(--text-secondary-light)] tabular-nums">
                        {counts.completed}
                      </span>
                    </button>
                    {showCompleted && (
                      <div className="mt-3 flex flex-col gap-2">
                        {groups.completed.map((task: TaskRecord) => (
                          <WorkTaskCard
                            key={task.id}
                            task={task}
                            selected={selectedTask === task.id}
                            now={now}
                            onSelect={handleRowActivate}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </div>

          {/* RIGHT CONTEXTUAL PANEL (xl+) — contained, internal scroll */}
          {isXl && selected && (
            <aside className="hidden min-h-0 xl:flex xl:w-[372px] xl:shrink-0">
              <div className={cn("flex h-full min-h-0 w-full overflow-hidden", shellCard)}>
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
            </aside>
          )}
        </div>
      </div>

      {/* < xl: contextual sheet (same panel body) */}
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
        description={deleteItem ? `“${deleteItem.titulo ?? ""}” will be removed permanently.` : ""}
        confirmLabel="Delete"
        variant="danger"
        onCancel={() => setDeleteItem(null)}
        onConfirm={() => void handleDelete()}
      />
    </AppShell>
  )
}
