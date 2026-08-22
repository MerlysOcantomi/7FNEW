/**
 * CORE-03C-D3 — DETERMINISTIC DATA REPAIRS applier.
 *
 * Repairs, in Sevenef/7F production, exactly the D3 debt that the
 * owner-ratified M2 policy classifies as DETERMINISTIC — and nothing else:
 *
 *   1. NULL `workspaceId` rows whose workspace is derivable UNANIMOUSLY
 *      from existing canonical relations (M2 §5, parents-first:
 *      Cliente → Proyecto → Tarea/Factura/Transaccion → Activity).
 *   2. Activity rows whose `workspaceId` points at a nonexistent Workspace:
 *      SetNull convergence (M2 §7.2 rule 1), then parent-map derivation
 *      (§7.2 rule 2).
 *   3. Conversation/Message `connectionId` pointing at a nonexistent
 *      ChannelConnection: SetNull convergence (M2 §7.1) — materializing the
 *      `onDelete: SetNull` the schema always declared.
 *
 * NEVER: no default workspace, no fuzzy/approximate/name-based matching, no
 * invented relation, no DELETE, no archive, no schema change, no ledger.
 * AMBIGUOUS and non-SetNull ORPHANED rows are counted and left untouched.
 * `User.workspaceId` (LEGITIMATE_NULL, M2 §4) and `Notification.workspaceId`
 * (LEGITIMATE_NULL, M2 §5.6) are never written.
 *
 * FAIL-CLOSED SAFETY (same model as the D6 production applier, whose
 * hostname guard this tool reuses):
 *   - production hostname compile-time pinned; the D6B rehearsal branch is
 *     refused by name; `--target-production` required for every phase and
 *     `--owner-authorized` additionally for `apply`; unknown flags abort —
 *     there is no --force, no --skip-gates, no --repair-all.
 *   - `apply` requires a restore-verified FRESH checkpoint of the current
 *     52/93 post-D6 database, re-classifies every row live immediately
 *     before each write group, and STOPs if any aggregate count differs
 *     from the recorded pre-write plan, if any UPDATE affects a row count
 *     different from expected, or if cross-tenant mismatches leave 0.
 *   - Every write is an UPDATE inside an interactive transaction with a
 *     guard predicate (`workspaceId IS NULL` / the exact orphan anti-join),
 *     so a row that changed since classification produces 0 affected rows
 *     and aborts the whole group by rollback. DELETE statements: none.
 *
 * Usage: tsx scripts/apply-core-03c-d3-deterministic-repairs.ts <phase> --target-production
 * Phases: classify | backup | verify-backup | apply | post-audit
 * Env:    TURSO_DATABASE_URL / TURSO_AUTH_TOKEN  (required; production pin)
 *         CORE03C_D3_BACKUP_DIR  (optional) checkpoint dir (default:
 *                                <os tmpdir>/core03c-d3-repairs)
 *         CORE03C_D3_STATE_FILE  (optional) plan/backup state path
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- raw SQL rows are untyped */

import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

import { assertProductionUrl } from "./apply-core-03c-production-adoption"
import { fkTargetsFromManifest } from "./audit-core-03c-m1"

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const MANIFEST_PATH = join(REPO_ROOT, "prisma", "migrations", "drift-manifest.json")

/** Post-D6 production shape — D3 changes no schema, so this never moves. */
export const POST_D6_SHAPE = { tables: 52, indexes: 93 }

const out = (line: string): void => {
  process.stdout.write(line + "\n")
}

// ─── Flags (no override switches exist) ──────────────────────────────────────

export interface Flags {
  targetProduction: boolean
  ownerAuthorized: boolean
}

export function parseFlags(argv: string[]): Flags {
  const flags: Flags = { targetProduction: false, ownerAuthorized: false }
  for (const arg of argv) {
    if (arg === "--target-production") flags.targetProduction = true
    else if (arg === "--owner-authorized") flags.ownerAuthorized = true
    else throw new Error(`d3 guard: unknown argument '${arg}' — this tool has no overrides`)
  }
  return flags
}

