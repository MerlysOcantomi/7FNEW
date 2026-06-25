/**
 * Tasks · Work Queue — pure presentation logic.
 *
 * Groups the existing legacy `Tarea` rows (the only data the Tasks page
 * reads today, via `GET /api/tareas`) into attention-based work sections
 * and picks the "Current focus" protagonist.
 *
 * This module is intentionally pure: no network, no `db`, no React. It is
 * safe to import from the client page AND to unit-test with `tsx --test`.
 *
 * It derives EVERYTHING from real `Tarea` fields (`estado`, `prioridad`,
 * `fechaLimite`) and invents no data. Sections that have no backing in the
 * legacy model yet — "Proposed by Fanny" and "Suggested by 7F" — are owned
 * by the page as empty states; `summaryCounts` reports them as `0` here so
 * the page never shows a fabricated number.
 */

/** Minimal slice of a `Tarea` the queue logic needs. The page passes the
 *  full API row; the generic helpers below preserve that richer shape. */
export interface QueueTask {
  id: string
  estado?: string | null
  prioridad?: string | null
  fechaLimite?: string | null
}

export type WorkQueueSectionKey = "attention" | "ready" | "risks"

/** `estado` values that mean the task is no longer active work. */
const DONE_ESTADOS = new Set(["completada", "cancelada"])
/** `prioridad` values that pull a task into "Needs attention". */
const HIGH_PRIORITIES = new Set(["urgente", "alta"])

