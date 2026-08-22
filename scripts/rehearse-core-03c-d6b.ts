/**
 * CORE-03C-D6B — Turso CLOUD branch migration rehearsal driver.
 *
 * Runs the D6-rehearsed adoption against ONE explicitly authorized,
 * owner-created, disposable Turso Cloud branch — and nothing else. This is
 * the cloud counterpart of `rehearse-core-03c-d6.ts` (local sqld): same
 * mission, different target class, and one deliberate mechanism change:
 *
 *   NO LEDGER IS CREATED. The D6B mission (§N) forbids creating
 *   `_prisma_migrations` / `_sevenef_migrations` on the branch just because
 *   they were proposed. Applied-state is therefore decided from SCHEMA
 *   PRECONDITIONS: every object each migration creates (index / table /
 *   column) is derived from its SQL, and a migration counts as APPLIED only
 *   when ALL its objects exist, PENDING when NONE do, and anything partial
 *   is INCONSISTENT → hard stop. This is exactly the fail-closed
 *   idempotence contract of D6 §3 option A: "no pending migrations" is
 *   decided from a state source, DDL is never re-executed blindly.
 *
 * FAIL-CLOSED SAFETY — production is physically unreachable:
 *   - The target URL must have hostname EXACTLY `PINNED_HOST` (the
 *     owner-declared disposable branch). Any other host — production's
 *     included — is refused. There is no override and no env var can
 *     change the pin: it is a compile-time constant.
 *   - `TURSO_DATABASE_URL` / `TURSO_AUTH_TOKEN` (production-shaped names)
 *     present in the environment → abort before any connection.
 *     `DATABASE_URL` / `DATABASE_AUTH_TOKEN` are allowed only for the e2e
 *     phase and only when strictly equal to the D6B values (the app client
 *     reads them; equality means they can only point at the branch).
 *   - `mark` stamps the branch with a random-token marker table
 *     (`_d6b_rehearsal_marker`) and records the pre-adoption row count of
 *     every business table; every later phase refuses to touch a database
 *     whose marker token does not match the local state file.
 *   - `mark` itself only accepts a database in the exact pre-adoption
 *     production shape (48 business tables / 61 explicit indexes, no
 *     ledger of any kind) — it never "converts" anything else into a
 *     rehearsal target, and it never bootstraps a baseline (D6B §E: the
 *     baseline already exists on the branch; `0_baseline` is never run).
 *
 * Usage: tsx scripts/rehearse-core-03c-d6b.ts <phase>
 * Phases: audit | mark | apply | apply-again | status | cloud-validate
 *         | e2e | recovery
 * Env:    D6B_DATABASE_URL  (required) libsql/https/wss URL of the branch;
 *                           hostname must equal the pinned branch hostname
 *         D6B_AUTH_TOKEN    (required) database auth token for the branch
 *         D6B_STATE_FILE    (optional) marker-token state path (default
 *                           under the OS temp dir)
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- raw SQL rows are untyped */

import { randomUUID } from "node:crypto"
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { splitStatements } from "./rehearse-core-03c-d6"

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const MIGRATIONS_DIR = join(REPO_ROOT, "prisma", "migrations")
const MARKER_TABLE = "_d6b_rehearsal_marker"
const LEDGER_TABLES = ["_prisma_migrations", "_sevenef_migrations"]

/**
 * The one and only authorized rehearsal target: the disposable Turso Cloud
 * branch the owner created for CORE-03C-D6B. A hostname is the identity of
 * a Turso database — pinning it here means this tool cannot address any
 * other database, production's hostname included, no matter what the
 * environment contains.
 */
export const PINNED_HOST = "7f-d6b-rehearsal-7frames.aws-eu-west-1.turso.io"

const out = (line: string): void => {
  process.stdout.write(line + "\n")
}

// ─── Fail-closed guards ───────────────────────────────────────────────────────

