import { db } from "@core/db"
import type { TodayBuckets, TodayItem, TodayPayload, TodayPriority } from "./types"

/**
 * Today aggregator — server-side, pure-ish (DB only, no global state, no AI).
 *
 * Reads three workspace-scoped sources and unifies them into the `TodayPayload`
 * contract. Multi-tenant safety is non-negotiable: every query filters by
 * `workspaceId` exact-match. For the two models with `workspaceId String?` in
 * the schema (`Tarea`, `Evento`) this trivially excludes legacy null-tenant
 * rows, which must never leak into any workspace's view.
 *
 * Dedup: when a `Tarea` was created via `convertConversationToRecords` and the
 * operator additionally captured an `InboxTodo` whose `sourceActionId` points
 * to the matching `ConversationAction.resultId`, we keep ONLY the InboxTodo.
 * The InboxTodo carries the inbox link the operator cares about; the Tarea is
 * a downstream record. Best-effort — if a workspace has organic Tareas without
 * any linked action they appear normally.
 *
 * NOT in scope for PR 1: writes, completion, assignment, suggested-from-Fanny
 * actions, paginated lists, push notifications, real-time updates.
 */

/** Hard upper bounds — protect Turso from "tenant with 50k rows" runaway queries. */
const TODOS_TAKE = 200
const TAREAS_TAKE = 200
const EVENTOS_TAKE = 50

/**
 * Tarea status values that must NEVER show up in Today. Anything else is treated
 * as "active" (operator-actionable). The schema stores `estado` as a free
 * `String` with default `"pendiente"` and the UI conventionally uses
 * `pendiente | en_progreso | revision | completada | cancelada`. We exclude
 * both terminal states; if a tenant uses a synonym (`hecha`, `finalizada`)
 * those will appear here until normalisation in PR 2/3.
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
  const [todos, allTareas, eventos] = await Promise.all([
    db.inboxTodo.findMany({
      where: {
        workspaceId: input.workspaceId,
        status: { in: ["open", "waiting"] },
      },
      orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
      take: TODOS_TAKE,
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
   * Stage 2 — compute the dedup set. We only run this query when the InboxTodo
   * fetch surfaced at least one `sourceActionId`, otherwise the dedup is a no-op
   * and skipping the round-trip keeps the empty workspace path snappy.
   */
  const sourceActionIds = todos
    .map((t) => t.sourceActionId)
    .filter((id): id is string => typeof id === "string" && id.length > 0)

  const tareaIdsCoveredByTodo = new Set<string>()
  if (sourceActionIds.length > 0) {
    const dedupActions = await db.conversationAction.findMany({
      where: {
        id: { in: sourceActionIds },
        workspaceId: input.workspaceId,
        resultModule: "tareas",
        resultId: { not: null },
      },
      select: { resultId: true },
    })
    for (const a of dedupActions) {
      if (a.resultId) tareaIdsCoveredByTodo.add(a.resultId)
    }
  }

  const tareas = tareaIdsCoveredByTodo.size > 0
    ? allTareas.filter((t) => !tareaIdsCoveredByTodo.has(t.id))
    : allTareas

  /** Stage 3 — normalise each row to TodayItem. */
  const todoItems: TodayItem[] = todos.map((todo) => ({
    id: `inbox-todo:${todo.id}`,
    kind: "task" as const,
    title: todo.title,
    description: todo.description,
    dueAt: todo.dueAt ? todo.dueAt.toISOString() : null,
    priority: normaliseInboxTodoPriority(todo.priority),
    source: {
      kind: "inbox" as const,
      conversationId: todo.conversationId,
      href: todo.conversationId ? `/inbox?id=${encodeURIComponent(todo.conversationId)}` : "/inbox",
    },
    assignee: buildInboxTodoAssignee(todo, input.userId),
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

  for (const item of [...todoItems, ...tareaItems]) {
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
    /** Future-dated items (>= startOfTomorrow) are intentionally NOT included in PR 1. */
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

function normaliseInboxTodoPriority(raw: string | null | undefined): TodayPriority {
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

function buildInboxTodoAssignee(
  todo: { assigneeId: string | null; assigneeType: string },
  currentUserId: string,
): TodayItem["assignee"] {
  /**
   * `assigneeType="me"` is the schema's "no explicit user, the operator who created
   * it owns it" sentinel. We treat that as the current user only when the request
   * is made by the same caller, so a teammate looking at the same workspace
   * doesn't see those items as "yours". Otherwise we trust the explicit
   * `assigneeId` match.
   */
  if (todo.assigneeId) {
    return {
      id: todo.assigneeId,
      name: null,
      isCurrentUser: todo.assigneeId === currentUserId,
    }
  }
  if (todo.assigneeType === "me") {
    /** Without an explicit ID we can't decide ownership across users; conservative: not "yours". */
    return null
  }
  return null
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