export function assertFlags(phase: string, flags: Flags): void {
  if (!flags.targetProduction) {
    throw new Error("d3 guard: the explicit --target-production flag is required for every phase")
  }
  if (phase === "apply" && !flags.ownerAuthorized) {
    throw new Error(
      "d3 guard: 'apply' requires --owner-authorized — only after the owner's exact phrase 'AUTORIZO CORE-03C-D3 DETERMINISTIC REPAIRS' was received in this window",
    )
  }
}

// ─── Target access ────────────────────────────────────────────────────────────

export type QueryFn = (sql: string, args?: unknown[]) => Promise<any[]>

export interface Target {
  query: QueryFn
  /** Runs fn inside one interactive write transaction; rolls back on throw. */
  withTransaction<T>(fn: (tx: TxHandle) => Promise<T>): Promise<T>
  close(): void
}

export interface TxHandle {
  query: QueryFn
  /** Executes a write statement and returns the affected-row count. */
  run(sql: string, args?: unknown[]): Promise<number>
}

async function openLibsqlTarget(url: string, authToken: string): Promise<Target> {
  const { createClient } = await import("@libsql/client")
  const client = createClient({ url, authToken })
  return {
    async query(sql, args = []) {
      return (await client.execute({ sql, args: args as any[] })).rows as any[]
    },
    async withTransaction(fn) {
      const tx = await client.transaction("write")
      try {
        const result = await fn({
          query: async (sql, args = []) => (await tx.execute({ sql, args: args as any[] })).rows as any[],
          run: async (sql, args = []) => (await tx.execute({ sql, args: args as any[] })).rowsAffected,
        })
        await tx.commit()
        return result
      } catch (err) {
        try {
          await tx.rollback()
        } catch {
          /* rollback after failed tx may itself fail; the error below wins */
        }
        throw err
      }
    },
    close: () => client.close(),
  }
}

// ─── State (aggregate-only plan + backup metadata; ids are NEVER persisted) ──

function backupDir(): string {
  return process.env.CORE03C_D3_BACKUP_DIR || join(tmpdir(), "core03c-d3-repairs")
}

function stateFilePath(): string {
  return process.env.CORE03C_D3_STATE_FILE || join(backupDir(), "core03c-d3-state.json")
}

export interface ModelPlan {
  nullCount: number
  deterministic: number
  ambiguous: number
  orphaned: number
}

export interface D3Plan {
  cliente: ModelPlan
  proyecto: ModelPlan
  tarea: ModelPlan
  factura: ModelPlan
  transaccion: ModelPlan
  notification: { nullCount: number; legitimateNull: number }
  user: { nullCount: number; legitimateNull: number }
  activity: ModelPlan & { orphanRefsSetNull: number }
  conversation: { orphanConnections: number }
  message: { orphanConnections: number }
  crossTenantMismatches: number
  totalPlannedWrites: number
}

interface State {
  plan: D3Plan
  backup?: {
    backupPath: string
    createdAt: string
    tables: number
    explicitIndexes: number
    rowCounts: Record<string, number>
  }
}

function readState(): State {
  if (!existsSync(stateFilePath())) {
    throw new Error("d3 guard: no recorded state exists — run 'classify' (and 'backup') first — STOP")
  }
  return JSON.parse(readFileSync(stateFilePath(), "utf8"))
}

function writeState(state: State): void {
  mkdirSync(backupDir(), { recursive: true, mode: 0o700 })
  writeFileSync(stateFilePath(), JSON.stringify(state, null, 2), { mode: 0o600 })
}

// ─── Canonical derivation sources (M2 §5 / §7.2, verified against schema) ────

/** Child tables whose `clienteId` rows can witness a Cliente's workspace. */
export const CLIENTE_CHILD_SOURCES = ["Proyecto", "Factura", "Tarea", "Transaccion", "Documento", "Contact", "Conversation"] as const

/** Child tables whose `proyectoId` rows can witness a Proyecto's workspace. */
export const PROYECTO_CHILD_SOURCES = ["Tarea", "Factura", "Transaccion", "Documento", "Evento", "Nota"] as const

