import type { TodayBuckets, TodayItem } from "./types"

/**
 * Today lane classification — pure, no I/O, no React.
 *
 * The Today surface now splits actionable work into two lanes:
 *
 *   - `"mine"` — operator-owned work. `WorkspaceTask.assigneeType === "user"`.
 *   - `"ai"`   — AI-owned work. `WorkspaceTask.assigneeType === "ai"`. Includes
 *                rows with `status === "proposed"` (Fanny suggestions awaiting
 *                approval); those rows are read-only beyond a "Proposed" pill.
 *
 * Everything else — events, legacy `Tarea` fallback rows without a
 * `WorkspaceTask` mirror, `team` ownership, `unassigned` work — falls into the
 * `"other"` lane. The current Today UI does NOT render the `"other"` lane as
 * its own column (to keep the My-work / AI-work split clean); callers that
 * need a "miscellaneous" surface can opt in by reading the `other` slot from
 * `splitBucketsByLane`.
 *
 * Why server-driven? `aggregator.ts` already produces `assigneeType` per row,
 * so the client never has to guess "is this mine?" — it just reads the lane.
 * Keeping the helper pure means we can unit-test the classifier without
 * mocking Prisma, and we can reuse the exact same split logic in the page,
 * the bottom drawer, and any future Today surface.
 */
export type TodayLane = "mine" | "ai" | "other"

/**
 * Classify a single `TodayItem` into its lane.
 *
 * Rules:
 *   - Events are always `"other"` (no assignment plane).
 *   - Tasks with `assigneeType === "user"` → `"mine"`.
 *   - Tasks with `assigneeType === "ai"`   → `"ai"` (proposed or active).
 *   - Anything else (`team`, `unassigned`, legacy `Tarea` with `null`) → `"other"`.
 *
 * Note: a WorkspaceTask with `assigneeType === "user"` but an `assigneeId`
 * pointing at a teammate (not the current operator) still falls into `"mine"`
 * lane semantically — it's user-owned work, just not necessarily by *me*. The
 * caller can further refine using `item.assignee?.isCurrentUser` if a future
 * surface ever wants a per-user split.
 */
export function getTodayLane(item: TodayItem): TodayLane {
  if (item.kind !== "task") return "other"
  if (item.assigneeType === "user") return "mine"
  if (item.assigneeType === "ai") return "ai"
  return "other"
}

/**
 * Mirror of `TodayBuckets` shape, indexed by lane. Each lane preserves the
 * same overdue / today / undated structure so the renderer can reuse the
 * existing `<TodaySection>` primitives without further reshaping.
 */
export interface TodayBucketsByLane {
  mine: TodayBuckets
  ai: TodayBuckets
  other: TodayBuckets
}

/**
 * Project the aggregator's three buckets into per-lane buckets while
 * preserving the within-bucket order produced by the aggregator (priority
 * desc, then dueAt asc, then title asc). This avoids any client-side
 * re-sorting and keeps the lanes stable across reloads.
 *
 * Empty lanes are still represented with empty arrays so consumers can render
 * a friendly empty state without null-checking three nested levels.
 */
export function splitBucketsByLane(buckets: TodayBuckets): TodayBucketsByLane {
  const empty = (): TodayBuckets => ({ overdue: [], today: [], undated: [] })
  const out: TodayBucketsByLane = { mine: empty(), ai: empty(), other: empty() }

  for (const key of ["overdue", "today", "undated"] as const) {
    for (const item of buckets[key]) {
      const lane = getTodayLane(item)
      out[lane][key].push(item)
    }
  }

  return out
}

/** Total item count across the three buckets of a lane — handy for empty-state gating. */
export function countLane(buckets: TodayBuckets): number {
  return buckets.overdue.length + buckets.today.length + buckets.undated.length
}
