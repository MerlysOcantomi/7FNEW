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

// ─── SQL builder (workspace isolation + parameterization, both dialects) ────

const STATUS_PARAMS = [...UNANSWERED_EXCLUDED_STATUSES]

test("sqlite: candidate query is workspace-scoped, `?`-parameterized, and inlines nothing request-derived", () => {
  const { sql, params } = buildUnansweredCandidateQuery({ workspaceId: "ws_1", dialect: "sqlite" })
  assert.ok(sql.includes('c."workspaceId" = ?'))
  assert.deepEqual(params, ["ws_1", ...STATUS_PARAMS, UNANSWERED_CANDIDATE_LIMIT])
  // The workspace id travels as a bound parameter, never interpolated.
  assert.ok(!sql.includes("ws_1"))
  assert.equal((sql.match(/\?/g) ?? []).length, params.length)
})

test("postgresql: same query renders $1..$n with identical parameter order", () => {
  const { sql, params } = buildUnansweredCandidateQuery({ workspaceId: "ws_1", dialect: "postgresql" })
  assert.ok(sql.includes('c."workspaceId" = $1'))
  assert.ok(sql.includes(`NOT IN ($2, $3, $4, $5, $6)`))
  assert.ok(sql.includes("LIMIT $7"))
  assert.deepEqual(params, ["ws_1", ...STATUS_PARAMS, UNANSWERED_CANDIDATE_LIMIT])
  assert.ok(!/\$8/.test(sql))
})

test("candidate query mirrors the predicate's exclusions and direction check", () => {
  const { sql, params } = buildUnansweredCandidateQuery({ workspaceId: "ws_1", dialect: "sqlite" })
  for (const status of UNANSWERED_EXCLUDED_STATUSES) {
    assert.ok(params.includes(status), status)
    assert.ok(!sql.includes(`'${status}'`), `${status} must be bound, not inlined`)
  }
  assert.ok(sql.includes(`m."direction" = 'inbound'`))
  assert.ok(params.includes(UNANSWERED_CANDIDATE_LIMIT))
})

test("isInternal is a dialect boolean literal: 0 on sqlite (unchanged Turso semantics), FALSE on postgresql", () => {
  assert.ok(buildUnansweredCandidateQuery({ workspaceId: "ws_1", dialect: "sqlite" }).sql.includes('m2."isInternal" = 0'))
  assert.ok(
    buildUnansweredCandidateQuery({ workspaceId: "ws_1", dialect: "postgresql" }).sql.includes('m2."isInternal" = FALSE'),
  )
})

test("minAgeMinutes adds a bound timestamp threshold: ISO text on sqlite, Date on postgresql", () => {
  const sqlite = buildUnansweredCandidateQuery({ workspaceId: "ws_1", minAgeMinutes: 30, now: NOW, dialect: "sqlite" })
  assert.ok(sqlite.sql.includes('m."createdAt" <= ?'))
  assert.deepEqual(sqlite.params, ["ws_1", ...STATUS_PARAMS, minutesAgo(30).toISOString(), UNANSWERED_CANDIDATE_LIMIT])

  const pg = buildUnansweredCandidateQuery({ workspaceId: "ws_1", minAgeMinutes: 30, now: NOW, dialect: "postgresql" })
  assert.ok(pg.sql.includes('m."createdAt" <= $7'))
  assert.ok(pg.sql.includes("LIMIT $8"))
  const threshold = pg.params[6]
  assert.ok(threshold instanceof Date)
  assert.equal(threshold.getTime(), minutesAgo(30).getTime())
  assert.equal(pg.params[7], UNANSWERED_CANDIDATE_LIMIT)
})

test("no unquoted mixed-case identifier survives (PostgreSQL would fold it)", () => {
  const { sql } = buildUnansweredCandidateQuery({ workspaceId: "ws_1", minAgeMinutes: 5, dialect: "postgresql" })
  assert.ok(!/(?<!")\b(Conversation|Message|conversationId|workspaceId|isInternal|createdAt|lastMessageAt)\b(?!")/.test(sql))
})
