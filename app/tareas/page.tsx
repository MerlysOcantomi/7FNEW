"use client"

import { useState, useMemo, useCallback } from "react"
import { AppShell } from "@/components/app-shell"
import { TaskContextualPanel, type TaskRecord } from "@/components/tasks/task-contextual-panel"
import { useMediaQuery } from "@/hooks/use-media-query"
import { cn } from "@/lib/utils"
import { displayLabel, prioridadLabel, apiDelete } from "@/lib/api-client"
import { useFetch } from "@/hooks/use-fetch"
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronRight,
  Circle,
  Clock,
  Cpu,
  FolderKanban,
  Pause,
  Play,
  Plus,
  Sparkles,
  User,
  Users,
} from "lucide-react"
import { TareaForm } from "@/components/forms/tarea-form"
import { ConfirmModal } from "@/components/confirm-modal"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import { ExportCSVButton } from "@/components/export-button"
import { TAREA_COLUMNS } from "@/lib/export/csv"
import {
  groupWorkQueue,
  lensCounts,
  pickCurrentFocus,
  type WorkLensKey,
  type WorkQueueSectionKey,
} from "@modules/tareas/work-queue"

const XL_MEDIA = "(min-width: 1280px)"
const PHONE_MEDIA = "(max-width: 640px)"

/** Elevated surfaces on shell canvas — same token family as inbox intelligence / app surfaces. */
const shellCard =
  "rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] shadow-[var(--app-shadow-subtle)]"
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

/** Tones mapped onto existing Midnight status tokens. */
type Tone = "danger" | "warning" | "success" | "accent" | "info" | "muted"
const TONE: Record<Tone, { text: string; dot: string; softBg: string }> = {
  danger: { text: "text-[var(--status-danger-text)]", dot: "bg-[var(--status-danger-text)]", softBg: "bg-[var(--status-danger-bg)]" },
  warning: { text: "text-[var(--status-warning-text)]", dot: "bg-[var(--status-warning-text)]", softBg: "bg-[var(--status-warning-bg)]" },
  success: { text: "text-[var(--status-success-text)]", dot: "bg-[var(--status-success-text)]", softBg: "bg-[var(--status-success-bg)]" },
  info: { text: "text-[var(--status-info-text)]", dot: "bg-[var(--status-info-text)]", softBg: "bg-[var(--status-info-bg)]" },
  accent: { text: "text-[var(--accent-primary)]", dot: "bg-[var(--accent-primary)]", softBg: "bg-[var(--accent-primary)]/12" },
  muted: { text: "text-[var(--text-secondary-light)]", dot: "bg-[var(--text-secondary-light)]", softBg: "bg-white/8" },
}

/** Swimlane metadata (maps to WorkQueueSectionKey). */
const SECTION_META: Record<WorkQueueSectionKey, { label: string; tone: Tone; hint: string }> = {
  attention: { label: "Needs attention", tone: "danger", hint: "resolve these first" },
  risks: { label: "Risks & delays", tone: "warning", hint: "overdue or in review" },
  ready: { label: "Ready to do", tone: "success", hint: "clear — no blockers" },
}

/** Lens chips — internal navigation. `tone` drives the dot/active accent. */
const LENS_META: { key: WorkLensKey; label: string; tone: Tone }[] = [
  { key: "all", label: "All Work", tone: "accent" },
  { key: "attention", label: "Attention", tone: "danger" },
  { key: "risk", label: "Risks", tone: "warning" },
  { key: "ready", label: "Ready", tone: "success" },
  { key: "fanny", label: "Fanny", tone: "accent" },
  { key: "suggested", label: "Suggested", tone: "info" },
  { key: "done", label: "Done", tone: "muted" },
]

