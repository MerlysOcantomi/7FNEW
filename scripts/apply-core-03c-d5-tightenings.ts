/**
 * CORE-03C-D5 — SCHEMA TIGHTENINGS applier.
 *
 * Applies `4_d5_schema_tightenings` — the four owner-approved nullability
 * tightenings (Cliente.tipo, Documento.url, Factura.items,
 * Factura.fechaEmision; canonical decisions doc §7, M2 "APPROVED WITH
 * RECHECK") — to the ONE pinned Sevenef/7F production database.
 *
 * FAIL-CLOSED SAFETY (same model as the D6/D3 appliers; the production
 * hostname guard is shared with the D6 applier):
 *   - `--target-production` required for every phase, `--owner-authorized`
 *     additionally for `apply`; unknown flags abort — there is no --force,
 *     no --skip-gates, no --ignore-invalid-data.
 *   - The migration file must be byte-identical to the rehearsed bytes
 *     (pinned sha256), re-checked on every phase.
 *   - Applied-state is classified from the four columns' PRAGMA shape:
 *     all four in the relaxed pre-D5 shape → PENDING; all four in the
 *     target shape → APPLIED; anything else → INCONSISTENT → hard stop.
 *   - The four D5 data gates re-run immediately before the first DDL: ONE
 *     incompatible row anywhere → STOP. No value is ever invented and no
 *     row is ever modified: the migration is INSERT…SELECT verbatim copies
 *     into rebuilt tables (rebuild is SQLite's only NOT-NULL mechanism).
 *   - `apply` refuses to run without a restore-verified FRESH checkpoint
 *     and without a recorded PASS of the local data rehearsal (`rehearse`
 *     runs the real migration against a copy of that checkpoint: shapes,
 *     row counts, aggregate values, FK/index preservation, NULL-rejection
 *     and second-run APPLIED classification).
 *   - The whole migration executes as ONE atomic libSQL batch (the
 *     strongest atomicity available on the wire protocol): the three table
 *     rebuilds either all commit or none do.
 *
 * Usage: tsx scripts/apply-core-03c-d5-tightenings.ts <phase> --target-production
 * Phases: status | gates | backup | verify-backup | rehearse | apply
 *         | negative-probe
 * Env:    TURSO_DATABASE_URL / TURSO_AUTH_TOKEN  (required; production pin)
 *         CORE03C_D5_BACKUP_DIR  (optional) checkpoint dir (default:
 *                                <os tmpdir>/core03c-d5-tightenings)
 *         CORE03C_D5_STATE_FILE  (optional) state path (default under the
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
const MIGRATION_NAME = "4_d5_schema_tightenings"
const MIGRATION_PATH = join(REPO_ROOT, "prisma", "migrations", MIGRATION_NAME, "migration.sql")

/** Post-D6/D3, pre- and post-D5 shape: the rebuilds recreate equivalents. */
export const EXPECTED_SHAPE = { tables: 52, indexes: 93 }

/**
 * sha256 of 4_d5_schema_tightenings/migration.sql exactly as rehearsed
 * (verify-history + local data rehearsal). One changed byte aborts.
 */
export const REHEARSED_SHA256_D5 = "b7e8249a97e9bc46d6847c4584c83821b00426eea5e9462dc773d504ef9129ba"

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
    else throw new Error(`d5 guard: unknown argument '${arg}' — this tool has no overrides`)
  }
  return flags
}

export function assertFlags(phase: string, flags: Flags): void {
  if (!flags.targetProduction) {
    throw new Error("d5 guard: the explicit --target-production flag is required for every phase")
  }
  if (phase === "apply" && !flags.ownerAuthorized) {
    throw new Error(
      "d5 guard: 'apply' requires --owner-authorized — only after the owner's exact phrase 'AUTORIZO CORE-03C-D5 SCHEMA TIGHTENINGS' was received in this window",
    )
  }
}