/** Throws unless the URL addresses exactly the pinned disposable branch. */
export function assertBranchUrl(raw: string): void {
  if (!raw) throw new Error("D6B guard: D6B_DATABASE_URL is not set — refusing to run")
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error("D6B guard: target URL is unparseable — refusing to run")
  }
  const scheme = url.protocol.replace(":", "")
  if (!["libsql", "https", "wss"].includes(scheme)) {
    throw new Error(`D6B guard: scheme '${scheme}' is not an allowed remote scheme (file/local targets belong to D6, not D6B)`)
  }
  if (url.hostname.toLowerCase() !== PINNED_HOST) {
    throw new Error("D6B guard: target hostname is not the pinned disposable branch — refusing (production can never be addressed by this tool)")
  }
  if (url.username || url.password) {
    throw new Error("D6B guard: credentials embedded in the URL are refused — pass the token via D6B_AUTH_TOKEN")
  }
}

/**
 * Throws if any production-shaped credential is present. The app-client
 * pair (`DATABASE_URL`/`DATABASE_AUTH_TOKEN`) is allowed only for the e2e
 * phase and only when strictly equal to the D6B branch values.
 */
export function assertNoProductionEnv(phase: string, env: Record<string, string | undefined> = process.env): void {
  for (const name of ["TURSO_DATABASE_URL", "TURSO_AUTH_TOKEN"]) {
    if (env[name]) throw new Error(`D6B guard: ${name} is set in the environment — refusing to run with production-shaped credentials present`)
  }
  for (const [name, expected] of [
    ["DATABASE_URL", env.D6B_DATABASE_URL],
    ["DATABASE_AUTH_TOKEN", env.D6B_AUTH_TOKEN],
  ] as const) {
    const value = env[name]
    if (value === undefined || value === "") continue
    if (phase === "e2e" && value === expected) continue
    throw new Error(`D6B guard: ${name} is set${phase === "e2e" ? " but does not equal the D6B branch value" : ""} — refusing`)
  }
}

// ─── Target access ────────────────────────────────────────────────────────────

interface Target {
  execute(sql: string, args?: any[]): Promise<any[]>
  batch(stmts: string[]): Promise<void>
  transaction(): Promise<{ execute(sql: string, args?: any[]): Promise<any[]>; commit(): Promise<void>; rollback(): Promise<void> }>
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
    async transaction() {
      const tx = await client.transaction("write")
      return {
        async execute(sql, args = []) {
          return (await tx.execute({ sql, args })).rows as any[]
        },
        commit: () => tx.commit(),
        rollback: () => tx.rollback(),
      }
    },
    close: () => client.close(),
  }
}

function stateFilePath(): string {
  return process.env.D6B_STATE_FILE || join(tmpdir(), "d6b-rehearsal-state.json")
}

interface State {
  token: string
  baselineRowCounts: Record<string, number>
}

function readState(): State {
  return JSON.parse(readFileSync(stateFilePath(), "utf8"))
}

async function requireMarker(t: Target): Promise<State> {
  const rows = await t.execute(`SELECT token FROM "${MARKER_TABLE}" LIMIT 1`).catch(() => {
    throw new Error("D6B guard: rehearsal marker table absent — target is not the marked rehearsal branch (run 'mark' first)")
  })
  const state = readState()
  if (!rows[0]?.token || rows[0].token !== state.token) {
    throw new Error("D6B guard: rehearsal marker token mismatch — refusing to touch this database")
  }
  return state
}

// ─── Schema inspection (SELECT/PRAGMA only) ──────────────────────────────────

