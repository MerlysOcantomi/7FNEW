import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import {
  canonicalFromSource,
  canonicalFromTargetText,
  displayValue,
  insertOrder,
  orderRowsForSelfReferences,
  parseSourceBoolean,
  parseSourceDateTime,
  parseTargetSchema,
  rowDigest,
  tableDigest,
  toPostgresTimestamp,
  transformCell,
  transformRow,
  type TableDef,
} from "./etl-core"
import {
  BASELINE_SHA256,
  BASELINE_SQL_PATH,
  assertStagingId,
  assertTargetUrl,
  checkLocalServerAddress,
  checkStagingMarker,
  expectationFromFlags,
  formatStagingMarker,
  parseStagingMarker,
} from "./etl-turso-to-postgres"
import { createHash } from "node:crypto"

/** NEON-04 — pure unit tests of the ETL core against the real pinned baseline. No database. */

const SQL = readFileSync(BASELINE_SQL_PATH, "utf8")
const SCHEMA = parseTargetSchema(SQL)

test("the target schema is parsed from the pinned baseline: 50 tables, 87 FKs, only the five fidelity types", () => {
  assert.equal(createHash("sha256").update(SQL).digest("hex"), BASELINE_SHA256)
  assert.equal(SCHEMA.tables.length, 50)
  assert.equal(SCHEMA.tables.reduce((n, t) => n + t.foreignKeys.length, 0), 87)
  const types = new Set(SCHEMA.tables.flatMap((t) => t.columns.map((c) => c.type)))
  assert.deepEqual([...types].sort(), ["BOOLEAN", "DOUBLE PRECISION", "INTEGER", "TEXT", "TIMESTAMP(3)"])
  assert.ok(SCHEMA.tables.every((t) => t.primaryKey.length === 1 && t.primaryKey[0] === "id"))
  const ws = SCHEMA.byName.get("Workspace")!
  assert.equal(ws.columns.find((c) => c.name === "entitlementRevision")?.type, "INTEGER")
  assert.equal(ws.columns.find((c) => c.name === "updatedAt")?.notNull, true)
  assert.equal(ws.columns.find((c) => c.name === "createdAt")?.hasDefault, true)
  assert.ok(ws.uniqueIndexes.some((u) => u.columns.join() === "slug"))
  const media = SCHEMA.byName.get("PresenceMedia")!
  assert.ok(media.foreignKeys.some((fk) => fk.references === "PresenceMedia" && fk.column === "sourceMediaId"), "the one self-reference")
})

test("parseTargetSchema fails closed on an unknown column type or a table without primary key", () => {
  assert.throws(() => parseTargetSchema('CREATE TABLE "X" (\n    "id" TEXT NOT NULL,\n    "j" JSONB,\n    CONSTRAINT "X_pkey" PRIMARY KEY ("id")\n);'), /unsupported column type/)
  assert.throws(() => parseTargetSchema('CREATE TABLE "X" (\n    "id" TEXT NOT NULL\n);'), /no primary key/)
})

test("insertOrder puts every referenced table before its dependants, deterministically, and reports cycles", () => {
  const order = insertOrder(SCHEMA)
  assert.equal(order.length, 50)
  const position = new Map(order.map((t, i) => [t, i]))
  for (const t of SCHEMA.tables) for (const fk of t.foreignKeys) if (fk.references !== t.name) assert.ok(position.get(fk.references)! < position.get(t.name)!, `${fk.references} before ${t.name}`)
  assert.deepEqual(insertOrder(SCHEMA), order, "deterministic")
  assert.equal(order[0], "AllowedEmail")
  const cyclic = parseTargetSchema(
    [
      'CREATE TABLE "A" (\n    "id" TEXT NOT NULL,\n    "b" TEXT,\n    CONSTRAINT "A_pkey" PRIMARY KEY ("id")\n);',
      'CREATE TABLE "B" (\n    "id" TEXT NOT NULL,\n    "a" TEXT,\n    CONSTRAINT "B_pkey" PRIMARY KEY ("id")\n);',
      'ALTER TABLE "A" ADD CONSTRAINT "A_b_fkey" FOREIGN KEY ("b") REFERENCES "B"("id") ON DELETE SET NULL ON UPDATE CASCADE;',
      'ALTER TABLE "B" ADD CONSTRAINT "B_a_fkey" FOREIGN KEY ("a") REFERENCES "A"("id") ON DELETE SET NULL ON UPDATE CASCADE;',
    ].join("\n"),
  )
  assert.throws(() => insertOrder(cyclic), /FK cycle between tables: A, B/)
})

