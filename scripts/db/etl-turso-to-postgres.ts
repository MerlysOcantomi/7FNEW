/**
 * NEON-04 — Turso/libSQL → PostgreSQL ETL and parity verifier.
 *
 *   SOURCE = Turso/libSQL, READ-ONLY (one read batch = one consistent snapshot)
 *   TARGET = an EMPTY PostgreSQL database carrying the canonical history
 *            (`prisma/migrations-postgres`, 0_init pinned), identified
 *            EXPLICITLY — never by a word in a hostname.
 *
 * Commands
 *   plan    — parse the target schema, print insert order and column maps; no connection.
 *   run     — extract → transform → load in ONE target transaction; writes a manifest
 *             (per-table counts, per-row and per-table digests, timings). Refuses a
 *             non-empty target unless --reset-target --confirm-reset <database> is given
 *             (TRUNCATE inside the same transaction; schema and ledger untouched).
 *   parity  — recompute target digests and compare with the manifest (same snapshot),
 *             FK orphan scan, PK/unique duplicate scan, value-domain checks; with
 *             --live-source the current source is re-read and field-level mismatches are
 *             reported (sensitive columns redacted). Live drift since the snapshot is
 *             reported separately, never confused with ETL parity.
 *
 * Target identity guard (all required for run/parity):
 *   --target-role staging|local      the only roles this tool knows; there is NO production role
 *   --expect-target-host <hostname>  must equal the hostname of ETL_TARGET_URL
 *   --expect-target-database <name>  must equal current_database() on the live connection
 *   role local additionally requires a loopback host; any host/database matching /prod/i is refused.
 *   --forwarded-loopback             role local only: the loopback port is published by a container
 *                                    (CI service, docker run -p), so the server reports a PRIVATE
 *                                    address instead of loopback. Never accepts a public address.
 *   --expect-staging-id <id>         role staging only (REQUIRED there). The live database must carry
 *                                    the NEON-04 staging identity marker — its PostgreSQL database
 *                                    comment, independent of the application schema:
 *                                      sevenf:environment=staging;sevenf:migration=neon-04;sevenf:target=<id>
 *                                    Absent, malformed or different → FAIL before any read of the
 *                                    source and before any write (TRUNCATE included). Operator-supplied
 *                                    host/database/role are never enough on their own for staging.
 *
 *   stamp-staging — provisioning step for a NEW staging database: writes that marker
 *             (COMMENT ON DATABASE). Lifecycle: dedicated staging database → canonical
 *             history applied (0_init) → schema verified → EVERY application table empty →
 *             stamp → ETL. The command proves all of that on the live connection before
 *             writing and has no flag to skip it: a populated database can never be turned
 *             into staging by this command. Requires --confirm-stamp <database>; refuses
 *             to replace a different existing marker; never touches application tables.
 *
 * Environment: ETL_SOURCE_URL (+ ETL_SOURCE_AUTH_TOKEN), ETL_TARGET_URL. Connection
 * strings are never printed; the manifest stores only fingerprints and the database name.
 */

import { createClient, type Client as LibsqlClient } from "@libsql/client"
import { readFileSync, writeFileSync } from "node:fs"
import { performance } from "node:perf_hooks"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { Client as PgClient } from "pg"
import {
  canonicalFromSource,
  canonicalFromTargetText,
  displayValue,
  insertOrder,
  orderRowsForSelfReferences,
  parseTargetSchema,
  primaryKeyText,
  rowDigest,
  sha256,
  tableDigest,
  transformRow,
  type TableDef,
  type TargetCell,
  type TargetSchema,
} from "./etl-core"

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..")
export const BASELINE_SQL_PATH = join(REPO_ROOT, "prisma", "migrations-postgres", "0_init", "migration.sql")
export const BASELINE_SHA256 = "679d9d18e72a3fa101bd96f6c39b2194ba38ae86de35359a3e46be8d662af30e"
export const MANIFEST_VERSION = 1

const SOURCE_SCHEMES = new Set(["libsql:", "https:", "http:", "wss:", "ws:", "file:"])
const TARGET_SCHEMES = new Set(["postgresql:", "postgres:"])
const LOOPBACK = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])
const LOAD_CHUNK = 100

export interface TargetExpectation {
  role: "staging" | "local"
  host: string
  database: string
  /**
   * role local only. The client dials loopback, but the PostgreSQL server
   * runs in a container whose port is published to the host (GitHub Actions
   * service, `docker run -p`): `inet_server_addr()` is then the container's
   * private address. With this flag a PRIVATE (RFC 1918 / ULA) server address
   * is accepted; a public one is still refused.
   */
  forwardedLoopback?: boolean
  /**
   * role staging only (required there): the non-secret, environment-specific
   * identifier the live database must carry in its NEON-04 staging marker.
   */
  stagingId?: string
}

// ─── Staging identity marker (PostgreSQL database comment) ──────────────────
//
// The marker lives in `pg_shdescription` for the database object, outside the
// application schema and outside the migration ledger. It is set once at
// provisioning (`stamp-staging`) and read on the live connection by run/parity.
// It is deliberately NOT secret: it proves intent ("this database was
// provisioned as SevenF NEON-04 staging"), not possession of a credential.

