/**
 * CORE-03C-D6 — PRODUCTION ADOPTION applier.
 *
 * Applies the three D6B-rehearsed additive migrations
 * (`1_add_missing_indexes`, `2_add_link_columns`, `3_create_portal_tables`)
 * to the ONE pinned Sevenef/7F production database — and nothing else.
 * `0_baseline` is never parsed and never executed: the baseline already
 * exists in production.
 *
 * This tool is deliberately separate from `rehearse-core-03c-d6b.ts`: the
 * rehearsal driver keeps refusing production forever; this applier accepts
 * ONLY production. Neither tool can ever address the other's target.
 *
 * FAIL-CLOSED SAFETY:
 *   - The target URL must have hostname EXACTLY `PRODUCTION_HOST` — a
 *     compile-time constant. The D6B rehearsal branch hostname is refused
 *     by name, as is every other host. No env var can widen the pin.
 *   - Every phase requires the explicit `--target-production` flag; `apply`
 *     additionally requires `--owner-authorized`, whose presence asserts the
 *     operator received the owner's exact authorization phrase
 *     ("AUTORIZO CORE-03C-D6 PRODUCTION ADOPTION") in this window.
 *     Unknown flags abort. There is no --force, no --skip-gates, no
 *     --ignore-drift — and there never will be.
 *   - The three migration files must be byte-identical to what D6B
 *     rehearsed: their sha256 is pinned here and re-checked on every phase.
 *     A changed migration history is an automatic abort.
 *   - Applied-state is decided from SCHEMA PRECONDITIONS (mission §12,
 *     ledger Option A): all objects present → APPLIED, none → PENDING,
 *     partial → INCONSISTENT → hard stop. No `_prisma_migrations` /
 *     `_sevenef_migrations` is ever created.
 *   - `apply` refuses to run without a VERIFIED recovery checkpoint: the
 *     `backup` phase dumps production logically into a local SQLite file
 *     (restrictive permissions, never inside the repo), verifies the
 *     restored copy structurally and by row counts, and records the capture
 *     in a state file. `apply` re-checks that the backup still matches the
 *     live database (freshness) before the first write.
 *   - The M2 §8 blocking gates are re-run inside `apply` immediately before
 *     the first write; any regression aborts.
 *
 * Usage: tsx scripts/apply-core-03c-production-adoption.ts <phase> --target-production
 * Phases: identify | gates | backup | verify-backup | status
 *         | apply --owner-authorized
 * Env:    TURSO_DATABASE_URL   (required) libsql/https/wss URL; hostname
 *                              must equal the pinned production hostname
 *         TURSO_AUTH_TOKEN     (required) database auth token
 *         CORE03C_BACKUP_DIR   (optional) directory for the local recovery
 *                              checkpoint (default: <os tmpdir>/core03c-adoption)
 *         CORE03C_STATE_FILE   (optional) backup state path (default under
 *                              the backup dir)
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- raw SQL rows are untyped */

import { createHash } from "node:crypto"
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { splitStatements } from "./rehearse-core-03c-d6"
import { parsePreconditions, classifyState, type MigrationState, type Preconditions } from "./rehearse-core-03c-d6b"

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const MIGRATIONS_DIR = join(REPO_ROOT, "prisma", "migrations")
const LEDGER_TABLES = ["_prisma_migrations", "_sevenef_migrations"]

/**
 * The one and only target this tool can address: Sevenef/7F production.
 * A hostname is the identity of a Turso database — pinning it here means
 * this applier cannot address any other database, the D6B rehearsal branch
 * included, no matter what the environment contains.
 */
export const PRODUCTION_HOST = "7f-7frames.aws-eu-west-1.turso.io"

/** The D6B disposable rehearsal branch — refused by name, forever. */
export const REHEARSAL_HOST = "7f-d6b-rehearsal-7frames.aws-eu-west-1.turso.io"

/**
 * sha256 of each deployable migration file exactly as CORE-03C-D6B rehearsed
 * it (branch `7f-evolution` @ b99cf2a). If any file differs by one byte the
 * applier aborts: an unrehearsed migration must never reach production.
 */
