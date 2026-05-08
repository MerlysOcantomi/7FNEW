import { db } from "@core/db"
import type { TodayBuckets, TodayItem, TodayPayload, TodayPriority, TodaySource } from "./types"

/**
 * Today aggregator — server-side, pure-ish (DB only, no global state, no AI).
 *
 * As of PR 4 the canonical task source is `WorkspaceTask`. The aggregator now
 * reads three workspace-scoped sources:
 *
 *   1. `WorkspaceTask`  — every task-shaped item in Today comes from here
 *      (manual New-task captures, dual-written InboxTodo mirrors, and any
 *      future direct writers). Status filter excludes terminal and proposed
 *      rows so only actionable work surfaces.
 *   2. `Tarea`          — legacy CRM task model. Included only when no
 *      WorkspaceTask claims the row, so organic Tareas (created without a
 *      mirror) keep showing up but already-mirrored work doesn't duplicate.
 *   3. `Evento`         — calendar events for "today" in the user's timezone.
 *
 * Multi-tenant safety is non-negotiable: every query filters by `workspaceId`
 * exact-match. For models with `workspaceId String?` (`Tarea`, `Evento`) the
 * filter trivially excludes legacy null-tenant rows, which must never leak.
 *
 * Dedup strategy (Tarea ↔ WorkspaceTask):
 *   - If a WorkspaceTask row carries `tareaId`, the matching Tarea is hidden
 *     (forward-compat for PR 5/8 when a writer starts populating that field).
 *   - If a WorkspaceTask row carries `conversationActionId`, we look up the
 *     `ConversationAction.resultId` (when `resultModule="tareas"`) and hide
 *     that Tarea too. This preserves the PR 1 behaviour of "don't show both
 *     sides of a conversation→Tarea promotion".
 *
 * NOT in scope for PR 4: writes, completion, assignment, suggested-from-Fanny
 * actions, paginated lists, push notifications, real-time updates.
 */

/** Hard upper bounds — protect Turso from "tenant with 50k rows" runaway queries. */
const TASKS_TAKE = 200
const TAREAS_TAKE = 200
const EVENTOS_TAKE = 50

/**
 * `WorkspaceTask` statuses that ARE actionable from the Today view.
 *
 * Excluded:
 *   - `proposed`   — Fanny / AI suggestion awaiting approval; surfaced in a
 *                    separate "Suggestions" surface (PR 6) so Today doesn't
 *                    mix unreviewed proposals with confirmed work.
 *   - `done`       — completed; the operator already finished it.
 *   - `dismissed`  — the operator decided not to do it.
 */
const TASK_ACTIVE_STATUSES = ["open", "in_progress", "waiting"] as const

/**
 * `Tarea.estado` values that must NEVER show up in Today. Anything else is
 * treated as "active" (operator-actionable). Schema stores `estado` as a free
 * `String` with default `"pendiente"` and the UI conventionally uses
 * `pendiente | en_progreso | revision | completada | cancelada`. We exclude
 * both terminal states; if a tenant uses a synonym (`hecha`, `finalizada`)
 * those will appear here until the migration normalises them.
 */
const TAREA_TERMINAL_STATES = ["completada", "cancelada"] as const

export interface AggregateTodayInput {
  workspaceId: string
  userId: string
  /** IANA timezone name (e.g. `"America/New_York"`). Falls back to `"UTC"` when invalid. */
  timezone: string
  /** Allows tests to inject a fixed `now`; defaults to `new Date()`. */
  now?: Date
}