export const STAGING_MARKER_ENVIRONMENT = "staging"
export const STAGING_MARKER_MIGRATION = "neon-04"
const STAGING_ID = /^[a-z0-9][a-z0-9-]{2,63}$/
const MARKER_KEYS = ["sevenf:environment", "sevenf:migration", "sevenf:target"] as const

export interface StagingMarker {
  environment: string
  migration: string
  target: string
}

export function assertStagingId(id: unknown): string {
  if (typeof id !== "string" || !STAGING_ID.test(id)) {
    throw new Error("etl: --expect-staging-id must be 3-64 chars of [a-z0-9-], starting with a letter or digit")
  }
  if (/prod/i.test(id)) throw new Error("etl: staging id must not look like production")
  return id
}

export function formatStagingMarker(id: string): string {
  return `sevenf:environment=${STAGING_MARKER_ENVIRONMENT};sevenf:migration=${STAGING_MARKER_MIGRATION};sevenf:target=${assertStagingId(id)}`
}

/** Strict parse: exactly the three keys, each once, nothing else. Never echoes the text. */
export function parseStagingMarker(text: string): StagingMarker {
  const pairs = text.split(";")
  if (pairs.length !== MARKER_KEYS.length) throw new Error("etl: staging identity marker is malformed")
  const seen = new Map<string, string>()
  for (const pair of pairs) {
    const eq = pair.indexOf("=")
    if (eq <= 0) throw new Error("etl: staging identity marker is malformed")
    const key = pair.slice(0, eq)
    const value = pair.slice(eq + 1)
    if (!(MARKER_KEYS as readonly string[]).includes(key) || seen.has(key) || value === "") {
      throw new Error("etl: staging identity marker is malformed")
    }
    seen.set(key, value)
  }
  return { environment: seen.get("sevenf:environment")!, migration: seen.get("sevenf:migration")!, target: seen.get("sevenf:target")! }
}

/**
 * Pure check used on the live connection's database comment. Fails closed on
 * absence, malformation and every field mismatch; messages never include the
 * comment text found.
 */
export function checkStagingMarker(comment: string | null, expectedId: string): StagingMarker {
  const id = assertStagingId(expectedId)
  if (comment === null || comment.trim() === "") {
    throw new Error("etl: the live database carries no staging identity marker (COMMENT ON DATABASE) — it was not provisioned as SevenF NEON-04 staging; refusing")
  }
  const marker = parseStagingMarker(comment)
  if (marker.environment !== STAGING_MARKER_ENVIRONMENT) throw new Error("etl: staging identity marker environment is not staging; refusing")
  if (marker.migration !== STAGING_MARKER_MIGRATION) throw new Error("etl: staging identity marker migration is not neon-04; refusing")
  if (marker.target !== id) throw new Error("etl: staging identity marker names a different target than --expect-staging-id; refusing")
  return marker
}

async function readDatabaseComment(pg: PgClient): Promise<string | null> {
  const r = await pg.query<{ description: string | null }>(
    "SELECT d.description FROM pg_database db LEFT JOIN pg_shdescription d ON d.objoid = db.oid AND d.classoid = 'pg_database'::regclass WHERE db.datname = current_database()",
  )
  return r.rows[0]?.description ?? null
}

const PRIVATE_V4 = /^(10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.)/
const PRIVATE_V6 = /^f[cd][0-9a-f]{2}:/i

/**
 * Server-side address check for role local, on the LIVE connection. NULL is a
 * Unix socket (local by definition); loopback is always fine; a private
 * address is fine only when the caller declared a forwarded loopback; a public
 * address is never fine. Pure so it can be unit-tested without a server.
 */
export function checkLocalServerAddress(addr: string | null, forwardedLoopback: boolean): void {
  if (addr === null || addr === "127.0.0.1" || addr === "::1") return
  const isPrivate = PRIVATE_V4.test(addr) || PRIVATE_V6.test(addr)
  if (isPrivate && forwardedLoopback) return
  if (isPrivate) {
    throw new Error("etl: role local but the server address is not loopback (a container-published port needs --forwarded-loopback)")
  }
  throw new Error("etl: role local but the server address is not loopback")
}

export interface EtlOptions {
  sourceUrl: string
  sourceAuthToken?: string
  targetUrl: string
  expectation: TargetExpectation
  resetTarget?: boolean
  confirmReset?: string
  log?: (line: string) => void
}

export interface TableManifest {
  sourceRows: number
  loadedRows: number
  digest: string
  rows: Record<string, string>
  warnings: string[]
  presentInSource: boolean
}

export interface EtlManifest {
  version: number
  snapshotAt: string
  source: { kind: string; hostFingerprint: string; tables: number }
  target: { role: string; database: string; hostFingerprint: string; baselineSha256: string; stagingId?: string }
  insertOrder: string[]
  tables: Record<string, TableManifest>
  totals: { tables: number; sourceRows: number; loadedRows: number; warnings: number }
  timings: { schemaCheckMs: number; extractMs: number; transformMs: number; loadMs: number; verifyMs: number; totalMs: number }
}

// ─── Guards ─────────────────────────────────────────────────────────────────