/** Activity `module` → parent table (M2 §7.2; matches core/activity.ts writers). */
export const ACTIVITY_MODULE_MAP: Record<string, string> = {
  clientes: "Cliente",
  proyectos: "Proyecto",
  tareas: "Tarea",
  facturacion: "Factura",
  documentos: "Documento",
  email: "Conversation",
}

/** Unanimity rule (M2 §5 template): the candidate set decides the class. */
export function classifyCandidates(candidates: Set<string>): "DETERMINISTIC" | "AMBIGUOUS" | "ORPHANED" {
  if (candidates.size === 1) return "DETERMINISTIC"
  if (candidates.size > 1) return "AMBIGUOUS"
  return "ORPHANED"
}

// ─── Classification engine (read-only; parents-first via projections) ────────

interface Assignment {
  id: string
  ws: string
}

interface ModelClassification extends ModelPlan {
  assignments: Assignment[]
}

export interface D3Classification {
  plan: D3Plan
  /** In-memory only — never persisted, never printed. */
  assignments: {
    cliente: Assignment[]
    proyecto: Assignment[]
    tarea: Assignment[]
    factura: Assignment[]
    transaccion: Assignment[]
    activity: Assignment[]
  }
}

/**
 * Full row-by-row classification. `projected` carries the parents-first
 * assignments planned earlier in the same pass, so a child can inherit a
 * parent that WILL be repaired before it — exactly the order `apply` uses.
 */
