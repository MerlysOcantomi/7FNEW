import assert from "node:assert/strict"
import test from "node:test"
import { DatabaseSync } from "node:sqlite"
import { renderSql } from "@core/db-dialect"
import { buildAssignedUnseenQuery, buildLeadUnseenQuery } from "./attention-queries"
import { buildUnansweredCandidateQuery, UNANSWERED_CANDIDATE_LIMIT } from "./unanswered"

/**
 * NEON-01 — SQLite equivalence gate for the hardened raw statements.
 *
 * The three raw queries were rewritten to be PostgreSQL-compatible (quoted
 * identifiers, dialect boolean literal, dialect placeholders). This test proves
 * the SQLite rendering is (a) valid SQLite and (b) returns EXACTLY the same
 * rows as the statements 7F ran on Turso before the rewrite, over a fixture
 * that exercises every branch of each predicate.
 *
 * Local only: an in-memory `node:sqlite` database with the columns the
 * statements touch. No Prisma client, no network, no env. This gate is
 * SQLite-specific by design and is retired when Turso is retired.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ── The statements exactly as they ran before NEON-01 (verbatim) ────────────
const LEGACY_ASSIGNED_UNSEEN = `SELECT COUNT(*) as cnt
       FROM Conversation c
       LEFT JOIN ConversationRead cr
         ON cr.conversationId = c.id AND cr.userId = ?
       WHERE c.workspaceId = ?
         AND c.assignedTo = ?
         AND c.status NOT IN ('closed', 'archived', 'new')
         AND (cr.lastSeenAt IS NULL OR c.lastMessageAt > cr.lastSeenAt)`

const LEGACY_LEAD_UNSEEN = `SELECT COUNT(*) as cnt
       FROM Conversation c
       LEFT JOIN ConversationRead cr
         ON cr.conversationId = c.id AND cr.userId = ?
       WHERE c.workspaceId = ?
         AND c.status = 'lead_detected'
         AND c.assignedTo IS NULL
         AND (cr.lastSeenAt IS NULL OR c.lastMessageAt > cr.lastSeenAt)`

function legacyUnanswered(ageClause: string): string {
  return `SELECT c.id AS id
FROM Conversation c
JOIN Message m ON m.id = (
  SELECT m2.id FROM Message m2
  WHERE m2.conversationId = c.id AND m2.isInternal = 0
  ORDER BY m2.createdAt DESC, m2.id DESC
  LIMIT 1
)
WHERE c.workspaceId = ?
  AND c.status NOT IN ('resolved', 'converted', 'closed', 'archived', 'trashed')
  AND m.direction = 'inbound'
  ${ageClause}
ORDER BY c.lastMessageAt DESC
LIMIT ${UNANSWERED_CANDIDATE_LIMIT}`
}

// ── Fixture ─────────────────────────────────────────────────────────────────
const NOW = new Date("2026-07-19T12:00:00.000Z")
const iso = (minutesAgo: number) => new Date(NOW.getTime() - minutesAgo * 60_000).toISOString()

function openFixture(): DatabaseSync {
  const db = new DatabaseSync(":memory:")
  db.exec(`
    CREATE TABLE "Conversation" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "workspaceId" TEXT NOT NULL,
      "status" TEXT NOT NULL,
      "assignedTo" TEXT,
      "lastMessageAt" DATETIME
    );
    CREATE TABLE "ConversationRead" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "conversationId" TEXT NOT NULL,
      "userId" TEXT NOT NULL,
      "lastSeenAt" DATETIME NOT NULL
    );
    CREATE TABLE "Message" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "conversationId" TEXT NOT NULL,
      "direction" TEXT NOT NULL,
      "isInternal" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" DATETIME NOT NULL
    );
  `)
  const conv = db.prepare(`INSERT INTO "Conversation" VALUES (?, ?, ?, ?, ?)`)
  const read = db.prepare(`INSERT INTO "ConversationRead" VALUES (?, ?, ?, ?)`)
  const msg = db.prepare(`INSERT INTO "Message" VALUES (?, ?, ?, ?, ?)`)

  // Assigned to u1, unseen (never read)                               → counts for assigned
  conv.run("c1", "ws", "triaged", "u1", iso(10))
  // Assigned to u1, seen after last message                            → not counted
  conv.run("c2", "ws", "triaged", "u1", iso(30))
  read.run("r2", "c2", "u1", iso(5))
  // Assigned to u1, read marker older than last message                → counts
  conv.run("c3", "ws", "awaiting_response", "u1", iso(5))
  read.run("r3", "c3", "u1", iso(60))
  // Assigned to u1 but status 'new' / 'closed'                          → excluded
  conv.run("c4", "ws", "new", "u1", iso(1))
  conv.run("c5", "ws", "closed", "u1", iso(1))
  // Assigned to another user                                            → excluded
  conv.run("c6", "ws", "triaged", "u2", iso(1))
  // Other workspace                                                     → excluded
  conv.run("c7", "other", "triaged", "u1", iso(1))
  // Lead, unassigned, unseen                                            → counts for lead
  conv.run("c8", "ws", "lead_detected", null, iso(10))
  // Lead, unassigned, seen                                              → not counted
  conv.run("c9", "ws", "lead_detected", null, iso(30))
  read.run("r9", "c9", "u1", iso(5))
  // Lead but assigned                                                   → not counted as lead
  conv.run("c10", "ws", "lead_detected", "u1", iso(10))
  // Read marker by a DIFFERENT user must not hide c11 from u1
  conv.run("c11", "ws", "triaged", "u1", iso(10))
  read.run("r11", "c11", "u2", iso(1))

  // Unanswered fixture (same conversations; messages decide)
  msg.run("m1", "c1", "inbound", 0, iso(50)) // c1 latest non-internal = inbound → unanswered
  msg.run("m1i", "c1", "outbound", 1, iso(40)) // internal note must not clear it
  msg.run("m2a", "c2", "inbound", 0, iso(50))
  msg.run("m2b", "c2", "outbound", 0, iso(45)) // c2 answered
  msg.run("m3", "c3", "inbound", 0, iso(3)) // c3 unanswered but young (3 min)
  msg.run("m5", "c5", "inbound", 0, iso(50)) // c5 closed → excluded
  msg.run("m7", "c7", "inbound", 0, iso(50)) // other workspace → excluded
  msg.run("m8", "c8", "inbound", 0, iso(200)) // c8 unanswered, old
  msg.run("m11", "c11", "inbound", 0, iso(50)) // c11 unanswered
  // c4, c6, c9, c10 have no messages → not unanswered
  return db
}

function rows(db: DatabaseSync, sql: string, params: readonly unknown[]): any[] {
  return db.prepare(sql).all(...(params as any[])) as any[]
}

test("attention-count: hardened SQL is valid SQLite and matches the legacy statements row-for-row", () => {
  const db = openFixture()
  try {
    const input = { workspaceId: "ws", userId: "u1" }
    const assigned = renderSql(buildAssignedUnseenQuery(input), "sqlite")
    const lead = renderSql(buildLeadUnseenQuery(input), "sqlite")

    const legacyAssigned = rows(db, LEGACY_ASSIGNED_UNSEEN, ["u1", "ws", "u1"])
    const legacyLead = rows(db, LEGACY_LEAD_UNSEEN, ["u1", "ws"])
    const newAssigned = rows(db, assigned.sql, assigned.params)
    const newLead = rows(db, lead.sql, lead.params)

    assert.deepEqual(newAssigned, legacyAssigned)
    assert.deepEqual(newLead, legacyLead)
    // And the fixture really exercises the predicates: c1, c3, c10, c11 / c8.
    // (c10 is a lead assigned to u1: it counts as assigned-unseen, not as lead.)
    assert.equal(Number(newAssigned[0].cnt), 4)
    assert.equal(Number(newLead[0].cnt), 1)
  } finally {
    db.close()
  }
})

test("unanswered candidates: hardened SQL matches the legacy statement with and without minAge", () => {
  const db = openFixture()
  try {
    const noAge = buildUnansweredCandidateQuery({ workspaceId: "ws", dialect: "sqlite" })
    const legacyNoAge = rows(db, legacyUnanswered(""), ["ws"])
    const newNoAge = rows(db, noAge.sql, noAge.params)
    assert.deepEqual(newNoAge, legacyNoAge)
    assert.deepEqual(
      newNoAge.map((r) => r.id).sort(),
      ["c1", "c11", "c3", "c8"],
    )

    const withAge = buildUnansweredCandidateQuery({ workspaceId: "ws", minAgeMinutes: 30, now: NOW, dialect: "sqlite" })
    const legacyWithAge = rows(db, legacyUnanswered("AND m.createdAt <= ?"), ["ws", iso(30)])
    const newWithAge = rows(db, withAge.sql, withAge.params)
    assert.deepEqual(newWithAge, legacyWithAge)
    // c3's inbound message is 3 minutes old → gated out by minAge=30.
    assert.deepEqual(
      newWithAge.map((r) => r.id).sort(),
      ["c1", "c11", "c8"],
    )
  } finally {
    db.close()
  }
})