export function assertSourceUrl(url: string): URL {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error("etl: ETL_SOURCE_URL is not a valid URL")
  }
  if (!SOURCE_SCHEMES.has(parsed.protocol)) {
    throw new Error(`etl: ETL_SOURCE_URL must be a Turso/libSQL URL (libsql://, https://, file:) — scheme ${parsed.protocol} refused; the source is never PostgreSQL`)
  }
  return parsed
}

export function assertTargetUrl(url: string, expectation: TargetExpectation): URL {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error("etl: ETL_TARGET_URL is not a valid URL")
  }
  if (!TARGET_SCHEMES.has(parsed.protocol)) {
    throw new Error(`etl: ETL_TARGET_URL must be postgresql:// — scheme ${parsed.protocol} refused; the target is never Turso/SQLite`)
  }
  if (expectation.role !== "staging" && expectation.role !== "local") {
    throw new Error(`etl: unknown target role ${JSON.stringify(expectation.role)} — only "staging" and "local" exist; this tool has no production mode`)
  }
  const host = parsed.hostname === "[::1]" ? "::1" : parsed.hostname
  if (host !== expectation.host) {
    throw new Error("etl: ETL_TARGET_URL host does not match --expect-target-host (refusing an unexpected target)")
  }
  if (expectation.role === "local" && !LOOPBACK.has(host)) {
    throw new Error("etl: role local requires a loopback target host")
  }
  const database = parsed.pathname.replace(/^\//, "")
  if (database !== expectation.database) {
    throw new Error("etl: ETL_TARGET_URL database does not match --expect-target-database")
  }
  if (/prod/i.test(host) || /prod/i.test(database)) {
    throw new Error("etl: target host/database looks like production — refused unconditionally (NEON-04 tooling never targets production)")
  }
  if (expectation.role === "staging") {
    if (expectation.stagingId === undefined) throw new Error("etl: role staging requires --expect-staging-id (the database must carry the NEON-04 staging identity marker)")
    assertStagingId(expectation.stagingId)
  }
  return parsed
}

function fingerprint(text: string): string {
  return sha256(text).slice(0, 12)
}

// ─── Target helpers ─────────────────────────────────────────────────────────

async function assertTargetIdentity(pg: PgClient, expectation: TargetExpectation): Promise<void> {
  const r = await pg.query<{ db: string; addr: string | null }>("SELECT current_database() AS db, host(inet_server_addr()) AS addr")
  if (r.rows[0].db !== expectation.database) {
    throw new Error("etl: current_database() on the live connection does not match --expect-target-database")
  }
  if (expectation.role === "local") checkLocalServerAddress(r.rows[0].addr, expectation.forwardedLoopback === true)
  if (expectation.role === "staging") checkStagingMarker(await readDatabaseComment(pg), expectation.stagingId!)
}

export interface StampOptions {
  targetUrl: string
  expectation: TargetExpectation
  /** must repeat the exact target database name */
  confirmStamp?: string
  log?: (line: string) => void
}

/**
 * Provisioning step: write the staging identity marker on the target database.
 * Same URL/role/host/database/prod guards as run; live current_database()
 * check; idempotent for an identical marker; REFUSES to replace a different
 * one (re-labelling a database is a human decision, not a flag). Touches only
 * the database comment — no application table, no ledger.
 */
export async function stampStagingIdentity(options: StampOptions): Promise<StagingMarker> {
  const log = options.log ?? (() => undefined)
  if (options.expectation.role !== "staging") throw new Error("etl: stamp-staging only applies to --target-role staging")
  assertTargetUrl(options.targetUrl, options.expectation)
  const marker = formatStagingMarker(options.expectation.stagingId!)
  if (options.confirmStamp !== options.expectation.database) {
    throw new Error("etl: --confirm-stamp must repeat the exact target database name")
  }
  const schema = loadSchema()
  const pg = new PgClient({ connectionString: options.targetUrl })
  await pg.connect()
  try {
    // 1. live identity
    const r = await pg.query<{ db: string }>("SELECT current_database() AS db")
    if (r.rows[0].db !== options.expectation.database) {
      throw new Error("etl: current_database() on the live connection does not match --expect-target-database")
    }
    // 2. no different marker
    const existing = await readDatabaseComment(pg)
    const identical = existing === marker
    if (existing !== null && existing.trim() !== "" && !identical) {
      throw new Error("etl: the database already carries a different comment/marker — refusing to relabel it (clear it by hand if that is intended)")
    }
    // 3. canonical schema: completed 0_init with the pinned checksum, all 50
    //    tables, no sequences, no foreign application tables (same check run/parity use)
    await assertTargetSchema(pg, schema)
    if (identical) {
      // Nothing to write: an already-stamped staging database may legitimately
      // hold ETL data by now; the marker is only ever CREATED on an empty one.
      log(`[etl] staging identity already present for ${options.expectation.database} (unchanged; schema re-verified)`)
      return parseStagingMarker(existing!)
    }
    // 4. EVERY application table empty — there is no flag to skip this.
    const nonEmpty = Object.entries(await targetRowCounts(pg, schema)).filter(([, n]) => n > 0)
    if (nonEmpty.length > 0) {
      throw new Error(
        `etl: refusing to stamp a populated database as staging — ${nonEmpty.length} table(s) with rows: ${describeNonEmpty(nonEmpty)}. ` +
          "Only a freshly provisioned database (canonical history applied, every application table empty) can receive the staging identity; a populated database is never relabelled",
      )
    }
    // COMMENT ON DATABASE accepts no bind parameters. The marker text is fully
    // validated ([a-z0-9-] id inside fixed key=value pairs, no quotes possible)
    // and the database name is a quoted identifier.
    await pg.query(`COMMENT ON DATABASE "${options.expectation.database.replace(/"/g, '""')}" IS '${marker}'`)
    const written = await readDatabaseComment(pg)
    if (written !== marker) throw new Error("etl: staging identity marker was not persisted as expected")
    log(`[etl] staging identity stamped on ${options.expectation.database}: environment=${STAGING_MARKER_ENVIRONMENT} migration=${STAGING_MARKER_MIGRATION} target=${options.expectation.stagingId}`)
    return parseStagingMarker(written)
  } finally {
    await pg.end()
  }
}