test("orderRowsForSelfReferences emits parents first and refuses a cycle or a dangling parent", () => {
  const rows = [
    { id: "v2", sourceMediaId: "v1" },
    { id: "orig", sourceMediaId: null },
    { id: "v1", sourceMediaId: "orig" },
  ]
  assert.deepEqual(orderRowsForSelfReferences(rows, "id", ["sourceMediaId"]).map((r) => r.id), ["orig", "v1", "v2"])
  assert.throws(() => orderRowsForSelfReferences([{ id: "a", p: "b" }, { id: "b", p: "a" }], "id", ["p"]), /self-reference cycle or dangling parent/)
  assert.throws(() => orderRowsForSelfReferences([{ id: "a", p: "missing" }], "id", ["p"]), /dangling/)
  assert.deepEqual(orderRowsForSelfReferences(rows, "id", []), rows, "no self-reference → untouched")
})

test("parseSourceDateTime accepts the libSQL adapter shape, the SQLite CURRENT_TIMESTAMP shape and epochs; refuses garbage", () => {
  assert.equal(parseSourceDateTime("2026-07-19T12:00:00.123+00:00")!.toISOString(), "2026-07-19T12:00:00.123Z")
  assert.equal(parseSourceDateTime("2026-07-19T12:00:00.123+02:00")!.toISOString(), "2026-07-19T10:00:00.123Z", "offset honoured")
  assert.equal(parseSourceDateTime("2026-07-19T12:00:00.123Z")!.toISOString(), "2026-07-19T12:00:00.123Z")
  assert.equal(parseSourceDateTime("2026-07-19 12:00:00")!.toISOString(), "2026-07-19T12:00:00.000Z", "SQLite CURRENT_TIMESTAMP is UTC")
  assert.equal(parseSourceDateTime("2026-07-19T12:00:00")!.toISOString(), "2026-07-19T12:00:00.000Z", "no zone → UTC, never local")
  assert.equal(parseSourceDateTime("2026-07-19")!.toISOString(), "2026-07-19T00:00:00.000Z")
  assert.equal(parseSourceDateTime(1784894400123)!.toISOString(), "2026-07-24T12:00:00.123Z", "epoch ms")
  assert.equal(parseSourceDateTime(1784894400)!.toISOString(), "2026-07-24T12:00:00.000Z", "epoch s")
  assert.equal(parseSourceDateTime(null), null)
  assert.throws(() => parseSourceDateTime("19/07/2026"), /unrecognised DateTime text shape/)
  assert.throws(() => parseSourceDateTime("2026-13-45T99:99:99.000+00:00"), /invalid DateTime/)
  assert.equal(toPostgresTimestamp(new Date("2026-07-19T12:00:00.123Z")), "2026-07-19 12:00:00.123")
})

test("parseSourceBoolean maps SQLite 0/1 (and only those) to booleans", () => {
  assert.equal(parseSourceBoolean(0), false)
  assert.equal(parseSourceBoolean(1), true)
  assert.equal(parseSourceBoolean(BigInt(1)), true)
  assert.equal(parseSourceBoolean(null), null)
  assert.throws(() => parseSourceBoolean(2), /unsupported BOOLEAN storage/)
  assert.throws(() => parseSourceBoolean("yes"), /unsupported BOOLEAN storage/)
})

