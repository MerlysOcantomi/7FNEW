/**
 * CORE-03C-D6 — Turso/libSQL migration-adoption rehearsal driver.
 *
 * Rehearses, against a DISPOSABLE libSQL target only, the production
 * adoption of the Prisma migration history:
 *
 *   legacy-equivalent baseline (0_baseline DDL, no ledger)
 *   → synthetic representative fixtures
 *   → ledger adoption (baseline marked applied)
 *   → migrations 1..3 applied and validated one by one
 *   → idempotent re-run
 *   → status report (ledger vs. history directory)
 *   → application-level end-to-end (real services over the real adapter)
 *   → restore verification after an external snapshot restore
 *
 * WHY THIS TOOL EXISTS (D6 finding): Prisma 7.4.1's migrate CLI only
 * accepts `file:` URLs for the sqlite provider — `http://` and `libsql://`
 * datasources are rejected with P1013, so `prisma migrate resolve/deploy/
 * status` can never run against a libSQL server (Turso included). The
 * adoption mechanism rehearsed here is therefore a LEDGER-COMPATIBLE
 * APPLIER: it executes each migration's SQL over @libsql/client and writes
 * `_prisma_migrations` rows whose shape and checksums are taken from — and
 * verified against — a reference run of the real Prisma CLI on a throwaway
 * local file database built to the same legacy baseline.
 *
 * FAIL-CLOSED SAFETY — production is physically unreachable:
 *   - `D6_REHEARSAL_URL` must positively identify a disposable target:
 *     a `file:` path under the OS temp directory, or an http/https/ws/wss/
 *     libsql URL whose host is 127.0.0.1 / ::1 / localhost. Anything else —
 *     including any remote hostname — is refused. There is no override.
 *   - The production env vars must be ABSENT (or, for the e2e phase only,
 *     `DATABASE_URL` may equal the rehearsal URL itself). A production
 *     credential in the environment aborts the run before any connection.
 *   - Every phase after `baseline` requires the `_d6_rehearsal_marker`
 *     token written by `baseline` into that database — commands cannot be
 *     pointed at a different database mid-run, even a local one.
 *   - `baseline` itself only writes into an EMPTY database (zero user
 *     tables). It never "converts" an existing database into a rehearsal.
 *
 * Usage: tsx scripts/rehearse-core-03c-d6.ts <phase>
 * Phases: baseline | fixtures | adopt | deploy-again | status | e2e
 *         | verify-restored
 * Env:    D6_REHEARSAL_URL   (required) disposable target, see guard above
 *         D6_STATE_FILE      (optional) marker-token state path (default
 *                            under the OS temp dir)
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- raw SQL rows are untyped */

import { createHash, randomUUID } from "node:crypto"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve, dirname, sep } from "node:path"
import { fileURLToPath } from "node:url"

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

const out = (line: string): void => {
  process.stdout.write(line + "\n")
}
const MIGRATIONS_DIR = join(REPO_ROOT, "prisma", "migrations")
const MARKER_TABLE = "_d6_rehearsal_marker"
const LEDGER_TABLE = "_prisma_migrations"

// ─── Fail-closed guard ────────────────────────────────────────────────────────

/** Throws unless the URL positively identifies a disposable local target. */
export function assertDisposableUrl(raw: string): void {
  if (!raw) throw new Error("D6 guard: D6_REHEARSAL_URL is not set — refusing to run")
  if (raw.startsWith("file:")) {
    const path = resolve(raw.slice("file:".length))
    const tmp = resolve(tmpdir())
    if (!(path === tmp || path.startsWith(tmp + sep))) {
      throw new Error("D6 guard: file target is outside the OS temp directory — not provably disposable")
    }
    return
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("D6 guard: target URL is unparseable — refusing to run")
  }
  const scheme = url.protocol.replace(":", "")
  if (!["http", "https", "ws", "wss", "libsql"].includes(scheme)) {
    throw new Error(`D6 guard: scheme '${scheme}' is not an allowed rehearsal scheme`)
  }
  const host = url.hostname.toLowerCase()
  if (!["127.0.0.1", "::1", "[::1]", "localhost"].includes(host)) {
    throw new Error("D6 guard: target host is not loopback — a remote database can never be a rehearsal target here")
  }
}

/** Throws if any production-shaped credential is present in the environment. */
export function assertNoProductionEnv(rehearsalUrl: string, phase: string): void {
  const vars = ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN", "DATABASE_URL", "DATABASE_AUTH_TOKEN"]
  for (const name of vars) {
    const value = process.env[name]
    if (value === undefined || value === "") continue
    if (phase === "e2e" && name === "DATABASE_URL" && value === rehearsalUrl) continue
    throw new Error(`D6 guard: ${name} is set in the environment — refusing to run with production-shaped credentials present`)
  }
}