async function userTables(t: Target): Promise<string[]> {
  const rows = await t.execute(
    `SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
  )
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

// ─── Migration history and schema preconditions ──────────────────────────────

interface MigrationEntry {
  name: string
  sql: string
}

function readHistory(): MigrationEntry[] {
  return readdirSync(MIGRATIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((name) => ({ name, sql: readFileSync(join(MIGRATIONS_DIR, name, "migration.sql"), "utf8") }))
}

export interface Preconditions {
  indexes: string[]
  tables: string[]
  columns: Array<{ table: string; column: string }>
}

/**
 * Derives the schema objects a migration creates, straight from its SQL.
 * Only the three additive statement shapes of migrations 1–3 are legal —
 * anything else (DROP, DML, unquoted identifiers, …) is refused, because
 * applied-state cannot be decided for it from schema shape alone.
 */
export function parsePreconditions(sql: string): Preconditions {
  const pre: Preconditions = { indexes: [], tables: [], columns: [] }
  for (const stmt of splitStatements(sql)) {
    let m: RegExpExecArray | null
    if ((m = /^CREATE\s+(?:UNIQUE\s+)?INDEX\s+"([^"]+)"\s+ON\s+"[^"]+"/i.exec(stmt))) {
      pre.indexes.push(m[1])
    } else if ((m = /^CREATE\s+TABLE\s+"([^"]+)"\s*\(/i.exec(stmt))) {
      pre.tables.push(m[1])
    } else if ((m = /^ALTER\s+TABLE\s+"([^"]+)"\s+ADD\s+COLUMN\s+"([^"]+)"/i.exec(stmt))) {
      pre.columns.push({ table: m[1], column: m[2] })
    } else {
      throw new Error(`D6B preconditions: statement shape not recognized as additive — refusing: ${stmt.slice(0, 60)}…`)
    }
  }
  return pre
}

export type MigrationState = "APPLIED" | "PENDING" | "INCONSISTENT"

/** Classifies a migration given which of its objects exist. */
export function classifyState(pre: Preconditions, present: { indexes: Set<string>; tables: Set<string>; columns: Set<string> }): MigrationState {
  const wanted =
    pre.indexes.map((i) => present.indexes.has(i))
      .concat(pre.tables.map((t) => present.tables.has(t)))
      .concat(pre.columns.map((c) => present.columns.has(`${c.table}.${c.column}`)))
  if (wanted.length === 0) throw new Error("D6B preconditions: migration defines no objects — cannot classify")
  if (wanted.every(Boolean)) return "APPLIED"
  if (wanted.every((w) => !w)) return "PENDING"
  return "INCONSISTENT"
}

async function presentObjects(t: Target, pre: Preconditions): Promise<{ indexes: Set<string>; tables: Set<string>; columns: Set<string> }> {
  const idx = await t.execute(`SELECT name FROM sqlite_schema WHERE type='index' AND name NOT LIKE 'sqlite_%'`)
  const tbl = await t.execute(`SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'`)
  const columns = new Set<string>()
  for (const table of new Set(pre.columns.map((c) => c.table))) {
    for (const col of await columnInfo(t, table)) columns.add(`${table}.${col.name}`)
  }
  return {
    indexes: new Set(idx.map((r: any) => String(r.name))),
    tables: new Set(tbl.map((r: any) => String(r.name))),
    columns,
  }
}

async function migrationState(t: Target, entry: MigrationEntry): Promise<MigrationState> {
  const pre = parsePreconditions(entry.sql)
  return classifyState(pre, await presentObjects(t, pre))
}

/** Migrations 1..n — the baseline is never parsed, never applied (D6B §E). */
function deployableHistory(): MigrationEntry[] {
  const history = readHistory()
  if (history.length === 0 || !history[0].name.startsWith("0_")) throw new Error("migration history not found or baseline missing")
  return history.slice(1)
}

// ─── Structural expectations (from D6 §3, verified there) ────────────────────

const EXPECT = {
  baseline: { tables: 48, indexes: 61 },
  afterByName: {
    "1_add_missing_indexes": { tables: 48, indexes: 82 },
    "2_add_link_columns": { tables: 48, indexes: 84 },
    "3_create_portal_tables": { tables: 52, indexes: 93 },
  } as Record<string, { tables: number; indexes: number }>,
}

// ─── Phases ───────────────────────────────────────────────────────────────────

async function phaseAudit(t: Target): Promise<void> {
  const tables = await businessTables(t)
  const all = await userTables(t)
  const report = {
    host: PINNED_HOST,
    businessTables: tables.length,
    explicitIndexes: await explicitIndexCount(t),
    ledgerTables: LEDGER_TABLES.filter((l) => all.includes(l)),
    marker: all.includes(MARKER_TABLE),
    inboxTodoHasWorkspaceTaskId: (await columnInfo(t, "InboxTodo")).some((c) => c.name === "workspaceTaskId"),
    qrCodeHasWorkspaceId: (await columnInfo(t, "QRCode")).some((c) => c.name === "workspaceId"),
    portalTablesPresent: ["ClientAsset", "ClientRequest", "ClientRequestAsset", "ForteSnapshot"].filter((n) => tables.includes(n)),
  }
  out(`[audit] ${JSON.stringify(report)}`)
}

async function phaseMark(t: Target): Promise<void> {
  const all = await userTables(t)
  if (all.includes(MARKER_TABLE)) throw new Error("mark: marker already present — mark runs exactly once, on the pre-adoption branch")
  for (const ledger of LEDGER_TABLES) {
    if (all.includes(ledger)) throw new Error(`mark: ${ledger} exists — target is not the expected ledger-free pre-adoption branch`)
  }
  const tables = await businessTables(t)
  const indexes = await explicitIndexCount(t)
  if (tables.length !== EXPECT.baseline.tables || indexes !== EXPECT.baseline.indexes) {
    throw new Error(`mark: target shape ${tables.length}/${indexes} is not the pre-adoption baseline ${EXPECT.baseline.tables}/${EXPECT.baseline.indexes} — refusing to mark`)
  }
  const baselineRowCounts: Record<string, number> = {}
  for (const table of tables) baselineRowCounts[table] = await countRows(t, table)
  const token = randomUUID()
  await t.execute(`CREATE TABLE "${MARKER_TABLE}" (token TEXT NOT NULL, created_at TEXT NOT NULL)`)
  await t.execute(`INSERT INTO "${MARKER_TABLE}" (token, created_at) VALUES (?, ?)`, [token, new Date().toISOString()])
  writeFileSync(stateFilePath(), JSON.stringify({ token, baselineRowCounts } satisfies State))
  out(`[mark] baseline=${tables.length}/${indexes} ledger=absent rowCountsCaptured=${tables.length} marker=created`)
}

/** Row-count equality against the `mark` capture, minus expected exceptions. */
async function assertRowsIntact(t: Target, state: State, phase: string): Promise<void> {
  for (const [table, expected] of Object.entries(state.baselineRowCounts)) {
    const now = await countRows(t, table)
    if (now !== expected) throw new Error(`${phase}: row count changed for ${table} (${expected} → ${now}) — migrations must not touch data — STOP`)
  }
}

async function validateAfterMigration(t: Target, name: string, state: State): Promise<void> {
  const tables = (await businessTables(t)).length
  const indexes = await explicitIndexCount(t)
  const expect = EXPECT.afterByName[name]
  if (!expect) throw new Error(`validate: no structural expectation for '${name}'`)
  if (tables !== expect.tables || indexes !== expect.indexes) {
    throw new Error(`${name}: tables=${tables}/indexes=${indexes}, expected ${expect.tables}/${expect.indexes} — STOP`)
  }
  await assertRowsIntact(t, state, name)
  if (name === "2_add_link_columns") {
    const todoLink = (await columnInfo(t, "InboxTodo")).find((c) => c.name === "workspaceTaskId")
    const qrWs = (await columnInfo(t, "QRCode")).find((c) => c.name === "workspaceId")
    if (!todoLink || todoLink.type !== "TEXT" || todoLink.notnull !== 0 || todoLink.dflt !== null) throw new Error(`${name}: InboxTodo.workspaceTaskId wrong shape`)
    if (!qrWs || qrWs.type !== "TEXT" || qrWs.notnull !== 0 || qrWs.dflt !== null) throw new Error(`${name}: QRCode.workspaceId wrong shape`)
    const linkedTodos = Number((await t.execute(`SELECT COUNT(*) c FROM "InboxTodo" WHERE "workspaceTaskId" IS NOT NULL`))[0].c)
    if (linkedTodos !== 0) throw new Error(`${name}: ${linkedTodos} InboxTodo rows gained an invented link — STOP`)
    const scopedQrs = Number((await t.execute(`SELECT COUNT(*) c FROM "QRCode" WHERE "workspaceId" IS NOT NULL`))[0].c)
    if (scopedQrs !== 0) throw new Error(`${name}: ${scopedQrs} QRCode rows gained an invented workspace — STOP`)
    out(`[migration 2] columns=OK nullable/no-default=OK legacy links all NULL, no synthetic tasks, no default workspace`)
  } else if (name === "3_create_portal_tables") {
    for (const created of ["ClientAsset", "ClientRequest", "ClientRequestAsset", "ForteSnapshot"]) {
      if ((await countRows(t, created)) !== 0) throw new Error(`${name}: new table ${created} is not empty`)
    }
    out(`[migration 3] tables=${tables} explicitIndexes=${indexes} new tables empty`)
  } else {
    out(`[migration 1] tables=${tables} explicitIndexes=${indexes} rows intact`)
  }
}

async function phaseApply(t: Target): Promise<void> {
  const state = await requireMarker(t)
  const applied: string[] = []
  for (const entry of deployableHistory()) {
    const s = await migrationState(t, entry)
    if (s === "INCONSISTENT") throw new Error(`apply: '${entry.name}' is partially present — refusing to guess — STOP`)
    if (s === "APPLIED") {
      out(`[apply] ${entry.name}: already applied (all schema preconditions present) — skipping`)
      continue
    }
    await t.batch(splitStatements(entry.sql)) // one atomic batch per migration
    await validateAfterMigration(t, entry.name, state)
    applied.push(entry.name)
  }
  out(`[apply] applied=${JSON.stringify(applied)} finalTables=${(await businessTables(t)).length} finalExplicitIndexes=${await explicitIndexCount(t)}`)
}

async function phaseApplyAgain(t: Target): Promise<void> {
  const state = await requireMarker(t)
  const tablesBefore = (await businessTables(t)).length
  const indexesBefore = await explicitIndexCount(t)
  const pending = []
  for (const entry of deployableHistory()) {
    const s = await migrationState(t, entry)
    if (s !== "APPLIED") pending.push(`${entry.name}:${s}`)
  }
  if (pending.length > 0) throw new Error(`apply-again: expected no pending migrations, found ${JSON.stringify(pending)}`)
  const tablesAfter = (await businessTables(t)).length
  const indexesAfter = await explicitIndexCount(t)
  if (tablesAfter !== tablesBefore || indexesAfter !== indexesBefore) throw new Error("apply-again: schema changed during a read-only pass")
  void state
  out(`[apply-again] NO PENDING MIGRATIONS — no DDL executed, schemaDelta=0 — idempotent`)
}

async function phaseStatus(t: Target): Promise<void> {
  await requireMarker(t)
  out(`[status] tables=${(await businessTables(t)).length} explicitIndexes=${await explicitIndexCount(t)}`)
  for (const entry of deployableHistory()) {
    out(`[status] ${entry.name}: ${await migrationState(t, entry)} (by schema preconditions; no ledger exists by design)`)
  }
  const all = await userTables(t)
  for (const ledger of LEDGER_TABLES) {
    if (all.includes(ledger)) throw new Error(`status: ${ledger} exists — the D6B mission forbids creating a ledger`)
  }
}

/** Turso-cloud-specific behavior probes, on a disposable scratch table only. */
async function phaseCloudValidate(t: Target): Promise<void> {
  await requireMarker(t)
  const probe = "_d6b_probe"
  await t.execute(`DROP TABLE IF EXISTS "${probe}"`)
  await t.execute(`CREATE TABLE "${probe}" (id TEXT PRIMARY KEY, v INTEGER NOT NULL DEFAULT 0)`)
  await t.execute(`ALTER TABLE "${probe}" ADD COLUMN "extra" TEXT`)
  await t.execute(`CREATE INDEX "${probe}_v_idx" ON "${probe}"("v")`)
  const cols = (await columnInfo(t, probe)).map((c) => c.name)
  const idx = await t.execute(`SELECT name FROM sqlite_schema WHERE type='index' AND tbl_name = ?`, [probe])
  if (!cols.includes("extra") || !idx.some((r: any) => r.name === `${probe}_v_idx`)) {
    throw new Error("cloud-validate: DDL not visible through sqlite_schema/PRAGMA after execution")
  }
  out(`[cloud-validate] CREATE TABLE / ALTER TABLE ADD COLUMN / CREATE INDEX: executed and visible`)

  // Interactive transaction: commit.
  const tx1 = await t.transaction()
  await tx1.execute(`INSERT INTO "${probe}" (id, v) VALUES ('c1', 1)`)
  await tx1.commit()
  if ((await countRows(t, probe)) !== 1) throw new Error("cloud-validate: committed transaction row missing")
  // Interactive transaction: rollback.
  const tx2 = await t.transaction()
  await tx2.execute(`INSERT INTO "${probe}" (id, v) VALUES ('r1', 2)`)
  await tx2.rollback()
  if ((await countRows(t, probe)) !== 1) throw new Error("cloud-validate: rolled-back transaction leaked a row")
  out(`[cloud-validate] interactive transactions over the wire: commit=OK rollback=OK`)

  // Batch atomicity: a failing statement must abort the whole batch.
  let failed = false
  try {
    await t.batch([`INSERT INTO "${probe}" (id, v) VALUES ('b1', 3)`, `INSERT INTO "no_such_table_d6b" (id) VALUES ('x')`])
  } catch {
    failed = true
  }
  if (!failed || (await countRows(t, probe)) !== 1) throw new Error("cloud-validate: failing batch was not atomic")
  out(`[cloud-validate] batch with failing statement: rejected atomically, no partial write`)

  await t.execute(`DROP TABLE "${probe}"`)
  out(`[cloud-validate] probe artifacts dropped`)
}

// ─── E2E fixtures (synthetic only, d6b- prefixed, zero PII) ──────────────────

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
  await t.execute(
    `INSERT OR IGNORE INTO "${table}" (${names.map((n) => `"${n}"`).join(",")}) VALUES (${names.map(() => "?").join(",")})`,
    names.map((n) => row[n] as any),
  )
}

