/**
 * Raw SQL behind `GET /api/inbox/attention-count` (NEON-01).
 *
 * Two "unseen" counts that Prisma's filter API cannot express directly (they
 * need a LEFT JOIN on the per-user read marker and a column-to-column
 * comparison). Kept here as pure builders — next to the inbox domain and away
 * from the route handler — so they can be rendered and asserted for BOTH SQL
 * dialects without an HTTP request or a database.
 *
 * Identifiers are double-quoted: Prisma creates mixed-case table and column
 * names, which SQLite matches either way but PostgreSQL folds to lower-case
 * when unquoted. `COUNT(*)` comes back as a number on SQLite and as a
 * `bigint` on PostgreSQL; callers coerce with `Number()`.
 */
import { sql, type SqlFragment } from "@core/db-dialect"

export interface AttentionQueryInput {
  workspaceId: string
  userId: string
}

/**
 * Conversations assigned to the user, still open, with activity the user has
 * not seen since their last read marker (or never read).
 */
export function buildAssignedUnseenQuery(input: AttentionQueryInput): SqlFragment {
  return sql`SELECT COUNT(*) AS cnt
FROM "Conversation" c
LEFT JOIN "ConversationRead" cr
  ON cr."conversationId" = c."id" AND cr."userId" = ${input.userId}
WHERE c."workspaceId" = ${input.workspaceId}
  AND c."assignedTo" = ${input.userId}
  AND c."status" NOT IN ('closed', 'archived', 'new')
  AND (cr."lastSeenAt" IS NULL OR c."lastMessageAt" > cr."lastSeenAt")`
}

/**
 * Detected leads nobody owns yet, with activity the user has not seen.
 */
export function buildLeadUnseenQuery(input: AttentionQueryInput): SqlFragment {
  return sql`SELECT COUNT(*) AS cnt
FROM "Conversation" c
LEFT JOIN "ConversationRead" cr
  ON cr."conversationId" = c."id" AND cr."userId" = ${input.userId}
WHERE c."workspaceId" = ${input.workspaceId}
  AND c."status" = 'lead_detected'
  AND c."assignedTo" IS NULL
  AND (cr."lastSeenAt" IS NULL OR c."lastMessageAt" > cr."lastSeenAt")`
}

/** `COUNT(*)` row shape across providers (number on SQLite, bigint on PostgreSQL). */
export type CountRow = { cnt: number | bigint }

export function countFromRows(rows: readonly CountRow[]): number {
  return Number(rows[0]?.cnt ?? 0)
}