// ─── Target access ────────────────────────────────────────────────────────────

interface Target {
  execute(sql: string, args?: any[]): Promise<any[]>
  executeMultiple(sql: string): Promise<void>
  batch(stmts: string[]): Promise<void>
  close(): void
}

async function openTarget(url: string): Promise<Target> {
  const { createClient } = await import("@libsql/client")
  const client = createClient({ url })
  return {
    async execute(sql, args = []) {
      return (await client.execute({ sql, args })).rows as any[]
    },
    async executeMultiple(sql) {
      await client.executeMultiple(sql)
    },
    async batch(stmts) {
      await client.batch(stmts, "write")
    },
    close: () => client.close(),
  }
}

function stateFilePath(): string {
  return process.env.D6_STATE_FILE || join(tmpdir(), "d6-rehearsal-state.json")
}

async function requireMarker(t: Target): Promise<string> {
  const rows = await t
    .execute(`SELECT token FROM "${MARKER_TABLE}" LIMIT 1`)
    .catch(() => {
      throw new Error("D6 guard: rehearsal marker table absent — target is not the bootstrapped rehearsal database")
    })
  const token = rows[0]?.token
  const state = JSON.parse(readFileSync(stateFilePath(), "utf8"))
  if (!token || token !== state.token) {
    throw new Error("D6 guard: rehearsal marker token mismatch — refusing to touch this database")
  }
  return String(token)
}

// ─── Schema inspection helpers (SELECT/PRAGMA only) ──────────────────────────

async function userTables(t: Target): Promise<string[]> {
  const rows = await t.execute(
    `SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT IN ('${MARKER_TABLE}') ORDER BY name`,
  )
  return rows.map((r: any) => String(r.name))
}

async function businessTables(t: Target): Promise<string[]> {
  return (await userTables(t)).filter((n) => n !== LEDGER_TABLE)
}

