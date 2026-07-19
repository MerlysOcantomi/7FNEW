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
 * SQL mirror of `isUnansweredConversation`, parameterized for
 * `$queryRawUnsafe` with `?` placeholders. Returns the statement and its
 * ordered parameter list. Kept here (next to the predicate) so the two
 * definitions cannot drift without a reviewer noticing.
 *
 * Placeholders: workspaceId, then optionally the max inbound timestamp
 * (now - minAge) in ISO format when `minAgeMinutes` is set.
 */
export function buildUnansweredCandidateQuery(options: {
  workspaceId: string
  minAgeMinutes?: number
  now?: Date
}): { sql: string; params: Array<string | number> } {
  const statusList = UNANSWERED_EXCLUDED_STATUSES.map((s) => `'${s}'`).join(", ")
  const params: Array<string | number> = [options.workspaceId]
  let ageClause = ""
  if (typeof options.minAgeMinutes === "number" && options.minAgeMinutes > 0) {
    const now = options.now ?? new Date()
    const threshold = new Date(now.getTime() - options.minAgeMinutes * 60_000)
    ageClause = "AND m.createdAt <= ?"
    params.push(threshold.toISOString())
  }
  const sql = `SELECT c.id AS id
FROM Conversation c
JOIN Message m ON m.id = (
  SELECT m2.id FROM Message m2
  WHERE m2.conversationId = c.id AND m2.isInternal = 0
  ORDER BY m2.createdAt DESC, m2.id DESC
  LIMIT 1
)
WHERE c.workspaceId = ?
  AND c.status NOT IN (${statusList})
  AND m.direction = 'inbound'
  ${ageClause}
ORDER BY c.lastMessageAt DESC
LIMIT ${UNANSWERED_CANDIDATE_LIMIT}`
  return { sql, params }
}
