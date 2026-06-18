/**
 * Today "work_first_v2" hero selectors — pure, no I/O, no React.
 *
 * Two responsibilities, both derived ENTIRELY from data `/api/today` already
 * returns (counts + lanes):
 *
 *   - `buildBriefingLine` — a deterministic, rule-based morning-briefing
 *     sentence in Fanny's voice. This is NOT LLM output. It never invents
 *     meetings, tasks, weather or agent activity; it only restates and
 *     prioritises the real counts. Honest by construction.
 *   - `pickProtagonist` — the single "Start Here" item the operator should
 *     handle first, chosen from their own lane.
 *
 * Kept pure so they unit-test without Prisma / React and stay reusable across
 * any future Today surface. Mirrors the `modules/today/lanes.ts` convention.
 */
import type { TodayBucketsByLane } from "./lanes"
import type { TodayItem } from "./types"

export type PartOfDay = "morning" | "afternoon" | "evening"

/** Real Today counts the briefing is allowed to mention — nothing else. */
export interface TodayBriefingCounts {
  overdue: number
  dueToday: number
  waiting: number
  schedule: number
  /** Items in the AI lane (assigneeType === "ai", incl. proposed). */
  ai: number
}

export type ProtagonistReason = "overdue" | "today" | "waiting" | "undated"

export interface TodayProtagonist {
  item: TodayItem
  reason: ProtagonistReason
}

/**
 * Part of day from the local clock. The caller passes the `Date` so the
 * function stays pure and testable (no hidden `new Date()`).
 */
export function getPartOfDay(date: Date): PartOfDay {
  const hour = date.getHours()
  if (hour < 12) return "morning"
  if (hour < 18) return "afternoon"
  return "evening"
}

function plural(n: number, one: string, many: string): string {
  return n === 1 ? one : many
}

/**
 * Deterministic morning-briefing line, assembled ONLY from real counts.
 *
 * Branch order matches the operator's mental model — lead with whatever is
 * most pressing (overdue → due today → waiting → calendar-only → all clear).
 * The calendar clause is honest about "no meetings today"; the optional AI
 * tail keeps a neutral verb ("is on") so proposed-but-unapproved rows are
 * never overstated as done.
 */
export function buildBriefingLine(
  counts: TodayBriefingCounts,
  partOfDay: PartOfDay,
): string {
  const { overdue, dueToday, waiting, schedule, ai } = counts
  const greeting = `Good ${partOfDay}.`

  const meetings =
    schedule > 0
      ? `${schedule} ${plural(schedule, "event", "events")} on the calendar`
      : "no meetings today"

  let body: string
  if (overdue > 0) {
    const clear = overdue === 1 ? "clear it first" : "clear the overdue work first"
    body = `You have ${overdue} overdue ${plural(overdue, "item", "items")} and ${meetings}. I'd ${clear} — it's what's pulling the day behind.`
  } else if (dueToday > 0) {
    body = `${dueToday} ${plural(dueToday, "item is", "items are")} due today and ${meetings}. Start with what's due and the board stays ahead.`
  } else if (waiting > 0) {
    body = `Nothing overdue or due today, and ${meetings}. ${waiting} ${plural(waiting, "item is", "items are")} waiting on others — a good moment to follow up.`
  } else if (schedule > 0) {
    body = `No overdue or due-today work — just ${meetings}. Your queue is clear.`
  } else {
    body = `Nothing overdue, due today, or waiting, and no meetings. You're all clear.`
  }

  const tail = ai > 0 ? ` 7F is on ${ai} ${plural(ai, "item", "items")} alongside you.` : ""

  return `${greeting} ${body}${tail}`
}

/**
 * Choose the single "Start Here" protagonist from the operator's OWN lane.
 *
 * Priority: overdue → due today → waiting → top undated. Returns `null` when
 * the operator's lane is empty (the "you're all clear" state) — even if AI
 * work exists, because Start Here is about what needs the PERSON now.
 *
 * Buckets arrive pre-sorted by the aggregator (priority desc, dueAt asc,
 * title asc), so index 0 is always the most important row.
 */
export function pickProtagonist(
  byLane: TodayBucketsByLane,
): TodayProtagonist | null {
  const mine = byLane.mine
  if (mine.overdue.length > 0) return { item: mine.overdue[0], reason: "overdue" }
  if (mine.today.length > 0) return { item: mine.today[0], reason: "today" }
  if (mine.waiting.length > 0) return { item: mine.waiting[0], reason: "waiting" }
  if (mine.undated.length > 0) return { item: mine.undated[0], reason: "undated" }
  return null
}