/** Honest, prepared empty states per lens — no fabricated data. */
const LENS_EMPTY: Record<string, { icon: typeof Sparkles; title: string; body: string; tone: Tone }> = {
  attention: {
    icon: CheckCircle2,
    tone: "success",
    title: "Nothing needs attention",
    body: "No overdue or high-priority work right now. 7F surfaces items here the moment something needs you.",
  },
  risk: {
    icon: CheckCircle2,
    tone: "success",
    title: "No risks or delays",
    body: "Nothing overdue or in review. As your queue grows, work slipping past its date will surface here.",
  },
  ready: {
    icon: Play,
    tone: "success",
    title: "Nothing queued as ready",
    body: "When tasks are unblocked and ready to start, they collect here so you can pick one and go.",
  },
  fanny: {
    icon: Sparkles,
    tone: "accent",
    title: "No proposals right now",
    body: "When Fanny spots work in your messages, follow-ups or client signals, it'll wait here for your approval.",
  },
  suggested: {
    icon: Cpu,
    tone: "info",
    title: "7F has no system suggestions yet",
    body: "As your work queue grows, this area will surface duplicates, stale tasks, and improvement opportunities.",
  },
  done: {
    icon: CheckCircle2,
    tone: "muted",
    title: "Nothing completed yet",
    body: "Finished tasks appear here so you can look back on what's shipped.",
  },
  allClear: {
    icon: CheckCircle2,
    tone: "success",
    title: "You're all caught up",
    body: "No open work in the queue. New tasks, proposals from Fanny, and 7F suggestions will land here.",
  },
  noTasks: {
    icon: CheckSquare,
    tone: "muted",
    title: "No tasks yet",
    body: "Create your first task to start your work queue.",
  },
}

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

/** Due-date label + tone, derived from the real `fechaLimite`. */
function formatDue(value: string | null | undefined, now: number): { label: string; tone: Tone } {
  if (!value) return { label: "No date", tone: "muted" }
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return { label: "No date", tone: "muted" }
  const dateStr = new Date(t).toLocaleDateString("en-US", { day: "numeric", month: "short" })
  if (t < startOfDay(now)) return { label: `Overdue · ${dateStr}`, tone: "danger" }
  if (isSameDay(t, now)) return { label: "Due today", tone: "warning" }
  return { label: dateStr, tone: "muted" }
}

function formatShortDate(value: string | null | undefined): string {
  if (!value) return ""
  const t = new Date(value).getTime()
  if (Number.isNaN(t)) return ""
  return new Date(t).toLocaleDateString("en-US", { day: "numeric", month: "short" })
}

/** Primary verb derived from `estado`. The real mutations live in the panel. */
function focusAction(task: { estado?: string }): string {
  switch ((task.estado ?? "").toLowerCase()) {
    case "en_progreso":
      return "Continue"
    case "revision":
      return "Review"
    default:
      return "Start now"
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

/** Section header (dot · label · count · hint). */
function SectionHeader({ label, tone, count, hint }: { label: string; tone: Tone; count: number; hint?: string }) {
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

/** A work-queue task card. Selecting it opens the contextual panel. */
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

/** Light "Done" row — strikethrough title + completed date. Selectable. */
function DoneRow({ task, onSelect }: { task: TaskRecord; onSelect: (id: string) => void }) {
  const extra = task as TaskRecord & { completedAt?: string | null; updatedAt?: string | null }
  const when = formatShortDate(extra.completedAt ?? extra.updatedAt ?? null)
  return (
    <button
      type="button"
      onClick={() => onSelect(task.id)}
      className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-dark)] bg-[var(--app-surface-dark)] px-4 py-3 text-left transition-colors hover:bg-[var(--app-surface-dark-elevated)]"
    >
      <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-[var(--status-success-bg)] text-[var(--status-success-text)]">
        <Check className="h-3 w-3" />
      </span>
      <p className={cn("min-w-0 flex-1 truncate text-[13px] line-through", shellMuted)}>{task.titulo}</p>
      {when ? <span className={cn("shrink-0 font-mono text-[11px]", shellMuted)}>{when}</span> : null}
    </button>
  )
}

/** Honest empty / all-clear state for a lens. */
function LensEmpty({ icon: Icon, title, body, tone }: { icon: typeof Sparkles; title: string; body: string; tone: Tone }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[var(--border-dark)] bg-[var(--app-surface-dark)]/40 px-8 py-14 text-center">
      <span className={cn("grid h-12 w-12 place-items-center rounded-2xl", TONE[tone].softBg, TONE[tone].text)}>
        <Icon className="h-5 w-5" />
      </span>
      <p className={cn("mt-3.5 text-sm font-semibold", shellText)}>{title}</p>
      <p className={cn("mt-1.5 max-w-sm text-[12.5px] leading-relaxed", shellMuted)}>{body}</p>
    </div>
  )
}

