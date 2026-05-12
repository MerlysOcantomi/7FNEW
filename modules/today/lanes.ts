import type { TodayBuckets, TodayItem } from "./types"

/**
 * Today lane classification — pure, no I/O, no React.
 *
 * The Today surface splits the day into three lanes:
 *
 *   - `"mine"`     — operator-owned work. Includes everything task-shaped
 *                    that isn't explicitly AI-assigned: `assigneeType`
 *                    of `user`, `team`, `unassigned`, plus legacy `Tarea`
 *                    fallback rows that have no `WorkspaceTask` mirror
 *                    yet (so their `assigneeType` is `null`). The Today
 *                    workboard intentionally does NOT hide unowned or
 *                    team-owned work — Today is the daily standup, and
 *                    nothing important should disappear because the
 *                    ownership label is fuzzy.
 *   - `"ai"`       — `assigneeType === "ai"`. Includes proposed rows
 *                    (`isProposed === true`); those are still surfaced
 *                    read-only — Approve / Dismiss stays in the Inbox /
 *                    Smart Hub for now.
 *   - `"schedule"` — calendar events. Always lives outside the My/AI
 *                    assignment plane and is rendered as a separate
 *                    Schedule section.
 *
 * Why a separate Schedule lane (and not a third workboard column)?
 * Events are time-anchored, not work-shaped: they have no priority,
 * no assignee, no Send/Take-over action. Treating them as a column
 * peer of My-work / AI-work invites a "third column" that doesn't
 * carry the same vocabulary. We keep them visible as a strip so the
 * day stays calendar-aware.
 *
 * Why server-driven? `aggregator.ts` already produces `assigneeType`
 * per row, so the client never has to guess "is this mine?" — it just
 * reads the lane. Keeping the helper pure means we can unit-test the
 * classifier without mocking Prisma, and we can reuse the exact same
 * split logic in the page, the bottom drawer, and any future Today
 * surface.
 */
export type TodayLane = "mine" | "ai" | "schedule"

/**
 * Classify a single `TodayItem` into its lane.
 *
 * Rules (evaluated top-down):
 *   1. Events → `"schedule"`.
 *   2. Tasks with `assigneeType === "ai"` → `"ai"`.
 *   3. Everything else task-shaped (user / team / unassigned / null
 *      legacy Tarea fallback) → `"mine"`.
 *
 * Note: a `WorkspaceTask` with `assigneeType === "user"` but an
 * `assigneeId` pointing at a teammate (not the current operator) still
 * falls into the `"mine"` lane — it's user-owned work, just not
 * necessarily by *me*. The caller can further refine using
 * `item.assignee?.isCurrentUser` if a future surface ever wants a
 * per-user split.
 */
export function getTodayLane(item: TodayItem): TodayLane {
  if (item.kind === "event") return "schedule"
  if (item.assigneeType === "ai") return "ai"
  return "mine"
}

/**
 * Extended bucket shape for the workboard. Mirrors the aggregator's
 * `TodayBuckets` (`overdue` / `today` / `undated`) and adds a transversal
 * `waiting` slot.
 *
 * Routing rule applied by `splitBucketsByLane`:
 *   - If `item.isWaiting === true`, the item goes to `waiting`
 *     regardless of its date bucket. Otherwise it keeps the
 *     aggregator's date-based bucket.
 *
 * Rationale: "Waiting / Blocked" is a status concept, not a date
 * concept. An overdue waiting task is still "blocked" in the
 * operator's mental model; surfacing it under Overdue would create
 * the false impression that the operator can just power through it.
 * The dedicated bucket makes the blocker visible and actionable.
 *
 * `waiting` is empty for the Schedule lane (events have no status).
 */
export interface TodayLaneBuckets {
  overdue: TodayItem[]
  today: TodayItem[]
  waiting: TodayItem[]
  undated: TodayItem[]
}

export interface TodayBucketsByLane {
  mine: TodayLaneBuckets
  ai: TodayLaneBuckets
  schedule: TodayLaneBuckets
}

/**
 * Project the aggregator's three buckets into per-lane buckets while
 * preserving the within-bucket order produced by the aggregator
 * (priority desc, then dueAt asc, then title asc). This avoids any
 * client-side re-sorting and keeps the lanes stable across reloads.
 *
 * Empty lanes / sub-buckets are still represented with empty arrays so
 * consumers can render a friendly empty state without null-checking
 * three nested levels.
 */
export function splitBucketsByLane(buckets: TodayBuckets): TodayBucketsByLane {
  const empty = (): TodayLaneBuckets => ({
    overdue: [],
    today: [],
    waiting: [],
    undated: [],
  })
  const out: TodayBucketsByLane = {
    mine: empty(),
    ai: empty(),
    schedule: empty(),
  }

  for (const dateKey of ["overdue", "today", "undated"] as const) {
    for (const item of buckets[dateKey]) {
      const lane = getTodayLane(item)
      /**
       * Waiting items are pulled OUT of their date bucket and grouped
       * under `waiting` — only for task-shaped lanes. Schedule is a
       * calendar surface and stays purely date-driven.
       */
      if (lane !== "schedule" && item.isWaiting) {
        out[lane].waiting.push(item)
      } else {
        out[lane][dateKey].push(item)
      }
    }
  }

  return out
}

/** Total item count across all sub-buckets of a lane — handy for empty-state gating and header counts. */
export function countLane(buckets: TodayLaneBuckets): number {
  return (
    buckets.overdue.length +
    buckets.today.length +
    buckets.waiting.length +
    buckets.undated.length
  )
}

/**
 * Count "waiting / blocked" items across both task lanes. Used by the
 * workboard header to surface the day's blocker pressure at a glance.
 */
export function countWaitingAcrossLanes(byLane: TodayBucketsByLane): number {
  return byLane.mine.waiting.length + byLane.ai.waiting.length
}

/** Flat list of events for the Schedule strip — the schedule lane only fills `today`. */
export function getScheduleItems(byLane: TodayBucketsByLane): TodayItem[] {
  return [...byLane.schedule.today]
}
