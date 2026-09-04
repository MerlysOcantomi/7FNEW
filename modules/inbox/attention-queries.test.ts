import assert from "node:assert/strict"
import test from "node:test"
import { renderSql } from "@core/db-dialect"
import { buildAssignedUnseenQuery, buildLeadUnseenQuery, countFromRows } from "./attention-queries"

const INPUT = { workspaceId: "ws_1", userId: "user_1" }

test("assigned-unseen: sqlite renders `?` placeholders with params in order [userId, workspaceId, userId]", () => {
  const { sql, params } = renderSql(buildAssignedUnseenQuery(INPUT), "sqlite")
  assert.equal((sql.match(/\?/g) ?? []).length, 3)
  assert.deepEqual(params, ["user_1", "ws_1", "user_1"])
  assert.ok(!sql.includes("ws_1") && !sql.includes("user_1"))
})

test("assigned-unseen: postgresql renders $1..$3 with the same parameter order", () => {
  const { sql, params } = renderSql(buildAssignedUnseenQuery(INPUT), "postgresql")
  assert.ok(sql.includes('cr."userId" = $1'))
  assert.ok(sql.includes('c."workspaceId" = $2'))
  assert.ok(sql.includes('c."assignedTo" = $3'))
  assert.deepEqual(params, ["user_1", "ws_1", "user_1"])
})

test("lead-unseen: two placeholders, params [userId, workspaceId], no assignee parameter", () => {
  const sqlite = renderSql(buildLeadUnseenQuery(INPUT), "sqlite")
  assert.equal((sqlite.sql.match(/\?/g) ?? []).length, 2)
  assert.deepEqual(sqlite.params, ["user_1", "ws_1"])
  const pg = renderSql(buildLeadUnseenQuery(INPUT), "postgresql")
  assert.ok(pg.sql.includes('cr."userId" = $1') && pg.sql.includes('c."workspaceId" = $2'))
  assert.ok(pg.sql.includes('c."assignedTo" IS NULL'))
  assert.deepEqual(pg.params, ["user_1", "ws_1"])
})

test("identifiers are double-quoted so PostgreSQL does not fold Prisma's mixed-case names", () => {
  for (const build of [buildAssignedUnseenQuery, buildLeadUnseenQuery]) {
    const { sql } = renderSql(build(INPUT), "postgresql")
    for (const ident of ['"Conversation"', '"ConversationRead"', '"conversationId"', '"workspaceId"', '"lastSeenAt"', '"lastMessageAt"']) {
      assert.ok(sql.includes(ident), ident)
    }
    // No unquoted mixed-case identifier survives (would be folded by PostgreSQL).
    assert.ok(!/\b(?<!")(Conversation|ConversationRead|conversationId|workspaceId|assignedTo|lastSeenAt|lastMessageAt)\b(?!")/.test(sql))
  }
})

test("both queries preserve the status semantics of the original statements", () => {
  const assigned = renderSql(buildAssignedUnseenQuery(INPUT), "sqlite").sql
  assert.ok(assigned.includes(`NOT IN ('closed', 'archived', 'new')`))
  const lead = renderSql(buildLeadUnseenQuery(INPUT), "sqlite").sql
  assert.ok(lead.includes(`"status" = 'lead_detected'`))
})

test("countFromRows coerces sqlite numbers and postgresql bigints alike", () => {
  assert.equal(countFromRows([{ cnt: 3 }]), 3)
  assert.equal(countFromRows([{ cnt: BigInt(3) }]), 3)
  assert.equal(countFromRows([]), 0)
})