export function assertRehearsedChecksum(migrationPath: string = MIGRATION_PATH): void {
  const actual = createHash("sha256").update(readFileSync(migrationPath)).digest("hex")
  if (actual !== REHEARSED_SHA256_D5) {
    throw new Error("d5 guard: 4_d5_schema_tightenings/migration.sql differs from the rehearsed bytes — an unrehearsed migration must never reach production — STOP")
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
  return process.env.CORE03C_D5_BACKUP_DIR || join(tmpdir(), "core03c-d5-tightenings")
}

function stateFilePath(): string {
  return process.env.CORE03C_D5_STATE_FILE || join(backupDir(), "core03c-d5-state.json")
}

interface State {
  backup?: {
    backupPath: string
    createdAt: string
    tables: number
    rowCounts: Record<string, number>
  }
  rehearsalPassedForSha?: string
}

function readState(): State {
  if (!existsSync(stateFilePath())) return {}
  return JSON.parse(readFileSync(stateFilePath(), "utf8"))
}

function writeState(state: State): void {
  mkdirSync(backupDir(), { recursive: true, mode: 0o700 })
  writeFileSync(stateFilePath(), JSON.stringify(state, null, 2), { mode: 0o600 })
}

// ─── Column shape classification ─────────────────────────────────────────────

export type MigrationState = "APPLIED" | "PENDING" | "INCONSISTENT"

interface ColumnShape {
  type: string
  notnull: number
  dflt: string | null
}

async function columnShape(q: QueryFn, table: string, column: string): Promise<ColumnShape> {
  const rows = await q(`PRAGMA table_info("${table}")`)
  const c = rows.find((r: any) => String(r.name) === column)
  if (!c) throw new Error(`d5 guard: ${table}.${column} does not exist — unexpected schema — STOP`)
  return { type: String(c.type), notnull: Number(c.notnull), dflt: c.dflt_value === null || c.dflt_value === undefined ? null : String(c.dflt_value) }
}

const stripQuotes = (v: string | null): string | null => (v === null ? null : v.replace(/^'(.*)'$/, "$1"))

/** The four columns: relaxed (pre-D5) vs target (post-D5) shapes. */
export async function classifyD5State(q: QueryFn): Promise<MigrationState> {
  const tipo = await columnShape(q, "Cliente", "tipo")
  const url = await columnShape(q, "Documento", "url")
  const items = await columnShape(q, "Factura", "items")
  const fecha = await columnShape(q, "Factura", "fechaEmision")

  const atTarget =
    tipo.notnull === 1 && stripQuotes(tipo.dflt) === "empresa" &&
    url.notnull === 1 && url.dflt === null &&
    items.notnull === 1 && items.dflt === null &&
    fecha.notnull === 1 && fecha.dflt === "CURRENT_TIMESTAMP"
  const atRelaxed =
    tipo.notnull === 0 && tipo.dflt === null &&
    url.notnull === 0 && url.dflt === null &&
    items.notnull === 0 && items.dflt === null &&
    fecha.notnull === 0 && fecha.dflt === null

  if (atTarget) return "APPLIED"
  if (atRelaxed) return "PENDING"
  return "INCONSISTENT"
}

// ─── D5 data gates ────────────────────────────────────────────────────────────

interface GateResult {
  name: string
  pass: boolean
  detail: string
}

export async function runD5Gates(q: QueryFn): Promise<GateResult[]> {
  const results: GateResult[] = []
  const gate = (name: string, pass: boolean, detail: string) => results.push({ name, pass, detail })

  const items = (await q(
    `SELECT COUNT(*) total,
            SUM(CASE WHEN "items" IS NULL THEN 1 ELSE 0 END) nulls,
            SUM(CASE WHEN "items" IS NOT NULL AND TRIM("items") = '' THEN 1 ELSE 0 END) blank,
            SUM(CASE WHEN "items" IS NOT NULL AND TRIM("items") <> '' AND json_valid("items") = 0 THEN 1 ELSE 0 END) invalidJson,
            SUM(CASE WHEN json_valid("items") = 1 AND json_type("items") <> 'array' THEN 1 ELSE 0 END) nonArrays
       FROM "Factura"`,
  ))[0]
  gate(
    "Factura.items",
    Number(items.nulls ?? 0) === 0 && Number(items.blank ?? 0) === 0 && Number(items.invalidJson ?? 0) === 0 && Number(items.nonArrays ?? 0) === 0,
    `total=${items.total} nulls=${items.nulls ?? 0} blank=${items.blank ?? 0} invalidJson=${items.invalidJson ?? 0} nonArrays=${items.nonArrays ?? 0}`,
  )

  const url = (await q(`SELECT COUNT(*) total, SUM(CASE WHEN "url" IS NULL THEN 1 ELSE 0 END) nulls FROM "Documento"`))[0]
  gate("Documento.url", Number(url.nulls ?? 0) === 0, `total=${url.total} nulls=${url.nulls ?? 0}`)

  const tipo = (await q(`SELECT COUNT(*) total, SUM(CASE WHEN "tipo" IS NULL THEN 1 ELSE 0 END) nulls FROM "Cliente"`))[0]
  gate("Cliente.tipo", Number(tipo.nulls ?? 0) === 0, `total=${tipo.total} nulls=${tipo.nulls ?? 0}`)

  const fecha = (await q(
    `SELECT SUM(CASE WHEN "fechaEmision" IS NULL THEN 1 ELSE 0 END) nulls,
            SUM(CASE WHEN "fechaEmision" IS NOT NULL AND datetime("fechaEmision") IS NULL THEN 1 ELSE 0 END) invalid
       FROM "Factura"`,
  ))[0]
  gate("Factura.fechaEmision", Number(fecha.nulls ?? 0) === 0 && Number(fecha.invalid ?? 0) === 0, `nulls=${fecha.nulls ?? 0} invalid=${fecha.invalid ?? 0}`)

  return results
}

async function assertGatesGreen(q: QueryFn, label: string): Promise<void> {
  const results = await runD5Gates(q)
  for (const r of results) out(`[${label}] ${r.pass ? "PASS" : "FAIL"} ${r.name} (${r.detail})`)
  if (results.some((r) => !r.pass)) throw new Error(`${label}: a D5 data gate FAILED — one incompatible row is a full stop — STOP`)
}

// ─── Shape helpers ────────────────────────────────────────────────────────────

async function assertShape(q: QueryFn): Promise<void> {
  const tables = (await q(`SELECT COUNT(*) c FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\'`))[0]
  const indexes = (await q(`SELECT COUNT(*) c FROM sqlite_schema WHERE type='index' AND name NOT LIKE 'sqlite_%' AND tbl_name NOT LIKE '\\_%' ESCAPE '\\'`))[0]
  if (Number(tables.c) !== EXPECTED_SHAPE.tables || Number(indexes.c) !== EXPECTED_SHAPE.indexes) {
    throw new Error(`d5 guard: schema shape ${tables.c}/${indexes.c} is not the expected ${EXPECTED_SHAPE.tables}/${EXPECTED_SHAPE.indexes} — STOP`)
  }
}

async function businessTables(q: QueryFn): Promise<string[]> {
  return (await q(`SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name`)).map(
    (r: any) => String(r.name),
  )
}

/** Aggregate value fingerprints of the three rebuilt tables (no row content). */
async function valueFingerprint(q: QueryFn): Promise<Record<string, unknown>> {
  const fp: Record<string, unknown> = {}
  fp.cliente = (await q(`SELECT COUNT(*) c, COUNT(DISTINCT "tipo") tipos, SUM(LENGTH("id")) idlen FROM "Cliente"`))[0]
  fp.documento = (await q(`SELECT COUNT(*) c FROM "Documento"`))[0]
  fp.factura = (await q(
    `SELECT COUNT(*) c, SUM(LENGTH("items")) itemslen, SUM(json_valid("items")) valid, MIN("fechaEmision") minf, MAX("fechaEmision") maxf, SUM("total") sumtotal FROM "Factura"`,
  ))[0]
  return fp
}

// ─── Phases ───────────────────────────────────────────────────────────────────

async function phaseStatus(q: QueryFn): Promise<void> {
  await assertShape(q)
  out(`[status] ${MIGRATION_NAME}: ${await classifyD5State(q)} (by PRAGMA column shape; no ledger by design)`)
}

async function phaseBackup(t: Target): Promise<void> {
  await assertShape(t.query)
  const { DatabaseSync } = await import("node:sqlite")
  mkdirSync(backupDir(), { recursive: true, mode: 0o700 })
  const backupPath = join(backupDir(), "core03c-d5-pre-tightening-checkpoint.db")
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
  const localTables = Number((local.prepare(`SELECT COUNT(*) c FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'`).get() as any).c)
  let mismatches = 0
  for (const table of tables) {
    const localCount = Number((local.prepare(`SELECT COUNT(*) c FROM "${table}"`).get() as any).c)
    const remote = Number((await t.query(`SELECT COUNT(*) c FROM "${table}"`))[0].c)
    if (localCount !== rowCounts[table] || remote !== rowCounts[table]) mismatches++
  }
  local.close()
  chmodSync(backupPath, 0o600)
  if (localTables !== tables.length) throw new Error(`backup: restored table count ${localTables} != ${tables.length} — STOP`)
  if (mismatches > 0) throw new Error(`backup: ${mismatches} tables restored with wrong row counts — STOP`)

  const prior = readState()
  writeState({ ...prior, backup: { backupPath, createdAt: new Date().toISOString(), tables: tables.length, rowCounts }, rehearsalPassedForSha: undefined })
  out(`[backup] checkpoint created and restore-verified: tables=${tables.length} rowsCopied=${totalRows} rowCountMismatches=0`)
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

/**
 * Local data rehearsal: the real migration file runs against a copy of the
 * production checkpoint. Proves the rebuild on the real data: shapes, row
 * counts, aggregate values, FK/index preservation, NULL rejection and
 * second-run APPLIED classification. The copy is deleted afterwards.
 */
async function phaseRehearse(t: Target): Promise<void> {
  assertRehearsedChecksum()
  const state = readState()
  if (!state.backup || !existsSync(state.backup.backupPath)) throw new Error("rehearse: no checkpoint — run 'backup' first — STOP")
  const { DatabaseSync } = await import("node:sqlite")
  const copyPath = join(backupDir(), "core03c-d5-rehearsal-copy.db")
  copyFileSync(state.backup.backupPath, copyPath)
  chmodSync(copyPath, 0o600)
  try {
    const local = new DatabaseSync(copyPath)
    const lq: QueryFn = async (sql, args = []) => local.prepare(sql).all(...(args as any[])) as any[]

    if ((await classifyD5State(lq)) !== "PENDING") throw new Error("rehearse: checkpoint copy is not in the PENDING shape — STOP")
    const before = await valueFingerprint(lq)
    const beforeCounts: Record<string, number> = {}
    for (const table of ["Cliente", "Documento", "Factura"]) {
      beforeCounts[table] = Number((local.prepare(`SELECT COUNT(*) c FROM "${table}"`).get() as any).c)
    }

    // The real migration, statement by statement (PRAGMAs are session-level here).
    for (const stmt of splitStatements(readFileSync(MIGRATION_PATH, "utf8"))) local.exec(stmt)

    if ((await classifyD5State(lq)) !== "APPLIED") throw new Error("rehearse: post-migration shape is not APPLIED — STOP")
    const after = await valueFingerprint(lq)
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      throw new Error(`rehearse: value fingerprints changed — data must be copied verbatim — STOP`)
    }
    for (const [table, expected] of Object.entries(beforeCounts)) {
      const now = Number((local.prepare(`SELECT COUNT(*) c FROM "${table}"`).get() as any).c)
      if (now !== expected) throw new Error(`rehearse: ${table} row count ${expected} → ${now} — STOP`)
    }
    // FK and unique-index preservation.
    const facturaSql = String((local.prepare(`SELECT sql FROM sqlite_schema WHERE type='table' AND name='Factura'`).get() as any).sql)
    const documentoSql = String((local.prepare(`SELECT sql FROM sqlite_schema WHERE type='table' AND name='Documento'`).get() as any).sql)
    if (!facturaSql.includes("Factura_clienteId_fkey") || !facturaSql.includes("Factura_proyectoId_fkey")) throw new Error("rehearse: Factura FKs lost — STOP")
    if (!documentoSql.includes("Documento_clienteId_fkey") || !documentoSql.includes("Documento_proyectoId_fkey")) throw new Error("rehearse: Documento FKs lost — STOP")
    if (!local.prepare(`SELECT name FROM sqlite_schema WHERE type='index' AND name='Factura_numero_key'`).get()) throw new Error("rehearse: Factura_numero_key lost — STOP")

    // Negative constraint tests: NULL is rejected on all four columns now.
    const expectReject = (sql: string, label: string): void => {
      try {
        local.exec(sql)
      } catch (err) {
        if (String(err).includes("NOT NULL")) return
        throw new Error(`rehearse: ${label} rejected with unexpected error: ${String(err).slice(0, 80)}`)
      }
      throw new Error(`rehearse: ${label} was ACCEPTED — constraint not effective — STOP`)
    }
    expectReject(`INSERT INTO "Cliente" ("id","nombre","tipo","updatedAt") VALUES ('d5-neg-1','x',NULL,CURRENT_TIMESTAMP)`, "Cliente.tipo NULL")
    expectReject(`INSERT INTO "Documento" ("id","nombre","tipo","url","updatedAt") VALUES ('d5-neg-2','x','documento',NULL,CURRENT_TIMESTAMP)`, "Documento.url NULL")
    expectReject(`INSERT INTO "Factura" ("id","numero","items","updatedAt") VALUES ('d5-neg-3','d5-neg-num',NULL,CURRENT_TIMESTAMP)`, "Factura.items NULL")
    expectReject(`INSERT INTO "Factura" ("id","numero","items","fechaEmision","updatedAt") VALUES ('d5-neg-4','d5-neg-num2','[]',NULL,CURRENT_TIMESTAMP)`, "Factura.fechaEmision NULL")
    // Valid writes still work; defaults fill omitted tipo/fechaEmision.
    local.exec(`INSERT INTO "Cliente" ("id","nombre","updatedAt") VALUES ('d5-pos-1','x',CURRENT_TIMESTAMP)`)
    const filled = local.prepare(`SELECT "tipo" t FROM "Cliente" WHERE "id"='d5-pos-1'`).get() as any
    if (String(filled.t) !== "empresa") throw new Error("rehearse: Cliente.tipo default did not fill — STOP")
    local.exec(`INSERT INTO "Factura" ("id","numero","items","updatedAt") VALUES ('d5-pos-2','d5-pos-num','[]',CURRENT_TIMESTAMP)`)
    const fechaFilled = local.prepare(`SELECT "fechaEmision" f FROM "Factura" WHERE "id"='d5-pos-2'`).get() as any
    if (!fechaFilled.f) throw new Error("rehearse: Factura.fechaEmision default did not fill — STOP")
    // Second run of the state classifier: APPLIED (no-op detection).
    if ((await classifyD5State(lq)) !== "APPLIED") throw new Error("rehearse: second classification is not APPLIED — STOP")
    local.close()

    writeState({ ...state, rehearsalPassedForSha: REHEARSED_SHA256_D5 })
    out(`[rehearse] PASS on production-data copy: shapes=APPLIED rows/values verbatim, FKs+unique index preserved, NULL rejected on all four, valid writes + canonical defaults OK`)
  } finally {
    rmSync(copyPath, { force: true })
    out(`[rehearse] rehearsal copy deleted (production-copy data never outlives the check)`)
  }
  void t
}

async function phaseApply(t: Target): Promise<void> {
  assertRehearsedChecksum()
  const state = readState()
  if (!state.backup || !existsSync(state.backup.backupPath)) throw new Error("apply: no verified checkpoint — run 'backup' — STOP")
  if (state.rehearsalPassedForSha !== REHEARSED_SHA256_D5) {
    throw new Error("apply: the local data rehearsal has not passed for these exact migration bytes — run 'rehearse' — STOP")
  }
  await assertShape(t.query)
  const st = await classifyD5State(t.query)
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
  const before = await valueFingerprint(t.query)

  // ONE atomic batch: the three rebuilds all commit or none do.
  await t.batch(splitStatements(readFileSync(MIGRATION_PATH, "utf8")))

  // Post-validation: shape, state, counts, values, structure, gates.
  await assertShape(t.query)
  if ((await classifyD5State(t.query)) !== "APPLIED") throw new Error("apply: post-DDL state is not APPLIED — INCIDENT")
  let postDrift = 0
  for (const [table, expected] of Object.entries(state.backup.rowCounts)) {
    if (Number((await t.query(`SELECT COUNT(*) c FROM "${table}"`))[0].c) !== expected) postDrift++
  }
  if (postDrift > 0) throw new Error(`apply: ${postDrift} tables changed row counts — INCIDENT`)
  const after = await valueFingerprint(t.query)
  if (JSON.stringify(before) !== JSON.stringify(after)) throw new Error("apply: value fingerprints changed — INCIDENT")
  const facturaSql = String((await t.query(`SELECT sql FROM sqlite_schema WHERE type='table' AND name='Factura'`))[0].sql)
  if (!facturaSql.includes("Factura_clienteId_fkey")) throw new Error("apply: Factura FKs lost — INCIDENT")
  if ((await t.query(`SELECT name FROM sqlite_schema WHERE type='index' AND name='Factura_numero_key'`)).length !== 1) {
    throw new Error("apply: Factura_numero_key lost — INCIDENT")
  }
  await assertGatesGreen(t.query, "apply/post")
  out(`[apply] ${MIGRATION_NAME} APPLIED atomically: shape ${EXPECTED_SHAPE.tables}/${EXPECTED_SHAPE.indexes}, rows/values verbatim, constraints active`)
}

/** Rollback-only probe on production: NULL must be rejected, nothing persists. */
async function phaseNegativeProbe(t: Target): Promise<void> {
  if ((await classifyD5State(t.query)) !== "APPLIED") throw new Error("negative-probe: migration is not APPLIED — nothing to probe")
  const countBefore = Number((await t.query(`SELECT COUNT(*) c FROM "Factura"`))[0].c)
  let rejected = false
  try {
    await t.query(`INSERT INTO "Factura" ("id","numero","items","updatedAt") VALUES ('d5prod-neg','d5prod-neg-num',NULL,CURRENT_TIMESTAMP)`)
  } catch (err) {
    rejected = String(err).includes("NOT NULL") || String(err).includes("SQLITE_CONSTRAINT")
  }
  const countAfter = Number((await t.query(`SELECT COUNT(*) c FROM "Factura"`))[0].c)
  if (!rejected || countAfter !== countBefore) throw new Error("negative-probe: NULL write was not rejected cleanly — INCIDENT")
  out(`[negative-probe] NULL items INSERT rejected by the live constraint; row count unchanged (${countAfter})`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [phase, ...rest] = process.argv.slice(2)
  ;(async () => {
    const flags = parseFlags(rest)
    assertFlags(phase ?? "", flags)
    assertRehearsedChecksum()
    const url = process.env.TURSO_DATABASE_URL || ""
    const token = process.env.TURSO_AUTH_TOKEN || ""
    assertProductionUrl(url)
    if (!token) throw new Error("d5 guard: TURSO_AUTH_TOKEN is not set — refusing to run")
    const t = await openLibsqlTarget(url, token)
    try {
      switch (phase) {
        case "status": await phaseStatus(t.query); break
        case "gates": await assertGatesGreen(t.query, "gates"); break
        case "backup": await phaseBackup(t); break
        case "verify-backup": await phaseVerifyBackup(t); break
        case "rehearse": await phaseRehearse(t); break
        case "apply": await phaseApply(t); break
        case "negative-probe": await phaseNegativeProbe(t); break
        default:
          throw new Error("usage: tsx scripts/apply-core-03c-d5-tightenings.ts <status|gates|backup|verify-backup|rehearse|apply|negative-probe> --target-production [--owner-authorized]")
      }
    } finally {
      t.close()
    }
  })().catch((err) => {
    console.error(`[core03c-d5] ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}