export async function aggregateToday(input: AggregateTodayInput): Promise<TodayPayload> {
  if (!input.workspaceId) {
    /**
     * Refuse to run with a falsy workspaceId. Defence-in-depth: callers go
     * through `requireReadAccess` which already blocks anonymous traffic, but
     * this keeps the aggregator safe even if it's reused later from a worker
     * or a script that constructs the input by hand.
     */
    throw new Error("aggregateToday requires a workspaceId")
  }
  if (!input.userId) {
    throw new Error("aggregateToday requires a userId")
  }

  const tz = isValidTimezone(input.timezone) ? input.timezone : "UTC"
  const now = input.now ?? new Date()

  const startOfToday = startOfDayInTZ(now, tz)
  const startOfTomorrow = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000)

  /** Stage 1 — pull the three sources in parallel. */
  const [tasks, allTareas, eventos] = await Promise.all([
    db.workspaceTask.findMany({
      where: {
        workspaceId: input.workspaceId,
        status: { in: [...TASK_ACTIVE_STATUSES] },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: TASKS_TAKE,
    }),
    db.tarea.findMany({
      where: {
        workspaceId: input.workspaceId,
        estado: { notIn: [...TAREA_TERMINAL_STATES] },
      },
      include: {
        proyecto: { select: { id: true, nombre: true } },
        usuario: { select: { id: true, nombre: true, email: true } },
      },
      orderBy: [{ fechaLimite: "asc" }, { createdAt: "desc" }],
      take: TAREAS_TAKE,
    }),
    db.evento.findMany({
      where: {
        workspaceId: input.workspaceId,
        fechaInicio: { gte: startOfToday, lt: startOfTomorrow },
      },
      orderBy: { fechaInicio: "asc" },
      take: EVENTOS_TAKE,
    }),
  ])

  /**
   * Stage 2a — resolve project names for any tasks that point at a project.
   * One round-trip with a single `IN (...)` query keeps the page fast even
   * for tenants with hundreds of open tasks across many projects. The
   * workspaceId predicate is included for defence in depth — without it a
   * faulty `proyectoId` could cross tenants on the SELECT.
   */
  const projectIds = Array.from(
    new Set(
      tasks
        .map((t) => t.proyectoId)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  )

  const projectMap = new Map<string, { id: string; nombre: string }>()
  if (projectIds.length > 0) {
    const projects = await db.proyecto.findMany({
      where: { id: { in: projectIds }, workspaceId: input.workspaceId },
      select: { id: true, nombre: true },
    })
    for (const p of projects) projectMap.set(p.id, p)
  }

  /**
   * Stage 2b — compute the Tarea dedup set. Two signals are merged:
   *
   *   (a) Direct link: a WorkspaceTask whose `tareaId` points at a Tarea
   *       claims that Tarea. Forward-compat — nothing writes this in PR 4
   *       but PR 5 / future writers will.
   *   (b) Promotion link: a WorkspaceTask whose `conversationActionId`
   *       points at a `ConversationAction` that itself produced a
   *       `Tarea` via `resultModule="tareas"` claims that Tarea. This
   *       preserves the PR 1 behaviour where a conversation → Tarea
   *       promotion appears once (as the WorkspaceTask), not twice.
   */
  const tareaIdsCoveredByTask = new Set<string>()

  for (const t of tasks) {
    if (t.tareaId) tareaIdsCoveredByTask.add(t.tareaId)
  }

  const taskActionIds = tasks
    .map((t) => t.conversationActionId)
    .filter((id): id is string => typeof id === "string" && id.length > 0)

  if (taskActionIds.length > 0) {
    const dedupActions = await db.conversationAction.findMany({
      where: {
        id: { in: taskActionIds },
        workspaceId: input.workspaceId,
        resultModule: "tareas",
        resultId: { not: null },
      },
      select: { resultId: true },
    })
    for (const a of dedupActions) {
      if (a.resultId) tareaIdsCoveredByTask.add(a.resultId)
    }
  }

  const tareas = tareaIdsCoveredByTask.size > 0
    ? allTareas.filter((t) => !tareaIdsCoveredByTask.has(t.id))
    : allTareas

  /** Stage 3 — normalise each row to `TodayItem`. */
  const taskItems: TodayItem[] = tasks.map((task) => ({
    id: `task:${task.id}`,
    kind: "task" as const,
    title: task.title,
    description: task.description,
    dueAt: task.dueAt ? task.dueAt.toISOString() : null,
    priority: normaliseWorkspaceTaskPriority(task.priority),
    source: buildWorkspaceTaskSource(task, projectMap),
    assignee: buildWorkspaceTaskAssignee(task, input.userId),
  }))

  const tareaItems: TodayItem[] = tareas.map((tarea) => ({
    id: `tarea:${tarea.id}`,
    kind: "task" as const,
    title: tarea.titulo,
    description: tarea.descripcion,
    dueAt: tarea.fechaLimite ? tarea.fechaLimite.toISOString() : null,
    priority: normaliseTareaPrioridad(tarea.prioridad),
    source: {
      kind: "project" as const,
      projectId: tarea.proyecto?.id ?? null,
      projectName: tarea.proyecto?.nombre ?? null,
      href: `/tareas/${tarea.id}`,
    },
    assignee: buildTareaAssignee(tarea, input.userId),
  }))

  const eventoItems: TodayItem[] = eventos.map((evento) => ({
    id: `evento:${evento.id}`,
    kind: "event" as const,
    title: evento.titulo,
    description: evento.descripcion,
    /** Events use `fechaInicio` as the temporal anchor — `dueAt` is just the field name in the wire shape. */
    dueAt: evento.fechaInicio.toISOString(),
    /** Calendar events don't carry a priority dimension in the schema. */
    priority: null,
    source: {
      kind: "calendar" as const,
      href: "/calendario",
    },
    /** Events don't expose an explicit assignee in the existing schema. */
    assignee: null,
  }))

  /** Stage 4 — bucketise. */
  const buckets: TodayBuckets = {
    overdue: [],
    today: [],
    undated: [],
  }

  for (const item of [...taskItems, ...tareaItems]) {
    if (!item.dueAt) {
      /**
       * `undated` is restricted to items the current user owns, otherwise it
       * becomes a workspace-wide dumping ground. We accept that legacy items
       * without an explicit assignee will be hidden — that's the conservative
       * choice the spec asked for.
       */
      if (item.assignee?.isCurrentUser) {
        buckets.undated.push(item)
      }
      continue
    }
    const due = new Date(item.dueAt)
    if (due < startOfToday) {
      buckets.overdue.push(item)
    } else if (due < startOfTomorrow) {
      buckets.today.push(item)
    }
    /** Future-dated items (>= startOfTomorrow) are intentionally NOT included. */
  }

  for (const event of eventoItems) {
    /**
     * Eventos were already filtered by [startOfToday, startOfTomorrow) in the
     * SQL query, so they all belong in the `today` bucket. We still guard with
     * the same range check in case the upstream filter changes.
     */
    const start = new Date(event.dueAt!)
    if (start >= startOfToday && start < startOfTomorrow) {
      buckets.today.push(event)
    }
  }

  /** Stage 5 — sort within each bucket. */
  buckets.overdue.sort(compareTodayItems)
  buckets.today.sort(compareTodayItems)
  buckets.undated.sort(compareTodayItems)

  return {
    buckets,
    generatedAt: now.toISOString(),
    timezone: tz,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIORITY_ORDER: Record<TodayPriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
}

function compareTodayItems(a: TodayItem, b: TodayItem): number {
  /** Priority desc, then dueAt asc, then title asc as a stable tiebreaker. */
  const pa = a.priority ? PRIORITY_ORDER[a.priority] : 99
  const pb = b.priority ? PRIORITY_ORDER[b.priority] : 99
  if (pa !== pb) return pa - pb

  const da = a.dueAt ? new Date(a.dueAt).getTime() : Number.POSITIVE_INFINITY
  const db = b.dueAt ? new Date(b.dueAt).getTime() : Number.POSITIVE_INFINITY
  if (da !== db) return da - db

  return a.title.localeCompare(b.title)
}

/**
 * `WorkspaceTask.priority` shares the four-level vocabulary with the legacy
 * `InboxTodo.priority` column, so the same mapping applies. `urgent` collapses
 * to `critical` so the UI picks a single visual treatment per tier.
 */
function normaliseWorkspaceTaskPriority(raw: string | null | undefined): TodayPriority {
  switch ((raw ?? "").toLowerCase()) {
    case "low":
      return "low"
    case "high":
      return "high"
    case "urgent":
      return "critical"
    case "normal":
    default:
      return "normal"
  }
}

function normaliseTareaPrioridad(raw: string | null | undefined): TodayPriority {
  switch ((raw ?? "").toLowerCase()) {
    case "baja":
      return "low"
    case "alta":
      return "high"
    case "urgente":
      return "critical"
    case "media":
    default:
      return "normal"
  }
}

/**
 * Decide the source chip + click target for a WorkspaceTask row. Resolution
 * order matches the documentation in `types.ts`:
 *
 *   conversationId → "From Inbox"        → /inbox?id=<conversation>
 *   tareaId        → "From <project>"    → /tareas/<tarea>
 *   proyectoId     → "From <project>"    → /proyectos/<project>
 *   otherwise      → generic "Task" chip → /today (self-pointer)
 *
 * `tareaId` resolves a project name through `task.proyectoId` when present,
 * falling back to `null`. We could resolve via Tarea→Proyecto but that would
 * require an extra join in stage 2a, and the chip already degrades gracefully
 * to "From Project" when no name is available.
 */
function buildWorkspaceTaskSource(
  task: {
    conversationId: string | null
    tareaId: string | null
    proyectoId: string | null
  },
  projectMap: Map<string, { id: string; nombre: string }>,
): TodaySource {
  if (task.conversationId) {
    return {
      kind: "inbox",
      conversationId: task.conversationId,
      href: `/inbox?id=${encodeURIComponent(task.conversationId)}`,
    }
  }
  if (task.tareaId) {
    const proj = task.proyectoId ? projectMap.get(task.proyectoId) ?? null : null
    return {
      kind: "project",
      projectId: proj?.id ?? task.proyectoId ?? null,
      projectName: proj?.nombre ?? null,
      href: `/tareas/${task.tareaId}`,
    }
  }
  if (task.proyectoId) {
    const proj = projectMap.get(task.proyectoId) ?? null
    return {
      kind: "project",
      projectId: task.proyectoId,
      projectName: proj?.nombre ?? null,
      href: `/proyectos/${task.proyectoId}`,
    }
  }
  return {
    kind: "manual",
    href: "/today",
  }
}

/**
 * `WorkspaceTask` assignee semantics:
 *   - `assigneeType="user"` + matching `assigneeId` → `isCurrentUser=true`.
 *   - `assigneeType="user"` + non-matching `assigneeId` → another user owns it.
 *   - `assigneeType="ai" | "team"` → not the current user; show the explicit id
 *     when available so future UI can resolve a name.
 *   - `assigneeType="unassigned"` → null (no assignee).
 */
function buildWorkspaceTaskAssignee(
  task: { assigneeType: string; assigneeId: string | null },
  currentUserId: string,
): TodayItem["assignee"] {
  if (task.assigneeType === "unassigned" || !task.assigneeId) {
    return null
  }
  return {
    id: task.assigneeId,
    name: null,
    isCurrentUser: task.assigneeType === "user" && task.assigneeId === currentUserId,
  }
}

function buildTareaAssignee(
  tarea: {
    usuarioId: string | null
    usuario: { id: string; nombre: string | null; email: string } | null
  },
  currentUserId: string,
): TodayItem["assignee"] {
  if (!tarea.usuarioId) return null
  return {
    id: tarea.usuarioId,
    name: tarea.usuario?.nombre ?? tarea.usuario?.email ?? null,
    isCurrentUser: tarea.usuarioId === currentUserId,
  }
}

// ─── Timezone math ────────────────────────────────────────────────────────────

/**
 * Validate an IANA timezone string by attempting to instantiate
 * `Intl.DateTimeFormat` with it. The constructor throws `RangeError` for
 * unknown zones in modern Node / V8, which gives us a free, dependency-less
 * validation path.
 */
function isValidTimezone(tz: string): boolean {
  if (!tz || typeof tz !== "string") return false
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz })
    return true
  } catch {
    return false
  }
}

