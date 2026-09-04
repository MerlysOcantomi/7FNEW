/**
 * Minimal SQL dialect helper for the FEW raw statements 7F runs through
 * `$queryRawUnsafe` (NEON-01 — PostgreSQL compatibility hardening).
 *
 * This is deliberately NOT a query builder or a database abstraction. It does
 * exactly three things the existing raw statements need in order to run
 * unchanged on Turso/SQLite today and on PostgreSQL after the provider flip:
 *
 *   1. Placeholders — SQLite/libSQL binds positional `?`, PostgreSQL binds
 *      numbered `$1 … $n`. Callers write ONE template; `renderSql` numbers
 *      the placeholders for the target dialect and returns the parameters in
 *      the same order, so arity and order can never drift apart.
 *   2. Boolean literals — Prisma stores `Boolean` as INTEGER 0/1 on SQLite
 *      and as a real `boolean` on PostgreSQL, where `col = 0` is a type
 *      error. `bool(v)` renders `1`/`0` or `TRUE`/`FALSE` per dialect.
 *   3. Timestamp parameters — Prisma stores `DateTime` as ISO-8601 text on
 *      SQLite (compared lexically) and as `timestamp(3)` on PostgreSQL, whose
 *      driver expects a `Date`. `timestamp(d)` binds the right representation.
 *
 * Everything interpolated into a template becomes a BOUND PARAMETER. The only
 * way to inline text is the explicit `raw()` marker, reserved for constants
 * that originate in code (never from a request). Identifiers are written by
 * the caller, double-quoted (`"Conversation"`, `c."workspaceId"`): SQLite
 * accepts the standard quoting and PostgreSQL requires it for the mixed-case
 * names Prisma creates — unquoted `workspaceId` would fold to `workspaceid`.
 *
 * Dialect resolution mirrors `core/db.ts`: the same URL variables, in the
 * same precedence, and fail-closed on anything unrecognised. A `libsql:` or
 * `file:` URL is SQLite; `postgres:`/`postgresql:` is PostgreSQL. Nothing
 * here reads a value other than the URL scheme, and nothing is ever logged.
 */

export type SqlDialect = "sqlite" | "postgresql"

/** Values that can be bound as parameters. */
export type SqlParam = string | number | boolean | Date | null

/** A rendered statement, ready for `db.$queryRawUnsafe(sql, ...params)`. */
export interface SqlStatement {
  readonly sql: string
  readonly params: readonly SqlParam[]
}

/** Trusted text inlined verbatim. Only for constants defined in code. */
export class SqlRaw {
  constructor(readonly text: string) {}
}

/** Boolean literal rendered per dialect (`1`/`0` vs `TRUE`/`FALSE`). */
export class SqlBool {
  constructor(readonly value: boolean) {}
}

/** DateTime parameter bound per dialect (ISO text vs `Date`). */
export class SqlTimestamp {
  constructor(readonly value: Date) {}
}

/** A dialect-agnostic template: literal parts interleaved with values. */
export class SqlFragment {
  constructor(
    readonly parts: readonly string[],
    readonly values: readonly SqlValue[],
  ) {}
}

export type SqlValue = SqlParam | SqlRaw | SqlBool | SqlTimestamp | SqlFragment

/** Tagged template: every `${…}` becomes a bound parameter unless marked. */
export function sql(strings: TemplateStringsArray, ...values: SqlValue[]): SqlFragment {
  return new SqlFragment([...strings], values)
}

/** Inline a code-defined constant verbatim. Never pass request-derived text. */
export function raw(text: string): SqlRaw {
  return new SqlRaw(text)
}

export function bool(value: boolean): SqlBool {
  return new SqlBool(value)
}

export function timestamp(value: Date): SqlTimestamp {
  return new SqlTimestamp(value)
}

/** The empty fragment — for optional clauses. */
export const EMPTY_SQL: SqlFragment = new SqlFragment([""], [])

/** Join fragments/values with a literal separator (e.g. a bound `IN (…)` list). */
export function join(items: readonly SqlValue[], separator = ", "): SqlFragment {
  if (items.length === 0) return EMPTY_SQL
  const parts: string[] = [""]
  for (let i = 1; i < items.length; i++) parts.push(separator)
  parts.push("")
  return new SqlFragment(parts, items)
}

/**
 * Render a fragment for one dialect. Placeholders are numbered in the order
 * the values appear (depth-first through nested fragments), and `params` is
 * returned in exactly that order.
 */
export function renderSql(fragment: SqlFragment, dialect: SqlDialect): SqlStatement {
  const params: SqlParam[] = []
  let text = ""

  const placeholder = (): string => (dialect === "postgresql" ? `$${params.length}` : "?")

  const emit = (value: SqlValue): void => {
    if (value instanceof SqlFragment) {
      for (let i = 0; i < value.parts.length; i++) {
        text += value.parts[i]
        if (i < value.values.length) emit(value.values[i])
      }
      return
    }
    if (value instanceof SqlRaw) {
      text += value.text
      return
    }
    if (value instanceof SqlBool) {
      text += dialect === "postgresql" ? (value.value ? "TRUE" : "FALSE") : value.value ? "1" : "0"
      return
    }
    if (value instanceof SqlTimestamp) {
      params.push(dialect === "postgresql" ? value.value : value.value.toISOString())
      text += placeholder()
      return
    }
    params.push(value)
    text += placeholder()
  }

  emit(fragment)
  return { sql: text, params }
}

const SQLITE_SCHEMES = new Set(["libsql:", "file:", "http:", "https:", "ws:", "wss:"])
const POSTGRES_SCHEMES = new Set(["postgres:", "postgresql:"])

/**
 * Resolve the dialect from a connection URL. Defaults to the same variables,
 * in the same precedence, that `core/db.ts` uses to build the client, so the
 * raw statements always speak the dialect of the client that executes them.
 * Fail-closed: an absent or unrecognised URL throws instead of guessing.
 */
export function resolveSqlDialect(url: string | undefined = connectionUrlFromEnv()): SqlDialect {
  if (!url) {
    throw new Error(
      "[7F] SQL dialect could not be resolved: no database URL is configured. " +
        "Set DATABASE_URL (or TURSO_DATABASE_URL).",
    )
  }
  const scheme = schemeOf(url)
  if (scheme && SQLITE_SCHEMES.has(scheme)) return "sqlite"
  if (scheme && POSTGRES_SCHEMES.has(scheme)) return "postgresql"
  throw new Error(
    `[7F] SQL dialect could not be resolved: unsupported database URL scheme "${scheme ?? "(none)"}".`,
  )
}

function connectionUrlFromEnv(): string | undefined {
  return process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL
}

/** The URL scheme including the trailing colon, lower-cased; never the rest of the URL. */
function schemeOf(url: string): string | null {
  const match = /^([A-Za-z][A-Za-z0-9+.-]*):/.exec(url)
  return match ? `${match[1].toLowerCase()}:` : null
}