async function assertTargetSchema(pg: PgClient, schema: TargetSchema): Promise<void> {
  const hasLedger = await pg.query<{ present: boolean }>("SELECT to_regclass('public._prisma_migrations') IS NOT NULL AS present")
  if (!hasLedger.rows[0].present) {
    throw new Error("etl: target has no _prisma_migrations ledger — apply the canonical history (0_init) first; nothing was written")
  }
  const ledger = await pg.query<{ migration_name: string; checksum: string; finished_at: Date | null; rolled_back_at: Date | null }>(
    'SELECT migration_name, checksum, finished_at, rolled_back_at FROM "_prisma_migrations" ORDER BY started_at',
  )
  const init = ledger.rows.find((r) => r.migration_name === "0_init")
  if (!init || !init.finished_at || init.rolled_back_at) throw new Error("etl: target ledger has no completed 0_init row")
  if (init.checksum !== BASELINE_SHA256) throw new Error("etl: target 0_init checksum differs from the pinned baseline — the target does not carry the canonical schema")
  const tables = await pg.query<{ table_name: string }>("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'")
  const present = new Set(tables.rows.map((r) => r.table_name))
  const missing = schema.tables.filter((t) => !present.has(t.name)).map((t) => t.name)
  if (missing.length > 0) throw new Error(`etl: target is missing table(s): ${missing.join(", ")}`)
  const expected = new Set([...schema.tables.map((t) => t.name), LEDGER_TABLE])
  const unexpected = [...present].filter((name) => !expected.has(name)).sort()
  if (unexpected.length > 0) {
    throw new Error(`etl: target carries ${unexpected.length} base table(s) outside the canonical schema (${unexpected.join(", ")}) — another application schema, refusing`)
  }
  const sequences = await pg.query<{ n: string }>("SELECT COUNT(*)::text AS n FROM pg_sequences WHERE schemaname = 'public'")
  if (Number(sequences.rows[0].n) !== 0) throw new Error("etl: target has sequences; the canonical schema has none (nothing to resynchronise, refusing an unexpected schema)")
}

const LEDGER_TABLE = "_prisma_migrations"

/** Safe rendering for errors: table names and row counts only. */
function describeNonEmpty(nonEmpty: Array<[string, number]>): string {
  return nonEmpty.map(([t, n]) => `${t}=${n}`).join(", ")
}