export async function classifyD3(q: QueryFn): Promise<D3Classification> {
  const projected = new Map<string, Map<string, string>>() // table → id → planned ws
  const projectedWs = (table: string, id: string): string | undefined => projected.get(table)?.get(id)

  const nullRows = async (table: string): Promise<string[]> =>
    (await q(`SELECT "id" FROM "${table}" WHERE "workspaceId" IS NULL ORDER BY "id"`)).map((r) => String(r.id))

  /** Live workspace of a parent row, or the projected one if repair is planned. */
  const parentWs = async (table: string, id: string): Promise<{ exists: boolean; ws: string | null }> => {
    const rows = await q(`SELECT "workspaceId" w FROM "${table}" WHERE "id" = ?`, [id])
    if (rows.length === 0) return { exists: false, ws: null }
    const live = rows[0].w === null || rows[0].w === undefined ? null : String(rows[0].w)
    return { exists: true, ws: live ?? projectedWs(table, id) ?? null }
  }

  const childWitnesses = async (childTable: string, fkColumn: string, id: string): Promise<string[]> =>
    (
      await q(`SELECT DISTINCT "workspaceId" w FROM "${childTable}" WHERE "${fkColumn}" = ? AND "workspaceId" IS NOT NULL`, [id])
    ).map((r) => String(r.w))

  const classifyModel = async (
    table: string,
    candidateSources: (id: string) => Promise<string[][]>,
  ): Promise<ModelClassification> => {
    const ids = await nullRows(table)
    const result: ModelClassification = { nullCount: ids.length, deterministic: 0, ambiguous: 0, orphaned: 0, assignments: [] }
    for (const id of ids) {
      const candidates = new Set<string>((await candidateSources(id)).flat())
      const cls = classifyCandidates(candidates)
      if (cls === "DETERMINISTIC") {
        const ws = [...candidates][0]
        result.deterministic++
        result.assignments.push({ id, ws })
        if (!projected.has(table)) projected.set(table, new Map())
        projected.get(table)!.set(id, ws)
      } else if (cls === "AMBIGUOUS") result.ambiguous++
      else result.orphaned++
    }
    return result
  }

  // 1. Cliente — witnesses are its children across all canonical sources.
  const cliente = await classifyModel("Cliente", async (id) =>
    Promise.all(CLIENTE_CHILD_SOURCES.map((t) => childWitnesses(t, "clienteId", id))),
  )

  // 2. Proyecto — parent Cliente (possibly just planned) + children.
  const proyecto = await classifyModel("Proyecto", async (id) => {
    const own = await q(`SELECT "clienteId" c FROM "Proyecto" WHERE "id" = ?`, [id])
    const viaParent: string[] = []
    if (own[0]?.c) {
      const p = await parentWs("Cliente", String(own[0].c))
      if (p.exists && p.ws) viaParent.push(p.ws)
    }
    const viaChildren = await Promise.all(PROYECTO_CHILD_SOURCES.map((t) => childWitnesses(t, "proyectoId", id)))
    return [viaParent, ...viaChildren]
  })

  // 3. Tarea / Factura / Transaccion — parents Cliente/Proyecto (both possibly planned).
  const viaParents = (table: string) => async (id: string) => {
    const own = await q(`SELECT "clienteId" c, "proyectoId" p FROM "${table}" WHERE "id" = ?`, [id])
    const found: string[] = []
    if (own[0]?.c) {
      const p = await parentWs("Cliente", String(own[0].c))
      if (p.exists && p.ws) found.push(p.ws)
    }
    if (own[0]?.p) {
      const p = await parentWs("Proyecto", String(own[0].p))
      if (p.exists && p.ws) found.push(p.ws)
    }
    return [found]
  }
  const tarea = await classifyModel("Tarea", viaParents("Tarea"))
  const factura = await classifyModel("Factura", viaParents("Factura"))
  const transaccion = await classifyModel("Transaccion", viaParents("Transaccion"))

  // 4. Notification / User — LEGITIMATE_NULL by closed decision (M2 §5.6 / §4).
  const notificationNull = Number((await q(`SELECT COUNT(*) c FROM "Notification" WHERE "workspaceId" IS NULL`))[0].c)
  const userNull = Number((await q(`SELECT COUNT(*) c FROM "User" WHERE "workspaceId" IS NULL`))[0].c)

  // 5. Activity — orphan refs first (SetNull convergence), then module-map derivation.
  const orphanRefRows = await q(
    `SELECT "id" FROM "Activity" a WHERE a."workspaceId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Workspace" w WHERE w."id" = a."workspaceId") ORDER BY "id"`,
  )
  const activityNullIds = (await q(`SELECT "id" FROM "Activity" WHERE "workspaceId" IS NULL ORDER BY "id"`)).map((r) => String(r.id))
  const activityPoolIds = [...activityNullIds, ...orphanRefRows.map((r) => String(r.id))] // orphan refs join the NULL pool after SetNull
  const activity: ModelClassification & { orphanRefsSetNull: number } = {
    nullCount: activityPoolIds.length,
    deterministic: 0,
    ambiguous: 0,
    orphaned: 0,
    assignments: [],
    orphanRefsSetNull: orphanRefRows.length,
  }
  for (const id of activityPoolIds) {
    const row = (await q(`SELECT "module" m, "recordId" r FROM "Activity" WHERE "id" = ?`, [id]))[0]
    const parentTable = ACTIVITY_MODULE_MAP[String(row?.m ?? "")]
    if (!parentTable) {
      activity.ambiguous++ // unmapped module: no code-confirmed derivation exists
      continue
    }
    const p = await parentWs(parentTable, String(row.r))
    if (!p.exists) activity.orphaned++
    else if (p.ws) {
      activity.deterministic++
      activity.assignments.push({ id, ws: p.ws })
    } else activity.ambiguous++ // parent exists but its own workspace is unresolved after parents-first
  }

  // 6. Conversation / Message — orphaned connection references (SetNull convergence).
  const orphanConn = async (table: string): Promise<number> =>
    Number(
      (
        await q(
          `SELECT COUNT(*) c FROM "${table}" x WHERE x."connectionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "ChannelConnection" cc WHERE cc."id" = x."connectionId")`,
        )
      )[0].c,
    )
  const conversationOrphans = await orphanConn("Conversation")
  const messageOrphans = await orphanConn("Message")

  // 7. Cross-tenant mismatches (same manifest-driven definition as the M1 audit).
  const crossTenant = await countCrossTenant(q)

  const strip = (m: ModelClassification): ModelPlan => ({
    nullCount: m.nullCount,
    deterministic: m.deterministic,
    ambiguous: m.ambiguous,
    orphaned: m.orphaned,
  })

  const totalPlannedWrites =
    cliente.deterministic +
    proyecto.deterministic +
    tarea.deterministic +
    factura.deterministic +
    transaccion.deterministic +
    activity.orphanRefsSetNull +
    activity.deterministic +
    conversationOrphans +
    messageOrphans

  return {
    plan: {
      cliente: strip(cliente),
      proyecto: strip(proyecto),
      tarea: strip(tarea),
      factura: strip(factura),
      transaccion: strip(transaccion),
      notification: { nullCount: notificationNull, legitimateNull: notificationNull },
      user: { nullCount: userNull, legitimateNull: userNull },
      activity: { ...strip(activity), orphanRefsSetNull: activity.orphanRefsSetNull },
      conversation: { orphanConnections: conversationOrphans },
      message: { orphanConnections: messageOrphans },
      crossTenantMismatches: crossTenant,
      totalPlannedWrites,
    },
    assignments: {
      cliente: cliente.assignments,
      proyecto: proyecto.assignments,
      tarea: tarea.assignments,
      factura: factura.assignments,
      transaccion: transaccion.assignments,
      activity: activity.assignments,
    },
  }
}

