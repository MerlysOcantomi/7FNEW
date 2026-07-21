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
import type { TodayMessages } from "@core/i18n/ui"
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

/**
 * Deterministic morning-briefing line, assembled ONLY from real counts.
 *
 * Branch order matches the operator's mental model — lead with whatever is
 * most pressing (overdue → due today → waiting → calendar-only → all clear).
 * The calendar clause is honest about "no meetings today"; the optional AI
 * tail keeps a neutral verb so proposed-but-unapproved rows are never
 * overstated as done.
 *
 * Copy is fully catalog-driven (I18N-TODAY-FULL-PAGE-02B): the canonical
 * count values drive the branch; every sentence piece comes from
 * `today.briefing` so the line renders in the viewer's locale. Pure — no I/O,
 * no clock; the caller passes both the counts and the resolved catalog.
 */
export function buildBriefingLine(
  counts: TodayBriefingCounts,
  partOfDay: PartOfDay,
  briefing: TodayMessages["briefing"],
): string {
  const { overdue, dueToday, waiting, schedule, ai } = counts
  const greeting = briefing.greeting[partOfDay]
  const meetings = schedule > 0 ? briefing.meetings(schedule) : briefing.noMeetings

  let body: string
  if (overdue > 0) {
    body = briefing.bodyOverdue(overdue, meetings)
  } else if (dueToday > 0) {
    body = briefing.bodyDueToday(dueToday, meetings)
  } else if (waiting > 0) {
    body = briefing.bodyWaiting(waiting, meetings)
  } else if (schedule > 0) {
    body = briefing.bodySchedule(meetings)
  } else {
    body = briefing.bodyAllClear
  }

  const tail = ai > 0 ? briefing.aiTail(ai) : ""

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
