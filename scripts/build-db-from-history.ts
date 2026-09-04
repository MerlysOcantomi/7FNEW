/**
 * Migration-history verifier (CORE-03C-2B, C7).
 *
 * Fail-closed, local-only harness. It proves, on every run, that:
 *
 *   1. an EMPTY local SQLite database built from `prisma/migrations` via
 *      `prisma migrate deploy` reaches the expected structure
 *      (EXPECTED_TABLES user tables, EXPECTED_INDEXES explicit indexes,
 *      clean `integrity_check` and `foreign_key_check`);
 *   2. the local throwaway ledger records exactly the expected migrations,
 *      in order — a missing or unexpected migration fails the run;
 *   3. every remaining structural difference between the history-built
 *      database and the canonical `prisma/schema.prisma` is EXPLICITLY
 *      declared in `prisma/migrations/drift-manifest.json` — an unknown
 *      difference fails, a stale manifest entry fails, a malformed or
 *      duplicated entry fails, and an entry whose expiry was marked
 *      satisfied while its drift still exists fails.
 *
 * Safety: everything runs inside a fresh `mkdtemp` directory with a
 * temporary Prisma config that never imports dotenv; DATABASE_URL/TURSO_*
 * variables are removed from the child environment; only local `file:`
 * SQLite URLs are used; the repository-local Prisma binary is invoked; all
 * temporary files are deleted on success and failure. No remote database
 * can be reached by construction.
 *
 * Comparison semantics (deliberate):
 *   - objects are compared per table BY NAME: columns (type, notnull,
 *     default, pk membership), foreign keys (referenced table, column
 *     pairs, on_update/on_delete) and explicit indexes (uniqueness, column
 *     list, partiality). Physical column ORDER is excluded on purpose —
 *     SQLite appends `ALTER TABLE ADD COLUMN` at the end, which is a
 *     semantically irrelevant difference the deployed history legitimately
 *     carries.
 *   - `sqlite_*` internals and `_prisma_migrations` are excluded.
 *
 * CLI: `npm run db:verify-history` (exit 0 = history and manifest are in
 * sync with the canonical schema; non-zero otherwise).
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- PRAGMA result rows from node:sqlite are untyped */

import { execFileSync } from "node:child_process"
import { mkdtempSync, rmSync, symlinkSync, writeFileSync, readFileSync, readdirSync, existsSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { DatabaseSync } from "node:sqlite"

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

export const EXPECTED_MIGRATIONS = [
  "0_baseline",
  "1_add_missing_indexes",
  "2_add_link_columns",
  "3_create_portal_tables",
  "4_d5_schema_tightenings",
  "5_d2_retire_legacy_portal_tables",
  "6_found04a_workspace_entitlements",
] as const

export const EXPECTED_TABLES = 50
export const EXPECTED_INDEXES = 94

const EXPIRY_PATTERN = /^(C[0-9]+|AUDIT_DECISION:[A-Za-z0-9_.-]+|NEON_CUTOVER)$/

export interface VerifyOptions {
  migrationsDir?: string
  schemaPath?: string
  manifestPath?: string
  expectedMigrations?: readonly string[]
  expectedTables?: number
  expectedIndexes?: number
}

export interface ManifestEntry {
  id: string
  kind: "foreign-key" | "column-nullability" | "column-default" | "column" | "index" | "table"
  table: string
  identifier?: string
  direction: "history-lacks" | "history-has-extra" | "differs"
  reason: string
  source: string
  expiresWith: string
  expirySatisfied?: boolean
}

interface TableShape {
  columns: Record<string, { type: string; notnull: number; dflt: string | null; pk: number }>
  fks: string[]
  indexes: Record<string, { unique: number; columns: string[]; partial: number }>
}

type Shape = Record<string, TableShape>

interface Drift {
  id: string
  kind: ManifestEntry["kind"]
  table: string
  identifier?: string
  direction: ManifestEntry["direction"]
  detail: string
}

function sanitizedEnv(): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env }
  delete env.DATABASE_URL
  delete env.TURSO_DATABASE_URL
  delete env.DATABASE_AUTH_TOKEN
  delete env.TURSO_AUTH_TOKEN
  env.DOTENV_CONFIG_PATH = "/dev/null"
  env.CHECKPOINT_DISABLE = "1"
  env.PRISMA_HIDE_UPDATE_MESSAGE = "1"
  return env
}