export const REHEARSED_SHA256: Record<string, string> = {
  "1_add_missing_indexes": "46fae4edf66a5cecaabb01ae24bccc101930853a90e3c2f580a2a041cf925137",
  "2_add_link_columns": "444d3a2661a1754c1d071b0ad632e83dea0c6c290a46a5cdb5afa4a2860745ed",
  "3_create_portal_tables": "101c8b37d8322585f0d06ef4feadd70910425c8d2508278113c9d27434064ae2",
}

/** Structural expectations, verified in D6 and re-verified on Turso Cloud in D6B. */
export const EXPECT = {
  baseline: { tables: 48, indexes: 61 },
  afterByName: {
    "1_add_missing_indexes": { tables: 48, indexes: 82 },
    "2_add_link_columns": { tables: 48, indexes: 84 },
    "3_create_portal_tables": { tables: 52, indexes: 93 },
  } as Record<string, { tables: number; indexes: number }>,
}

const out = (line: string): void => {
  process.stdout.write(line + "\n")
}

// ─── Fail-closed guards ───────────────────────────────────────────────────────

/** Throws unless the URL addresses exactly pinned production. */
export function assertProductionUrl(raw: string): void {
  if (!raw) throw new Error("production guard: TURSO_DATABASE_URL is not set — refusing to run")
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("production guard: target URL is unparseable — refusing to run")
  }
  const scheme = url.protocol.replace(":", "")
  if (!["libsql", "https", "wss"].includes(scheme)) {
    throw new Error(`production guard: scheme '${scheme}' is not an allowed remote scheme`)
  }
  const host = url.hostname.toLowerCase()
  if (host === REHEARSAL_HOST) {
    throw new Error("production guard: target is the D6B rehearsal branch — this applier refuses it (the rehearsal is not production)")
  }
  if (host !== PRODUCTION_HOST) {
    throw new Error("production guard: target hostname is not pinned production — refusing (this tool addresses exactly one database)")
  }
  if (url.username || url.password) {
    throw new Error("production guard: credentials embedded in the URL are refused — pass the token via TURSO_AUTH_TOKEN")
  }
}

export interface Flags {
  targetProduction: boolean
  ownerAuthorized: boolean
}

/**
 * Strict argv parser: only the two known flags exist. Anything else —
 * including any would-be override (--force, --skip-gates, --ignore-drift) —
 * aborts before a connection is ever opened.
 */
export function parseFlags(argv: string[]): Flags {
  const flags: Flags = { targetProduction: false, ownerAuthorized: false }
  for (const arg of argv) {
    if (arg === "--target-production") flags.targetProduction = true
    else if (arg === "--owner-authorized") flags.ownerAuthorized = true
    else throw new Error(`production guard: unknown argument '${arg}' — this tool has no overrides`)
  }
  return flags
}

export function assertFlags(phase: string, flags: Flags): void {
  if (!flags.targetProduction) {
    throw new Error("production guard: the explicit --target-production flag is required for every phase")
  }
  if (phase === "apply" && !flags.ownerAuthorized) {
    throw new Error(
      "production guard: 'apply' requires --owner-authorized — only after the owner's exact phrase 'AUTORIZO CORE-03C-D6 PRODUCTION ADOPTION' was received in this window",
    )
  }
}

/** Verifies the three migration files are byte-identical to the D6B rehearsal. */
export function assertRehearsedChecksums(migrationsDir: string = MIGRATIONS_DIR): void {
  for (const [name, expected] of Object.entries(REHEARSED_SHA256)) {
    const sql = readFileSync(join(migrationsDir, name, "migration.sql"))
    const actual = createHash("sha256").update(sql).digest("hex")
    if (actual !== expected) {
      throw new Error(`production guard: ${name}/migration.sql differs from the D6B-rehearsed bytes — an unrehearsed migration must never reach production — STOP`)
    }
  }
}

// ─── Target access ────────────────────────────────────────────────────────────