test("transformCell is driven by the TARGET type: integers stay integers, booleans only where the column is BOOLEAN", () => {
  const int = { name: "progreso", type: "INTEGER", notNull: true, hasDefault: true } as const
  const bool = { name: "isPrivate", type: "BOOLEAN", notNull: true, hasDefault: true } as const
  const dbl = { name: "presupuesto", type: "DOUBLE PRECISION", notNull: false, hasDefault: false } as const
  const txt = { name: "metadata", type: "TEXT", notNull: false, hasDefault: false } as const
  const ts = { name: "createdAt", type: "TIMESTAMP(3)", notNull: true, hasDefault: true } as const
  assert.equal(transformCell(int, 1), 1, "a 1 in an INTEGER column is the number 1, not true")
  assert.equal(transformCell(bool, 1), true)
  assert.equal(transformCell(dbl, 1234.5), 1234.5)
  assert.equal(transformCell(txt, '{"a":1}'), '{"a":1}')
  assert.equal(transformCell(ts, "2026-07-19T12:00:00.123+00:00"), "2026-07-19 12:00:00.123")
  assert.equal(transformCell(txt, null), null)
  assert.throws(() => transformCell({ name: "updatedAt", type: "TIMESTAMP(3)", notNull: true, hasDefault: false }, null), /NULL in NOT NULL column updatedAt/)
  assert.throws(() => transformCell(int, 1.5), /non-integer/)
  assert.throws(() => transformCell(txt, 1.5), /non-text storage/)
})

test("transformRow follows the target column order, NULLs columns absent from the source and warns on invalid JSON-looking text", () => {
  const ws = SCHEMA.byName.get("Workspace")!
  const now = "2026-07-19T12:00:00.000+00:00"
  const { values, warnings } = transformRow(ws, { id: "w1", nombre: "W", slug: "w", createdAt: now, updatedAt: now, config: '{"modules":{"inbox":true}}' })
  assert.equal(values.length, ws.columns.length)
  assert.equal(values[ws.columns.findIndex((c) => c.name === "entitlementRevision")], null, "new-in-PostgreSQL column → NULL")
  assert.deepEqual(warnings, [])
  const bad = transformRow(ws, { id: "w2", nombre: "W", slug: "w2", createdAt: now, updatedAt: now, config: "{not json" })
  assert.deepEqual(bad.warnings, ["Workspace.config: JSON-looking text is not valid JSON"])
})

test("canonical representation: source and target forms of the same value agree; different values do not", () => {
  const bool = { name: "isDefault", type: "BOOLEAN", notNull: true, hasDefault: true } as const
  const ts = { name: "createdAt", type: "TIMESTAMP(3)", notNull: true, hasDefault: true } as const
  const dbl = { name: "presupuesto", type: "DOUBLE PRECISION", notNull: false, hasDefault: false } as const
  assert.equal(canonicalFromSource(bool, 1), canonicalFromTargetText(bool, "true"))
  assert.equal(canonicalFromSource(bool, 0), canonicalFromTargetText(bool, "f"))
  assert.equal(canonicalFromSource(ts, "2026-07-19T14:00:00.500+02:00"), canonicalFromTargetText(ts, "2026-07-19 12:00:00.5"), "PostgreSQL drops trailing zeros of the fraction")
  assert.equal(canonicalFromSource(ts, "2026-07-19 12:00:00"), canonicalFromTargetText(ts, "2026-07-19 12:00:00"))
  assert.equal(canonicalFromSource(dbl, 1234.5), canonicalFromTargetText(dbl, "1234.5"))
  assert.notEqual(canonicalFromSource(bool, 1), canonicalFromTargetText(bool, "false"))
  assert.notEqual(canonicalFromSource(ts, "2026-07-19T12:00:00.123+00:00"), canonicalFromTargetText(ts, "2026-07-19 12:00:00.124"))
})