function runPrisma(args: string[]): void {
  execFileSync(join(REPO_ROOT, "node_modules", ".bin", "prisma"), args, {
    cwd: REPO_ROOT,
    env: sanitizedEnv(),
    stdio: ["ignore", "ignore", "pipe"],
  })
}

function writeTempConfig(dir: string, schemaPath: string, migrationsDir: string, dbUrl: string): string {
  // `import "prisma/config"` resolves through a node_modules link inside the
  // temp dir; the config never imports dotenv, so no .env can be read.
  const link = join(dir, "node_modules")
  if (!existsSync(link)) symlinkSync(join(REPO_ROOT, "node_modules"), link)
  const configPath = join(dir, "prisma.config.ts")
  writeFileSync(
    configPath,
    [
      'import { defineConfig } from "prisma/config"',
      "export default defineConfig({",
      `  schema: ${JSON.stringify(schemaPath)},`,
      `  migrations: { path: ${JSON.stringify(migrationsDir)} },`,
      `  datasource: { url: ${JSON.stringify(dbUrl)} },`,
      "})",
      "",
    ].join("\n"),
  )
  return configPath
}

function snapshot(dbPath: string): Shape {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations' ORDER BY name",
      )
      .all() as Array<{ name: string }>
    const shape: Shape = {}
    for (const { name } of tables) {
      const columns: TableShape["columns"] = {}
      for (const c of db.prepare(`PRAGMA table_info("${name}")`).all() as any[]) {
        columns[c.name] = { type: c.type, notnull: c.notnull, dflt: c.dflt_value ?? null, pk: c.pk }
      }
      const fkRows = db.prepare(`PRAGMA foreign_key_list("${name}")`).all() as any[]
      const fkGroups = new Map<number, any[]>()
      for (const f of fkRows) {
        if (!fkGroups.has(f.id)) fkGroups.set(f.id, [])
        fkGroups.get(f.id)!.push(f)
      }
      const fks = [...fkGroups.values()]
        .map((group) => {
          const g = group.sort((a, b) => a.seq - b.seq)
          const cols = g.map((f) => `${f.from}->${f.to}`).join(",")
          return `${g[0].table}(${cols})[update:${g[0].on_update},delete:${g[0].on_delete}]`
        })
        .sort()
      const indexes: TableShape["indexes"] = {}
      for (const i of db.prepare(`PRAGMA index_list("${name}")`).all() as any[]) {
        if (i.origin === "pk" || String(i.name).startsWith("sqlite_")) continue
        const cols = (db.prepare(`PRAGMA index_info("${i.name}")`).all() as any[])
          .sort((a, b) => a.seqno - b.seqno)
          .map((x) => x.name ?? "<expr>")
        indexes[i.name] = { unique: i.unique, columns: cols, partial: i.partial }
      }
      shape[name] = { columns, fks, indexes }
    }
    return shape
  } finally {
    db.close()
  }
}

function countsAndHealth(dbPath: string): { tables: number; indexes: number; integrity: string; fkViolations: number } {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    const tables = (
      db
        .prepare(
          "SELECT COUNT(*) c FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations'",
        )
        .get() as any
    ).c
    const indexes = (
      db
        .prepare(
          "SELECT COUNT(*) c FROM sqlite_schema WHERE type='index' AND name NOT LIKE 'sqlite_%' AND tbl_name <> '_prisma_migrations'",
        )
        .get() as any
    ).c
    const integrity = (db.prepare("PRAGMA integrity_check").get() as any).integrity_check
    const fkViolations = (db.prepare("PRAGMA foreign_key_check").all() as any[]).length
    return { tables, indexes, integrity, fkViolations }
  } finally {
    db.close()
  }
}

