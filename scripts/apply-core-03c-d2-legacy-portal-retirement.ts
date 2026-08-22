/**
 * CORE-03C-D2 — LEGACY PORTAL RETIREMENT applier.
 *
 * Applies `5_d2_retire_legacy_portal_tables` — dropping exactly the three
 * empty legacy portal tables (ClientProject, ClientInvoice, ClientFile) —
 * to the ONE pinned Sevenef/7F production database. This is the only
 * destructive migration of the CORE-03C family, and it is triple-gated:
 *
 *   1. COUNT(*) must be 0 in all three tables immediately before the DROP
 *      (the owner-approved rule). One row anywhere → STOP. This tool never
 *      DELETEs, never exports-and-drops, never drops a non-empty table.
 *   2. Zero inbound dependencies: no other table's DDL may reference the
 *      three (verified live against sqlite_schema each run).
 *   3. The canonical portal tables (ClientAsset, ClientRequest,
 *      ClientRequestAsset, ForteSnapshot) and ClientAuth must exist before
 *      AND after — their absence at any point is an immediate stop.
 *
 * FAIL-CLOSED SAFETY (same model as the D6/D3/D5 appliers; production
 * hostname guard shared with the D6 applier):
 *   - `--target-production` for every phase, `--owner-authorized`
 *     additionally for `apply`; unknown flags abort — there is no --force,
 *     no --skip-gates, no --drop-nonempty, no --ignore-dependencies.
 *   - Migration 5 must be byte-identical to the rehearsed bytes AND
 *     migrations 0–4 must be byte-intact (all six sha256 pinned).
 *   - State by table presence: all three present with the expected column
 *     shape → PENDING; all three absent → APPLIED; anything else →
 *     INCONSISTENT → STOP. Option A: no ledger is ever created.
 *   - `apply` refuses to run without a restore-verified FRESH checkpoint
 *     whose restored copy demonstrably contains the three tables (their
 *     original schema is the recovery path) and without a recorded PASS of
 *     BOTH rehearsals: the success rehearsal (real migration on a copy of
 *     the checkpoint) and the fail-closed rehearsal (a seeded row makes
 *     the applier STOP with zero DDL executed).
 *   - The three DROPs execute as ONE atomic libSQL batch.
 *
 * Usage: tsx scripts/apply-core-03c-d2-legacy-portal-retirement.ts <phase> --target-production
 * Phases: status | gates | backup | verify-backup | rehearse
 *         | rehearse-fail-closed | apply
 * Env:    TURSO_DATABASE_URL / TURSO_AUTH_TOKEN  (required; production pin)
 *         CORE03C_D2_BACKUP_DIR  (optional) checkpoint dir (default:
 *                                <os tmpdir>/core03c-d2-retirement)
 *         CORE03C_D2_STATE_FILE  (optional) state path (default under the
 *                                backup dir)
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- raw SQL rows are untyped */