test("digests are deterministic and independent of row order; any cell change changes them", () => {
  const a = rowDigest(["m1", "ws", true, "2026-07-19T12:00:00.123Z", null])
  assert.equal(a, rowDigest(["m1", "ws", true, "2026-07-19T12:00:00.123Z", null]))
  assert.notEqual(a, rowDigest(["m1", "ws", false, "2026-07-19T12:00:00.123Z", null]))
  const rows = [
    { pk: "b", digest: "2" },
    { pk: "a", digest: "1" },
  ]
  assert.equal(tableDigest(rows), tableDigest([...rows].reverse()))
  assert.notEqual(tableDigest(rows), tableDigest([{ pk: "a", digest: "1" }]))
})

test("displayValue redacts sensitive columns and truncates long values", () => {
  const shown = displayValue("ChannelConnection", "credentials", "enc:v1:deadbeef-ciphertext")
  assert.match(shown, /^<redacted sha256:[0-9a-f]{12}>$/)
  assert.ok(!shown.includes("deadbeef"))
  assert.equal(displayValue("Message", "content", "hola"), "hola")
  assert.equal(displayValue("Message", "content", null), "NULL")
  assert.equal(displayValue("Message", "content", "x".repeat(200)).length, 118)
  const t: TableDef = SCHEMA.byName.get("ClientAuth")!
  assert.ok(t.columns.some((c) => c.name === "passwordHash"), "the redacted ClientAuth column exists")
})

test("checkLocalServerAddress: loopback and Unix sockets always pass; a private address only with a declared forwarded loopback; public never", () => {
  assert.doesNotThrow(() => checkLocalServerAddress(null, false), "NULL = Unix socket")
  assert.doesNotThrow(() => checkLocalServerAddress("127.0.0.1", false))
  assert.doesNotThrow(() => checkLocalServerAddress("::1", false))
  assert.throws(() => checkLocalServerAddress("172.17.0.2", false), /needs --forwarded-loopback/)
  assert.throws(() => checkLocalServerAddress("10.0.0.5", false), /needs --forwarded-loopback/)
  assert.throws(() => checkLocalServerAddress("192.168.1.9", false), /needs --forwarded-loopback/)
  assert.doesNotThrow(() => checkLocalServerAddress("172.17.0.2", true))
  assert.doesNotThrow(() => checkLocalServerAddress("fd00::2", true))
  assert.throws(() => checkLocalServerAddress("8.8.8.8", true), /not loopback$/, "public stays refused even when forwarded")
  assert.throws(() => checkLocalServerAddress("172.32.0.1", true), /not loopback$/, "172.32/16 is not RFC 1918")
  assert.throws(() => checkLocalServerAddress("2001:db8::1", true), /not loopback$/)
})