const F = { workspace: "d6b-ws", user: "d6b-user", cliente: "d6b-cliente" }

async function phaseE2e(t: Target): Promise<void> {
  const state = await requireMarker(t)
  if (process.env.DATABASE_URL !== process.env.D6B_DATABASE_URL || process.env.DATABASE_AUTH_TOKEN !== process.env.D6B_AUTH_TOKEN) {
    throw new Error("D6B guard: e2e requires DATABASE_URL/DATABASE_AUTH_TOKEN to equal the D6B branch values exactly")
  }
  // Synthetic sandbox rows so the e2e never mixes with production-copy data.
  await makeInsert(t, "Workspace", { id: F.workspace, nombre: "D6B Rehearsal WS", slug: "d6b-rehearsal-ws" })
  await makeInsert(t, "User", { id: F.user, email: "d6b-user@rehearsal.invalid", workspaceId: null })
  await makeInsert(t, "WorkspaceMember", { id: "d6b-member", userId: F.user, workspaceId: F.workspace, role: "ADMIN" })
  await makeInsert(t, "Cliente", { id: F.cliente, nombre: "D6B Synthetic Client", workspaceId: F.workspace })

  const { createTodo } = await import("../modules/inbox/todo-service")
  const { updateInboxScopedTaskStatus } = await import("../modules/inbox/inbox-tasks-write")
  const { db } = await import("../core/db")

  // 1. Real dual-write create path (the production HIGH), over the real adapter.
  const todo = await createTodo({ workspaceId: F.workspace, title: "D6B e2e todo", createdBy: F.user, createdSource: "operator" })
  if (!todo.workspaceTaskId) throw new Error("e2e: createTodo returned no workspaceTaskId")
  const mirror = await db.workspaceTask.findFirst({ where: { id: todo.workspaceTaskId, workspaceId: F.workspace } })
  if (!mirror || mirror.sourceType !== "inbox_todo" || mirror.sourceId !== todo.id) throw new Error("e2e: mirror WorkspaceTask wrong or missing")
  if ((await db.workspaceTask.count({ where: { sourceType: "inbox_todo", sourceId: todo.id } })) !== 1) throw new Error("e2e: duplicate mirror")
  out(`[e2e] createTodo on Turso Cloud: InboxTodo + WorkspaceTask + link committed atomically (no orphan, no duplicate)`)

  // 2. Legacy-id fallback branch (resolveWorkspaceTaskId — still live code).
  const updated = await updateInboxScopedTaskStatus({ workspaceId: F.workspace, id: todo.id, status: "done", actorId: F.user })
  if (!updated) throw new Error("e2e: legacy-id status update did not resolve via workspaceTaskId")
  if ((await db.workspaceTask.findFirst({ where: { id: todo.workspaceTaskId } }))?.status !== "done") throw new Error("e2e: mirror status not updated")
  out(`[e2e] resolveWorkspaceTaskId legacy branch: InboxTodo id → linked WorkspaceTask updated`)

  // 3. The 3 legacy production-copy todos must still be unlinked (no invented data).
  const legacyLinked = Number((await t.execute(`SELECT COUNT(*) c FROM "InboxTodo" WHERE "workspaceTaskId" IS NOT NULL AND "workspaceId" <> ?`, [F.workspace]))[0].c)
  if (legacyLinked !== 0) throw new Error(`e2e: ${legacyLinked} legacy todos gained links — STOP`)
  const legacyCount = Number((await t.execute(`SELECT COUNT(*) c FROM "InboxTodo" WHERE "workspaceId" <> ?`, [F.workspace]))[0].c)
  if (legacyCount !== state.baselineRowCounts["InboxTodo"]) throw new Error("e2e: legacy InboxTodo count changed — STOP")
  out(`[e2e] the ${legacyCount} legacy InboxTodo rows: untouched, workspaceTaskId still NULL`)

  // 4. Controlled transaction rollback through the app client (same interactive shape).
  const todosBefore = await db.inboxTodo.count()
  const tasksBefore = await db.workspaceTask.count()
  let rolledBack = false
  try {
    await db.$transaction(async (tx) => {
      const created = await tx.inboxTodo.create({ data: { workspaceId: F.workspace, title: "D6B rollback probe", createdBy: F.user, status: "open" } as any })
      await tx.workspaceTask.create({ data: { workspaceId: F.workspace, title: "D6B rollback mirror", createdBy: F.user, sourceType: "inbox_todo", sourceId: created.id } as any })
      throw new Error("d6b-injected-failure")
    })
  } catch (err) {
    rolledBack = err instanceof Error && err.message === "d6b-injected-failure"
  }
  if (!rolledBack || (await db.inboxTodo.count()) !== todosBefore || (await db.workspaceTask.count()) !== tasksBefore) {
    throw new Error("e2e: injected-failure rollback left partial rows")
  }
  out(`[e2e] injected mid-transaction failure: full rollback over Turso Cloud, no partial rows`)

  // 5. QRCode with the new column; no legacy row may gain a workspace (0 exist).
  const qr = await db.qRCode.create({ data: { module: "clientes", recordId: F.cliente, url: "https://rehearsal.invalid/qr", imageData: "synthetic", workspaceId: F.workspace } as any })
  if (!(await db.qRCode.findFirst({ where: { id: qr.id, workspaceId: F.workspace } }))) throw new Error("e2e: scoped QRCode read failed")
  if ((await db.qRCode.count({ where: { workspaceId: null } as any })) !== state.baselineRowCounts["QRCode"]) throw new Error("e2e: QRCode NULL-workspace count drifted")
  out(`[e2e] QRCode: scoped create/read OK; no default workspace invented`)

  // 6. Portal tables + ForteSnapshot persistence patterns.
  const request = await db.clientRequest.create({
    data: { workspaceId: F.workspace, clienteId: F.cliente, title: "D6B request", assets: { create: [{ assetUrl: "https://rehearsal.invalid/a", assetName: "d6b-a" }] } },
    include: { assets: true },
  })
  if (request.assets?.length !== 1) throw new Error("e2e: nested ClientRequestAsset create failed")
  await db.clientAsset.create({ data: { workspaceId: F.workspace, clienteId: F.cliente, filename: "d6b-file", mimeType: "text/plain", sizeBytes: 1, url: "https://rehearsal.invalid/f" } })
  await db.forteSnapshot.upsert({ where: { workspaceId: F.workspace }, create: { workspaceId: F.workspace, maturity: "synthetic", payload: "{}" }, update: { payload: "{}" } })
  if (!(await db.forteSnapshot.findUnique({ where: { workspaceId: F.workspace } as any }))) throw new Error("e2e: ForteSnapshot round-trip failed")
  out(`[e2e] portal tables (nested create/include) + ForteSnapshot upsert/find: OK`)

  // 7. Factura.items contract on the real production-copy rows — counts only.
  const facturas = await db.factura.findMany({ select: { items: true } })
  const arrays = facturas.filter((f) => {
    try {
      return Array.isArray(JSON.parse(String(f.items)))
    } catch {
      return false
    }
  }).length
  if (arrays !== facturas.length) throw new Error(`e2e: ${facturas.length - arrays} Factura.items rows are not JSON arrays`)
  out(`[e2e] Factura.items: ${arrays}/${facturas.length} rows parse as JSON arrays through the app client`)
  await db.$disconnect()
}