interface Target {
  execute(sql: string, args?: any[]): Promise<any[]>
  batch(stmts: string[]): Promise<void>
  close(): void
}

async function openTarget(url: string, authToken: string): Promise<Target> {
  const { createClient } = await import("@libsql/client")
  const client = createClient({ url, authToken })
  return {
    async execute(sql, args = []) {
      return (await client.execute({ sql, args })).rows as any[]
    },
    async batch(stmts) {
      await client.batch(stmts, "write")
    },
    close: () => client.close(),
  }
}

// ─── Backup state ─────────────────────────────────────────────────────────────

function backupDir(): string {
  return process.env.CORE03C_BACKUP_DIR || join(tmpdir(), "core03c-adoption")
}

function stateFilePath(): string {
  return process.env.CORE03C_STATE_FILE || join(backupDir(), "core03c-adoption-state.json")
}

interface BackupState {
  backupPath: string
  createdAt: string
  verifiedAt: string
  tables: number
  explicitIndexes: number
  rowCounts: Record<string, number>
}

function readBackupState(): BackupState {
  if (!existsSync(stateFilePath())) {
    throw new Error("production guard: no verified backup state exists — run the 'backup' phase first — STOP")
  }
  return JSON.parse(readFileSync(stateFilePath(), "utf8"))
}

// ─── Schema inspection (SELECT/PRAGMA only) ──────────────────────────────────

