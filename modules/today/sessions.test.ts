/**
 * Unit tests for `deriveSessionDay` — the pure summary behind the session-first
 * Today: KPI counts, the protagonist the canvas opens on, and the variant-aware
 * Fanny flow sections.
 *
 * Hermetic fixtures only (no alias imports), `node:test` via `tsx`. Run with:
 *
 *   npm run test:today-sessions
 */

import assert from "node:assert/strict"
import test from "node:test"

import {
  deriveSessionDay,
  type SessionFlowSection,
  type TodaySession,
  type TodaySessionDay,
  type SessionVariant,
} from "./sessions"

let seq = 0
function mk(over: Partial<TodaySession> = {}): TodaySession {
  seq += 1
  return {
    id: over.id ?? `s${seq}`,
    title: over.title ?? `Session ${seq}`,
    startsAt: over.startsAt,
    endsAt: over.endsAt,
    mode: over.mode ?? "in_person",
    status: over.status ?? "scheduled",
    ...over,
  }
}
function day(variant: SessionVariant, sessions: TodaySession[]): TodaySessionDay {
  return { variant, businessName: "Demo", sessions }
}
function findSection(flow: SessionFlowSection[], label: string): SessionFlowSection | undefined {
  return flow.find((s) => s.label === label)
}

test("class: KPIs (sessions, students, unpaid, materials) + starting_soon protagonist", () => {
  seq = 0
  const d = deriveSessionDay(
    day("class", [
      mk({ id: "a", participantCount: 5, status: "completed", startsAt: "2026-06-15T09:00:00Z" }),
      mk({ id: "b", participantCount: 4, paymentStatus: "unpaid", status: "completed", startsAt: "2026-06-15T10:30:00Z", attendanceMarked: false }),
      mk({ id: "c", participantCount: 4, status: "starting_soon", materialStatus: "missing", startsAt: "2026-06-15T12:00:00Z" }),
      mk({ id: "d", participantCount: 3, materialStatus: "pending", paymentStatus: "overdue", startsAt: "2026-06-15T16:00:00Z" }),
    ]),
  )
  assert.equal(d.count, 4)
  assert.equal(d.participants, 16)
  assert.equal(d.unpaid, 2)
  assert.equal(d.materialsPending, 2)
  assert.equal(d.protagonistId, "c") // starting_soon wins
  assert.ok(findSection(d.flow, "Materials to send"))
  assert.equal(findSection(d.flow, "Payment pending")?.items.length, 2)
})

test("tutor: practiced ratio, homework + protagonist; payment section counts unpaid+overdue", () => {
  seq = 0
  const d = deriveSessionDay(
    day("tutor", [
      mk({ id: "done", status: "completed", practice: { done: 5, goal: 5 } }),
      mk({ id: "noprac", status: "completed" }), // no practice → not in practicedTotal
      mk({ id: "up", status: "starting_soon", homeworkStatus: "to_review", practice: { done: 4, goal: 5 }, startsAt: "2026-06-15T12:00:00Z" }),
      mk({ id: "pay1", status: "scheduled", paymentStatus: "unpaid", practice: { done: 2, goal: 5 } }),
      mk({ id: "pay2", status: "needs_follow_up", paymentStatus: "overdue", risks: [{ type: "reschedule", label: "Rebook" }] }),
    ]),
  )
  assert.equal(d.practicedTotal, 3) // done, up, pay1 carry practice
  assert.equal(d.practicedDone, 3)
  assert.equal(d.homeworkToReview, 1)
  assert.equal(d.protagonistId, "up")
  assert.equal(findSection(d.flow, "Payment pending")?.items.length, 2)
  assert.equal(findSection(d.flow, "Homework to review")?.items.length, 1)
  assert.equal(findSection(d.flow, "Follow-ups")?.items.length, 1)
})

test("care: people/visits/calls/urgent counts + urgent protagonist", () => {
  seq = 0
  const d = deriveSessionDay(
    day("care", [
      mk({ id: "ana", contactKind: "call", startsAt: "2026-06-15T15:00:00Z", risks: [{ type: "urgent", label: "Urgent" }] }),
      mk({ id: "rob", contactKind: "call", startsAt: "2026-06-15T10:00:00Z" }),
      mk({ id: "fam", contactKind: "visit", startsAt: "2026-06-15T13:00:00Z" }),
      mk({ id: "carmen", contactKind: "call", startsAt: "2026-06-15T11:30:00Z", risks: [{ type: "urgent", label: "Urgent" }] }),
      mk({ id: "marta", risks: [{ type: "reminder", label: "Birthday" }], status: "needs_follow_up" }),
      mk({ id: "lucia", status: "waiting_reply" }),
    ]),
  )
  assert.equal(d.count, 6)
  assert.equal(d.calls, 3)
  assert.equal(d.visits, 1)
  assert.equal(d.urgent, 2)
  assert.equal(d.reminders, 1)
  assert.equal(d.waitingReply, 1)
  assert.equal(d.protagonistId, "ana") // first urgent

  // urgent calls live under "People needing attention", not "Calls to make"
  assert.equal(findSection(d.flow, "People needing attention")?.items.length, 2)
  assert.equal(findSection(d.flow, "Calls to make")?.items.length, 1) // only non-urgent call (rob)
  assert.equal(findSection(d.flow, "Visits today")?.items.length, 1)
  assert.equal(findSection(d.flow, "Waiting your reply")?.items.length, 1)
})

test("protagonist fallbacks: care without urgent → earliest scheduled; class without starting_soon → earliest scheduled", () => {
  seq = 0
  const care = deriveSessionDay(
    day("care", [
      mk({ id: "late", contactKind: "visit", startsAt: "2026-06-15T17:00:00Z" }),
      mk({ id: "early", contactKind: "call", startsAt: "2026-06-15T09:00:00Z" }),
    ]),
  )
  assert.equal(care.protagonistId, "early")

  const klass = deriveSessionDay(
    day("class", [
      mk({ id: "c2", status: "scheduled", startsAt: "2026-06-15T14:00:00Z" }),
      mk({ id: "c1", status: "scheduled", startsAt: "2026-06-15T09:00:00Z" }),
    ]),
  )
  assert.equal(klass.protagonistId, "c1")
})

test("empty day: null protagonist, empty flow, zeroed counts", () => {
  const d = deriveSessionDay(day("class", []))
  assert.equal(d.count, 0)
  assert.equal(d.protagonistId, null)
  assert.equal(d.flow.length, 0)
  assert.equal(d.unpaid, 0)
})
