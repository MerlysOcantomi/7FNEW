import assert from "node:assert/strict"
import test from "node:test"
import {
  bool,
  EMPTY_SQL,
  join,
  raw,
  renderSql,
  resolveSqlDialect,
  sql,
  timestamp,
  type SqlDialect,
} from "./db-dialect"

/**
 * NEON-01 — the dialect helper must produce, from ONE template, a statement
 * that binds correctly on SQLite/libSQL (`?`) and on PostgreSQL (`$n`), with
 * the parameters in placeholder order. These tests never touch a database.
 */

const DIALECTS: readonly SqlDialect[] = ["sqlite", "postgresql"]

test("sqlite: every interpolation is a `?` placeholder and a bound parameter", () => {
  const { sql: text, params } = renderSql(sql`SELECT * FROM "T" WHERE a = ${"x"} AND b = ${2}`, "sqlite")
  assert.equal(text, 'SELECT * FROM "T" WHERE a = ? AND b = ?')
  assert.deepEqual(params, ["x", 2])
})

test("postgresql: placeholders are numbered $1…$n in order of appearance", () => {
  const { sql: text, params } = renderSql(sql`SELECT * FROM "T" WHERE a = ${"x"} AND b = ${2} AND c = ${"x"}`, "postgresql")
  assert.equal(text, 'SELECT * FROM "T" WHERE a = $1 AND b = $2 AND c = $3')
  assert.deepEqual(params, ["x", 2, "x"])
})

test("values are never inlined: a request-shaped string stays a parameter in both dialects", () => {
  const hostile = "x' OR 1=1 --"
  for (const dialect of DIALECTS) {
    const { sql: text, params } = renderSql(sql`SELECT 1 WHERE a = ${hostile}`, dialect)
    assert.ok(!text.includes(hostile), dialect)
    assert.deepEqual(params, [hostile])
  }
})

test("placeholder count always equals parameter count (arity), including nested fragments", () => {
  const inner = sql`AND m."createdAt" <= ${timestamp(new Date("2026-07-19T12:00:00.000Z"))}`
  const outer = sql`SELECT 1 FROM "M" m WHERE m."workspaceId" = ${"ws"} ${inner} AND m."n" = ${3} LIMIT ${10}`
  for (const dialect of DIALECTS) {
    const { sql: text, params } = renderSql(outer, dialect)
    const placeholders = dialect === "sqlite" ? text.match(/\?/g) ?? [] : text.match(/\$\d+/g) ?? []
    assert.equal(placeholders.length, params.length, dialect)
    assert.equal(params.length, 4, dialect)
  }
  const pg = renderSql(outer, "postgresql")
  assert.equal(pg.sql, 'SELECT 1 FROM "M" m WHERE m."workspaceId" = $1 AND m."createdAt" <= $2 AND m."n" = $3 LIMIT $4')
  // Numbering is contiguous and each $n maps to params[n-1].
  assert.deepEqual(pg.params, ["ws", new Date("2026-07-19T12:00:00.000Z"), 3, 10])
})

test("nested fragments keep parameter ORDER, not just count", () => {
  const first = sql`a = ${"A"}`
  const second = sql`b = ${"B"}`
  const { sql: text, params } = renderSql(sql`WHERE ${second} AND ${first} AND c = ${"C"}`, "postgresql")
  assert.equal(text, "WHERE b = $1 AND a = $2 AND c = $3")
  assert.deepEqual(params, ["B", "A", "C"])
})

test("boolean literal renders 0/1 on sqlite and FALSE/TRUE on postgresql", () => {
  assert.equal(renderSql(sql`x = ${bool(false)}`, "sqlite").sql, "x = 0")
  assert.equal(renderSql(sql`x = ${bool(true)}`, "sqlite").sql, "x = 1")
  assert.equal(renderSql(sql`x = ${bool(false)}`, "postgresql").sql, "x = FALSE")
  assert.equal(renderSql(sql`x = ${bool(true)}`, "postgresql").sql, "x = TRUE")
  // A literal is not a parameter.
  assert.deepEqual(renderSql(sql`x = ${bool(false)}`, "postgresql").params, [])
})

