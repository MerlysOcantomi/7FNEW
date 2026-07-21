/**
 * Unit tests for the Today work_first_v2 hero selectors.
 *
 * These lock down the two guarantees that matter: the briefing is a
 * deterministic restatement of REAL counts (never fabricated copy), and the
 * protagonist picker follows the daily-standup priority and stays inside the
 * operator's own lane.
 *
 * Test runner: Node's built-in `node:test`, executed via `tsx --test`
 * (matches the convention in modules/today/*.test.ts). Run narrowly with:
 *
 *   npm run test:today-briefing
 */

import assert from "node:assert/strict"
import test from "node:test"

import { getUIMessages } from "@core/i18n/ui"
import type { TodayBucketsByLane, TodayLaneBuckets } from "./lanes"
import type { TodayItem } from "./types"
import { buildBriefingLine, getPartOfDay, pickProtagonist } from "./briefing"

/** English briefing catalog — the canonical source the assertions pin. */
const EN = getUIMessages("en").today.briefing

// ─── Fixtures ───────────────────────────────────────────────────────────────

function item(id: string, title: string): TodayItem {
  return {
    id,
    kind: "task",
    title,
    description: null,
    dueAt: null,
    priority: null,
    source: { kind: "manual", href: "/today" },
    assignee: null,
    assigneeType: "user",
    isProposed: false,
    isWaiting: false,
  }
}

const emptyLane = (): TodayLaneBuckets => ({
  overdue: [],
  today: [],
  waiting: [],
  undated: [],
})

function byLane(mine: Partial<TodayLaneBuckets>): TodayBucketsByLane {
  return {
    mine: { ...emptyLane(), ...mine },
    ai: emptyLane(),
    schedule: emptyLane(),
  }
}

// ─── getPartOfDay ───────────────────────────────────────────────────────────

test("getPartOfDay buckets the local clock", () => {
  assert.equal(getPartOfDay(new Date(2026, 5, 17, 6, 0)), "morning")
  assert.equal(getPartOfDay(new Date(2026, 5, 17, 11, 59)), "morning")
  assert.equal(getPartOfDay(new Date(2026, 5, 17, 12, 0)), "afternoon")
  assert.equal(getPartOfDay(new Date(2026, 5, 17, 17, 59)), "afternoon")
  assert.equal(getPartOfDay(new Date(2026, 5, 17, 18, 0)), "evening")
  assert.equal(getPartOfDay(new Date(2026, 5, 17, 23, 30)), "evening")
})

// ─── buildBriefingLine ──────────────────────────────────────────────────────

test("briefing leads with overdue, singular copy + 'no meetings'", () => {
  const line = buildBriefingLine(
    { overdue: 1, dueToday: 3, waiting: 2, schedule: 0, ai: 0 },
    "morning",
    EN,
  )
  assert.match(line, /^Good morning\./)
  assert.match(line, /1 overdue item /)
  assert.match(line, /no meetings today/)
  assert.match(line, /clear it first/)
})

test("briefing pluralises overdue and surfaces real events", () => {
  const line = buildBriefingLine(
    { overdue: 2, dueToday: 0, waiting: 0, schedule: 3, ai: 0 },
    "afternoon",
    EN,
  )
  assert.match(line, /^Good afternoon\./)
  assert.match(line, /2 overdue items/)
  assert.match(line, /3 events on the calendar/)
  assert.match(line, /clear the overdue work first/)
})

test("briefing falls through overdue -> due today -> waiting -> clear", () => {
  assert.match(
    buildBriefingLine({ overdue: 0, dueToday: 2, waiting: 1, schedule: 0, ai: 0 }, "morning", EN),
    /2 items are due today/,
  )
  assert.match(
    buildBriefingLine({ overdue: 0, dueToday: 0, waiting: 1, schedule: 0, ai: 0 }, "morning", EN),
    /1 item is waiting on others/,
  )
  assert.match(
    buildBriefingLine({ overdue: 0, dueToday: 0, waiting: 0, schedule: 2, ai: 0 }, "morning", EN),
    /just 2 events on the calendar\. Your queue is clear\./,
  )
  assert.match(
    buildBriefingLine({ overdue: 0, dueToday: 0, waiting: 0, schedule: 0, ai: 0 }, "morning", EN),
    /You're all clear\./,
  )
})

test("briefing adds an honest AI tail only when ai > 0", () => {
  assert.match(
    buildBriefingLine({ overdue: 0, dueToday: 0, waiting: 0, schedule: 0, ai: 2 }, "morning", EN),
    /7F is on 2 items alongside you\.$/,
  )
  assert.doesNotMatch(
    buildBriefingLine({ overdue: 0, dueToday: 0, waiting: 0, schedule: 0, ai: 0 }, "morning", EN),
    /7F is on/,
  )
})

test("briefing renders in Spanish from the es catalog (same canonical branch)", () => {
  const ES = getUIMessages("es").today.briefing
  const line = buildBriefingLine(
    { overdue: 2, dueToday: 0, waiting: 0, schedule: 3, ai: 1 },
    "morning",
    ES,
  )
  assert.match(line, /^Buenos días\./)
  assert.match(line, /2 elementos atrasados/)
  assert.match(line, /3 eventos en el calendario/)
  assert.match(line, /7F está con 1 elemento junto a ti\.$/)
})

// ─── pickProtagonist ────────────────────────────────────────────────────────

test("pickProtagonist honours overdue > due today > waiting > undated", () => {
  assert.equal(
    pickProtagonist(byLane({ overdue: [item("task:a", "A")], today: [item("task:b", "B")] }))?.item.id,
    "task:a",
  )
  assert.equal(
    pickProtagonist(byLane({ today: [item("task:b", "B")], waiting: [item("task:c", "C")] }))?.reason,
    "today",
  )
  assert.equal(pickProtagonist(byLane({ waiting: [item("task:c", "C")] }))?.reason, "waiting")
  assert.equal(pickProtagonist(byLane({ undated: [item("task:d", "D")] }))?.reason, "undated")
})

test("pickProtagonist returns null when the operator lane is empty (even if AI has work)", () => {
  const lanes = byLane({})
  lanes.ai.overdue.push(item("task:ai", "AI owns this"))
  assert.equal(pickProtagonist(lanes), null)
})