test("staging identity marker: strict format, exact match required, absence and every mismatch fail closed, nothing echoed", () => {
  const marker = formatStagingMarker("sevenf-neon04-staging")
  assert.equal(marker, "sevenf:environment=staging;sevenf:migration=neon-04;sevenf:target=sevenf-neon04-staging")
  assert.deepEqual(parseStagingMarker(marker), { environment: "staging", migration: "neon-04", target: "sevenf-neon04-staging" })
  assert.deepEqual(checkStagingMarker(marker, "sevenf-neon04-staging").target, "sevenf-neon04-staging")

  // absent
  assert.throws(() => checkStagingMarker(null, "sevenf-neon04-staging"), /carries no staging identity marker/)
  assert.throws(() => checkStagingMarker("   ", "sevenf-neon04-staging"), /carries no staging identity marker/)
  // different target id
  assert.throws(() => checkStagingMarker(formatStagingMarker("other-staging"), "sevenf-neon04-staging"), /names a different target/)
  // wrong environment / migration (hand-written comments)
  assert.throws(() => checkStagingMarker("sevenf:environment=local;sevenf:migration=neon-04;sevenf:target=sevenf-neon04-staging", "sevenf-neon04-staging"), /environment is not staging/)
  assert.throws(() => checkStagingMarker("sevenf:environment=staging;sevenf:migration=neon-05;sevenf:target=sevenf-neon04-staging", "sevenf-neon04-staging"), /migration is not neon-04/)
  // malformed: free text, missing key, duplicate key, extra key, empty value
  for (const bad of [
    "staging database, do not touch",
    "sevenf:environment=staging;sevenf:target=sevenf-neon04-staging",
    "sevenf:environment=staging;sevenf:environment=staging;sevenf:target=sevenf-neon04-staging",
    `${marker};extra=1`,
    "sevenf:environment=;sevenf:migration=neon-04;sevenf:target=sevenf-neon04-staging",
  ]) {
    assert.throws(() => checkStagingMarker(bad, "sevenf-neon04-staging"), /malformed/, bad)
    try {
      checkStagingMarker(bad, "sevenf-neon04-staging")
    } catch (err) {
      assert.ok(!(err as Error).message.includes("do not touch"), "the comment text found is never echoed")
    }
  }
  // the expected id itself is validated and can never look like production
  assert.throws(() => assertStagingId("prod-staging"), /must not look like production/)
  assert.throws(() => assertStagingId("Staging!"), /3-64 chars/)
  assert.throws(() => assertStagingId(""), /3-64 chars/)
  assert.throws(() => formatStagingMarker("x"), /3-64 chars/)
})

test("target expectations: staging REQUIRES an id, local never needs one; forwarded-loopback stays local-only; no production role", () => {
  const base = { "expect-target-host": "db.example.invalid", "expect-target-database": "sevenf_staging" }
  assert.throws(() => expectationFromFlags({ ...base, "target-role": "staging" }), /requires --expect-staging-id/)
  assert.deepEqual(expectationFromFlags({ ...base, "target-role": "staging", "expect-staging-id": "sevenf-neon04-staging" }), {
    role: "staging",
    host: "db.example.invalid",
    database: "sevenf_staging",
    stagingId: "sevenf-neon04-staging",
  })
  assert.throws(() => expectationFromFlags({ ...base, "target-role": "staging", "expect-staging-id": "prod-1" }), /must not look like production/)
  assert.throws(() => expectationFromFlags({ ...base, "target-role": "staging", "forwarded-loopback": true, "expect-staging-id": "sevenf-neon04-staging" }), /only applies to --target-role local/)
  assert.throws(() => expectationFromFlags({ ...base, "target-role": "production", "expect-staging-id": "sevenf-neon04-staging" }), /no production mode/)
  const local = { "target-role": "local", "expect-target-host": "127.0.0.1", "expect-target-database": "t7f_x" }
  assert.deepEqual(expectationFromFlags(local), { role: "local", host: "127.0.0.1", database: "t7f_x", forwardedLoopback: false })
  assert.deepEqual(expectationFromFlags({ ...local, "forwarded-loopback": true }).forwardedLoopback, true)
  assert.throws(() => expectationFromFlags({ ...local, "expect-staging-id": "sevenf-neon04-staging" }), /only applies to --target-role staging/)

  // URL guard: an operator-supplied host/database that match the URL are NOT enough for staging without an id
  const url = "postgresql://u:p@db.example.invalid:5432/sevenf_staging"
  assert.throws(() => assertTargetUrl(url, { role: "staging", host: "db.example.invalid", database: "sevenf_staging" }), /requires --expect-staging-id/)
  assert.doesNotThrow(() => assertTargetUrl(url, { role: "staging", host: "db.example.invalid", database: "sevenf_staging", stagingId: "sevenf-neon04-staging" }))
  assert.throws(() => assertTargetUrl("postgresql://u:p@db.example.invalid:5432/sevenf_prod", { role: "staging", host: "db.example.invalid", database: "sevenf_prod", stagingId: "sevenf-neon04-staging" }), /looks like production/)
})
