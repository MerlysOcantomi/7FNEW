/**
 * Read/write classification of raw SQL for the `database.write` guard.
 *
 * Only `$queryRaw` / `$queryRawUnsafe` need this: `$executeRaw*` is a write
 * by contract. The rule is deliberately conservative — under a write freeze a
 * false "write" only costs a refused read, while a false "read" would let a
 * disguised write through:
 *
 *   - the statement must START with a read verb (SELECT, WITH, VALUES,
 *     TABLE, SHOW, EXPLAIN) after comments and whitespace are stripped;
 *   - it must not contain, anywhere, a data-modifying or DDL keyword
 *     (data-modifying CTEs, `SELECT … FOR UPDATE`, function calls with
 *     side effects hidden behind a WITH are all refused);
 *   - anything else (empty, DO blocks, CALL, COPY, transaction control) is
 *     a write.
 */
const READ_LEADERS = new Set(["select", "with", "values", "table", "show", "explain"])
const MUTATING = /\b(insert|update|delete|merge|truncate|alter|drop|create|grant|revoke|copy|lock|refresh|vacuum|analyze|reindex|cluster|call|do|set|reset|nextval|setval|pg_advisory_lock|pg_advisory_xact_lock)\b/i

function stripLeadingComments(sql: string): string {
  let s = sql
  for (;;) {
    const before = s
    s = s.replace(/^\s+/, "").replace(/^--[^\n]*\n?/, "").replace(/^\/\*[\s\S]*?\*\//, "")
    if (s === before) return s
  }
}

export type RawSqlKind = "read" | "write"

export function classifyRawSql(sql: string): RawSqlKind {
  const body = stripLeadingComments(sql)
  const leader = /^([a-z]+)(?![a-z0-9_$])/i.exec(body)?.[1]?.toLowerCase()
  if (!leader || !READ_LEADERS.has(leader)) return "write"
  if (MUTATING.test(body)) return "write"
  return "read"
}
