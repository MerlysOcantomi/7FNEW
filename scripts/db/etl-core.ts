/**
 * NEON-04 — pure core of the Turso → PostgreSQL ETL (no I/O).
 *
 * The TARGET schema is the single source of truth: it is parsed from the
 * immutable PostgreSQL baseline (`prisma/migrations-postgres/0_init`), never
 * from the source database. Every cell is transformed by the target column's
 * type, so the ETL cannot "copy bytes": SQLite `0/1` become booleans only
 * where the target column is BOOLEAN, SQLite date strings become UTC
 * timestamps only where the target column is TIMESTAMP(3), and text stays
 * text (JSON documents, ciphertext included — never decrypted, never
 * re-encoded).
 *
 * Also here: FK-derived insert order (Kahn over NOT NULL and nullable edges
 * alike, self-references handled per row), and the canonical normalized
 * representation → deterministic digest used by the parity verifier on BOTH
 * sides. Everything is unit-tested in etl-core.test.ts.
 */

import { createHash } from "node:crypto"

export type ColumnType = "TEXT" | "TIMESTAMP(3)" | "INTEGER" | "BOOLEAN" | "DOUBLE PRECISION"

export interface ColumnDef {
  name: string
  type: ColumnType
  notNull: boolean
  hasDefault: boolean
}

export interface ForeignKeyDef {
  table: string
  column: string
  references: string
  referencedColumn: string
  onDelete: string
}

export interface TableDef {
  name: string
  columns: ColumnDef[]
  primaryKey: string[]
  uniqueIndexes: Array<{ name: string; columns: string[] }>
  foreignKeys: ForeignKeyDef[]
}

export interface TargetSchema {
  tables: TableDef[]
  byName: Map<string, TableDef>
}

const COLUMN_RE = /^\s+"([A-Za-z0-9_]+)" (TEXT|TIMESTAMP\(3\)|INTEGER|BOOLEAN|DOUBLE PRECISION)( NOT NULL)?( DEFAULT [^,\n]+)?,?$/gm

