import assert from "node:assert/strict"
import test from "node:test"
import {
  buildUnansweredCandidateQuery,
  isUnansweredConversation,
  UNANSWERED_CANDIDATE_LIMIT,
  UNANSWERED_EXCLUDED_STATUSES,
} from "./unanswered"

const NOW = new Date("2026-07-19T12:00:00.000Z")

function minutesAgo(minutes: number): Date {
  return new Date(NOW.getTime() - minutes * 60_000)
}

// ─── Predicate semantics ────────────────────────────────────────────────────

test("latest inbound message on an active conversation → unanswered", () => {
  assert.equal(
    isUnansweredConversation({
      status: "new",
      lastNonInternalMessage: { direction: "inbound", createdAt: minutesAgo(5) },
    }),
    true,
  )
})

test("latest outbound message → answered", () => {
  assert.equal(
    isUnansweredConversation({
      status: "triaged",
      lastNonInternalMessage: { direction: "outbound", createdAt: minutesAgo(5) },
    }),
    false,
  )
})

test("a conversation with no non-internal messages is not unanswered", () => {
  assert.equal(
    isUnansweredConversation({ status: "new", lastNonInternalMessage: null }),
    false,
  )
})

test("terminal statuses are excluded even with a latest inbound message", () => {
  for (const status of UNANSWERED_EXCLUDED_STATUSES) {
    assert.equal(
      isUnansweredConversation({
        status,
        lastNonInternalMessage: { direction: "inbound", createdAt: minutesAgo(120) },
      }),
      false,
      status,
    )
  }
  // Waiting-on-client is NOT terminal: if the customer wrote last, it is
  // genuinely unanswered regardless of the stale status value.
  assert.equal(
    isUnansweredConversation({
      status: "awaiting_response",
      lastNonInternalMessage: { direction: "inbound", createdAt: minutesAgo(120) },
    }),
    true,
  )
})

test("minAgeMinutes gates young inbound messages", () => {
  const candidate = {
    status: "new",
    lastNonInternalMessage: { direction: "inbound", createdAt: minutesAgo(10) },
  }
  assert.equal(isUnansweredConversation(candidate, { minAgeMinutes: 30, now: NOW }), false)
  assert.equal(isUnansweredConversation(candidate, { minAgeMinutes: 10, now: NOW }), true)
  assert.equal(isUnansweredConversation(candidate, { now: NOW }), true)
})

// ─── SQL builder (workspace isolation + parameterization) ───────────────────

test("candidate query is workspace-scoped and parameterized", () => {
  const { sql, params } = buildUnansweredCandidateQuery({ workspaceId: "ws_1" })
  assert.ok(sql.includes("c.workspaceId = ?"))
  assert.deepEqual(params, ["ws_1"])
  // The workspace id travels as a bound parameter, never interpolated.
  assert.ok(!sql.includes("ws_1"))
})

test("candidate query mirrors the predicate's exclusions and direction check", () => {
  const { sql } = buildUnansweredCandidateQuery({ workspaceId: "ws_1" })
  for (const status of UNANSWERED_EXCLUDED_STATUSES) {
    assert.ok(sql.includes(`'${status}'`), status)
  }
  assert.ok(sql.includes("m.direction = 'inbound'"))
  assert.ok(sql.includes("m2.isInternal = 0"))
  assert.ok(sql.includes(`LIMIT ${UNANSWERED_CANDIDATE_LIMIT}`))
})

test("minAgeMinutes adds a bound timestamp threshold", () => {
  const { sql, params } = buildUnansweredCandidateQuery({
    workspaceId: "ws_1",
    minAgeMinutes: 30,
    now: NOW,
  })
  assert.ok(sql.includes("m.createdAt <= ?"))
  assert.deepEqual(params, ["ws_1", minutesAgo(30).toISOString()])
})