export default function TareasPage() {
  const isXl = useMediaQuery(XL_MEDIA)
  const isPhone = useMediaQuery(PHONE_MEDIA)

  const [activeLens, setActiveLens] = useState<WorkLensKey>("all")
  const [selectedTask, setSelectedTask] = useState<string | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<TaskRecord | null>(null)
  const [deleteItem, setDeleteItem] = useState<TaskRecord | null>(null)

  // Fetch the whole queue (capped) and slice client-side via lenses.
  const { data: apiData, loading, error, refetch } = useFetch<any>("/api/tareas?pageSize=100")
  const allTasks = Array.isArray(apiData) ? apiData : []

  /** Stable "now" for overdue/due-today bucketing — computed once on mount. */
  const now = useMemo(() => Date.now(), [])

  /** Sort by due date (soonest first, undated last) for lane ordering. */
  const sortedTasks = useMemo(() => {
    return [...allTasks].sort((a: any, b: any) => {
      const da = a.fechaLimite ? new Date(a.fechaLimite).getTime() : Number.POSITIVE_INFINITY
      const db = b.fechaLimite ? new Date(b.fechaLimite).getTime() : Number.POSITIVE_INFINITY
      return da - db
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiData])

  const groups = useMemo(() => groupWorkQueue(sortedTasks, now), [sortedTasks, now])
  const focus = useMemo(() => pickCurrentFocus(sortedTasks, now), [sortedTasks, now])
  const counts = useMemo(() => lensCounts(groups), [groups])

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
    if (counts.risk) parts.push(`${counts.risk} at risk`)
    if (counts.ready) parts.push(`${counts.ready} ready`)
    const lead = parts.length ? parts.join(" · ") : "You're all clear"
    return focus ? `${lead}. I'd start with “${focus.task.titulo}”.` : `${lead}.`
  })()

  /** Render one swimlane for a section. */
  const renderLane = (key: WorkQueueSectionKey) => {
    const items = groups[key]
    const meta = SECTION_META[key]
    return (
      <section key={key}>
        <SectionHeader label={meta.label} tone={meta.tone} count={items.length} hint={meta.hint} />
        <div className="flex flex-col gap-2">
          {items.map((task: TaskRecord) => (
            <WorkTaskCard key={task.id} task={task} selected={selectedTask === task.id} now={now} onSelect={handleRowActivate} />
          ))}
        </div>
      </section>
    )
  }

  /** Work area content driven by the active lens. */
  const renderWorkArea = () => {
    if (loading) {
      return (
        <div className={cn(shellCard, "border-dashed border-[var(--border-dark)] p-12 text-center")}>
          <p className={cn("text-sm font-medium", shellText)}>Loading...</p>
        </div>
      )
    }
    if (error) {
      return (
        <div className={cn(shellCard, "border-dashed border-[var(--border-dark)] p-12 text-center")}>
          <p className="text-sm font-medium text-destructive">{error}</p>
        </div>
      )
    }
    if (allTasks.length === 0) return <LensEmpty {...LENS_EMPTY.noTasks} />

    switch (activeLens) {
      case "all": {
        const lanes: WorkQueueSectionKey[] = (["attention", "risks", "ready"] as const).filter(
          (k) => groups[k].length > 0,
        )
        if (lanes.length === 0) return <LensEmpty {...LENS_EMPTY.allClear} />
        return lanes.map(renderLane)
      }
      case "attention":
        return groups.attention.length ? renderLane("attention") : <LensEmpty {...LENS_EMPTY.attention} />
      case "risk":
        return groups.risks.length ? renderLane("risks") : <LensEmpty {...LENS_EMPTY.risk} />
      case "ready":
        return groups.ready.length ? renderLane("ready") : <LensEmpty {...LENS_EMPTY.ready} />
      case "fanny":
        // Legacy Tarea has no "proposed" backing yet → prepared empty lane.
        return <LensEmpty {...LENS_EMPTY.fanny} />
      case "suggested":
        // No system-suggestion engine yet → prepared empty lane.
        return <LensEmpty {...LENS_EMPTY.suggested} />
      case "done":
        return groups.completed.length ? (
          <div className="flex flex-col gap-2">
            {groups.completed.map((task: TaskRecord) => (
              <DoneRow key={task.id} task={task} onSelect={handleRowActivate} />
            ))}
          </div>
        ) : (
          <LensEmpty {...LENS_EMPTY.done} />
        )
      default:
        return null
    }
  }

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
              <div className="flex items-center gap-2.5">
                <h1 className={cn("text-2xl font-semibold tracking-tight text-balance", shellText)}>Tasks</h1>
                <span className="rounded-md border border-[var(--accent-primary)]/35 bg-[var(--accent-primary)]/12 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--accent-primary)]">
                  Work Queue
                </span>
              </div>
              <p className={cn("mt-1 text-xs", shellMuted)}>Work system · all your work, not just today</p>
              <p className={cn("mt-2 flex items-start gap-2 text-[13px] leading-relaxed", shellMuted)}>
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--accent-primary)]" />
                <span>{summaryLine}</span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <div className="origin-right scale-90 sm:scale-100">
                <ExportCSVButton
                  data={sortedTasks}
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
        </header>

        {/* ===== CURRENT FOCUS (always visible) ===== */}
        <div className="mt-4 shrink-0">
          {focus ? (
            <button
              type="button"
              onClick={() => handleRowActivate(focus.task.id)}
              className="relative w-full overflow-hidden rounded-2xl border border-[var(--accent-primary)]/35 bg-[var(--app-surface-dark)] p-5 text-left shadow-[var(--app-shadow-subtle)] ring-1 ring-[var(--accent-primary)]/15 transition-all hover:ring-[var(--accent-primary)]/30"
            >
              <span
                aria-hidden
                className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[radial-gradient(circle,rgba(139,92,255,0.18),transparent_70%)]"
              />
              <div className="relative flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--status-danger-text)] opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--status-danger-text)]" />
                    </span>
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--accent-primary)]">
                      Current focus
                    </span>
                    <span className={cn("text-[11px]", shellMuted)}>· {focus.reason}</span>
                  </div>
                  <p className={cn("truncate text-base font-semibold leading-snug", shellText)}>{focus.task.titulo}</p>
                  <div className={cn("mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]", shellMuted)}>
                    <MetaItem icon={FolderKanban} value={focus.task.proyecto?.nombre ?? "—"} />
                    <MetaItem icon={Users} value={focus.task.cliente?.nombre ?? "No client"} />
                    <span className={cn("font-mono font-medium", TONE[formatDue(focus.task.fechaLimite, now).tone].text)}>
                      {formatDue(focus.task.fechaLimite, now).label}
                    </span>
                  </div>
                </div>
                <span className="hidden shrink-0 items-center gap-2 self-center rounded-lg bg-[var(--accent-primary)] px-4 py-2.5 text-sm font-semibold text-white shadow-[var(--app-shadow-subtle)] sm:inline-flex">
                  <Play className="h-4 w-4" />
                  {focusAction(focus.task)}
                </span>
              </div>
            </button>
          ) : (
            <div className={cn(shellCard, "flex items-center gap-3 p-4")}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[var(--status-success-bg)] text-[var(--status-success-text)]">
                <CheckCircle2 className="h-4 w-4" />
              </span>
              <div>
                <p className={cn("text-sm font-semibold", shellText)}>
                  {allTasks.length === 0 ? "No tasks yet" : "You're all caught up"}
                </p>
                <p className={cn("text-[12px]", shellMuted)}>
                  {allTasks.length === 0
                    ? "Create your first task to start your work queue."
                    : "No open work needs you right now."}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ===== HORIZONTAL WORK LENSES ===== */}
        <div className="mt-4 shrink-0">
          <div className="flex gap-2 overflow-x-auto pb-1">
            {LENS_META.map((lens) => {
              const active = activeLens === lens.key
              const count = counts[lens.key]
              return (
                <button
                  key={lens.key}
                  type="button"
                  onClick={() => setActiveLens(lens.key)}
                  className={cn(
                    "inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-[13px] font-semibold transition-colors",
                    active
                      ? "border-[var(--accent-primary)]/45 bg-[var(--app-surface-dark-elevated)] text-[var(--text-primary-light)]"
                      : "border-[var(--border-dark)] bg-[var(--app-surface-dark)] text-[var(--text-secondary-light)] hover:bg-[var(--app-surface-dark-elevated)]",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 rounded-full", active ? TONE[lens.tone].dot : "bg-[var(--text-secondary-light)]/50")} />
                  {lens.label}
                  <span
                    className={cn(
                      "inline-grid h-[18px] min-w-[18px] place-items-center rounded-md px-1 text-[10.5px] font-bold tabular-nums",
                      active
                        ? "bg-[var(--accent-primary)]/18 text-[var(--accent-primary)]"
                        : "bg-white/[0.06] text-[var(--text-secondary-light)]",
                    )}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ===== BODY: work area + contextual panel ===== */}
        <div className="mt-4 flex min-h-0 flex-1 gap-5 border-t border-[var(--border-dark)] pt-4">
          <div className="-mr-1 flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto pb-2 pr-1">
            {renderWorkArea()}
          </div>

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