/** Cross-tenant mismatch count, manifest-driven — must be 0 before AND after. */
export async function countCrossTenant(q: QueryFn): Promise<number> {
  const tables = new Set<string>(
    (await q(`SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'`)).map((r) => String(r.name)),
  )
  const columns = async (t: string): Promise<Set<string>> =>
    new Set((await q(`PRAGMA table_info("${t}")`)).map((c: any) => String(c.name)))
  let total = 0
  for (const fk of fkTargetsFromManifest(MANIFEST_PATH)) {
    if (!tables.has(fk.child) || !tables.has(fk.parent)) continue
    const childCols = await columns(fk.child)
    const parentCols = await columns(fk.parent)
    if (!childCols.has("workspaceId") || !parentCols.has("workspaceId")) continue
    if (!childCols.has(fk.childColumn) || !parentCols.has(fk.parentColumn)) continue
    total += Number(
      (
        await q(
          `SELECT COUNT(*) c FROM "${fk.child}" x JOIN "${fk.parent}" p ON p."${fk.parentColumn}" = x."${fk.childColumn}"
            WHERE x."workspaceId" IS NOT NULL AND p."workspaceId" IS NOT NULL AND x."workspaceId" <> p."workspaceId"`,
        )
      )[0].c,
    )
  }
  return total
}

/** Aggregate-only plan comparison; a single differing count is a hard stop. */
export function assertPlansEqual(recorded: D3Plan, fresh: D3Plan): void {
  const a = JSON.stringify(recorded)
  const b = JSON.stringify(fresh)
  if (a !== b) {
    throw new Error("d3 guard: live classification differs from the recorded pre-write plan — data changed since the gate — STOP (re-run classify + backup and re-present the gate)")
  }
}

// ─── Phases ───────────────────────────────────────────────────────────────────

async function phaseClassify(t: Target): Promise<void> {
  await assertShape(t.query)
  const { plan } = await classifyD3(t.query)
  writeState({ ...readStateOptional(), plan })
  out(`[classify] ${JSON.stringify(plan)}`)
}

function readStateOptional(): Partial<State> {
  try {
    return readState()
  } catch {
    return {}
  }
}

async function assertShape(q: QueryFn): Promise<void> {
  const tables = (await q(`SELECT COUNT(*) c FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\'`))[0]
  const indexes = (await q(`SELECT COUNT(*) c FROM sqlite_schema WHERE type='index' AND name NOT LIKE 'sqlite_%' AND tbl_name NOT LIKE '\\_%' ESCAPE '\\'`))[0]
  if (Number(tables.c) !== POST_D6_SHAPE.tables || Number(indexes.c) !== POST_D6_SHAPE.indexes) {
    throw new Error(`d3 guard: schema shape ${tables.c}/${indexes.c} is not the post-D6 ${POST_D6_SHAPE.tables}/${POST_D6_SHAPE.indexes} — STOP`)
  }
}

async function businessTables(q: QueryFn): Promise<string[]> {
  return (await q(`SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '\\_%' ESCAPE '\\' ORDER BY name`)).map(
    (r: any) => String(r.name),
  )
}