async function explicitIndexCount(t: Target): Promise<number> {
  const rows = await t.execute(
    `SELECT COUNT(*) c FROM sqlite_schema WHERE type='index' AND name NOT LIKE 'sqlite_%' AND tbl_name NOT IN ('${MARKER_TABLE}', '${LEDGER_TABLE}')`,
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

// ─── Migration history reading ────────────────────────────────────────────────

interface MigrationEntry {
  name: string
  sql: string
  checksum: string
}

function readHistory(): MigrationEntry[] {
  const names = readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
  return names.map((name) => {
    const sql = readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8")
    return { name, sql, checksum: createHash("sha256").update(sql).digest("hex") }
  })
}

/** Split a migration script into statements (comments stripped, top-level `;`). */
export function splitStatements(sql: string): string[] {
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n")
  return withoutComments
    .split(";")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
}

// ─── Reference run (real Prisma CLI, throwaway local FILE database only) ─────

interface ReferenceResult {
  ledgerDdl: string
  rows: Array<{ migration_name: string; checksum: string; applied_steps_count: number; logs: unknown; rolled_back_at: unknown }>
  resolveRow: { migration_name: string; checksum: string; applied_steps_count: number }
  tables: number
  indexes: number
  statusAfterDeploy: string
  secondDeployOutput: string
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

/**
 * Runs the production-shaped adoption on a throwaway LOCAL FILE database:
 * legacy baseline via raw DDL (no ledger), then the real
 * `prisma migrate resolve --applied 0_baseline`, then the real
 * `prisma migrate deploy`. Captures the ledger Prisma itself writes, as the
 * authority the libSQL applier must reproduce.
 */
async function runReference(history: MigrationEntry[]): Promise<ReferenceResult> {
  const { DatabaseSync } = await import("node:sqlite")
  const dir = mkdtempSync(join(tmpdir(), "d6-reference-"))
  const dbPath = join(dir, "reference.db")

  const db = new DatabaseSync(dbPath)
  db.exec(history[0].sql) // legacy-equivalent baseline, no ledger — mirrors production
  db.close()

  symlinkSync(join(REPO_ROOT, "node_modules"), join(dir, "node_modules"))
  const configPath = join(dir, "prisma.config.ts")
  writeFileSync(
    configPath,
    [
      'import { defineConfig } from "prisma/config"',
      "export default defineConfig({",
      `  schema: ${JSON.stringify(join(REPO_ROOT, "prisma", "schema.prisma"))},`,
      `  migrations: { path: ${JSON.stringify(MIGRATIONS_DIR)} },`,
      `  datasource: { url: ${JSON.stringify(`file:${dbPath}`)} },`,
      "})",
      "",
    ].join("\n"),
  )
  const prismaBin = join(REPO_ROOT, "node_modules", ".bin", "prisma")
  const run = (args: string[]) =>
    execFileSync(prismaBin, [...args, "--config", configPath], { cwd: REPO_ROOT, env: sanitizedEnv(), encoding: "utf8" })

  run(["migrate", "resolve", "--applied", history[0].name])

  const inspect = () => {
    const d = new DatabaseSync(dbPath, { readOnly: true })
    try {
      const ledgerDdl = (d.prepare(`SELECT sql FROM sqlite_schema WHERE type='table' AND name='${LEDGER_TABLE}'`).get() as any)?.sql
      const rows = d
        .prepare(`SELECT migration_name, checksum, applied_steps_count, logs, rolled_back_at FROM "${LEDGER_TABLE}" ORDER BY started_at, migration_name`)
        .all() as any[]
      const tables = (d.prepare(`SELECT COUNT(*) c FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name <> '${LEDGER_TABLE}'`).get() as any).c
      const indexes = (d.prepare(`SELECT COUNT(*) c FROM sqlite_schema WHERE type='index' AND name NOT LIKE 'sqlite_%' AND tbl_name <> '${LEDGER_TABLE}'`).get() as any).c
      return { ledgerDdl: String(ledgerDdl), rows, tables: Number(tables), indexes: Number(indexes) }
    } finally {
      d.close()
    }
  }

  const afterResolve = inspect()
  if (afterResolve.rows.length !== 1 || afterResolve.rows[0].migration_name !== history[0].name) {
    throw new Error("reference: resolve --applied did not create exactly the baseline ledger row")
  }
  if (afterResolve.tables !== 48) {
    throw new Error(`reference: resolve changed the schema (tables=${afterResolve.tables}, expected 48) — STOP`)
  }

  run(["migrate", "deploy"])
  const afterDeploy = inspect()
  const statusAfterDeploy = run(["migrate", "status"])
  const secondDeployOutput = run(["migrate", "deploy"])

  return {
    ledgerDdl: afterDeploy.ledgerDdl,
    rows: afterDeploy.rows.map((r: any) => ({
      migration_name: String(r.migration_name),
      checksum: String(r.checksum),
      applied_steps_count: Number(r.applied_steps_count),
      logs: r.logs,
      rolled_back_at: r.rolled_back_at,
    })),
    resolveRow: {
      migration_name: String(afterResolve.rows[0].migration_name),
      checksum: String(afterResolve.rows[0].checksum),
      applied_steps_count: Number(afterResolve.rows[0].applied_steps_count),
    },
    tables: afterDeploy.tables,
    indexes: afterDeploy.indexes,
    statusAfterDeploy,
    secondDeployOutput,
  }
}

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Fill every NOT NULL / no-default column with a synthetic value. */
async function makeInsert(t: Target, table: string, values: Record<string, unknown>): Promise<void> {
  const cols = await columnInfo(t, table)
  const row: Record<string, unknown> = { ...values }
  for (const c of cols) {
    if (row[c.name] !== undefined) continue
    if (c.notnull === 1 && c.dflt === null) {
      row[c.name] = /INT|REAL|NUM|BOOL/i.test(c.type) ? 0 : /DATE/i.test(c.type) ? "2026-01-01 00:00:00" : "synthetic"
    }
  }
  const names = Object.keys(row)
  // OR IGNORE: fixture ids are fixed, so re-running the phase is a no-op.
  await t.execute(
    `INSERT OR IGNORE INTO "${table}" (${names.map((n) => `"${n}"`).join(",")}) VALUES (${names.map(() => "?").join(",")})`,
    names.map((n) => row[n] as any),
  )
}

const FIXTURES = {
  workspace: "d6-ws",
  user: "d6-user",
  cliente: "d6-cliente",
  factura: "d6-factura",
  connection: "d6-conn",
  convWithConn: "d6-conv-conn",
  convNoConn: "d6-conv-none",
  convOrphanConn: "d6-conv-orphan",
  contact: "d6-contact",
  legacyTodo: "d6-todo-legacy",
  workspaceTask: "d6-task",
  qr: "d6-qr",
}

// ─── Phases ───────────────────────────────────────────────────────────────────

async function phaseBaseline(t: Target, history: MigrationEntry[]): Promise<void> {
  const existing = await userTables(t)
  if (existing.length > 0) {
    throw new Error(`D6 guard: target is not empty (${existing.length} user tables) — baseline only bootstraps a fresh disposable database`)
  }
  await t.executeMultiple(history[0].sql)
  const tables = await businessTables(t)
  const indexes = await explicitIndexCount(t)
  const ledger = (await userTables(t)).includes(LEDGER_TABLE)
  if (tables.length !== 48 || indexes !== 61 || ledger) {
    throw new Error(`baseline mismatch: tables=${tables.length} (want 48), indexes=${indexes} (want 61), ledger=${ledger} (want false)`)
  }
  const token = randomUUID()
  await t.execute(`CREATE TABLE "${MARKER_TABLE}" (token TEXT NOT NULL, created_at TEXT NOT NULL)`)
  await t.execute(`INSERT INTO "${MARKER_TABLE}" (token, created_at) VALUES (?, ?)`, [token, new Date().toISOString()])
  writeFileSync(stateFilePath(), JSON.stringify({ token, url: process.env.D6_REHEARSAL_URL }))
  out(`[baseline] tables=48 explicitIndexes=61 ledger=absent marker=created`)
}

async function phaseFixtures(t: Target): Promise<void> {
  await requireMarker(t)
  const F = FIXTURES
  await makeInsert(t, "Workspace", { id: F.workspace, nombre: "D6 Rehearsal WS", slug: "d6-rehearsal-ws" })
  await makeInsert(t, "User", { id: F.user, email: "d6-user@rehearsal.invalid", workspaceId: null })
  await makeInsert(t, "WorkspaceMember", { id: "d6-member", userId: F.user, workspaceId: F.workspace, role: "ADMIN" })
  await makeInsert(t, "Cliente", { id: F.cliente, nombre: "D6 Synthetic Client", workspaceId: F.workspace })
  await makeInsert(t, "Factura", {
    id: F.factura, numero: "D6-0001", clienteId: F.cliente, workspaceId: F.workspace,
    items: '[{"q":1,"desc":"synthetic item","price":10}]', subtotal: 10, impuesto: 0, total: 10,
    fechaEmision: "2026-08-20 00:00:00",
  })
  await makeInsert(t, "Contact", { id: F.contact, workspaceId: F.workspace, nombre: "D6 Synthetic Contact" })
  await makeInsert(t, "ChannelConnection", { id: F.connection, workspaceId: F.workspace, channelType: "email", provider: "synthetic", name: "D6 synthetic email", status: "active" })
  await makeInsert(t, "Conversation", { id: F.convWithConn, workspaceId: F.workspace, contactId: F.contact, channel: "email", connectionId: F.connection })
  await makeInsert(t, "Conversation", { id: F.convNoConn, workspaceId: F.workspace, contactId: F.contact, channel: "email", connectionId: null })
  // Orphan case: creatable exactly because the deployed baseline has no FK here.
  await makeInsert(t, "Conversation", { id: F.convOrphanConn, workspaceId: F.workspace, contactId: F.contact, channel: "email", connectionId: "d6-ghost-connection" })
  await makeInsert(t, "Message", { id: "d6-msg-conn", conversationId: F.convWithConn, workspaceId: F.workspace, role: "user", content: "synthetic", connectionId: F.connection })
  await makeInsert(t, "Message", { id: "d6-msg-none", conversationId: F.convNoConn, workspaceId: F.workspace, role: "user", content: "synthetic", connectionId: null })
  await makeInsert(t, "Message", { id: "d6-msg-orphan", conversationId: F.convOrphanConn, workspaceId: F.workspace, role: "user", content: "synthetic", connectionId: "d6-ghost-connection" })
  // Legacy InboxTodo: pre-adoption shape — the workspaceTaskId column does not exist yet.
  await makeInsert(t, "InboxTodo", { id: F.legacyTodo, workspaceId: F.workspace, title: "D6 legacy todo", status: "open", createdBy: F.user })
  await makeInsert(t, "WorkspaceTask", { id: F.workspaceTask, workspaceId: F.workspace, title: "D6 pre-existing task", status: "open", createdBy: F.user })
  // Legacy QRCode: pre-adoption shape — no workspaceId column yet.
  await makeInsert(t, "QRCode", { id: F.qr, module: "clientes", recordId: F.cliente, url: "https://rehearsal.invalid/qr", imageData: "synthetic" })

  const counts: Record<string, number> = {}
  for (const table of ["Workspace", "User", "WorkspaceMember", "Cliente", "Factura", "Contact", "ChannelConnection", "Conversation", "Message", "InboxTodo", "WorkspaceTask", "QRCode"]) {
    counts[table] = await countRows(t, table)
  }
  out(`[fixtures] ${JSON.stringify(counts)}`)
}

/** Ledger-compatible applier: the mechanism rehearsed for production adoption. */
async function applyPending(t: Target, history: MigrationEntry[], reference: ReferenceResult): Promise<string[]> {
  const tablesNow = await userTables(t)
  if (!tablesNow.includes(LEDGER_TABLE)) {
    await t.execute(reference.ledgerDdl)
    const baseRef = reference.rows.find((r) => r.migration_name === history[0].name)!
    if (baseRef.checksum !== history[0].checksum) {
      throw new Error("reference baseline checksum does not match the migration file — STOP")
    }
    const now = new Date().toISOString()
    await t.execute(
      `INSERT INTO "${LEDGER_TABLE}" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)`,
      [randomUUID(), baseRef.checksum, now, history[0].name, now, baseRef.applied_steps_count],
    )
  }
  const appliedRows = await t.execute(`SELECT migration_name, checksum FROM "${LEDGER_TABLE}" WHERE rolled_back_at IS NULL`)
  const applied = new Map(appliedRows.map((r: any) => [String(r.migration_name), String(r.checksum)]))
  for (const [name, checksum] of applied) {
    const entry = history.find((h) => h.name === name)
    if (!entry) throw new Error(`ledger contains unknown migration '${name}' — STOP`)
    if (entry.checksum !== checksum) throw new Error(`checksum mismatch for applied migration '${name}' — STOP`)
  }
  const pending = history.filter((h) => !applied.has(h.name))
  for (const entry of pending) {
    const started = new Date().toISOString()
    const stmts = splitStatements(entry.sql)
    await t.batch(stmts) // one atomic batch per migration
    const refRow = reference.rows.find((r) => r.migration_name === entry.name)
    if (!refRow) throw new Error(`reference run has no ledger row for '${entry.name}' — STOP`)
    if (refRow.checksum !== entry.checksum) throw new Error(`reference checksum mismatch for '${entry.name}' — STOP`)
    await t.execute(
      `INSERT INTO "${LEDGER_TABLE}" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) VALUES (?, ?, ?, ?, NULL, NULL, ?, ?)`,
      [randomUUID(), entry.checksum, new Date().toISOString(), entry.name, started, refRow.applied_steps_count],
    )
  }
  return pending.map((p) => p.name)
}

async function validateAfterMigration(t: Target, name: string): Promise<void> {
  const F = FIXTURES
  const tables = (await businessTables(t)).length
  const indexes = await explicitIndexCount(t)
  const fixtureIntact = async () => {
    const todo = await t.execute(`SELECT * FROM "InboxTodo" WHERE id = ?`, [F.legacyTodo])
    const factura = await t.execute(`SELECT "items" FROM "Factura" WHERE id = ?`, [F.factura])
    if (todo.length !== 1 || factura.length !== 1) throw new Error(`${name}: fixture rows lost — STOP`)
    return todo[0]
  }
  if (name === "1_add_missing_indexes") {
    if (tables !== 48 || indexes !== 82) throw new Error(`${name}: tables=${tables}/indexes=${indexes}, expected 48/82`)
    await fixtureIntact()
    out(`[migration 1] tables=48 explicitIndexes=82 fixtures=intact`)
  } else if (name === "2_add_link_columns") {
    if (tables !== 48 || indexes !== 84) throw new Error(`${name}: tables=${tables}/indexes=${indexes}, expected 48/84`)
    const qrCols = await columnInfo(t, "QRCode")
    const todoCols = await columnInfo(t, "InboxTodo")
    const qrWs = qrCols.find((c) => c.name === "workspaceId")
    const todoLink = todoCols.find((c) => c.name === "workspaceTaskId")
    if (!qrWs || qrWs.type !== "TEXT" || qrWs.notnull !== 0 || qrWs.dflt !== null) throw new Error(`${name}: QRCode.workspaceId wrong shape`)
    if (!todoLink || todoLink.type !== "TEXT" || todoLink.notnull !== 0 || todoLink.dflt !== null) throw new Error(`${name}: InboxTodo.workspaceTaskId wrong shape`)
    const todo = await fixtureIntact()
    if (todo.workspaceTaskId !== null) throw new Error(`${name}: legacy todo gained an invented link — STOP`)
    const qr = (await t.execute(`SELECT "workspaceId" FROM "QRCode" WHERE id = ?`, [F.qr]))[0]
    if (qr.workspaceId !== null) throw new Error(`${name}: legacy QR row gained an invented workspace — STOP`)
    const tasks = await countRows(t, "WorkspaceTask")
    if (tasks !== 1) throw new Error(`${name}: WorkspaceTask count changed (${tasks}) — migration must not create tasks`)
    out(`[migration 2] columns=OK nullable=OK legacy todo link=NULL legacy QR workspace=NULL tasks unchanged`)
  } else if (name === "3_create_portal_tables") {
    if (tables !== 52 || indexes !== 93) throw new Error(`${name}: tables=${tables}/indexes=${indexes}, expected 52/93`)
    for (const created of ["ClientAsset", "ClientRequest", "ClientRequestAsset", "ForteSnapshot"]) {
      if ((await countRows(t, created)) !== 0) throw new Error(`${name}: new table ${created} is not empty`)
    }
    await fixtureIntact()
    out(`[migration 3] tables=52 explicitIndexes=93 new tables empty fixtures=intact`)
  }
}

async function phaseAdopt(t: Target, history: MigrationEntry[]): Promise<void> {
  await requireMarker(t)
  out(`[reference] running real Prisma CLI adoption on a throwaway local FILE database…`)
  const reference = await runReference(history)
  out(`[reference] resolve row: ${reference.resolveRow.migration_name} steps=${reference.resolveRow.applied_steps_count}; after deploy: tables=${reference.tables} indexes=${reference.indexes} ledgerRows=${reference.rows.length}`)
  if (reference.tables !== 52 || reference.indexes !== 93) throw new Error("reference deploy did not reach 52/93 — STOP")

  if ((await userTables(t)).includes(LEDGER_TABLE)) throw new Error("adopt: rehearsal target already has a ledger — run on a fresh baseline")
  // Apply one migration at a time so each can be validated individually.
  const before = (await businessTables(t)).length
  if (before !== 48) throw new Error(`adopt: expected 48 pre-adoption tables, found ${before}`)

  const appliedNames: string[] = []
  // Grow the visible history one entry at a time so every migration is
  // applied and validated individually. The first slice ([0_baseline])
  // only creates the ledger and marks the baseline applied.
  for (let upTo = 1; upTo <= history.length; upTo++) {
    const newly = await applyPending(t, history.slice(0, upTo), reference)
    for (const name of newly) {
      await validateAfterMigration(t, name)
      appliedNames.push(name)
    }
  }

  const ledgerRows = await t.execute(`SELECT migration_name, checksum, applied_steps_count FROM "${LEDGER_TABLE}" ORDER BY started_at, migration_name`)
  if (ledgerRows.length !== reference.rows.length) throw new Error(`ledger row count ${ledgerRows.length} != reference ${reference.rows.length}`)
  for (const ref of reference.rows) {
    const mine = ledgerRows.find((r: any) => String(r.migration_name) === ref.migration_name)
    if (!mine) throw new Error(`ledger missing '${ref.migration_name}'`)
    if (String(mine.checksum) !== ref.checksum) throw new Error(`ledger checksum mismatch for '${ref.migration_name}'`)
    if (Number(mine.applied_steps_count) !== ref.applied_steps_count) throw new Error(`applied_steps_count mismatch for '${ref.migration_name}'`)
  }
  out(`[adopt] applied=${JSON.stringify(appliedNames)} ledger==reference (names, checksums, steps) final tables=52 explicitIndexes=93`)
  out(`[adopt] reference 'migrate status' after deploy:\n${reference.statusAfterDeploy.trim()}`)
  out(`[adopt] reference second 'migrate deploy':\n${reference.secondDeployOutput.trim()}`)
}

async function phaseDeployAgain(t: Target, history: MigrationEntry[]): Promise<void> {
  await requireMarker(t)
  const tablesBefore = (await businessTables(t)).length
  const indexesBefore = await explicitIndexCount(t)
  const ledgerBefore = await countRows(t, LEDGER_TABLE)
  const todosBefore = await countRows(t, "InboxTodo")
  const reference = { ledgerDdl: "", rows: readHistory().map((h) => ({ migration_name: h.name, checksum: h.checksum, applied_steps_count: 1, logs: null, rolled_back_at: null })), resolveRow: { migration_name: history[0].name, checksum: history[0].checksum, applied_steps_count: 0 }, tables: 52, indexes: 93, statusAfterDeploy: "", secondDeployOutput: "" }
  const newly = await applyPending(t, history, reference as ReferenceResult)
  const tablesAfter = (await businessTables(t)).length
  const indexesAfter = await explicitIndexCount(t)
  const ledgerAfter = await countRows(t, LEDGER_TABLE)
  const todosAfter = await countRows(t, "InboxTodo")
  if (newly.length !== 0) throw new Error(`idempotence broken: second run applied ${JSON.stringify(newly)}`)
  if (tablesAfter !== tablesBefore || indexesAfter !== indexesBefore || ledgerAfter !== ledgerBefore || todosAfter !== todosBefore) {
    throw new Error("idempotence broken: second run changed schema/ledger/data")
  }
  out(`[deploy-again] pending=0 schemaDelta=0 ledgerDelta=0 dataDelta=0 — idempotent`)
}

async function phaseStatus(t: Target, history: MigrationEntry[]): Promise<void> {
  await requireMarker(t)
  const rows = await t.execute(`SELECT migration_name, checksum, rolled_back_at FROM "${LEDGER_TABLE}" ORDER BY started_at, migration_name`)
  const applied = new Map(rows.map((r: any) => [String(r.migration_name), String(r.checksum)]))
  const report = history.map((h) => {
    const state = !applied.has(h.name) ? "PENDING" : applied.get(h.name) === h.checksum ? "APPLIED" : "CHECKSUM MISMATCH"
    return `${h.name}: ${state}`
  })
  const unknown = [...applied.keys()].filter((n) => !history.some((h) => h.name === n))
  out(`[status] tables=${(await businessTables(t)).length} explicitIndexes=${await explicitIndexCount(t)} ledgerRows=${rows.length}`)
  for (const line of report) out(`[status] ${line}`)
  if (unknown.length > 0) throw new Error(`[status] ledger rows not in history: ${unknown.join(", ")}`)
  if (report.some((l) => !l.endsWith("APPLIED"))) throw new Error("[status] ledger and history disagree")
}

async function phaseE2e(t: Target): Promise<void> {
  await requireMarker(t)
  if (process.env.DATABASE_URL !== process.env.D6_REHEARSAL_URL) {
    throw new Error("D6 guard: e2e requires DATABASE_URL to equal D6_REHEARSAL_URL exactly")
  }
  const F = FIXTURES
  const { createTodo } = await import("../modules/inbox/todo-service")
  const { updateInboxScopedTaskStatus } = await import("../modules/inbox/inbox-tasks-write")
  const { db } = await import("../core/db")

  // 1. Real dual-write create path (the production HIGH).
  const todo = await createTodo({ workspaceId: F.workspace, title: "D6 e2e todo", createdBy: F.user, createdSource: "operator" })
  if (!todo.workspaceTaskId) throw new Error("e2e: createTodo returned no workspaceTaskId")
  const mirror = await db.workspaceTask.findFirst({ where: { id: todo.workspaceTaskId, workspaceId: F.workspace } })
  if (!mirror || mirror.sourceType !== "inbox_todo" || mirror.sourceId !== todo.id) throw new Error("e2e: mirror WorkspaceTask wrong or missing")
  const duplicates = await db.workspaceTask.count({ where: { sourceType: "inbox_todo", sourceId: todo.id } })
  if (duplicates !== 1) throw new Error(`e2e: expected exactly 1 mirror, found ${duplicates}`)
  out(`[e2e] createTodo: InboxTodo + WorkspaceTask + link committed atomically (no orphan, no duplicate)`)

  // 2. Legacy-id fallback branch (resolveWorkspaceTaskId).
  const updated = await updateInboxScopedTaskStatus({ workspaceId: F.workspace, id: todo.id, status: "done", actorId: F.user })
  if (!updated) throw new Error("e2e: legacy-id status update did not resolve via workspaceTaskId")
  const mirrorDone = await db.workspaceTask.findFirst({ where: { id: todo.workspaceTaskId } })
  if (mirrorDone?.status !== "done") throw new Error("e2e: mirror status not updated via legacy id")
  out(`[e2e] resolveWorkspaceTaskId legacy branch: InboxTodo id → linked WorkspaceTask updated`)

  // 3. Controlled transaction rollback (same interactive shape as createTodo).
  const todosBefore = await db.inboxTodo.count()
  const tasksBefore = await db.workspaceTask.count()
  let rolledBack = false
  try {
    await db.$transaction(async (tx) => {
      const created = await tx.inboxTodo.create({ data: { workspaceId: F.workspace, title: "D6 rollback probe", createdBy: F.user, status: "open" } as any })
      await tx.workspaceTask.create({ data: { workspaceId: F.workspace, title: "D6 rollback mirror", createdBy: F.user, sourceType: "inbox_todo", sourceId: created.id } as any })
      throw new Error("d6-injected-failure")
    })
  } catch (err) {
    rolledBack = err instanceof Error && err.message === "d6-injected-failure"
  }
  const todosAfter = await db.inboxTodo.count()
  const tasksAfter = await db.workspaceTask.count()
  if (!rolledBack || todosAfter !== todosBefore || tasksAfter !== tasksBefore) {
    throw new Error(`e2e: rollback failed (todos ${todosBefore}→${todosAfter}, tasks ${tasksBefore}→${tasksAfter})`)
  }
  out(`[e2e] injected mid-transaction failure: full rollback, no partial InboxTodo/WorkspaceTask`)

  // 4. QRCode with the new column, through the app client.
  const qr = await db.qRCode.create({ data: { module: "clientes", recordId: F.cliente, url: "https://rehearsal.invalid/qr2", imageData: "synthetic", workspaceId: F.workspace } as any })
  const qrScoped = await db.qRCode.findFirst({ where: { id: qr.id, workspaceId: F.workspace } })
  if (!qrScoped) throw new Error("e2e: workspace-scoped QRCode read failed")
  const legacyQr = await db.qRCode.findFirst({ where: { id: F.qr } })
  if (legacyQr?.workspaceId !== null) throw new Error("e2e: legacy QR row should still have NULL workspaceId")
  out(`[e2e] QRCode: scoped create/read OK; legacy row still NULL (no invented workspace)`)

  // 5. Portal tables + ForteSnapshot persistence patterns.
  const request = await db.clientRequest.create({
    data: {
      workspaceId: F.workspace, clienteId: F.cliente, title: "D6 request",
      assets: { create: [{ assetUrl: "https://rehearsal.invalid/a", assetName: "d6-a" }] },
    },
    include: { assets: true },
  })
  if (request.assets?.length !== 1) throw new Error("e2e: nested ClientRequestAsset create failed")
  await db.clientAsset.create({
    data: { workspaceId: F.workspace, clienteId: F.cliente, filename: "d6-file", mimeType: "text/plain", sizeBytes: 1, url: "https://rehearsal.invalid/f" },
  })
  await db.forteSnapshot.upsert({
    where: { workspaceId: F.workspace },
    create: { workspaceId: F.workspace, maturity: "synthetic", payload: "{}" },
    update: { payload: "{}" },
  })
  const snap = await db.forteSnapshot.findUnique({ where: { workspaceId: F.workspace } as any })
  if (!snap) throw new Error("e2e: ForteSnapshot round-trip failed")
  out(`[e2e] portal tables (nested create/include) + ForteSnapshot upsert/find: OK`)

  // 6. Factura JSON read path assumption.
  const factura = await db.factura.findFirst({ where: { id: F.factura } })
  const items = JSON.parse(String(factura?.items))
  if (!Array.isArray(items) || items.length !== 1) throw new Error("e2e: Factura.items JSON contract broken")
  out(`[e2e] Factura.items parses as array through the app client`)
  await db.$disconnect()
}

async function phaseVerifyRestored(t: Target): Promise<void> {
  await requireMarker(t)
  const tables = await businessTables(t)
  const indexes = await explicitIndexCount(t)
  const ledger = (await userTables(t)).includes(LEDGER_TABLE)
  const todo = await t.execute(`SELECT * FROM "InboxTodo" WHERE id = ?`, [FIXTURES.legacyTodo])
  const todoCols = await columnInfo(t, "InboxTodo")
  const linkColumn = todoCols.some((c) => c.name === "workspaceTaskId")
  if (tables.length !== 48 || indexes !== 61 || ledger || todo.length !== 1 || linkColumn) {
    throw new Error(
      `restore mismatch: tables=${tables.length} (48) indexes=${indexes} (61) ledger=${ledger} (false) fixtureTodo=${todo.length} (1) linkColumn=${linkColumn} (false)`,
    )
  }
  out(`[verify-restored] tables=48 explicitIndexes=61 ledger=absent link column=absent fixtures=present — pre-adoption state restored`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const phase = process.argv[2]
  const url = process.env.D6_REHEARSAL_URL || ""
  ;(async () => {
    assertDisposableUrl(url)
    assertNoProductionEnv(url, phase ?? "")
    const history = readHistory()
    if (history.length === 0 || !history[0].name.startsWith("0_")) throw new Error("migration history not found or baseline missing")
    const t = await openTarget(url)
    try {
      switch (phase) {
        case "baseline": await phaseBaseline(t, history); break
        case "fixtures": await phaseFixtures(t); break
        case "adopt": await phaseAdopt(t, history); break
        case "deploy-again": await phaseDeployAgain(t, history); break
        case "status": await phaseStatus(t, history); break
        case "e2e": await phaseE2e(t); break
        case "verify-restored": await phaseVerifyRestored(t); break
        default:
          throw new Error("usage: tsx scripts/rehearse-core-03c-d6.ts <baseline|fixtures|adopt|deploy-again|status|e2e|verify-restored>")
      }
    } finally {
      t.close()
    }
  })().catch((err) => {
    console.error(`[d6-rehearsal] ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}
