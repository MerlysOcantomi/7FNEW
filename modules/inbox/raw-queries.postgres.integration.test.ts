import assert from "node:assert/strict"
import test from "node:test"
import { provisionTestDatabase, type ProvisionedDatabase } from "@/test/support/postgres"
import { renderSql, resolveSqlDialect } from "@core/db-dialect"
import { buildAssignedUnseenQuery, buildLeadUnseenQuery, countFromRows, type CountRow } from "./attention-queries"
import { buildUnansweredCandidateQuery } from "./unanswered"

/**
 * NEON-03 — the three hardened raw statements (attention-count assigned/lead
 * unseen, unanswered candidates) executed on REAL PostgreSQL through the
 * runtime Prisma client, exactly as `app/api/inbox/attention-count/route.ts`
 * and `modules/inbox/service.ts` run them: `renderSql(…, resolveSqlDialect())`
 * + `db.$queryRawUnsafe`. Same fixture as the SQLite equivalence gate
 * (`raw-queries.sqlite-equivalence.test.ts`), same expected rows.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
let database: ProvisionedDatabase
let db: any

const NOW = new Date("2026-07-19T12:00:00.000Z")
const ago = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000)

test.before(async () => {
  database = await provisionTestDatabase("raw-queries-pg")
  ;({ db } = await import("@core/db"))

  await db.workspace.createMany({ data: [{ id: "ws", nombre: "WS", slug: "ws" }, { id: "other", nombre: "Other", slug: "other" }] })
  await db.user.createMany({ data: [{ id: "u1", email: "u1@example.test" }, { id: "u2", email: "u2@example.test" }] })
  await db.contact.createMany({ data: [{ id: "ct", workspaceId: "ws", nombre: "Contact" }, { id: "cto", workspaceId: "other", nombre: "X" }] })

  const conv = (id: string, ws: string, status: string, assignedTo: string | null, lastMessageAt: Date) =>
    db.conversation.create({ data: { id, contactId: ws === "ws" ? "ct" : "cto", workspaceId: ws, status, assignedTo, lastMessageAt } })
  const read = (id: string, conversationId: string, userId: string, lastSeenAt: Date) =>
    db.conversationRead.create({ data: { id, conversationId, userId, workspaceId: "ws", lastSeenAt } })
  const msg = (id: string, conversationId: string, direction: string, isInternal: boolean, createdAt: Date) =>
    db.message.create({ data: { id, conversationId, role: "visitor", content: "x", workspaceId: conversationId === "c7" ? "other" : "ws", direction, isInternal, createdAt } })

  // Assigned to u1, unseen (never read)                               → counts for assigned
  await conv("c1", "ws", "triaged", "u1", ago(10))
  // Assigned to u1, seen after last message                            → not counted
  await conv("c2", "ws", "triaged", "u1", ago(30)); await read("r2", "c2", "u1", ago(5))
  // Assigned to u1, read marker older than last message                → counts
  await conv("c3", "ws", "awaiting_response", "u1", ago(5)); await read("r3", "c3", "u1", ago(60))
  // Assigned to u1 but status 'new' / 'closed'                          → excluded
  await conv("c4", "ws", "new", "u1", ago(1))
  await conv("c5", "ws", "closed", "u1", ago(1))
  // Assigned to another user                                            → excluded
  await conv("c6", "ws", "triaged", "u2", ago(1))
  // Other workspace                                                     → excluded
  await conv("c7", "other", "triaged", "u1", ago(1))
  // Lead, unassigned, unseen                                            → counts for lead
  await conv("c8", "ws", "lead_detected", null, ago(10))
  // Lead, unassigned, seen                                              → not counted
  await conv("c9", "ws", "lead_detected", null, ago(30)); await read("r9", "c9", "u1", ago(5))
  // Lead but assigned                                                   → counted as assigned-unseen, not lead
  await conv("c10", "ws", "lead_detected", "u1", ago(10))
  // Read marker by a DIFFERENT user must not hide c11 from u1
  await conv("c11", "ws", "triaged", "u1", ago(10)); await read("r11", "c11", "u2", ago(1))

  await msg("m1", "c1", "inbound", false, ago(50)) // c1 latest non-internal = inbound → unanswered
  await msg("m1i", "c1", "outbound", true, ago(40)) // internal note must not clear it
  await msg("m2a", "c2", "inbound", false, ago(50))
  await msg("m2b", "c2", "outbound", false, ago(45)) // c2 answered
  await msg("m3", "c3", "inbound", false, ago(3)) // c3 unanswered but young (3 min)
  await msg("m5", "c5", "inbound", false, ago(50)) // c5 closed → excluded
  await msg("m7", "c7", "inbound", false, ago(50)) // other workspace → excluded
  await msg("m8", "c8", "inbound", false, ago(200)) // c8 unanswered, old
  await msg("m11", "c11", "inbound", false, ago(50)) // c11 unanswered
})

test.after(async () => {
  await db.$disconnect()
  await database.dispose()
})

test("the runtime resolves the postgresql dialect from DATABASE_URL", () => {
  assert.equal(resolveSqlDialect(), "postgresql")
})

test("attention-count: assigned-unseen and lead-unseen through $queryRawUnsafe ($n placeholders, bigint COUNT)", async () => {
  const dialect = resolveSqlDialect()
  const input = { workspaceId: "ws", userId: "u1" }
  const assigned = renderSql(buildAssignedUnseenQuery(input), dialect)
  const lead = renderSql(buildLeadUnseenQuery(input), dialect)
  assert.match(assigned.sql, /\$1/, "postgresql placeholders")
  assert.doesNotMatch(assigned.sql, /\?/)

  const assignedRows = await db.$queryRawUnsafe(assigned.sql, ...assigned.params) as CountRow[]
  const leadRows = await db.$queryRawUnsafe(lead.sql, ...lead.params) as CountRow[]
  // PostgreSQL COUNT(*) arrives as bigint through the adapter; countFromRows coerces it.
  assert.equal(typeof assignedRows[0].cnt, "bigint")
  assert.equal(countFromRows(assignedRows), 4) // c1, c3, c10, c11
  assert.equal(countFromRows(leadRows), 1) // c8
})

test("unanswered candidates: boolean literal, Date parameter and ordering behave on PostgreSQL", async () => {
  const noAge = buildUnansweredCandidateQuery({ workspaceId: "ws", dialect: resolveSqlDialect() })
  assert.match(noAge.sql, /"isInternal" = FALSE/)
  const rows = await db.$queryRawUnsafe(noAge.sql, ...noAge.params) as { id: string }[]
  assert.deepEqual(rows.map((r) => r.id).sort(), ["c1", "c11", "c3", "c8"])

  const withAge = buildUnansweredCandidateQuery({ workspaceId: "ws", minAgeMinutes: 30, now: NOW, dialect: resolveSqlDialect() })
  assert.ok(withAge.params.some((p) => p instanceof Date), "the age threshold is bound as a Date on PostgreSQL")
  const aged = await db.$queryRawUnsafe(withAge.sql, ...withAge.params) as { id: string }[]
  // c3's inbound message is 3 minutes old → gated out by minAge=30.
  assert.deepEqual(aged.map((r) => r.id).sort(), ["c1", "c11", "c8"])
})

test("workspace scoping: the other workspace sees ONLY its own row (c7), never the ws fixture", async () => {
  const dialect = resolveSqlDialect()
  const assigned = renderSql(buildAssignedUnseenQuery({ workspaceId: "other", userId: "u1" }), dialect)
  assert.equal(countFromRows(await db.$queryRawUnsafe(assigned.sql, ...assigned.params)), 1, "c7 is assigned to u1 in `other`")
  const lead = renderSql(buildLeadUnseenQuery({ workspaceId: "other", userId: "u1" }), dialect)
  assert.equal(countFromRows(await db.$queryRawUnsafe(lead.sql, ...lead.params)), 0)
  const un = buildUnansweredCandidateQuery({ workspaceId: "other", dialect })
  const rows = await db.$queryRawUnsafe(un.sql, ...un.params) as { id: string }[]
  assert.deepEqual(rows.map((r) => r.id), ["c7"])
})