import { createHash } from "node:crypto"
import { chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { assertProductionUrl } from "./apply-core-03c-production-adoption"
import { splitStatements } from "./rehearse-core-03c-d6"

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const MIGRATIONS_DIR = join(REPO_ROOT, "prisma", "migrations")
const MIGRATION_NAME = "5_d2_retire_legacy_portal_tables"

/** The exact retirement set — nothing else may ever be dropped. */
export const LEGACY_TABLES = ["ClientFile", "ClientInvoice", "ClientProject"] as const

/** Must exist before AND after; touching any of them is an incident. */
export const PROTECTED_TABLES = ["ClientAsset", "ClientRequest", "ClientRequestAsset", "ForteSnapshot", "ClientAuth"] as const

/** Shape before (post-D5) and after (post-D2) the retirement. */
export const SHAPE_BEFORE = { tables: 52, indexes: 93 }
export const SHAPE_AFTER = { tables: 49, indexes: 93 }

/**
 * sha256 of every migration file exactly as rehearsed. Migration 5 must
 * match to run at all; 0–4 must be byte-intact (history immutability).
 */
export const PINNED_SHA256: Record<string, string> = {
  "0_baseline": "5d3d60c8b12533fc2caa6f94d043a35cdae71664f2ce5a91a7ec43acc0682f58",
  "1_add_missing_indexes": "46fae4edf66a5cecaabb01ae24bccc101930853a90e3c2f580a2a041cf925137",
  "2_add_link_columns": "444d3a2661a1754c1d071b0ad632e83dea0c6c290a46a5cdb5afa4a2860745ed",
  "3_create_portal_tables": "101c8b37d8322585f0d06ef4feadd70910425c8d2508278113c9d27434064ae2",
  "4_d5_schema_tightenings": "b7e8249a97e9bc46d6847c4584c83821b00426eea5e9462dc773d504ef9129ba",
  "5_d2_retire_legacy_portal_tables": "c7b694e28fae649fed0afd605b4dfb63cba3a774cc17e7b4c9f0c81845484281",
}

/** Expected column sets (from the deployed baseline DDL) for PENDING shape. */
const EXPECTED_COLUMNS: Record<string, string[]> = {
  ClientProject: ["id", "clienteId", "titulo", "descripcion", "estado", "createdAt", "updatedAt"],
  ClientInvoice: ["id", "clienteId", "monto", "estado", "qrCodeUrl", "paymentUrl", "createdAt"],
  ClientFile: ["id", "clienteId", "nombre", "url", "mimeType", "tamano", "createdAt"],
}

const out = (line: string): void => {
  process.stdout.write(line + "\n")
}

// ─── Flags ────────────────────────────────────────────────────────────────────

export interface Flags {
  targetProduction: boolean
  ownerAuthorized: boolean
}

export function parseFlags(argv: string[]): Flags {
  const flags: Flags = { targetProduction: false, ownerAuthorized: false }
  for (const arg of argv) {
    if (arg === "--target-production") flags.targetProduction = true
    else if (arg === "--owner-authorized") flags.ownerAuthorized = true
    else throw new Error(`d2 guard: unknown argument '${arg}' — this tool has no overrides`)
  }
  return flags
}

export function assertFlags(phase: string, flags: Flags): void {
  if (!flags.targetProduction) {
    throw new Error("d2 guard: the explicit --target-production flag is required for every phase")
  }
  if (phase === "apply" && !flags.ownerAuthorized) {
    throw new Error(
      "d2 guard: 'apply' requires --owner-authorized — only after the owner's exact phrase 'AUTORIZO CORE-03C-D2 LEGACY PORTAL RETIREMENT' was received in this window",
    )
  }
}

/** Every migration file must match its pinned sha256 — 0–4 intact, 5 as rehearsed. */
export function assertPinnedChecksums(migrationsDir: string = MIGRATIONS_DIR): void {
  for (const [name, expected] of Object.entries(PINNED_SHA256)) {
    const actual = createHash("sha256").update(readFileSync(join(migrationsDir, name, "migration.sql"))).digest("hex")
    if (actual !== expected) {
      throw new Error(`d2 guard: ${name}/migration.sql differs from the pinned bytes — history must stay immutable and only rehearsed DDL may run — STOP`)
    }
  }
}

// ─── Target access ────────────────────────────────────────────────────────────

export type QueryFn = (sql: string, args?: unknown[]) => Promise<any[]>

interface Target {
  query: QueryFn
  batch(stmts: string[]): Promise<void>
  close(): void
}

async function openLibsqlTarget(url: string, authToken: string): Promise<Target> {
  const { createClient } = await import("@libsql/client")
  const client = createClient({ url, authToken })
  return {
    async query(sql, args = []) {
      return (await client.execute({ sql, args: args as any[] })).rows as any[]
    },
    async batch(stmts) {
      await client.batch(stmts, "write")
    },
    close: () => client.close(),
  }
}

// ─── State ────────────────────────────────────────────────────────────────────

function backupDir(): string {
  return process.env.CORE03C_D2_BACKUP_DIR || join(tmpdir(), "core03c-d2-retirement")
}

function stateFilePath(): string {
  return process.env.CORE03C_D2_STATE_FILE || join(backupDir(), "core03c-d2-state.json")
}

interface State {
  backup?: {
    backupPath: string
    createdAt: string
    tables: number
    rowCounts: Record<string, number>
  }
  successRehearsalSha?: string
  failClosedRehearsalSha?: string
}

function readState(): State {
  if (!existsSync(stateFilePath())) return {}
  return JSON.parse(readFileSync(stateFilePath(), "utf8"))
}

function writeState(state: State): void {
  mkdirSync(backupDir(), { recursive: true, mode: 0o700 })
  writeFileSync(stateFilePath(), JSON.stringify(state, null, 2), { mode: 0o600 })
}

// ─── Classification and gates ─────────────────────────────────────────────────

export type MigrationState = "APPLIED" | "PENDING" | "INCONSISTENT"

async function tableNames(q: QueryFn): Promise<Set<string>> {
  return new Set((await q(`SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'`)).map((r: any) => String(r.name)))
}

/** PENDING = all three present with expected columns; APPLIED = all absent. */
export async function classifyD2State(q: QueryFn): Promise<MigrationState> {
  const tables = await tableNames(q)
  const present = LEGACY_TABLES.filter((t) => tables.has(t))
  if (present.length === 0) return "APPLIED"
  if (present.length !== LEGACY_TABLES.length) return "INCONSISTENT"
  for (const t of LEGACY_TABLES) {
    const cols = (await q(`PRAGMA table_info("${t}")`)).map((c: any) => String(c.name))
    const expected = EXPECTED_COLUMNS[t]
    if (cols.length !== expected.length || expected.some((c) => !cols.includes(c))) return "INCONSISTENT"
  }
  return "PENDING"
}

export interface D2Gates {
  counts: Record<string, number>
  inboundRefs: string[]
  protectedPresent: string[]
  pass: boolean
}

/** The owner rule: 0/0/0 rows, zero inbound DDL references, canon intact. */
export async function runD2Gates(q: QueryFn): Promise<D2Gates> {
  const counts: Record<string, number> = {}
  for (const t of LEGACY_TABLES) counts[t] = Number((await q(`SELECT COUNT(*) c FROM "${t}"`))[0].c)
  const ddl = await q(`SELECT name, sql FROM sqlite_schema WHERE type='table' AND sql IS NOT NULL`)
  const inboundRefs = ddl
    .filter((r: any) => !LEGACY_TABLES.includes(String(r.name) as any) && /"Client(Project|Invoice|File)"/.test(String(r.sql)))
    .map((r: any) => String(r.name))
  const tables = await tableNames(q)
  const protectedPresent = PROTECTED_TABLES.filter((t) => tables.has(t))
  const pass = Object.values(counts).every((c) => c === 0) && inboundRefs.length === 0 && protectedPresent.length === PROTECTED_TABLES.length
  return { counts, inboundRefs, protectedPresent, pass }
}

async function assertGatesGreen(q: QueryFn, label: string): Promise<void> {
  const g = await runD2Gates(q)
  out(`[${label}] counts=${JSON.stringify(g.counts)} inboundRefs=${JSON.stringify(g.inboundRefs)} protectedPresent=${g.protectedPresent.length}/${PROTECTED_TABLES.length}`)
  if (!g.pass) throw new Error(`${label}: the D2 gate FAILED — a non-empty table, an inbound dependency or a missing canonical table is a full stop — STOP`)
}

async function shapeOf(q: QueryFn): Promise<{ tables: number; indexes: number }> {
  const tables = Number((await q(`SELECT COUNT(*) c FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\'`))[0].c)
  const indexes = Number((await q(`SELECT COUNT(*) c FROM sqlite_schema WHERE type='index' AND name NOT LIKE 'sqlite_%' AND tbl_name NOT LIKE '\\_%' ESCAPE '\\'`))[0].c)
  return { tables, indexes }
}

async function businessTables(q: QueryFn): Promise<string[]> {
  return (await q(`SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name`)).map(
    (r: any) => String(r.name),
  )
}

// ─── Local fixture helpers (used by rehearsals; no network) ─────────────────

function localQuery(db: import("node:sqlite").DatabaseSync): QueryFn {
  return async (sql, args = []) => db.prepare(sql).all(...(args as any[])) as any[]
}

/**
 * The applier's own decision sequence against an arbitrary query runner:
 * classify → gates → DROP list. Exported so both rehearsals and the unit
 * tests exercise EXACTLY the logic `apply` uses. Returns the statements to
 * run; throws (STOP) without returning any DDL when a gate fails.
 */
export async function decideDrop(q: QueryFn): Promise<string[]> {
  const st = await classifyD2State(q)
  if (st === "APPLIED") return []
  if (st !== "PENDING") throw new Error("d2 guard: migration state is INCONSISTENT — refusing to guess — STOP")
  const g = await runD2Gates(q)
  if (!g.pass) {
    throw new Error(`d2 guard: gate failed (counts=${JSON.stringify(g.counts)} inbound=${JSON.stringify(g.inboundRefs)}) — no DDL will be executed — STOP`)
  }
  return splitStatements(readFileSync(join(MIGRATIONS_DIR, MIGRATION_NAME, "migration.sql"), "utf8"))
}

// ─── Phases ───────────────────────────────────────────────────────────────────

async function phaseStatus(q: QueryFn): Promise<void> {
  const shape = await shapeOf(q)
  out(`[status] shape=${shape.tables}/${shape.indexes} ${MIGRATION_NAME}: ${await classifyD2State(q)} (by table presence/shape; no ledger by design)`)
}

async function phaseBackup(t: Target): Promise<void> {
  const shape = await shapeOf(t.query)
  if (shape.tables !== SHAPE_BEFORE.tables || shape.indexes !== SHAPE_BEFORE.indexes) {
    throw new Error(`backup: production shape ${shape.tables}/${shape.indexes} is not the expected pre-D2 ${SHAPE_BEFORE.tables}/${SHAPE_BEFORE.indexes} — STOP`)
  }
  const { DatabaseSync } = await import("node:sqlite")
  mkdirSync(backupDir(), { recursive: true, mode: 0o700 })
  const backupPath = join(backupDir(), "core03c-d2-pre-retirement-checkpoint.db")
  rmSync(backupPath, { force: true })

  const ddl = await t.query(
    `SELECT sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name`,
  )
  const local = new DatabaseSync(backupPath)
  local.exec("PRAGMA foreign_keys=OFF")
  for (const row of ddl) local.exec(String(row.sql))

  const tables = await businessTables(t.query)
  const rowCounts: Record<string, number> = {}
  let totalRows = 0
  for (const table of tables) {
    const rows = await t.query(`SELECT * FROM "${table}"`)
    rowCounts[table] = rows.length
    if (rows.length === 0) continue
    const names = Object.keys(rows[0])
    const stmt = local.prepare(`INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(",")}) VALUES (${names.map(() => "?").join(",")})`)
    for (const r of rows) {
      stmt.run(...names.map((n) => (r[n] === undefined ? null : (r[n] as any))))
      totalRows++
    }
  }
  // Restore verification, including: the three legacy tables are recoverable
  // from this checkpoint with their original schema.
  const localTables = Number((local.prepare(`SELECT COUNT(*) c FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'`).get() as any).c)
  let mismatches = 0
  for (const table of tables) {
    const localCount = Number((local.prepare(`SELECT COUNT(*) c FROM "${table}"`).get() as any).c)
    const remote = Number((await t.query(`SELECT COUNT(*) c FROM "${table}"`))[0].c)
    if (localCount !== rowCounts[table] || remote !== rowCounts[table]) mismatches++
  }
  for (const legacy of LEGACY_TABLES) {
    const cols = (local.prepare(`PRAGMA table_info("${legacy}")`).all() as any[]).map((c) => String(c.name))
    const expected = EXPECTED_COLUMNS[legacy]
    if (cols.length !== expected.length || expected.some((c) => !cols.includes(c))) {
      local.close()
      throw new Error(`backup: restored copy does not carry ${legacy} with its original schema — recovery unproven — STOP`)
    }
  }
  local.close()
  chmodSync(backupPath, 0o600)
  if (localTables !== tables.length) throw new Error(`backup: restored table count ${localTables} != ${tables.length} — STOP`)
  if (mismatches > 0) throw new Error(`backup: ${mismatches} tables restored with wrong row counts — STOP`)

  writeState({ backup: { backupPath, createdAt: new Date().toISOString(), tables: tables.length, rowCounts } })
  out(`[backup] checkpoint created and restore-verified: tables=${tables.length} rowsCopied=${totalRows} rowCountMismatches=0 legacyTablesRecoverable=yes`)
  out(`[backup] path=${backupPath} (0600, outside the repo — contains real data, never commit, never print)`)
}

async function phaseVerifyBackup(t: Target): Promise<void> {
  const state = readState()
  if (!state.backup || !existsSync(state.backup.backupPath)) throw new Error("verify-backup: checkpoint missing — re-run 'backup' — STOP")
  let drift = 0
  for (const [table, expected] of Object.entries(state.backup.rowCounts)) {
    if (Number((await t.query(`SELECT COUNT(*) c FROM "${table}"`))[0].c) !== expected) drift++
  }
  if (drift > 0) throw new Error(`verify-backup: live database drifted from the checkpoint in ${drift} tables — STALE, re-run 'backup' — STOP`)
  out(`[verify-backup] checkpoint intact and FRESH: tables=${state.backup.tables} liveRowDrift=0`)
}

/** Success rehearsal: the real migration on a copy of the checkpoint. */
async function phaseRehearse(): Promise<void> {
  assertPinnedChecksums()
  const state = readState()
  if (!state.backup || !existsSync(state.backup.backupPath)) throw new Error("rehearse: no checkpoint — run 'backup' first — STOP")
  const { DatabaseSync } = await import("node:sqlite")
  const copyPath = join(backupDir(), "core03c-d2-rehearsal-copy.db")
  copyFileSync(state.backup.backupPath, copyPath)
  chmodSync(copyPath, 0o600)
  try {
    const local = new DatabaseSync(copyPath)
    const lq = localQuery(local)
    if ((await classifyD2State(lq)) !== "PENDING") throw new Error("rehearse: checkpoint copy is not PENDING — STOP")
    const shapeBefore = await shapeOf(lq)
    const before: Record<string, number> = {}
    for (const table of await businessTables(lq)) before[table] = Number((local.prepare(`SELECT COUNT(*) c FROM "${table}"`).get() as any).c)

    const stmts = await decideDrop(lq)
    if (stmts.length === 0) throw new Error("rehearse: nothing to apply — unexpected")
    for (const stmt of stmts) local.exec(stmt)

    const shapeAfter = await shapeOf(lq)
    if (shapeAfter.tables !== SHAPE_AFTER.tables || shapeAfter.indexes !== SHAPE_AFTER.indexes) {
      throw new Error(`rehearse: post shape ${shapeAfter.tables}/${shapeAfter.indexes} != expected ${SHAPE_AFTER.tables}/${SHAPE_AFTER.indexes} — STOP`)
    }
    if (shapeBefore.tables - shapeAfter.tables !== LEGACY_TABLES.length) throw new Error("rehearse: retired table count != 3 — STOP")
    if ((await classifyD2State(lq)) !== "APPLIED") throw new Error("rehearse: post state is not APPLIED — STOP")
    const tablesAfter = await tableNames(lq)
    for (const p of PROTECTED_TABLES) {
      if (!tablesAfter.has(p)) throw new Error(`rehearse: canonical table ${p} disappeared — STOP`)
    }
    for (const [table, expected] of Object.entries(before)) {
      if ((LEGACY_TABLES as readonly string[]).includes(table)) continue
      const now = Number((local.prepare(`SELECT COUNT(*) c FROM "${table}"`).get() as any).c)
      if (now !== expected) throw new Error(`rehearse: ${table} row count ${expected} → ${now} — STOP`)
    }
    const integrity = (local.prepare(`PRAGMA integrity_check`).get() as any)
    if (String(integrity.integrity_check) !== "ok") throw new Error("rehearse: integrity_check failed — STOP")
    // Second run: the applier's own decision sequence is a no-op on APPLIED.
    if ((await decideDrop(lq)).length !== 0) throw new Error("rehearse: second run produced DDL — not idempotent — STOP")
    local.close()

    writeState({ ...state, successRehearsalSha: PINNED_SHA256[MIGRATION_NAME] })
    out(`[rehearse] PASS on production-data copy: exactly 3 tables retired, shape ${SHAPE_AFTER.tables}/${SHAPE_AFTER.indexes}, canon intact, rows intact, integrity ok, second run no-op`)
  } finally {
    rmSync(copyPath, { force: true })
    out(`[rehearse] rehearsal copy deleted (production-copy data never outlives the check)`)
  }
}

/** Fail-closed rehearsal: a seeded row must STOP the applier with zero DDL. */
async function phaseRehearseFailClosed(): Promise<void> {
  assertPinnedChecksums()
  const state = readState()
  if (!state.backup || !existsSync(state.backup.backupPath)) throw new Error("rehearse-fail-closed: no checkpoint — run 'backup' first — STOP")
  const { DatabaseSync } = await import("node:sqlite")
  const copyPath = join(backupDir(), "core03c-d2-failclosed-copy.db")
  copyFileSync(state.backup.backupPath, copyPath)
  chmodSync(copyPath, 0o600)
  try {
    const local = new DatabaseSync(copyPath)
    const lq = localQuery(local)
    // Controlled fixture: one synthetic row in ClientProject (local copy
    // only). FKs are disabled for the seed exactly as production's
    // unenforced-FK reality would allow such a legacy row to exist.
    local.exec(`PRAGMA foreign_keys=OFF`)
    local.exec(`INSERT INTO "ClientProject" ("id","clienteId","titulo","updatedAt") VALUES ('d2-failclosed-probe','d2-failclosed-cliente','probe',CURRENT_TIMESTAMP)`)

    let stopped = false
    try {
      await decideDrop(lq)
    } catch (err) {
      stopped = err instanceof Error && /gate failed/.test(err.message)
    }
    const tables = await tableNames(lq)
    const stillThere = LEGACY_TABLES.every((t) => tables.has(t))
    const rowStillThere = Number((local.prepare(`SELECT COUNT(*) c FROM "ClientProject"`).get() as any).c) === 1
    local.close()
    if (!stopped || !stillThere || !rowStillThere) {
      throw new Error("rehearse-fail-closed: the applier did NOT stop cleanly on a non-empty table — DO NOT PROCEED — STOP")
    }
    writeState({ ...readState(), failClosedRehearsalSha: PINNED_SHA256[MIGRATION_NAME] })
    out(`[rehearse-fail-closed] PASS: gate STOPPED before any DROP — tables still exist, row still exists, DDL executed = 0`)
  } finally {
    rmSync(copyPath, { force: true })
    out(`[rehearse-fail-closed] fixture copy deleted`)
  }
}

async function phaseApply(t: Target): Promise<void> {
  assertPinnedChecksums()
  const state = readState()
  if (!state.backup || !existsSync(state.backup.backupPath)) throw new Error("apply: no verified checkpoint — run 'backup' — STOP")
  if (state.successRehearsalSha !== PINNED_SHA256[MIGRATION_NAME]) throw new Error("apply: the success rehearsal has not passed for these exact bytes — run 'rehearse' — STOP")
  if (state.failClosedRehearsalSha !== PINNED_SHA256[MIGRATION_NAME]) {
    throw new Error("apply: the fail-closed rehearsal has not passed for these exact bytes — run 'rehearse-fail-closed' — STOP")
  }
  const st = await classifyD2State(t.query)
  if (st === "APPLIED") {
    out(`[apply] ${MIGRATION_NAME}: already applied — nothing to do`)
    return
  }
  if (st !== "PENDING") throw new Error("apply: migration state is INCONSISTENT — refusing to guess — STOP")
  await assertGatesGreen(t.query, "apply/pre")
  let drift = 0
  for (const [table, expected] of Object.entries(state.backup.rowCounts)) {
    if (Number((await t.query(`SELECT COUNT(*) c FROM "${table}"`))[0].c) !== expected) drift++
  }
  if (drift > 0) throw new Error(`apply: live database drifted from the checkpoint in ${drift} tables — STALE — STOP`)

  const stmts = await decideDrop(t.query) // re-classifies and re-gates one last time
  await t.batch(stmts) // ONE atomic batch: the three DROPs all commit or none do

  // Post-validation.
  const shape = await shapeOf(t.query)
  if (shape.tables !== SHAPE_AFTER.tables || shape.indexes !== SHAPE_AFTER.indexes) {
    throw new Error(`apply: post shape ${shape.tables}/${shape.indexes} != expected ${SHAPE_AFTER.tables}/${SHAPE_AFTER.indexes} — INCIDENT`)
  }
  if ((await classifyD2State(t.query)) !== "APPLIED") throw new Error("apply: post state is not APPLIED — INCIDENT")
  const tables = await tableNames(t.query)
  for (const p of PROTECTED_TABLES) {
    if (!tables.has(p)) throw new Error(`apply: canonical table ${p} is missing — INCIDENT`)
  }
  for (const ledger of ["_prisma_migrations", "_sevenef_migrations"]) {
    if (tables.has(ledger)) throw new Error(`apply: ${ledger} exists — Option A forbids a remote ledger — INCIDENT`)
  }
  let postDrift = 0
  for (const [table, expected] of Object.entries(state.backup.rowCounts)) {
    if ((LEGACY_TABLES as readonly string[]).includes(table)) continue
    if (Number((await t.query(`SELECT COUNT(*) c FROM "${table}"`))[0].c) !== expected) postDrift++
  }
  if (postDrift > 0) throw new Error(`apply: ${postDrift} remaining tables changed row counts — INCIDENT`)
  out(`[apply] ${MIGRATION_NAME} APPLIED atomically: 3 legacy tables retired, shape ${shape.tables}/${shape.indexes}, canon intact, remaining rows intact, no ledger`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [phase, ...rest] = process.argv.slice(2)
  ;(async () => {
    const flags = parseFlags(rest)
    assertFlags(phase ?? "", flags)
    assertPinnedChecksums()
    const url = process.env.TURSO_DATABASE_URL || ""
    const token = process.env.TURSO_AUTH_TOKEN || ""
    assertProductionUrl(url)
    if (!token) throw new Error("d2 guard: TURSO_AUTH_TOKEN is not set — refusing to run")
    const t = await openLibsqlTarget(url, token)
    try {
      switch (phase) {
        case "status": await phaseStatus(t.query); break
        case "gates": await assertGatesGreen(t.query, "gates"); break
        case "backup": await phaseBackup(t); break
        case "verify-backup": await phaseVerifyBackup(t); break
        case "rehearse": await phaseRehearse(); break
        case "rehearse-fail-closed": await phaseRehearseFailClosed(); break
        case "apply": await phaseApply(t); break
        default:
          throw new Error("usage: tsx scripts/apply-core-03c-d2-legacy-portal-retirement.ts <status|gates|backup|verify-backup|rehearse|rehearse-fail-closed|apply> --target-production [--owner-authorized]")
      }
    } finally {
      t.close()
    }
  })().catch((err) => {
    console.error(`[core03c-d2] ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}