function appliedMigrations(dbPath: string): string[] {
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    return (db.prepare("SELECT migration_name FROM _prisma_migrations ORDER BY started_at, migration_name").all() as any[]).map(
      (r) => r.migration_name,
    )
  } finally {
    db.close()
  }
}

/** Compute the semantic differences between the history-built DB and the schema-built DB. */
export function computeDrift(history: Shape, schema: Shape): Drift[] {
  const drift: Drift[] = []
  const allTables = [...new Set([...Object.keys(history), ...Object.keys(schema)])].sort()
  for (const table of allTables) {
    const h = history[table]
    const s = schema[table]
    if (!h) {
      drift.push({ id: `table:${table}`, kind: "table", table, direction: "history-lacks", detail: "table missing from history-built DB" })
      continue
    }
    if (!s) {
      drift.push({ id: `table:${table}`, kind: "table", table, direction: "history-has-extra", detail: "table absent from canonical schema" })
      continue
    }
    const allCols = [...new Set([...Object.keys(h.columns), ...Object.keys(s.columns)])].sort()
    for (const col of allCols) {
      const hc = h.columns[col]
      const sc = s.columns[col]
      if (!hc) {
        drift.push({ id: `column:${table}.${col}`, kind: "column", table, identifier: col, direction: "history-lacks", detail: "column missing" })
        continue
      }
      if (!sc) {
        drift.push({ id: `column:${table}.${col}`, kind: "column", table, identifier: col, direction: "history-has-extra", detail: "column not in schema" })
        continue
      }
      if (hc.notnull !== sc.notnull) {
        drift.push({
          id: `column-nullability:${table}.${col}`,
          kind: "column-nullability",
          table,
          identifier: col,
          direction: "differs",
          detail: `notnull history=${hc.notnull} schema=${sc.notnull}`,
        })
      }
      if ((hc.dflt ?? null) !== (sc.dflt ?? null)) {
        drift.push({
          id: `column-default:${table}.${col}`,
          kind: "column-default",
          table,
          identifier: col,
          direction: "differs",
          detail: `default history=${hc.dflt} schema=${sc.dflt}`,
        })
      }
      if (hc.type !== sc.type || hc.pk !== sc.pk) {
        drift.push({
          id: `column:${table}.${col}`,
          kind: "column",
          table,
          identifier: col,
          direction: "differs",
          detail: `type/pk history=${hc.type}/${hc.pk} schema=${sc.type}/${sc.pk}`,
        })
      }
    }
    const allFks = [...new Set([...h.fks, ...s.fks])].sort()
    for (const fk of allFks) {
      const inH = h.fks.includes(fk)
      const inS = s.fks.includes(fk)
      if (inH && inS) continue
      drift.push({
        id: `foreign-key:${table}:${fk}`,
        kind: "foreign-key",
        table,
        identifier: fk,
        direction: inS ? "history-lacks" : "history-has-extra",
        detail: `foreign key ${fk}`,
      })
    }
    const allIdx = [...new Set([...Object.keys(h.indexes), ...Object.keys(s.indexes)])].sort()
    for (const idx of allIdx) {
      const hi = h.indexes[idx]
      const si = s.indexes[idx]
      if (!hi) {
        drift.push({ id: `index:${table}.${idx}`, kind: "index", table, identifier: idx, direction: "history-lacks", detail: "index missing" })
      } else if (!si) {
        drift.push({ id: `index:${table}.${idx}`, kind: "index", table, identifier: idx, direction: "history-has-extra", detail: "index not in schema" })
      } else if (JSON.stringify(hi) !== JSON.stringify(si)) {
        drift.push({ id: `index:${table}.${idx}`, kind: "index", table, identifier: idx, direction: "differs", detail: "index definition differs" })
      }
    }
  }
  return drift.sort((a, b) => a.id.localeCompare(b.id))
}

