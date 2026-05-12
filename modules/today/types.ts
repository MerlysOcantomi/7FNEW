/**
 * Today aggregator — public types.
 *
 * `Today` is a read-only, workspace-level view that surfaces the work the operator
 * should look at first thing in the morning. As of PR 4 the canonical task source
 * is `WorkspaceTask`, with `Evento` still feeding calendar items and `Tarea`
 * surviving as a fallback for legacy CRM rows that have not yet been mirrored
 * into `WorkspaceTask`. `InboxTodo` is no longer queried directly — its rows
 * reach Today via the dual-write mirror established in PR 3.
 *
 * The shape lives in its own module so the API route, the aggregator, and the
 * client components can all import the SAME contract — drift between server
 * payload and client expectations is a recurring source of bugs in this codebase.
 *
 * NB: brand neutrality is enforced at the boundary. `TodaySource.kind` uses the
 * neutral term `"inbox"` (operator-facing copy is `"From Inbox"`); we do NOT
 * surface "InboxTodo" or "WorkspaceTask" as UI labels anywhere downstream.
 */

/**
 * Normalised priority across underlying taxonomies.
 *
 * Source mapping:
 *   - `WorkspaceTask.priority` : "low" | "normal" | "high" | "urgent"
 *   - `Tarea.prioridad`        : "baja" | "media" | "alta" | "urgente"
 *
 * Both `"urgent"` and `"urgente"` collapse to `"critical"` so the UI can pick a
 * single visual treatment per tier without branching on origin.
 */
export type TodayPriority = "low" | "normal" | "high" | "critical"

/**
 * Provenance of the underlying record. Used by the UI to render the chip on the
 * right of each row ("From Inbox", "From <project>", "From Calendar", "Task")
 * and to decide where a click should navigate.
 *
 * `href` is always a relative path inside the app — never an absolute URL — so
 * the client component can render `<Link>` without sanitisation.
 *
 * Source resolution priority for `WorkspaceTask` rows (highest → lowest):
 *   conversationId → `inbox`
 *   tareaId        → `project` (link goes to the underlying Tarea page)
 *   proyectoId     → `project` (link goes to the project page)
 *   otherwise      → `manual` (no upstream source yet — chip says "Task")
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
  | {
      /**
       * Task without a first-class upstream link (manual capture from
       * the New dropdown, or a future direct WorkspaceTask write that
       * doesn't carry a conversation/project pointer). The renderer
       * shows a small generic "Task" chip; `href` exists only to keep
       * the row clickable — `/today` is a self-pointer used as a
       * no-op until a global Task detail page lands.
       */
      kind: "manual"
      href: string
    }

/**
 * One displayable item in Today.
 *
 * `id` is prefixed with the source kind (e.g. `"task:abc"` for a WorkspaceTask,
 * `"tarea:xyz"` for a legacy Tarea fallback, `"evento:def"` for a calendar
 * event) so React keys never collide across sources and downstream code can
 * branch on the prefix when needed without re-querying.
 *
 * `kind`:
 *   - `"task"`  — actionable work (a WorkspaceTask, or a legacy Tarea that has
 *                 no mirror yet). Renders as a row.
 *   - `"event"` — calendar event for today. Renders as a card with a time chip;
 *                 still NOT actionable from Today (no inline complete/dismiss).
 */
/**
 * Ownership lane for a Today item — mirrors `WorkspaceTask.assigneeType`
 * with `null` for non-WorkspaceTask sources (events; legacy `Tarea`
 * fallback rows that have no canonical mirror yet). Surfaced into the
 * payload so the client can split rows into the My work / AI work
 * lanes without having to interpret `assignee.isCurrentUser` plus a
 * heuristic — the lane is owned by the server.
 */
export type TodayAssigneeType = "user" | "ai" | "team" | "unassigned" | null

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
  /**
   * Canonical `WorkspaceTask.assigneeType`. `null` for events and for
   * legacy `Tarea` fallback rows. Used by the client to render the
   * My work / AI work lanes and to gate the "Send to AI" / "Take over"
   * row controls.
   */
  assigneeType: TodayAssigneeType
  /**
   * True when the underlying `WorkspaceTask.status === "proposed"`
   * (Fanny / AI suggestion awaiting operator approval). UI uses this
   * to show a "Proposed" pill and to disable the Take-over affordance
   * — Approve / Dismiss still lives in Inbox / Smart Hub.
   */
  isProposed: boolean
  /**
   * True when the underlying `WorkspaceTask.status === "waiting"`
   * (operator-blocked, paused on an external dependency). UI uses
   * this to route the row into a dedicated "Waiting / Blocked"
   * sub-bucket inside its lane and to surface the workboard-level
   * "Waiting / Blocked" count. Always `false` for legacy `Tarea`
   * fallback rows and for events — those sources do not expose a
   * compatible status concept.
   */
  isWaiting: boolean
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