/**
 * Recovery rehearsal without platform access: a logical dump of the branch
 * (schema DDL + every row) restored into a local SQLite file, verified by
 * object and row counts, then deleted (the dump holds production-copy data
 * and must not outlive the check). This proves a restore path exists that
 * needs neither the Platform API nor production.
 */
async function phaseRecovery(t: Target): Promise<void> {
  await requireMarker(t)
  const { DatabaseSync } = await import("node:sqlite")
  const dir = mkdtempSync(join(tmpdir(), "d6b-recovery-"))
  const dbPath = join(dir, "restore.db")
  try {
    const ddl = await t.execute(
      `SELECT sql, type, name FROM sqlite_schema WHERE name NOT LIKE 'sqlite_%' AND name <> '${MARKER_TABLE}' AND sql IS NOT NULL ORDER BY CASE type WHEN 'table' THEN 0 ELSE 1 END, name`,
    )
    const local = new DatabaseSync(dbPath)
    local.exec("PRAGMA foreign_keys=OFF")
    for (const row of ddl) local.exec(String(row.sql))
    const tables = (await userTables(t)).filter((n) => n !== MARKER_TABLE)
    let totalRows = 0
    for (const table of tables) {
      const rows = await t.execute(`SELECT * FROM "${table}"`)
      if (rows.length === 0) continue
      const names = Object.keys(rows[0])
      const stmt = local.prepare(`INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(",")}) VALUES (${names.map(() => "?").join(",")})`)
      for (const r of rows) {
        stmt.run(...names.map((n) => (r[n] === undefined ? null : (r[n] as any))))
        totalRows++
      }
    }
    // Verify the restored copy structurally and row-by-count.
    const localTables = local.prepare(`SELECT COUNT(*) c FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'`).get() as any
    const localIndexes = local
      .prepare(`SELECT COUNT(*) c FROM sqlite_schema WHERE type='index' AND name NOT LIKE 'sqlite_%' AND tbl_name NOT LIKE '\\_%' ESCAPE '\\'`)
      .get() as any
    const remoteIndexes = await explicitIndexCount(t)
    if (Number(localTables.c) !== tables.length) throw new Error(`recovery: restored table count ${localTables.c} != ${tables.length}`)
    if (Number(localIndexes.c) !== remoteIndexes) throw new Error(`recovery: restored index count ${localIndexes.c} != ${remoteIndexes}`)
    let mismatches = 0
    for (const table of tables) {
      const localCount = Number((local.prepare(`SELECT COUNT(*) c FROM "${table}"`).get() as any).c)
      if (localCount !== (await countRows(t, table))) mismatches++
    }
    local.close()
    if (mismatches > 0) throw new Error(`recovery: ${mismatches} tables restored with wrong row counts`)
    out(`[recovery] logical dump → local restore verified: tables=${tables.length} explicitIndexes=${remoteIndexes} rowsCopied=${totalRows} rowCountMismatches=0`)
  } finally {
    rmSync(dir, { recursive: true, force: true })
    out(`[recovery] dump deleted (production-copy data never outlives the verification)`)
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const phase = process.argv[2]
  ;(async () => {
    const url = process.env.D6B_DATABASE_URL || ""
    const token = process.env.D6B_AUTH_TOKEN || ""
    assertBranchUrl(url)
    if (!token) throw new Error("D6B guard: D6B_AUTH_TOKEN is not set — refusing to run")
    assertNoProductionEnv(phase ?? "")
    const t = await openTarget(url, token)
    try {
      switch (phase) {
        case "audit": await phaseAudit(t); break
        case "mark": await phaseMark(t); break
        case "apply": await phaseApply(t); break
        case "apply-again": await phaseApplyAgain(t); break
        case "status": await phaseStatus(t); break
        case "cloud-validate": await phaseCloudValidate(t); break
        case "e2e": await phaseE2e(t); break
        case "recovery": await phaseRecovery(t); break
        default:
          throw new Error("usage: tsx scripts/rehearse-core-03c-d6b.ts <audit|mark|apply|apply-again|status|cloud-validate|e2e|recovery>")
      }
    } finally {
      t.close()
    }
  })().catch((err) => {
    console.error(`[d6b-rehearsal] ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}
