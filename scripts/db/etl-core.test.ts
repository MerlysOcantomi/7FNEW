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
import { BASELINE_SHA256, BASELINE_SQL_PATH } from "./etl-turso-to-postgres"
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