test("timestamp binds ISO-8601 text on sqlite and a Date on postgresql", () => {
  const at = new Date("2026-07-19T12:00:00.000Z")
  assert.deepEqual(renderSql(sql`t <= ${timestamp(at)}`, "sqlite").params, ["2026-07-19T12:00:00.000Z"])
  const pg = renderSql(sql`t <= ${timestamp(at)}`, "postgresql")
  assert.equal(pg.params.length, 1)
  assert.ok(pg.params[0] instanceof Date)
  assert.equal((pg.params[0] as Date).getTime(), at.getTime())
})

test("raw() inlines code constants verbatim and binds nothing", () => {
  const { sql: text, params } = renderSql(sql`LIMIT ${raw("2000")}`, "postgresql")
  assert.equal(text, "LIMIT 2000")
  assert.deepEqual(params, [])
})

test("join() binds every item of an IN list and numbers them in order", () => {
  const list = join(["a", "b", "c"])
  assert.equal(renderSql(sql`s NOT IN (${list})`, "sqlite").sql, "s NOT IN (?, ?, ?)")
  const pg = renderSql(sql`s NOT IN (${list}) AND w = ${"w"}`, "postgresql")
  assert.equal(pg.sql, "s NOT IN ($1, $2, $3) AND w = $4")
  assert.deepEqual(pg.params, ["a", "b", "c", "w"])
  assert.equal(renderSql(join([]), "postgresql").sql, "")
})

test("EMPTY_SQL renders to nothing and binds nothing (optional clauses)", () => {
  for (const dialect of DIALECTS) {
    const { sql: text, params } = renderSql(sql`SELECT 1 ${EMPTY_SQL}`, dialect)
    assert.equal(text, "SELECT 1 ")
    assert.deepEqual(params, [])
  }
})

test("resolveSqlDialect: libsql/file URLs are sqlite, postgres URLs are postgresql", () => {
  assert.equal(resolveSqlDialect("libsql://example.invalid"), "sqlite")
  assert.equal(resolveSqlDialect("LIBSQL://example.invalid"), "sqlite")
  assert.equal(resolveSqlDialect("file:./dev.db"), "sqlite")
  assert.equal(resolveSqlDialect("postgresql://user:pw@example.invalid/db?sslmode=require"), "postgresql")
  assert.equal(resolveSqlDialect("postgres://example.invalid/db"), "postgresql")
})

test("resolveSqlDialect fails closed on a missing or unknown URL and never echoes the URL", () => {
  assert.throws(() => resolveSqlDialect(""), /no database URL is configured/)
  assert.throws(() => resolveSqlDialect("not-a-url"), /unsupported database URL scheme "\(none\)"/)
  const secretish = "mysql://user:hunter2@host.invalid/db"
  assert.throws(
    () => resolveSqlDialect(secretish),
    (error: unknown) => error instanceof Error && /unsupported database URL scheme "mysql:"/.test(error.message) && !error.message.includes("hunter2"),
  )
})

test("resolveSqlDialect reads DATABASE_URL before TURSO_DATABASE_URL, like core/db.ts", () => {
  const saved = { a: process.env.DATABASE_URL, b: process.env.TURSO_DATABASE_URL }
  try {
    process.env.DATABASE_URL = "postgresql://example.invalid/db"
    process.env.TURSO_DATABASE_URL = "libsql://example.invalid"
    assert.equal(resolveSqlDialect(), "postgresql")
    delete process.env.DATABASE_URL
    assert.equal(resolveSqlDialect(), "sqlite")
  } finally {
    if (saved.a === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = saved.a
    if (saved.b === undefined) delete process.env.TURSO_DATABASE_URL
    else process.env.TURSO_DATABASE_URL = saved.b
  }
})
