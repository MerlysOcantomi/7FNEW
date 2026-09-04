/**
 * "Unanswered" semantics for the Smart Inbox — the single definition shared
 * by the server query (`listConversations` in `service.ts`) and by tests.
 *
 * A conversation is UNANSWERED when:
 *   1. its status is not terminal (`resolved`, `converted`, `closed`,
 *      `archived`, `trashed`) — finished work is not "waiting for a reply";
 *   2. its latest NON-INTERNAL message is inbound — an operator internal
 *      note must NOT clear the unanswered state (nothing was sent to the
 *      customer), while any outbound message does;
 *   3. optionally, that inbound message is at least `minAgeMinutes` old.
 *
 * Notes on the data model (why this is not a plain Prisma `where`):
 *   - There is no "last message direction" column on `Conversation`, and
 *     `lastMessageAt`/`updatedAt` say nothing about direction. Prisma's
 *     filter API cannot express "the newest matching related row has
 *     direction = inbound", so the id set is computed with one raw SQL query
 *     (same precedent as `app/api/inbox/attention-count/route.ts`) using a
 *     correlated newest-message subquery over the existing
 *     `[conversationId, createdAt]` index, bounded and workspace-scoped.
 *   - Conversations with no non-internal messages are NOT unanswered.
 */
import {
  bool,
  EMPTY_SQL,
  join,
  renderSql,
  sql,
  timestamp,
  type SqlDialect,
  type SqlStatement,
} from "@core/db-dialect"

/** Terminal statuses excluded from the unanswered set. */
export const UNANSWERED_EXCLUDED_STATUSES: readonly string[] = [
  "resolved",
  "converted",
  "closed",
  "archived",
  "trashed",
]

/**
 * Safety bound for the candidate-id query: the id set joins a Prisma
 * `id IN (...)` clause, so it must stay bounded. Newest conversations win
 * (ordered by `lastMessageAt DESC`); a workspace with more than this many
 * simultaneously-unanswered conversations has bigger problems than paging.
 */
export const UNANSWERED_CANDIDATE_LIMIT = 2000

export interface UnansweredCandidate {
  status: string
  /** The conversation's newest non-internal message, if any. */
  lastNonInternalMessage: { direction: string; createdAt: Date } | null
}

export interface UnansweredOptions {
  minAgeMinutes?: number
  /** Injectable clock for tests. */
  now?: Date
}

/** Pure predicate — the executable definition of "unanswered". */
export function isUnansweredConversation(
  candidate: UnansweredCandidate,
  options: UnansweredOptions = {},
): boolean {
  if (UNANSWERED_EXCLUDED_STATUSES.includes(candidate.status)) return false
  const last = candidate.lastNonInternalMessage
  if (!last) return false
  if (last.direction !== "inbound") return false
  const minAge = options.minAgeMinutes
  if (typeof minAge === "number" && minAge > 0) {
    const now = options.now ?? new Date()
    const ageMs = now.getTime() - last.createdAt.getTime()
    if (ageMs < minAge * 60_000) return false
  }
  return true
}

/**
 * SQL mirror of `isUnansweredConversation`, rendered for `$queryRawUnsafe`
 * in the dialect of the executing client (`?` on SQLite/libSQL, `$n` on
 * PostgreSQL — see `core/db-dialect.ts`). Returns the statement and its
 * ordered parameter list. Kept here (next to the predicate) so the two
 * definitions cannot drift without a reviewer noticing.
 *
 * Parameters, in order: the workspaceId, the excluded statuses, optionally
 * the max inbound timestamp (now - minAge) when `minAgeMinutes` is set, and
 * the candidate limit. Nothing request-derived is ever inlined.
 *
 * Dialect notes: identifiers are double-quoted (PostgreSQL folds unquoted
 * mixed-case names), the `isInternal` comparison is a dialect boolean literal
 * (`0` on SQLite, `FALSE` on PostgreSQL), and the timestamp threshold binds as
 * ISO text on SQLite and as a `Date` on PostgreSQL.
 */
export function buildUnansweredCandidateQuery(options: {
  workspaceId: string
  minAgeMinutes?: number
  now?: Date
  dialect: SqlDialect
}): SqlStatement {
  let ageClause = EMPTY_SQL
  if (typeof options.minAgeMinutes === "number" && options.minAgeMinutes > 0) {
    const now = options.now ?? new Date()
    const threshold = new Date(now.getTime() - options.minAgeMinutes * 60_000)
    ageClause = sql`AND m."createdAt" <= ${timestamp(threshold)}`
  }
  const fragment = sql`SELECT c."id" AS id
FROM "Conversation" c
JOIN "Message" m ON m."id" = (
  SELECT m2."id" FROM "Message" m2
  WHERE m2."conversationId" = c."id" AND m2."isInternal" = ${bool(false)}
  ORDER BY m2."createdAt" DESC, m2."id" DESC
  LIMIT 1
)
WHERE c."workspaceId" = ${options.workspaceId}
  AND c."status" NOT IN (${join([...UNANSWERED_EXCLUDED_STATUSES])})
  AND m."direction" = 'inbound'
  ${ageClause}
ORDER BY c."lastMessageAt" DESC
LIMIT ${UNANSWERED_CANDIDATE_LIMIT}`
  return renderSql(fragment, options.dialect)
}