function validateManifest(raw: unknown): { entries: ManifestEntry[]; errors: string[] } {
  const errors: string[] = []
  const entries: ManifestEntry[] = []
  if (typeof raw !== "object" || raw === null || !Array.isArray((raw as any).entries)) {
    return { entries, errors: ["manifest must be an object with an `entries` array"] }
  }
  const seen = new Set<string>()
  const KINDS = new Set(["foreign-key", "column-nullability", "column-default", "column", "index", "table"])
  const DIRECTIONS = new Set(["history-lacks", "history-has-extra", "differs"])
  for (const [i, e] of (raw as any).entries.entries()) {
    const where = `entries[${i}]`
    if (typeof e !== "object" || e === null) {
      errors.push(`${where}: not an object`)
      continue
    }
    for (const field of ["id", "kind", "table", "direction", "reason", "source", "expiresWith"]) {
      if (typeof e[field] !== "string" || e[field].length === 0) errors.push(`${where}: missing or empty "${field}"`)
    }
    if (typeof e.kind === "string" && !KINDS.has(e.kind)) errors.push(`${where}: unknown kind "${e.kind}"`)
    if (typeof e.direction === "string" && !DIRECTIONS.has(e.direction)) errors.push(`${where}: unknown direction "${e.direction}"`)
    if (typeof e.expiresWith === "string" && !EXPIRY_PATTERN.test(e.expiresWith))
      errors.push(`${where}: expiresWith "${e.expiresWith}" does not match C<N> | AUDIT_DECISION:<id> | NEON_CUTOVER`)
    if (e.expirySatisfied !== undefined && typeof e.expirySatisfied !== "boolean")
      errors.push(`${where}: expirySatisfied must be a boolean when present`)
    if (typeof e.id === "string") {
      if (seen.has(e.id)) errors.push(`${where}: duplicate id "${e.id}"`)
      seen.add(e.id)
    }
    entries.push(e as ManifestEntry)
  }
  return { entries, errors }
}

export interface VerifyResult {
  ok: boolean
  problems: string[]
  driftCount: number
  manifestCount: number
  counts: { tables: number; indexes: number; integrity: string; fkViolations: number }
}