async function targetRowCounts(pg: PgClient, schema: TargetSchema): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const t of schema.tables) {
    const r = await pg.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM "${t.name}"`)
    counts[t.name] = Number(r.rows[0].n)
  }
  return counts
}

function placeholder(index: number, table: TableDef, columnIndex: number): string {
  const type = table.columns[columnIndex].type
  return type === "TIMESTAMP(3)" ? `$${index}::timestamp(3)` : type === "DOUBLE PRECISION" ? `$${index}::double precision` : `$${index}`
}

// ─── Source extraction (one consistent read snapshot) ───────────────────────

export interface SourceSnapshot {
  snapshotAt: string
  tables: Record<string, Record<string, unknown>[]>
  sourceTableNames: string[]
}

export async function extractSnapshot(client: LibsqlClient, schema: TargetSchema): Promise<SourceSnapshot> {
  const listed = await client.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '_prisma_migrations' ORDER BY name")
  const sourceTableNames = listed.rows.map((r) => String(r.name))
  const targetNames = new Set(schema.tables.map((t) => t.name))
  const unexpected = sourceTableNames.filter((n) => !targetNames.has(n))
  if (unexpected.length > 0) throw new Error(`etl: source has table(s) absent from the target schema (data would be lost): ${unexpected.join(", ")}`)
  const present = schema.tables.filter((t) => sourceTableNames.includes(t.name))
  // One read batch = one transaction on the source → a consistent snapshot across all tables.
  const statements = present.map((t) => `SELECT * FROM "${t.name}" ORDER BY ${t.primaryKey.map((c) => `"${c}"`).join(", ")}`)
  const snapshotAt = new Date().toISOString()
  const results = await client.batch(statements, "read")
  const tables: Record<string, Record<string, unknown>[]> = {}
  present.forEach((t, i) => {
    const rs = results[i]
    const rows = rs.rows.map((row) => {
      const o: Record<string, unknown> = {}
      rs.columns.forEach((c, j) => {
        o[c] = row[j]
      })
      return o
    })
    const targetColumns = new Set(t.columns.map((c) => c.name))
    const extra = rs.columns.filter((c) => !targetColumns.has(c))
    if (extra.length > 0) throw new Error(`etl: source column(s) absent from the target schema in ${t.name} (data would be lost): ${extra.join(", ")}`)
    tables[t.name] = rows
  })
  return { snapshotAt, tables, sourceTableNames }
}

// ─── Run ────────────────────────────────────────────────────────────────────

export function loadSchema(): TargetSchema {
  const sql = readFileSync(BASELINE_SQL_PATH, "utf8")
  if (sha256(sql) !== BASELINE_SHA256) throw new Error("etl: 0_init on disk differs from the pinned baseline sha256 — refusing to derive a schema from an unexpected file")
  return parseTargetSchema(sql)
}

export async function runEtl(options: EtlOptions): Promise<EtlManifest> {
  const log = options.log ?? (() => undefined)
  const t0 = performance.now()
  const sourceUrl = assertSourceUrl(options.sourceUrl)
  const targetUrl = assertTargetUrl(options.targetUrl, options.expectation)
  const schema = loadSchema()
  const order = insertOrder(schema)

  const pg = new PgClient({ connectionString: options.targetUrl })
  await pg.connect()
  const source = createClient({ url: options.sourceUrl, authToken: options.sourceAuthToken })
  try {
    await assertTargetIdentity(pg, options.expectation)
    await assertTargetSchema(pg, schema)
    const counts = await targetRowCounts(pg, schema)
    const nonEmpty = Object.entries(counts).filter(([, n]) => n > 0)
    if (nonEmpty.length > 0) {
      if (!options.resetTarget) {
        throw new Error(`etl: target is not empty (${nonEmpty.length} table(s) with rows: ${describeNonEmpty(nonEmpty)}); pass --reset-target --confirm-reset <database> to truncate it inside the load transaction`)
      }
      if (options.confirmReset !== options.expectation.database) {
        throw new Error("etl: --confirm-reset must repeat the exact target database name")
      }
    }
    const t1 = performance.now()
    log(`[etl] target identity + schema OK (${options.expectation.role}/${options.expectation.database}), ${nonEmpty.length} non-empty table(s)`)

    const snapshot = await extractSnapshot(source, schema)
    const t2 = performance.now()
    log(`[etl] extracted ${snapshot.sourceTableNames.length} source table(s) in one read snapshot at ${snapshot.snapshotAt}`)

    // Transform (and digest) every table before touching the target.
    const prepared: Array<{ table: TableDef; rows: TargetCell[][]; manifest: TableManifest }> = []
    for (const name of order) {
      const table = schema.byName.get(name)!
      const sourceRows = snapshot.tables[name]
      const presentInSource = sourceRows !== undefined
      const selfRefs = table.foreignKeys.filter((fk) => fk.references === name).map((fk) => fk.column)
      const ordered = presentInSource ? orderRowsForSelfReferences(sourceRows, table.primaryKey[0], selfRefs) : []
      const rows: TargetCell[][] = []
      const rowDigests: Record<string, string> = {}
      const warnings: string[] = []
      for (const row of ordered) {
        const transformed = transformRow(table, row)
        rows.push(transformed.values)
        warnings.push(...transformed.warnings)
        rowDigests[primaryKeyText(table, row)] = rowDigest(table.columns.map((c) => canonicalFromSource(c, row[c.name])))
      }
      prepared.push({
        table,
        rows,
        manifest: {
          sourceRows: ordered.length,
          loadedRows: 0,
          digest: tableDigest(Object.entries(rowDigests).map(([pk, digest]) => ({ pk, digest }))),
          rows: rowDigests,
          warnings,
          presentInSource,
        },
      })
    }
    const t3 = performance.now()

    await pg.query("BEGIN")
    try {
      await pg.query("SET LOCAL TIME ZONE 'UTC'")
      if (nonEmpty.length > 0) {
        await pg.query(`TRUNCATE ${schema.tables.map((t) => `"${t.name}"`).join(", ")} RESTART IDENTITY CASCADE`)
        log(`[etl] target reset: TRUNCATE ${schema.tables.length} table(s) (schema and ledger untouched)`)
      }
      for (const p of prepared) {
        const cols = p.table.columns
        const colList = cols.map((c) => `"${c.name}"`).join(", ")
        for (let start = 0; start < p.rows.length; start += LOAD_CHUNK) {
          const chunk = p.rows.slice(start, start + LOAD_CHUNK)
          const params: TargetCell[] = []
          const tuples = chunk.map((row) => {
            const ph = row.map((cell, ci) => {
              params.push(cell)
              return placeholder(params.length, p.table, ci)
            })
            return `(${ph.join(", ")})`
          })
          const res = await pg.query(`INSERT INTO "${p.table.name}" (${colList}) VALUES ${tuples.join(", ")}`, params)
          p.manifest.loadedRows += res.rowCount ?? 0
        }
        if (p.manifest.loadedRows !== p.manifest.sourceRows) throw new Error(`etl: ${p.table.name}: loaded ${p.manifest.loadedRows} of ${p.manifest.sourceRows} rows`)
      }
      // In-transaction verification: counts must match before committing.
      const after = await targetRowCounts(pg, schema)
      for (const p of prepared) {
        if (after[p.table.name] !== p.manifest.sourceRows) throw new Error(`etl: ${p.table.name}: target count ${after[p.table.name]} ≠ source ${p.manifest.sourceRows} before commit`)
      }
      await pg.query("COMMIT")
    } catch (err) {
      await pg.query("ROLLBACK").catch(() => undefined)
      throw err
    }
    const t4 = performance.now()
    log(`[etl] loaded ${prepared.reduce((n, p) => n + p.manifest.loadedRows, 0)} row(s) into ${prepared.length} table(s) in one transaction`)

    const manifest: EtlManifest = {
      version: MANIFEST_VERSION,
      snapshotAt: snapshot.snapshotAt,
      source: { kind: sourceUrl.protocol.replace(":", ""), hostFingerprint: fingerprint(sourceUrl.hostname || sourceUrl.pathname), tables: snapshot.sourceTableNames.length },
      target: {
        role: options.expectation.role,
        database: options.expectation.database,
        hostFingerprint: fingerprint(targetUrl.hostname),
        baselineSha256: BASELINE_SHA256,
        ...(options.expectation.role === "staging" ? { stagingId: options.expectation.stagingId } : {}),
      },
      insertOrder: order,
      tables: Object.fromEntries(prepared.map((p) => [p.table.name, p.manifest])),
      totals: {
        tables: prepared.length,
        sourceRows: prepared.reduce((n, p) => n + p.manifest.sourceRows, 0),
        loadedRows: prepared.reduce((n, p) => n + p.manifest.loadedRows, 0),
        warnings: prepared.reduce((n, p) => n + p.manifest.warnings.length, 0),
      },
      timings: { schemaCheckMs: 0, extractMs: 0, transformMs: 0, loadMs: 0, verifyMs: 0, totalMs: 0 },
    }
    manifest.timings = {
      schemaCheckMs: Math.round(t1 - t0),
      extractMs: Math.round(t2 - t1),
      transformMs: Math.round(t3 - t2),
      loadMs: Math.round(t4 - t3),
      verifyMs: 0,
      totalMs: Math.round(performance.now() - t0),
    }
    return manifest
  } finally {
    source.close()
    await pg.end()
  }
}

// ─── Parity ─────────────────────────────────────────────────────────────────

export interface ParityTableResult {
  table: string
  manifestRows: number
  targetRows: number
  digestMatch: boolean
  fkOrphans: number
  duplicatePks: number
  status: "OK" | "MISMATCH"
}

export interface ParityMismatch {
  table: string
  primaryKey: string
  field: string
  source: string
  target: string
}

export interface ParityReport {
  ok: boolean
  tables: ParityTableResult[]
  mismatches: ParityMismatch[]
  liveSourceDrift: Array<{ table: string; snapshotRows: number; liveRows: number; digestChanged: boolean }> | null
  domainWarnings: string[]
  durationMs: number
}

async function targetCanonicalRows(pg: PgClient, table: TableDef): Promise<Map<string, { cells: Array<string | number | boolean | null>; digest: string }>> {
  const select = table.columns.map((c) => `"${c.name}"::text AS "${c.name}"`).join(", ")
  const res = await pg.query<Record<string, string | null>>(`SELECT ${select} FROM "${table.name}"`)
  const out = new Map<string, { cells: Array<string | number | boolean | null>; digest: string }>()
  for (const row of res.rows) {
    const cells = table.columns.map((c) => canonicalFromTargetText(c, row[c.name]))
    const pk = table.primaryKey.map((c) => String(row[c])).join("|")
    out.set(pk, { cells, digest: rowDigest(cells) })
  }
  return out
}

export async function verifyParity(options: EtlOptions & { manifest: EtlManifest; liveSource?: boolean }): Promise<ParityReport> {
  const t0 = performance.now()
  assertTargetUrl(options.targetUrl, options.expectation)
  const schema = loadSchema()
  if (options.manifest.target.baselineSha256 !== BASELINE_SHA256) throw new Error("etl: manifest was produced against a different baseline")
  const pg = new PgClient({ connectionString: options.targetUrl })
  await pg.connect()
  try {
    await assertTargetIdentity(pg, options.expectation)
    await assertTargetSchema(pg, schema)
    await pg.query("SET TIME ZONE 'UTC'")
    const tables: ParityTableResult[] = []
    const mismatches: ParityMismatch[] = []
    const domainWarnings: string[] = []
    let liveSourceDrift: ParityReport["liveSourceDrift"] = null
    let liveSnapshot: SourceSnapshot | null = null
    if (options.liveSource) {
      assertSourceUrl(options.sourceUrl)
      const source = createClient({ url: options.sourceUrl, authToken: options.sourceAuthToken })
      try {
        liveSnapshot = await extractSnapshot(source, schema)
      } finally {
        source.close()
      }
      liveSourceDrift = []
    }
    for (const table of schema.tables) {
      const entry = options.manifest.tables[table.name]
      if (!entry) throw new Error(`etl: manifest has no entry for ${table.name}`)
      const target = await targetCanonicalRows(pg, table)
      const targetDigest = tableDigest([...target.entries()].map(([pk, r]) => ({ pk, digest: r.digest })))
      const digestMatch = targetDigest === entry.digest && target.size === entry.sourceRows
      // Level 2: FK orphans (PostgreSQL enforces FKs; an orphan means constraints were tampered with).
      let fkOrphans = 0
      for (const fk of table.foreignKeys) {
        const r = await pg.query<{ n: string }>(
          `SELECT COUNT(*)::text AS n FROM "${table.name}" c LEFT JOIN "${fk.references}" p ON c."${fk.column}" = p."${fk.referencedColumn}" WHERE c."${fk.column}" IS NOT NULL AND p."${fk.referencedColumn}" IS NULL`,
        )
        fkOrphans += Number(r.rows[0].n)
      }
      const dup = await pg.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM (SELECT ${table.primaryKey.map((c) => `"${c}"`).join(", ")} FROM "${table.name}" GROUP BY ${table.primaryKey.map((c) => `"${c}"`).join(", ")} HAVING COUNT(*) > 1) d`,
      )
      const duplicatePks = Number(dup.rows[0].n)
      for (const c of table.columns) {
        if (c.type === "TIMESTAMP(3)") {
          const r = await pg.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM "${table.name}" WHERE "${c.name}" < '1971-01-01' OR "${c.name}" > (now() + interval '5 years')`)
          if (Number(r.rows[0].n) > 0) domainWarnings.push(`${table.name}.${c.name}: ${r.rows[0].n} timestamp(s) outside 1971..now+5y`)
        }
      }
      // Row-level detail: rows whose digest differs from the manifest (pk-level), field-level with the live source.
      if (!digestMatch) {
        const manifestPks = new Set(Object.keys(entry.rows))
        for (const [pk, r] of target) {
          if (!manifestPks.has(pk)) mismatches.push({ table: table.name, primaryKey: pk, field: "*", source: "<absent in snapshot>", target: "<row present>" })
          else if (entry.rows[pk] !== r.digest) {
            const liveRow = liveSnapshot?.tables[table.name]?.find((row) => primaryKeyText(table, row) === pk)
            if (liveRow) {
              table.columns.forEach((c, i) => {
                const s = canonicalFromSource(c, liveRow[c.name])
                if (JSON.stringify(s) !== JSON.stringify(r.cells[i])) {
                  mismatches.push({ table: table.name, primaryKey: pk, field: c.name, source: displayValue(table.name, c.name, s), target: displayValue(table.name, c.name, r.cells[i]) })
                }
              })
            } else mismatches.push({ table: table.name, primaryKey: pk, field: "*", source: "<digest differs; re-run with --live-source for fields>", target: "" })
          }
        }
        for (const pk of manifestPks) if (!target.has(pk)) mismatches.push({ table: table.name, primaryKey: pk, field: "*", source: "<row in snapshot>", target: "<absent in target>" })
      }
      if (liveSnapshot) {
        const liveRows = liveSnapshot.tables[table.name] ?? []
        const liveDigest = tableDigest(liveRows.map((row) => ({ pk: primaryKeyText(table, row), digest: rowDigest(table.columns.map((c) => canonicalFromSource(c, row[c.name]))) })))
        liveSourceDrift!.push({ table: table.name, snapshotRows: entry.sourceRows, liveRows: liveRows.length, digestChanged: liveDigest !== entry.digest })
      }
      tables.push({
        table: table.name,
        manifestRows: entry.sourceRows,
        targetRows: target.size,
        digestMatch,
        fkOrphans,
        duplicatePks,
        status: digestMatch && fkOrphans === 0 && duplicatePks === 0 ? "OK" : "MISMATCH",
      })
    }
    return { ok: tables.every((t) => t.status === "OK"), tables, mismatches, liveSourceDrift, domainWarnings, durationMs: Math.round(performance.now() - t0) }
  } finally {
    await pg.end()
  }
}

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv: string[]): { command: string; flags: Record<string, string | boolean> } {
  const [command, ...rest] = argv
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (!a.startsWith("--")) throw new Error(`etl: unexpected argument ${a}`)
    const key = a.slice(2)
    const next = rest[i + 1]
    if (next !== undefined && !next.startsWith("--")) {
      flags[key] = next
      i++
    } else flags[key] = true
  }
  return { command, flags }
}

export function expectationFromFlags(flags: Record<string, string | boolean>): TargetExpectation {
  const role = flags["target-role"]
  const host = flags["expect-target-host"]
  const database = flags["expect-target-database"]
  if (typeof role !== "string" || typeof host !== "string" || typeof database !== "string") {
    throw new Error("etl: --target-role <staging|local> --expect-target-host <host> --expect-target-database <name> are all required")
  }
  if (role !== "staging" && role !== "local") throw new Error(`etl: unknown target role ${JSON.stringify(role)} — only "staging" and "local" exist; this tool has no production mode`)
  const forwardedLoopback = flags["forwarded-loopback"] === true
  if (forwardedLoopback && role !== "local") throw new Error("etl: --forwarded-loopback only applies to --target-role local")
  const stagingIdFlag = flags["expect-staging-id"]
  if (role === "staging") {
    if (stagingIdFlag === undefined) throw new Error("etl: --target-role staging requires --expect-staging-id <id>")
    return { role, host, database, stagingId: assertStagingId(stagingIdFlag) }
  }
  if (stagingIdFlag !== undefined) throw new Error("etl: --expect-staging-id only applies to --target-role staging")
  return { role, host, database, forwardedLoopback }
}

function out(line: string): void {
  process.stdout.write(`${line}\n`)
}

function requireEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`etl: ${name} is not set`)
  return v
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  ;(async () => {
    const { command, flags } = parseArgs(process.argv.slice(2))
    switch (command) {
      case "plan": {
        const schema = loadSchema()
        const order = insertOrder(schema)
        out(`[etl] baseline sha256=${BASELINE_SHA256} tables=${schema.tables.length} fks=${schema.tables.reduce((n, t) => n + t.foreignKeys.length, 0)}`)
        out(`[etl] insert order: ${order.join(" > ")}`)
        for (const t of schema.tables) {
          const selfRefs = t.foreignKeys.filter((fk) => fk.references === t.name).map((fk) => fk.column)
          const typed = t.columns.filter((c) => c.type !== "TEXT").map((c) => `${c.name}:${c.type}`)
          out(`[etl]   ${t.name}: pk=${t.primaryKey.join(",")} typed=[${typed.join(" ")}]${selfRefs.length ? ` selfRef=${selfRefs.join(",")}` : ""}`)
        }
        return
      }
      case "stamp-staging": {
        const marker = await stampStagingIdentity({
          targetUrl: requireEnv("ETL_TARGET_URL"),
          expectation: expectationFromFlags(flags),
          confirmStamp: typeof flags["confirm-stamp"] === "string" ? flags["confirm-stamp"] : undefined,
          log: out,
        })
        out(`[etl] staging identity OK: environment=${marker.environment} migration=${marker.migration} target=${marker.target}`)
        return
      }
      case "run": {
        const manifestPath = flags.manifest
        if (typeof manifestPath !== "string") throw new Error("etl: --manifest <path> is required")
        const manifest = await runEtl({
          sourceUrl: requireEnv("ETL_SOURCE_URL"),
          sourceAuthToken: process.env.ETL_SOURCE_AUTH_TOKEN,
          targetUrl: requireEnv("ETL_TARGET_URL"),
          expectation: expectationFromFlags(flags),
          resetTarget: flags["reset-target"] === true,
          confirmReset: typeof flags["confirm-reset"] === "string" ? flags["confirm-reset"] : undefined,
          log: out,
        })
        writeFileSync(manifestPath, JSON.stringify(manifest, null, 2))
        out(`[etl] manifest written: ${manifestPath}`)
        out(`[etl] totals: tables=${manifest.totals.tables} sourceRows=${manifest.totals.sourceRows} loadedRows=${manifest.totals.loadedRows} warnings=${manifest.totals.warnings}`)
        out(`[etl] timings(ms): ${JSON.stringify(manifest.timings)}`)
        return
      }
      case "parity": {
        const manifestPath = flags.manifest
        if (typeof manifestPath !== "string") throw new Error("etl: --manifest <path> is required")
        const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as EtlManifest
        const report = await verifyParity({
          sourceUrl: process.env.ETL_SOURCE_URL ?? "libsql://unused.invalid",
          sourceAuthToken: process.env.ETL_SOURCE_AUTH_TOKEN,
          targetUrl: requireEnv("ETL_TARGET_URL"),
          expectation: expectationFromFlags(flags),
          manifest,
          liveSource: flags["live-source"] === true,
        })
        for (const t of report.tables) {
          out(`[parity] ${t.status.padEnd(8)} ${t.table.padEnd(24)} snapshot=${t.manifestRows} target=${t.targetRows} digest=${t.digestMatch ? "match" : "DIFF"} fkOrphans=${t.fkOrphans} dupPks=${t.duplicatePks}`)
        }
        for (const m of report.mismatches) out(`[parity] mismatch ${m.table} pk=${m.primaryKey} field=${m.field} source=${m.source} target=${m.target}`)
        for (const w of report.domainWarnings) out(`[parity] warning ${w}`)
        if (report.liveSourceDrift) {
          const drifted = report.liveSourceDrift.filter((d) => d.digestChanged)
          out(`[parity] live source drift since snapshot: ${drifted.length} table(s)${drifted.length ? ` — ${drifted.map((d) => `${d.table}(${d.snapshotRows}→${d.liveRows})`).join(", ")}` : ""}`)
        }
        out(`[parity] ${report.ok ? "OK" : "FAIL"} — ${report.tables.length} table(s) in ${report.durationMs}ms`)
        if (!report.ok) process.exit(2)
        return
      }
      default:
        throw new Error("usage: etl-turso-to-postgres.ts <plan|stamp-staging|run|parity> [flags]")
    }
  })().catch((err) => {
    console.error(`[etl] FAIL: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}