/**
 * Compute the offset between UTC and the given timezone at the given instant,
 * in milliseconds. Positive when the zone is ahead of UTC. Used as a building
 * block for `startOfDayInTZ`; intentionally not exported.
 *
 * Implementation: format the instant in the target timezone, parse the
 * resulting "wall clock" components, and treat them as if they were UTC. The
 * difference vs the original instant is the offset.
 */
function tzOffsetMs(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
  const parts = dtf.formatToParts(date)
  const map: Record<string, number> = {}
  for (const p of parts) {
    if (p.type !== "literal") map[p.type] = parseInt(p.value, 10)
  }
  /**
   * `Intl.DateTimeFormat` with `hour12: false` can return `"24"` for midnight
   * in some locales/Node versions. Normalise to `0` so `Date.UTC` doesn't roll
   * over silently.
   */
  const hour = map.hour === 24 ? 0 : map.hour
  const asUtc = Date.UTC(map.year, map.month - 1, map.day, hour, map.minute, map.second)
  return asUtc - date.getTime()
}

/**
 * Returns the UTC `Date` that corresponds to 00:00:00 on the user's local
 * calendar day in `tz`. Stable across DST transitions because the offset is
 * computed for the instant `now` itself, not for the abstract midnight.
 */
export function startOfDayInTZ(now: Date, tz: string): Date {
  const offset = tzOffsetMs(now, tz)
  /** Wall-clock fields of `now` in `tz`, expressed as UTC for arithmetic convenience. */
  const tzNow = new Date(now.getTime() + offset)
  const wallMidnight = Date.UTC(
    tzNow.getUTCFullYear(),
    tzNow.getUTCMonth(),
    tzNow.getUTCDate(),
    0,
    0,
    0,
  )
  return new Date(wallMidnight - offset)
}
