/**
 * Today aggregator — public types.
 *
 * `Today` is a read-only, workspace-level view that surfaces the work the operator
 * should look at first thing in the morning. It deliberately reads from THREE
 * existing sources (`InboxTodo`, `Tarea`, `Evento`) and presents them as a single
 * unified list grouped by temporal bucket. It is NOT a new persistence model and
 * NEVER renames or migrates the underlying tables.
 *
 * The shape lives in its own module so the API route, the aggregator, and the
 * client components can all import the SAME contract — drift between server
 * payload and client expectations is a recurring source of bugs in this codebase.
 *
 * NB: brand neutrality is enforced at the boundary. `TodaySource.kind` uses the
 * neutral term `"inbox"` (operator-facing copy is `"From Inbox"`); we do NOT
 * surface "InboxTodo" as a UI label anywhere downstream.
 */

/**
 * Normalised priority across the two underlying status taxonomies.
 *
 * Source mapping:
 *   - `InboxTodo.priority`   : "low" | "normal" | "high" | "urgent"
 *   - `Tarea.prioridad`      : "baja" | "media" | "alta" | "urgente"
 *
 * Both `"urgent"` and `"urgente"` collapse to `"critical"` so the UI can pick a
 * single visual treatment per tier without branching on origin.
 */
export type TodayPriority = "low" | "normal" | "high" | "critical"

/**
 * Provenance of the underlying record. Used by the UI to render the chip on the
 * right of each row ("From Inbox", "From <project>", "From Calendar") and to
 * decide where a click should navigate.
 *
 * `href` is always a relative path inside the app — never an absolute URL — so
 * the client component can render `<Link>` without sanitisation.
 */
export type TodaySource =
  | {
      kind: "inbox"
      conversationId: string | null
      href: string
    }
  | {
      kind: "project"
      projectId: string | null
      projectName: string | null
      href: string
    }
  | {
      kind: "calendar"
      href: string
    }

/**
 * One displayable item in Today.
 *
 * `id` is prefixed with the source kind (e.g. `"inbox-todo:abc"`, `"tarea:xyz"`,
 * `"evento:def"`) so React keys never collide across sources and downstream
 * code can branch on the prefix when needed without re-querying.
 *
 * `kind`:
 *   - `"task"`  — actionable work (InboxTodo or Tarea). Renders as a row.
 *   - `"event"` — calendar event for today. Renders as a card with a time chip;
 *                 NOT actionable in PR 1 (no inline complete/dismiss).
 */
export interface TodayItem {
  id: string
  kind: "task" | "event"
  title: string
  description: string | null
  /** ISO 8601. For events this is `fechaInicio`; for tasks it's `dueAt`/`fechaLimite`. */
  dueAt: string | null
  priority: TodayPriority | null
  source: TodaySource
  assignee: {
    id: string | null
    name: string | null
    isCurrentUser: boolean
  } | null
}

/**
 * Three buckets, in display order:
 *
 *   - `overdue` — tasks whose due is strictly before the start of "today" in the
 *                 user's timezone. Events are NEVER in `overdue` (a past event is
 *                 not pending work).
 *   - `today`   — tasks AND events with due/start inside the [startOfToday,
 *                 startOfTomorrow) window in the user's timezone.
 *   - `undated` — tasks with NO due, restricted to the current user (assigneeId
 *                 / usuarioId match) so the bucket doesn't become a workspace-wide
 *                 dumping ground. Events without a date are not possible
 *                 (`Evento.fechaInicio` is required) so they're absent here.
 */
export interface TodayBuckets {
  overdue: TodayItem[]
  today: TodayItem[]
  undated: TodayItem[]
}

export interface TodayPayload {
  buckets: TodayBuckets
  /** Server-side ISO timestamp at which the snapshot was computed. */
  generatedAt: string
  /** Echoed back so the UI can show "Times shown in <tz>" if it wants to. */
  timezone: string
}