export async function verifyMigrationHistory(options: VerifyOptions = {}): Promise<VerifyResult> {
  const migrationsDir = options.migrationsDir ?? join(REPO_ROOT, "prisma", "migrations")
  const schemaPath = options.schemaPath ?? join(REPO_ROOT, "prisma", "schema.prisma")
  const manifestPath = options.manifestPath ?? join(REPO_ROOT, "prisma", "migrations", "drift-manifest.json")
  const expectedMigrations = options.expectedMigrations ?? EXPECTED_MIGRATIONS
  const expectedTables = options.expectedTables ?? EXPECTED_TABLES
  const expectedIndexes = options.expectedIndexes ?? EXPECTED_INDEXES

  const problems: string[] = []
  const dir = mkdtempSync(join(tmpdir(), "db-history-verify-"))
  let counts = { tables: 0, indexes: 0, integrity: "not-run", fkViolations: -1 }
  let driftCount = 0
  let manifestCount = 0
  try {
    // 1. Directory listing must match the expected migration list exactly.
    const dirs = readdirSync(migrationsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort()
    for (const m of expectedMigrations) if (!dirs.includes(m)) problems.push(`expected migration missing from history: ${m}`)
    for (const d of dirs) if (!expectedMigrations.includes(d)) problems.push(`unexpected migration in history: ${d}`)

    // 2. Deploy the history from scratch into a throwaway DB.
    const histDb = join(dir, "history.db")
    const histConfig = writeTempConfig(dir, schemaPath, migrationsDir, `file:${histDb}`)
    try {
      runPrisma(["migrate", "deploy", "--config", histConfig])
    } catch (err) {
      problems.push(`migrate deploy failed: ${err instanceof Error ? err.message.slice(0, 300) : String(err)}`)
      return { ok: false, problems, driftCount, manifestCount, counts }
    }

    // 3. Ledger must record exactly the expected migrations, in order.
    const applied = appliedMigrations(histDb)
    if (JSON.stringify(applied) !== JSON.stringify([...expectedMigrations])) {
      problems.push(`applied migrations ${JSON.stringify(applied)} != expected ${JSON.stringify(expectedMigrations)}`)
    }

    // 4. Structural counts and health.
    counts = countsAndHealth(histDb)
    if (counts.tables !== expectedTables) problems.push(`expected ${expectedTables} tables, found ${counts.tables}`)
    if (counts.indexes !== expectedIndexes) problems.push(`expected ${expectedIndexes} explicit indexes, found ${counts.indexes}`)
    if (counts.integrity !== "ok") problems.push(`integrity_check: ${counts.integrity}`)
    if (counts.fkViolations !== 0) problems.push(`foreign_key_check reported ${counts.fkViolations} violations`)

    // 5. Build the canonical-schema DB (provider-correct SQLite DDL, offline).
    const canonicalSql = join(dir, "canonical.sql")
    const schemaDbDir = mkdtempSync(join(tmpdir(), "db-history-verify-schema-"))
    try {
      runPrisma(["migrate", "diff", "--config", histConfig, "--from-empty", "--to-schema", schemaPath, "--script", "-o", canonicalSql])
      const schemaDb = join(schemaDbDir, "schema.db")
      const sdb = new DatabaseSync(schemaDb)
      try {
        sdb.exec(readFileSync(canonicalSql, "utf8"))
      } finally {
        sdb.close()
      }

      // 6. Semantic drift vs the manifest.
      const drift = computeDrift(snapshot(histDb), snapshot(schemaDb))
      driftCount = drift.length

      let manifestRaw: unknown
      try {
        manifestRaw = JSON.parse(readFileSync(manifestPath, "utf8"))
      } catch (err) {
        problems.push(`drift manifest unreadable: ${err instanceof Error ? err.message : String(err)}`)
        return { ok: false, problems, driftCount, manifestCount, counts }
      }
      const { entries, errors } = validateManifest(manifestRaw)
      manifestCount = entries.length
      problems.push(...errors)

      const driftById = new Map(drift.map((d) => [d.id, d]))
      const manifestById = new Map(entries.map((e) => [e.id, e]))
      for (const d of drift) {
        const entry = manifestById.get(d.id)
        if (!entry) {
          problems.push(`UNKNOWN drift not declared in manifest: ${d.id} (${d.direction}; ${d.detail})`)
        } else if (entry.kind !== d.kind || entry.table !== d.table || entry.direction !== d.direction) {
          problems.push(`manifest entry ${d.id} does not semantically match the actual drift (${d.detail})`)
        } else if (entry.expirySatisfied === true) {
          problems.push(`manifest entry ${d.id} is marked expiry-satisfied but its drift still exists`)
        }
      }
      for (const e of entries) {
        if (typeof e.id === "string" && !driftById.has(e.id)) {
          problems.push(`STALE manifest entry with no matching drift: ${e.id}`)
        }
      }
    } finally {
      rmSync(schemaDbDir, { recursive: true, force: true })
    }

    return { ok: problems.length === 0, problems, driftCount, manifestCount, counts }
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  verifyMigrationHistory()
    .then((result) => {
      process.stdout.write(
        `[db:verify-history] tables=${result.counts.tables} indexes=${result.counts.indexes} integrity=${result.counts.integrity} fkViolations=${result.counts.fkViolations} drift=${result.driftCount} manifest=${result.manifestCount}\n`,
      )
      if (!result.ok) {
        for (const p of result.problems) console.error(`[db:verify-history] FAIL: ${p}`)
        process.exit(1)
      }
      process.stdout.write("[db:verify-history] OK — history, schema and drift manifest are in sync\n")
    })
    .catch((err) => {
      console.error("[db:verify-history] ERROR:", err instanceof Error ? err.message : err)
      process.exit(1)
    })
}