async function userTables(t: Target): Promise<string[]> {
  const rows = await t.execute(`SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
  return rows.map((r: any) => String(r.name))
}

async function businessTables(t: Target): Promise<string[]> {
  return (await userTables(t)).filter((n) => !n.startsWith("_"))
}

async function explicitIndexCount(t: Target): Promise<number> {
  const rows = await t.execute(
    `SELECT COUNT(*) c FROM sqlite_schema WHERE type='index' AND name NOT LIKE 'sqlite_%' AND tbl_name NOT LIKE '\\_%' ESCAPE '\\'`,
  )
  return Number(rows[0].c)
}

async function countRows(t: Target, table: string): Promise<number> {
  return Number((await t.execute(`SELECT COUNT(*) c FROM "${table}"`))[0].c)
}

async function columnInfo(t: Target, table: string): Promise<Array<{ name: string; type: string; notnull: number; dflt: unknown }>> {
  const rows = await t.execute(`PRAGMA table_info("${table}")`)
  return rows.map((r: any) => ({ name: String(r.name), type: String(r.type), notnull: Number(r.notnull), dflt: r.dflt_value }))
}

// ─── Migration history ────────────────────────────────────────────────────────

interface MigrationEntry {
  name: string
  sql: string
  pre: Preconditions
}

/** The three deployable migrations, in order. The baseline is never included. */
function deployableHistory(): MigrationEntry[] {
  assertRehearsedChecksums()
  return Object.keys(REHEARSED_SHA256)
    .sort()
    .map((name) => {
      const sql = readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8")
      return { name, sql, pre: parsePreconditions(sql) }
    })
}

async function presentObjects(t: Target, pre: Preconditions): Promise<{ indexes: Set<string>; tables: Set<string>; columns: Set<string> }> {
  const idx = await t.execute(`SELECT name FROM sqlite_schema WHERE type='index' AND name NOT LIKE 'sqlite_%'`)
  const tbl = await t.execute(`SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
  const tableNames = new Set(tbl.map((r: any) => String(r.name)))
  const columns = new Set<string>()
  for (const table of new Set(pre.columns.map((c) => c.table))) {
    if (!tableNames.has(table)) continue
    for (const col of await columnInfo(t, table)) columns.add(`${table}.${col.name}`)
  }
  return { indexes: new Set(idx.map((r: any) => String(r.name))), tables: tableNames, columns }
}

async function migrationState(t: Target, entry: MigrationEntry): Promise<MigrationState> {
  return classifyState(entry.pre, await presentObjects(t, entry.pre))
}

// ─── M2 §8 blocking gates (aggregate-only, read-only) ────────────────────────

interface GateResult {
  name: string
  pass: boolean
  detail: string
}

async function runBlockingGates(t: Target): Promise<GateResult[]> {
  const results: GateResult[] = []
  const gate = (name: string, pass: boolean, detail: string) => results.push({ name, pass, detail })

  for (const table of ["ClientProject", "ClientInvoice", "ClientFile"]) {
    const c = await countRows(t, table)
    gate(`D2 ${table}`, c === 0, `rows=${c}`)
  }

  const items = (await t.execute(
    `SELECT COUNT(*) total,
            SUM(CASE WHEN "items" IS NULL THEN 1 ELSE 0 END) nulls,
            SUM(CASE WHEN "items" IS NOT NULL AND TRIM("items") = '' THEN 1 ELSE 0 END) blank,
            SUM(CASE WHEN "items" IS NOT NULL AND TRIM("items") <> '' AND json_valid("items") = 0 THEN 1 ELSE 0 END) invalidJson,
            SUM(CASE WHEN json_valid("items") = 1 AND json_type("items") <> 'array' THEN 1 ELSE 0 END) nonArrays
       FROM "Factura"`,
  ))[0]
  gate(
    "D5 Factura.items",
    Number(items.nulls ?? 0) === 0 && Number(items.blank ?? 0) === 0 && Number(items.invalidJson ?? 0) === 0 && Number(items.nonArrays ?? 0) === 0,
    `total=${items.total} nulls=${items.nulls ?? 0} blank=${items.blank ?? 0} invalidJson=${items.invalidJson ?? 0} nonArrays=${items.nonArrays ?? 0}`,
  )

  const docNulls = Number((await t.execute(`SELECT COUNT(*) c FROM "Documento" WHERE "url" IS NULL`))[0].c)
  gate("D5 Documento.url", docNulls === 0, `nulls=${docNulls}`)

  const tipoNulls = Number((await t.execute(`SELECT COUNT(*) c FROM "Cliente" WHERE "tipo" IS NULL`))[0].c)
  gate("D5 Cliente.tipo", tipoNulls === 0, `nulls=${tipoNulls}`)

  const fecha = (await t.execute(
    `SELECT SUM(CASE WHEN "fechaEmision" IS NULL THEN 1 ELSE 0 END) nulls,
            SUM(CASE WHEN "fechaEmision" IS NOT NULL AND datetime("fechaEmision") IS NULL THEN 1 ELSE 0 END) invalid
       FROM "Factura"`,
  ))[0]
  gate("D5 Factura.fechaEmision", Number(fecha.nulls ?? 0) === 0 && Number(fecha.invalid ?? 0) === 0, `nulls=${fecha.nulls ?? 0} invalid=${fecha.invalid ?? 0}`)

  return results
}

// ─── Phases ───────────────────────────────────────────────────────────────────

async function phaseIdentify(t: Target): Promise<void> {
  const all = await userTables(t)
  const tables = all.filter((n) => !n.startsWith("_"))
  const inboxCols = (await columnInfo(t, "InboxTodo")).map((c) => c.name)
  const qrCols = (await columnInfo(t, "QRCode")).map((c) => c.name)
  const states: Record<string, MigrationState> = {}
  for (const entry of deployableHistory()) states[entry.name] = await migrationState(t, entry)
  const report = {
    host: PRODUCTION_HOST,
    businessTables: tables.length,
    explicitIndexes: await explicitIndexCount(t),
    ledgerTables: LEDGER_TABLES.filter((l) => all.includes(l)),
    inboxTodoHasWorkspaceTaskId: inboxCols.includes("workspaceTaskId"),
    qrCodeHasWorkspaceId: qrCols.includes("workspaceId"),
    portalTablesPresent: ["ClientAsset", "ClientRequest", "ClientRequestAsset", "ForteSnapshot"].filter((n) => tables.includes(n)),
    migrationStates: states,
  }
  out(`[identify] ${JSON.stringify(report)}`)
  if (Object.values(states).includes("INCONSISTENT")) {
    throw new Error("identify: at least one migration is INCONSISTENT (partially present) — STOP")
  }
}

async function phaseGates(t: Target): Promise<void> {
  const results = await runBlockingGates(t)
  for (const r of results) out(`[gates] ${r.pass ? "PASS" : "FAIL"} ${r.name} (${r.detail})`)
  if (results.some((r) => !r.pass)) throw new Error("gates: at least one M2 §8 blocking gate FAILED — STOP")
}

/**
 * Logical dump of production into a local SQLite file, restore-verified.
 * The dump holds real data: it lives outside the repo, gets 0600
 * permissions, and its contents are never printed.
 */
async function phaseBackup(t: Target): Promise<void> {
  const tables = await businessTables(t)
  const indexes = await explicitIndexCount(t)
  const all = await userTables(t)
  for (const ledger of LEDGER_TABLES) {
    if (all.includes(ledger)) throw new Error(`backup: ${ledger} exists — target is not the expected ledger-free pre-adoption database — STOP`)
  }
  if (tables.length !== EXPECT.baseline.tables || indexes !== EXPECT.baseline.indexes) {
    throw new Error(`backup: production shape ${tables.length}/${indexes} is not the pre-adoption baseline ${EXPECT.baseline.tables}/${EXPECT.baseline.indexes} — the checkpoint must capture the PRE-ADOPTION state — STOP`)
  }

  const { DatabaseSync } = await import("node:sqlite")
  mkdirSync(backupDir(), { recursive: true, mode: 0o700 })
  const backupPath = join(backupDir(), "core03c-pre-adoption-checkpoint.db")
  rmSync(backupPath, { force: true })

  const ddl = await t.execute(
    `SELECT sql FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND sql IS NOT NULL ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name`,
  )
  const local = new DatabaseSync(backupPath)
  local.exec("PRAGMA foreign_keys=OFF")
  for (const row of ddl) local.exec(String(row.sql))

  const rowCounts: Record<string, number> = {}
  let totalRows = 0
  for (const table of tables) {
    const rows = await t.execute(`SELECT * FROM "${table}"`)
    rowCounts[table] = rows.length
    if (rows.length === 0) continue
    const names = Object.keys(rows[0])
    const stmt = local.prepare(`INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(",")}) VALUES (${names.map(() => "?").join(",")})`)
    for (const r of rows) {
      stmt.run(...names.map((n) => (r[n] === undefined ? null : (r[n] as any))))
      totalRows++
    }
  }

  // Restore verification on the local copy: structure and per-table counts.
  const localTables = Number((local.prepare(`SELECT COUNT(*) c FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'`).get() as any).c)
  const localIndexes = Number(
    (local.prepare(`SELECT COUNT(*) c FROM sqlite_schema WHERE type='index' AND name NOT LIKE 'sqlite_%' AND tbl_name NOT LIKE '\\_%' ESCAPE '\\'`).get() as any).c,
  )
  let mismatches = 0
  for (const table of tables) {
    const localCount = Number((local.prepare(`SELECT COUNT(*) c FROM "${table}"`).get() as any).c)
    const remoteCount = await countRows(t, table)
    if (localCount !== rowCounts[table] || remoteCount !== rowCounts[table]) mismatches++
  }
  local.close()
  chmodSync(backupPath, 0o600)
  if (localTables !== tables.length) throw new Error(`backup: restored table count ${localTables} != ${tables.length} — STOP`)
  if (localIndexes !== indexes) throw new Error(`backup: restored explicit index count ${localIndexes} != ${indexes} — STOP`)
  if (mismatches > 0) throw new Error(`backup: ${mismatches} tables restored with wrong row counts — STOP`)

  const state: BackupState = {
    backupPath,
    createdAt: new Date().toISOString(),
    verifiedAt: new Date().toISOString(),
    tables: tables.length,
    explicitIndexes: indexes,
    rowCounts,
  }
  writeFileSync(stateFilePath(), JSON.stringify(state, null, 2), { mode: 0o600 })
  out(`[backup] checkpoint created and restore-verified: tables=${tables.length} explicitIndexes=${indexes} rowsCopied=${totalRows} rowCountMismatches=0`)
  out(`[backup] path=${backupPath} (0600, outside the repo — contains real data, never commit, never print)`)
}

/** Re-verifies the stored checkpoint against the live database (freshness). */
async function phaseVerifyBackup(t: Target): Promise<void> {
  const state = readBackupState()
  if (!existsSync(state.backupPath)) throw new Error("verify-backup: checkpoint file is gone — re-run 'backup' — STOP")
  const { DatabaseSync } = await import("node:sqlite")
  const local = new DatabaseSync(state.backupPath, { readOnly: true })
  const localTables = Number((local.prepare(`SELECT COUNT(*) c FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'`).get() as any).c)
  let localMismatches = 0
  for (const [table, expected] of Object.entries(state.rowCounts)) {
    if (Number((local.prepare(`SELECT COUNT(*) c FROM "${table}"`).get() as any).c) !== expected) localMismatches++
  }
  local.close()
  if (localTables !== state.tables || localMismatches > 0) {
    throw new Error("verify-backup: checkpoint no longer matches its own capture — re-run 'backup' — STOP")
  }
  let drift = 0
  for (const [table, expected] of Object.entries(state.rowCounts)) {
    if ((await countRows(t, table)) !== expected) drift++
  }
  if (drift > 0) {
    throw new Error(`verify-backup: live database drifted from the checkpoint in ${drift} tables — the checkpoint is STALE, re-run 'backup' — STOP`)
  }
  out(`[verify-backup] checkpoint intact and FRESH: tables=${state.tables} explicitIndexes=${state.explicitIndexes} liveRowDrift=0`)
}

async function validateAfterMigration(t: Target, name: string, state: BackupState): Promise<void> {
  const tables = (await businessTables(t)).length
  const indexes = await explicitIndexCount(t)
  const expect = EXPECT.afterByName[name]
  if (!expect) throw new Error(`validate: no structural expectation for '${name}'`)
  if (tables !== expect.tables || indexes !== expect.indexes) {
    throw new Error(`${name}: tables=${tables}/indexes=${indexes}, expected ${expect.tables}/${expect.indexes} — STOP`)
  }
  for (const [table, expected] of Object.entries(state.rowCounts)) {
    const now = await countRows(t, table)
    if (now !== expected) throw new Error(`${name}: row count changed for ${table} (${expected} → ${now}) — migrations must not touch data — STOP`)
  }
  if (name === "2_add_link_columns") {
    const todoLink = (await columnInfo(t, "InboxTodo")).find((c) => c.name === "workspaceTaskId")
    const qrWs = (await columnInfo(t, "QRCode")).find((c) => c.name === "workspaceId")
    if (!todoLink || todoLink.type !== "TEXT" || todoLink.notnull !== 0 || todoLink.dflt !== null) throw new Error(`${name}: InboxTodo.workspaceTaskId wrong shape — STOP`)
    if (!qrWs || qrWs.type !== "TEXT" || qrWs.notnull !== 0 || qrWs.dflt !== null) throw new Error(`${name}: QRCode.workspaceId wrong shape — STOP`)
    const linkedTodos = Number((await t.execute(`SELECT COUNT(*) c FROM "InboxTodo" WHERE "workspaceTaskId" IS NOT NULL`))[0].c)
    if (linkedTodos !== 0) throw new Error(`${name}: ${linkedTodos} InboxTodo rows gained an invented link — STOP`)
    const scopedQrs = Number((await t.execute(`SELECT COUNT(*) c FROM "QRCode" WHERE "workspaceId" IS NOT NULL`))[0].c)
    if (scopedQrs !== 0) throw new Error(`${name}: ${scopedQrs} QRCode rows gained an invented workspace — STOP`)
    out(`[migration 2] columns=OK nullable/no-default=OK legacy links all NULL, no synthetic tasks, no default workspace`)
  } else if (name === "3_create_portal_tables") {
    for (const created of ["ClientAsset", "ClientRequest", "ClientRequestAsset", "ForteSnapshot"]) {
      if ((await countRows(t, created)) !== 0) throw new Error(`${name}: new table ${created} is not empty — STOP`)
    }
    out(`[migration 3] tables=${tables} explicitIndexes=${indexes} new tables empty`)
  } else {
    out(`[migration 1] tables=${tables} explicitIndexes=${indexes} rows intact`)
  }
}

async function phaseApply(t: Target): Promise<void> {
  // Every pre-write gate re-checked immediately before the first write.
  const state = readBackupState()
  if (!existsSync(state.backupPath)) throw new Error("apply: verified checkpoint file is gone — re-run 'backup' — STOP")

  const gates = await runBlockingGates(t)
  for (const r of gates) out(`[apply/pre] ${r.pass ? "PASS" : "FAIL"} ${r.name} (${r.detail})`)
  if (gates.some((r) => !r.pass)) throw new Error("apply: an M2 §8 blocking gate FAILED immediately before the write window — STOP")

  let drift = 0
  for (const [table, expected] of Object.entries(state.rowCounts)) {
    if ((await countRows(t, table)) !== expected) drift++
  }
  if (drift > 0) throw new Error(`apply: live database drifted from the verified checkpoint in ${drift} tables — checkpoint STALE, re-run 'backup' — STOP`)

  const history = deployableHistory()
  const states = new Map<string, MigrationState>()
  for (const entry of history) states.set(entry.name, await migrationState(t, entry))
  if ([...states.values()].includes("INCONSISTENT")) {
    throw new Error(`apply: INCONSISTENT migration state ${JSON.stringify([...states.entries()])} — refusing to guess — STOP`)
  }

  const applied: string[] = []
  for (const entry of history) {
    if (states.get(entry.name) === "APPLIED") {
      out(`[apply] ${entry.name}: already applied (all schema preconditions present) — skipping`)
      continue
    }
    await t.batch(splitStatements(entry.sql)) // one atomic batch per migration
    await validateAfterMigration(t, entry.name, state)
    applied.push(entry.name)
  }
  out(`[apply] applied=${JSON.stringify(applied)} finalTables=${(await businessTables(t)).length} finalExplicitIndexes=${await explicitIndexCount(t)}`)
}

async function phaseStatus(t: Target): Promise<void> {
  out(`[status] tables=${(await businessTables(t)).length} explicitIndexes=${await explicitIndexCount(t)}`)
  for (const entry of deployableHistory()) {
    out(`[status] ${entry.name}: ${await migrationState(t, entry)} (by schema preconditions; no ledger exists by design)`)
  }
  const all = await userTables(t)
  for (const ledger of LEDGER_TABLES) {
    if (all.includes(ledger)) throw new Error(`status: ${ledger} exists — this adoption forbids creating a ledger (Option A)`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [phase, ...rest] = process.argv.slice(2)
  ;(async () => {
    const flags = parseFlags(rest)
    assertFlags(phase ?? "", flags)
    assertRehearsedChecksums()
    const url = process.env.TURSO_DATABASE_URL || ""
    const token = process.env.TURSO_AUTH_TOKEN || ""
    assertProductionUrl(url)
    if (!token) throw new Error("production guard: TURSO_AUTH_TOKEN is not set — refusing to run")
    const t = await openTarget(url, token)
    try {
      switch (phase) {
        case "identify": await phaseIdentify(t); break
        case "gates": await phaseGates(t); break
        case "backup": await phaseBackup(t); break
        case "verify-backup": await phaseVerifyBackup(t); break
        case "apply": await phaseApply(t); break
        case "status": await phaseStatus(t); break
        default:
          throw new Error("usage: tsx scripts/apply-core-03c-production-adoption.ts <identify|gates|backup|verify-backup|apply|status> --target-production [--owner-authorized]")
      }
    } finally {
      t.close()
    }
  })().catch((err) => {
    console.error(`[core03c-adoption] ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}