/** Parse the baseline SQL (CREATE TABLE / CREATE [UNIQUE] INDEX / ALTER TABLE … FOREIGN KEY). Fails closed on unknown column types. */
export function parseTargetSchema(sql: string): TargetSchema {
  const tables: TableDef[] = []
  for (const m of sql.matchAll(/CREATE TABLE "([A-Za-z0-9_]+)" \(([\s\S]*?)\n\);/g)) {
    const name = m[1]
    const body = m[2]
    const columns: ColumnDef[] = []
    for (const c of body.matchAll(COLUMN_RE)) {
      columns.push({ name: c[1], type: c[2] as ColumnType, notNull: !!c[3], hasDefault: !!c[4] })
    }
    const unknown = [...body.matchAll(/^\s+"([A-Za-z0-9_]+)" ([A-Z][A-Z() 0-9]*?)(?: NOT NULL)?(?: DEFAULT [^,\n]+)?,?$/gm)].filter(
      (x) => !["TEXT", "TIMESTAMP(3)", "INTEGER", "BOOLEAN", "DOUBLE PRECISION"].includes(x[2]),
    )
    if (unknown.length > 0) throw new Error(`etl-core: unsupported column type(s) in ${name}: ${unknown.map((u) => `${u[1]} ${u[2]}`).join(", ")}`)
    const pk = /CONSTRAINT "[A-Za-z0-9_]+" PRIMARY KEY \(([^)]+)\)/.exec(body)
    const primaryKey = pk ? pk[1].split(",").map((s) => s.trim().replace(/"/g, "")) : []
    if (primaryKey.length === 0) throw new Error(`etl-core: table ${name} has no primary key`)
    tables.push({ name, columns, primaryKey, uniqueIndexes: [], foreignKeys: [] })
  }
  const byName = new Map(tables.map((t) => [t.name, t]))
  for (const m of sql.matchAll(/CREATE UNIQUE INDEX "([A-Za-z0-9_]+)" ON "([A-Za-z0-9_]+)"\(([^)]+)\)/g)) {
    byName.get(m[2])?.uniqueIndexes.push({ name: m[1], columns: m[3].split(",").map((s) => s.trim().replace(/"/g, "")) })
  }
  for (const m of sql.matchAll(/ALTER TABLE "([A-Za-z0-9_]+)" ADD CONSTRAINT "[A-Za-z0-9_]+" FOREIGN KEY \("([A-Za-z0-9_]+)"\) REFERENCES "([A-Za-z0-9_]+)"\("([A-Za-z0-9_]+)"\) ON DELETE ([A-Z ]+?) ON UPDATE/g)) {
    const fk: ForeignKeyDef = { table: m[1], column: m[2], references: m[3], referencedColumn: m[4], onDelete: m[5] }
    const t = byName.get(fk.table)
    if (!t) throw new Error(`etl-core: FK on unknown table ${fk.table}`)
    if (!byName.has(fk.references)) throw new Error(`etl-core: FK ${fk.table}.${fk.column} references unknown table ${fk.references}`)
    t.foreignKeys.push(fk)
  }
  return { tables, byName }
}

/**
 * Insert order from the real FK graph (every edge counts, nullable ones too,
 * so no integrity check ever needs disabling). Self-references are handled
 * per row by `orderRowsForSelfReferences`. A cycle between tables is a hard
 * error — it must be analysed explicitly, never papered over.
 */
export function insertOrder(schema: TargetSchema): string[] {
  const names = schema.tables.map((t) => t.name)
  const indegree = new Map(names.map((n) => [n, 0]))
  const dependents = new Map<string, string[]>(names.map((n) => [n, []]))
  for (const t of schema.tables) {
    for (const fk of t.foreignKeys) {
      if (fk.references === t.name) continue
      dependents.get(fk.references)!.push(t.name)
      indegree.set(t.name, indegree.get(t.name)! + 1)
    }
  }
  const ready = names.filter((n) => indegree.get(n) === 0).sort()
  const order: string[] = []
  while (ready.length > 0) {
    const next = ready.shift()!
    order.push(next)
    for (const d of dependents.get(next)!.sort()) {
      indegree.set(d, indegree.get(d)! - 1)
      if (indegree.get(d) === 0) ready.push(d)
    }
    ready.sort()
  }
  if (order.length !== names.length) {
    const cyclic = names.filter((n) => !order.includes(n))
    throw new Error(`etl-core: FK cycle between tables: ${cyclic.join(", ")}`)
  }
  return order
}

/** Rows of a self-referencing table ordered so every parent precedes its children (null parents first). */
export function orderRowsForSelfReferences<T extends Record<string, unknown>>(rows: T[], pkColumn: string, selfRefColumns: string[]): T[] {
  if (selfRefColumns.length === 0) return rows
  const remaining = [...rows]
  const emitted = new Set<unknown>()
  const out: T[] = []
  while (remaining.length > 0) {
    const before = out.length
    for (let i = 0; i < remaining.length; ) {
      const row = remaining[i]
      const parentsReady = selfRefColumns.every((c) => row[c] === null || row[c] === undefined || emitted.has(row[c]))
      if (parentsReady) {
        out.push(row)
        emitted.add(row[pkColumn])
        remaining.splice(i, 1)
      } else i++
    }
    if (out.length === before) {
      throw new Error(`etl-core: self-reference cycle or dangling parent in ${remaining.length} row(s) (pk ${String(remaining[0][pkColumn])})`)
    }
  }
  return out
}

// ─── Cell transformation (source value → target-typed value) ────────────────

/**
 * SQLite/Turso DateTime as written by the Prisma libSQL adapter:
 * `YYYY-MM-DDTHH:MM:SS.sss+HH:MM` (explicit offset). Legacy rows written by
 * SQLite's CURRENT_TIMESTAMP carry `YYYY-MM-DD HH:MM:SS`, which SQLite defines
 * as UTC. Epoch integers (ms or s) are accepted for completeness. Anything
 * else is a hard error: a date that cannot be read is never guessed.
 */
export function parseSourceDateTime(value: unknown): Date | null {
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value
  if (typeof value === "number" || typeof value === "bigint") {
    const n = Number(value)
    return new Date(n > 100_000_000_000 ? n : n * 1000)
  }
  if (typeof value !== "string") throw new Error(`etl-core: unsupported DateTime storage ${typeof value}`)
  const s = value.trim()
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?([+-]\d{2}:\d{2}|Z)$/.test(s)) return checkDate(new Date(s), s)
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(s)) return checkDate(new Date(`${s}Z`), s)
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(s)) return checkDate(new Date(`${s.replace(" ", "T")}Z`), s)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return checkDate(new Date(`${s}T00:00:00Z`), s)
  throw new Error(`etl-core: unrecognised DateTime text shape (length ${s.length})`)
}

function checkDate(d: Date, raw: string): Date {
  if (Number.isNaN(d.getTime())) throw new Error(`etl-core: invalid DateTime value (length ${raw.length})`)
  return d
}

/** PostgreSQL `timestamp(3)` literal in UTC: `YYYY-MM-DD HH:MM:SS.mmm`. */
export function toPostgresTimestamp(d: Date): string {
  return d.toISOString().replace("T", " ").replace("Z", "")
}

export function parseSourceBoolean(value: unknown): boolean | null {
  if (value === null || value === undefined) return null
  if (typeof value === "boolean") return value
  if (typeof value === "number" || typeof value === "bigint") {
    const n = Number(value)
    if (n === 0) return false
    if (n === 1) return true
  }
  if (value === "0" || value === "false") return false
  if (value === "1" || value === "true") return true
  throw new Error(`etl-core: unsupported BOOLEAN storage ${typeof value}`)
}

export type TargetCell = string | number | boolean | null

/** Transform one source cell into the value the target column accepts (timestamps as UTC literals). */
export function transformCell(column: ColumnDef, value: unknown): TargetCell {
  if (value === null || value === undefined) {
    if (column.notNull && !column.hasDefault) throw new Error(`etl-core: NULL in NOT NULL column ${column.name}`)
    return null
  }
  switch (column.type) {
    case "TEXT":
      // Every Prisma-created SQLite column has TEXT affinity, and the read-only
      // Turso audit measured only the `text` storage class in TEXT columns.
      // Anything else is unexpected data, not something to coerce silently.
      if (typeof value === "string") return value
      throw new Error(`etl-core: non-text storage (${typeof value}) in TEXT column ${column.name}`)
    case "TIMESTAMP(3)":
      return toPostgresTimestamp(parseSourceDateTime(value)!)
    case "BOOLEAN":
      return parseSourceBoolean(value)
    case "INTEGER": {
      const n = typeof value === "bigint" ? Number(value) : typeof value === "string" ? Number(value) : (value as number)
      if (!Number.isInteger(n)) throw new Error(`etl-core: non-integer value in INTEGER column ${column.name}`)
      return n
    }
    case "DOUBLE PRECISION": {
      const n = typeof value === "bigint" ? Number(value) : typeof value === "string" ? Number(value) : (value as number)
      if (!Number.isFinite(n)) throw new Error(`etl-core: non-numeric value in DOUBLE PRECISION column ${column.name}`)
      return n
    }
  }
}

export interface TransformedRow {
  values: TargetCell[]
  warnings: string[]
}

/** Columns that hold ciphertext/secrets: compared by digest, never printed. */
export const SENSITIVE_COLUMNS: ReadonlySet<string> = new Set([
  "ChannelConnection.credentials", // AES-256-GCM ciphertext (core/crypto.ts) — carried verbatim, never decrypted
  "ClientAuth.passwordHash",
])

/**
 * Transform a source row into the target column order. Columns absent from the
 * source (new in the PostgreSQL schema, e.g. Workspace.entitlementRevision)
 * become NULL. JSON-looking TEXT that is not valid JSON is a warning, never a
 * silent pass.
 */
export function transformRow(table: TableDef, source: Record<string, unknown>): TransformedRow {
  const warnings: string[] = []
  const values = table.columns.map((column) => {
    const value = source[column.name]
    const cell = transformCell(column, value)
    if (column.type === "TEXT" && typeof cell === "string" && /^[[{]/.test(cell)) {
      try {
        JSON.parse(cell)
      } catch {
        warnings.push(`${table.name}.${column.name}: JSON-looking text is not valid JSON`)
      }
    }
    return cell
  })
  return { values, warnings }
}

// ─── Canonical normalized representation → digest ───────────────────────────

/**
 * Canonical cell used on BOTH sides of the parity check. Source values go
 * through the same transform as the load; target values arrive as text (the
 * verifier reads every column `::text` in a UTC session). Only representation
 * differences are normalised (SQLite `1` vs PostgreSQL `true`, timestamp text
 * forms, float text); a different value stays different.
 */
export function canonicalFromSource(column: ColumnDef, value: unknown): string | number | boolean | null {
  const cell = transformCell(column, value)
  if (cell === null) return null
  if (column.type === "TIMESTAMP(3)") return new Date(`${(cell as string).replace(" ", "T")}Z`).toISOString()
  return cell
}

export function canonicalFromTargetText(column: ColumnDef, text: string | null): string | number | boolean | null {
  if (text === null) return null
  switch (column.type) {
    case "TEXT":
      return text
    case "TIMESTAMP(3)":
      return new Date(`${text.replace(" ", "T")}Z`).toISOString()
    case "BOOLEAN":
      if (text === "true" || text === "t") return true
      if (text === "false" || text === "f") return false
      throw new Error(`etl-core: unexpected boolean text ${JSON.stringify(text)}`)
    case "INTEGER":
    case "DOUBLE PRECISION":
      return Number(text)
  }
}

export function sha256(text: string): string {
  return createHash("sha256").update(text).digest("hex")
}

export function rowDigest(canonicalCells: Array<string | number | boolean | null>): string {
  return sha256(JSON.stringify(canonicalCells))
}

/** Deterministic table digest: rows sorted by primary key text, digests concatenated. */
export function tableDigest(rowsByPk: Array<{ pk: string; digest: string }>): string {
  const sorted = [...rowsByPk].sort((a, b) => (a.pk < b.pk ? -1 : a.pk > b.pk ? 1 : 0))
  return sha256(sorted.map((r) => `${r.pk}:${r.digest}`).join("\n"))
}

export function primaryKeyText(table: TableDef, row: Record<string, unknown>): string {
  return table.primaryKey.map((c) => String(row[c])).join("|")
}

/** What a mismatch report may show for a column value: sensitive columns are digest-only. */
export function displayValue(table: string, column: string, value: unknown): string {
  if (SENSITIVE_COLUMNS.has(`${table}.${column}`)) return `<redacted sha256:${sha256(String(value)).slice(0, 12)}>`
  const text = value === null ? "NULL" : typeof value === "string" ? value : JSON.stringify(value)
  return text.length > 120 ? `${text.slice(0, 117)}…` : text
}