async function phaseBackup(t: Target): Promise<void> {
  await assertShape(t.query)
  const { DatabaseSync } = await import("node:sqlite")
  mkdirSync(backupDir(), { recursive: true, mode: 0o700 })
  const backupPath = join(backupDir(), "core03c-d3-pre-repair-checkpoint.db")
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

  const prior = readStateOptional()
  if (!prior.plan) throw new Error("backup: run 'classify' before 'backup' so the plan and checkpoint describe the same state")
  writeState({
    plan: prior.plan,
    backup: {
      backupPath,
      createdAt: new Date().toISOString(),
      tables: tables.length,
      explicitIndexes: POST_D6_SHAPE.indexes,
      rowCounts,
    },
  })
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
  if (drift > 0) throw new Error(`verify-backup: live database drifted from the checkpoint in ${drift} tables — STALE, re-run 'classify' + 'backup' — STOP`)
  out(`[verify-backup] checkpoint intact and FRESH: tables=${state.backup.tables} liveRowDrift=0`)
}

/** Per-row guarded assignment updates inside one transaction; UPDATE only. */
async function applyAssignments(t: Target, table: string, assignments: Assignment[], label: string): Promise<void> {
  if (assignments.length === 0) {
    out(`[apply] ${label}: 0 planned — skipping`)
    return
  }
  await t.withTransaction(async (tx) => {
    for (const a of assignments) {
      const affected = await tx.run(`UPDATE "${table}" SET "workspaceId" = ? WHERE "id" = ? AND "workspaceId" IS NULL`, [a.ws, a.id])
      if (affected !== 1) throw new Error(`${label}: expected exactly 1 affected row, got ${affected} — a row changed since classification — STOP (rolled back)`)
    }
    const crossTenant = await countCrossTenant(tx.query)
    if (crossTenant !== 0) throw new Error(`${label}: cross-tenant mismatches would become ${crossTenant} — STOP (rolled back)`)
  })
  out(`[apply] ${label}: ${assignments.length} rows repaired (guarded UPDATE, affected==expected, cross-tenant 0)`)
}

/**
 * The exact write sequence of the mission, in parents-first order. Exported
 * so the whole sequence is unit-testable against a local SQLite fixture
 * with zero network. UPDATE-only; every group is one transaction.
 */
export async function executeRepairs(t: Target, plan: D3Plan, assignments: D3Classification["assignments"]): Promise<void> {
  // 1–2. Parents-first deterministic workspace repairs.
  await applyAssignments(t, "Cliente", assignments.cliente, "Cliente deterministic")
  await applyAssignments(t, "Proyecto", assignments.proyecto, "Proyecto deterministic")
  await applyAssignments(t, "Tarea", assignments.tarea, "Tarea deterministic")
  await applyAssignments(t, "Factura", assignments.factura, "Factura deterministic")
  await applyAssignments(t, "Transaccion", assignments.transaccion, "Transaccion deterministic")

  // 3. Activity orphan refs → SetNull convergence (single guarded statement).
  await t.withTransaction(async (tx) => {
    const affected = await tx.run(
      `UPDATE "Activity" SET "workspaceId" = NULL WHERE "workspaceId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Workspace" w WHERE w."id" = "Activity"."workspaceId")`,
    )
    if (affected !== plan.activity.orphanRefsSetNull) {
      throw new Error(`Activity orphan SetNull: affected ${affected} != expected ${plan.activity.orphanRefsSetNull} — STOP (rolled back)`)
    }
  })
  out(`[apply] Activity orphan SetNull: ${plan.activity.orphanRefsSetNull} rows converged to NULL (no delete)`)

  // 4. Activity deterministic derivations (parents are repaired by now).
  await applyAssignments(t, "Activity", assignments.activity, "Activity deterministic")

  // 5–6. Conversation / Message orphaned connectionId → SetNull convergence.
  for (const [table, expected] of [
    ["Conversation", plan.conversation.orphanConnections],
    ["Message", plan.message.orphanConnections],
  ] as const) {
    await t.withTransaction(async (tx) => {
      const affected = await tx.run(
        `UPDATE "${table}" SET "connectionId" = NULL WHERE "connectionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "ChannelConnection" cc WHERE cc."id" = "${table}"."connectionId")`,
      )
      if (affected !== expected) throw new Error(`${table} connection SetNull: affected ${affected} != expected ${expected} — STOP (rolled back)`)
      const remaining = Number(
        (
          await tx.query(
            `SELECT COUNT(*) c FROM "${table}" x WHERE x."connectionId" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "ChannelConnection" cc WHERE cc."id" = x."connectionId")`,
          )
        )[0].c,
      )
      if (remaining !== 0) throw new Error(`${table} connection SetNull: ${remaining} orphans remain — STOP (rolled back)`)
    })
    out(`[apply] ${table} connection SetNull: ${expected} rows converged to NULL (no delete)`)
  }
}