function norm(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

export function isDone(task: Pick<QueueTask, "estado">): boolean {
  return DONE_ESTADOS.has(norm(task.estado))
}

/** Active task whose due date is strictly in the past. Done tasks and
 *  tasks without a (valid) due date are never overdue. */
export function isOverdue(task: Pick<QueueTask, "estado" | "fechaLimite">, now: number): boolean {
  if (isDone(task)) return false
  if (!task.fechaLimite) return false
  const due = new Date(task.fechaLimite).getTime()
  if (Number.isNaN(due)) return false
  return due < now
}

/**
 * Assign a single active task to exactly one work section. Precedence
 * keeps the buckets mutually exclusive:
 *   1. `attention` — overdue OR high priority (urgente/alta): resolve first.
 *   2. `risks`     — `estado === "revision"`: in review / at risk.
 *   3. `ready`     — everything else still active: clear, no blocker.
 * Done tasks return `null` (they belong to "Recently completed").
 */
export function classifyTask(task: QueueTask, now: number): WorkQueueSectionKey | null {
  if (isDone(task)) return null
  if (isOverdue(task, now) || HIGH_PRIORITIES.has(norm(task.prioridad))) return "attention"
  if (norm(task.estado) === "revision") return "risks"
  return "ready"
}

export interface WorkQueueGroups<T extends QueueTask> {
  attention: T[]
  ready: T[]
  risks: T[]
  completed: T[]
}

/** Partition tasks into the work sections, preserving input order within
 *  each bucket (the page sorts upstream, so section order follows the
 *  active sort). */
export function groupWorkQueue<T extends QueueTask>(tasks: T[], now: number): WorkQueueGroups<T> {
  const groups: WorkQueueGroups<T> = { attention: [], ready: [], risks: [], completed: [] }
  for (const task of tasks) {
    if (isDone(task)) {
      groups.completed.push(task)
      continue
    }
    const key = classifyTask(task, now)
    if (key) groups[key].push(task)
  }
  return groups
}

export interface WorkQueueCounts {
  attention: number
  ready: number
  risks: number
  completed: number
  /** No legacy backing yet — always 0. The page renders an empty state
   *  rather than a fabricated count. */
  proposed: number
  /** No legacy backing yet — always 0. */
  suggested: number
}

export function summaryCounts(tasks: QueueTask[], now: number): WorkQueueCounts {
  const groups = groupWorkQueue(tasks, now)
  return {
    attention: groups.attention.length,
    ready: groups.ready.length,
    risks: groups.risks.length,
    completed: groups.completed.length,
    proposed: 0,
    suggested: 0,
  }
}

// ─── Work lenses (horizontal internal navigation) ────────────────────────────

/** Internal navigation of the Tasks page. Lenses replace the older
 *  summary-bar + tabs redundancy: a single row of chips drives what the
 *  work area shows. `risk` is singular here (the lens) and maps to the
 *  `risks` group below. */
export type WorkLensKey =
  | "all"
  | "attention"
  | "risk"
  | "ready"
  | "fanny"
  | "suggested"
  | "done"

export const WORK_LENSES: readonly WorkLensKey[] = [
  "all",
  "attention",
  "risk",
  "ready",
  "fanny",
  "suggested",
  "done",
] as const

export interface LensCounts {
  all: number
  attention: number
  risk: number
  ready: number
  fanny: number
  suggested: number
  done: number
}

/**
 * Count badges for each lens. `attention`/`risk`/`ready`/`done` come from the
 * real grouped tasks. `fanny` (proposals) and `suggested` (system intelligence)
 * have no legacy backing yet, so they default to 0 — the page renders honest
 * empty states for them rather than a fabricated number. `all` is the live
 * open-work total (everything except Done).
 */
export function lensCounts<T extends QueueTask>(
  groups: WorkQueueGroups<T>,
  extra?: { fanny?: number; suggested?: number },
): LensCounts {
  const attention = groups.attention.length
  const risk = groups.risks.length
  const ready = groups.ready.length
  const done = groups.completed.length
  const fanny = extra?.fanny ?? 0
  const suggested = extra?.suggested ?? 0
  return {
    all: attention + risk + ready + fanny + suggested,
    attention,
    risk,
    ready,
    fanny,
    suggested,
    done,
  }
}

const PRIORITY_RANK: Record<string, number> = { urgente: 0, alta: 1, media: 2, baja: 3 }

/** Earlier due date sorts first; missing/invalid dates sort last. */
function dueRank(task: QueueTask): number {
  if (!task.fechaLimite) return Number.POSITIVE_INFINITY
  const due = new Date(task.fechaLimite).getTime()
  return Number.isNaN(due) ? Number.POSITIVE_INFINITY : due
}

function priorityRank(task: QueueTask): number {
  return PRIORITY_RANK[norm(task.prioridad)] ?? 9
}

export interface CurrentFocus<T> {
  task: T
  /** Short, honest reason — derived from the task's own fields. */
  reason: string
}

/**
 * Pick the protagonist task to surface in "Current focus". Precedence:
 *   1. overdue first (soonest due among overdue)
 *   2. then high priority (urgente/alta), then soonest due
 *   3. then any open/active task (soonest due)
 *   4. fallback: the first task available
 * Returns `null` only when `tasks` is empty.
 */
export function pickCurrentFocus<T extends QueueTask>(tasks: T[], now: number): CurrentFocus<T> | null {
  if (tasks.length === 0) return null
  const active = tasks.filter((task) => !isDone(task))

  const overdue = active
    .filter((task) => isOverdue(task, now))
    .sort((a, b) => dueRank(a) - dueRank(b))
  if (overdue.length > 0) {
    return { task: overdue[0], reason: "Overdue — start here to pull the week back on track." }
  }

  const high = active
    .filter((task) => HIGH_PRIORITIES.has(norm(task.prioridad)))
    .sort((a, b) => priorityRank(a) - priorityRank(b) || dueRank(a) - dueRank(b))
  if (high.length > 0) {
    return { task: high[0], reason: "Highest-priority active task — the best use of your next block." }
  }

  if (active.length > 0) {
    const open = [...active].sort((a, b) => dueRank(a) - dueRank(b))
    return { task: open[0], reason: "Next open task — nothing blocking, ready to pick up." }
  }

  return { task: tasks[0], reason: "All caught up — most recent task." }
}