async function phaseApply(t: Target): Promise<void> {
  const state = readState()
  if (!state.backup || !existsSync(state.backup.backupPath)) throw new Error("apply: no verified checkpoint — run 'backup' — STOP")
  await assertShape(t.query)

  // Freshness of the checkpoint against the live database.
  let drift = 0
  for (const [table, expected] of Object.entries(state.backup.rowCounts)) {
    if (Number((await t.query(`SELECT COUNT(*) c FROM "${table}"`))[0].c) !== expected) drift++
  }
  if (drift > 0) throw new Error(`apply: live database drifted from the checkpoint in ${drift} tables — STALE — STOP`)

  // Live re-classification must equal the recorded gate plan exactly.
  const fresh = await classifyD3(t.query)
  assertPlansEqual(state.plan, fresh.plan)
  if (fresh.plan.crossTenantMismatches !== 0) throw new Error("apply: cross-tenant mismatches != 0 before repairs — STOP")

  await executeRepairs(t, state.plan, fresh.assignments)

  // Global post-conditions: totals preserved, cross-tenant still 0.
  let totalDrift = 0
  for (const [table, expected] of Object.entries(state.backup.rowCounts)) {
    if (Number((await t.query(`SELECT COUNT(*) c FROM "${table}"`))[0].c) !== expected) totalDrift++
  }
  if (totalDrift > 0) throw new Error(`apply: ${totalDrift} tables changed total row count — repairs must be UPDATE-only — INCIDENT`)
  const crossTenant = await countCrossTenant(t.query)
  if (crossTenant !== 0) throw new Error(`apply: post-repair cross-tenant mismatches = ${crossTenant} — INCIDENT`)
  out(`[apply] complete: totalPlannedWrites=${state.plan.totalPlannedWrites} rowTotalsPreserved=yes crossTenant=0 deletes=0`)
}

async function phasePostAudit(t: Target): Promise<void> {
  await assertShape(t.query)
  const { plan } = await classifyD3(t.query)
  out(`[post-audit] ${JSON.stringify(plan)}`)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [phase, ...rest] = process.argv.slice(2)
  ;(async () => {
    const flags = parseFlags(rest)
    assertFlags(phase ?? "", flags)
    const url = process.env.TURSO_DATABASE_URL || ""
    const token = process.env.TURSO_AUTH_TOKEN || ""
    assertProductionUrl(url) // production pin + rehearsal refusal, shared with the D6 applier
    if (!token) throw new Error("d3 guard: TURSO_AUTH_TOKEN is not set — refusing to run")
    const t = await openLibsqlTarget(url, token)
    try {
      switch (phase) {
        case "classify": await phaseClassify(t); break
        case "backup": await phaseBackup(t); break
        case "verify-backup": await phaseVerifyBackup(t); break
        case "apply": await phaseApply(t); break
        case "post-audit": await phasePostAudit(t); break
        default:
          throw new Error("usage: tsx scripts/apply-core-03c-d3-deterministic-repairs.ts <classify|backup|verify-backup|apply|post-audit> --target-production [--owner-authorized]")
      }
    } finally {
      t.close()
    }
  })().catch((err) => {
    console.error(`[core03c-d3] ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  })
}
