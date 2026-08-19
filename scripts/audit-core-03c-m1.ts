/**
 * CORE-03C-M1 — read-only data & legacy audit (aggregate-only).
 *
 * Produces the evidence CORE-03C-M2 needs (decision doc §12 / M1 mission):
 * D2 retirement candidates, D5 column contents, legacy parallel concepts,
 * the two 2B link columns, and multitenant integrity — as COUNTS ONLY.
 *
 * READ-ONLY BY DESIGN, provable by review:
 *   - every SQL string must pass `assertReadOnlySql` (SELECT/PRAGMA only,
 *     single statement) before it is sent anywhere;
 *   - local SQLite files are opened with `readOnly: true`, so the engine
 *     itself rejects any write;
 *   - no INSERT/UPDATE/DELETE/DDL exists in this file;
 *   - no row content is ever emitted — only counts, min/max timestamps and
 *     length statistics. No names, emails, URLs or payload values.
 *   - no secret is printed: the datasource is echoed only as a kind label
 *     (never the URL or token).
 *
 * Target resolution (CLI):
 *   --db <path>          audit a local SQLite file (readOnly)
 *   $TURSO_DATABASE_URL / $DATABASE_URL
 *     file:...           treated as a local file (readOnly)
 *     libsql/https/wss   remote audit via @libsql/client — every statement
 *                        still passes the read-only guard; the credential is
 *                        read from the environment and never logged. NOTE:
 *                        a libsql token may technically permit writes; this
 *                        tool never issues one.
 *   (nothing)            exit 2 — evidence unavailable, never invented.
 *
 * Structures that do not exist yet in the audited database (e.g. the four
 * CANONICAL_ADD tables or the 2B link columns on a pre-adoption production
 * database) are captured as `TABLE_ABSENT` / `COLUMN_ABSENT` findings —
 * that absence is itself M1 evidence, not an error.
 */

/* eslint-disable @typescript-eslint/no-explicit-any -- SQL result rows are untyped */

import { readFileSync } from "node:fs"
import { join, resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

/** Single-statement SELECT/PRAGMA guard. Throws on anything else. */
export function assertReadOnlySql(sql: string): void {
  const trimmed = sql.trim()
  if (!/^(SELECT|PRAGMA)\b/i.test(trimmed)) {
    throw new Error(`read-only guard rejected statement: ${trimmed.slice(0, 40)}…`)
  }
  // No statement chaining: a semicolon may only appear at the very end.
  const inner = trimmed.endsWith(";") ? trimmed.slice(0, -1) : trimmed
  if (inner.includes(";")) {
    throw new Error("read-only guard rejected multi-statement SQL")
  }
}

export type QueryFn = (sql: string) => Promise<any[]>

/** Wraps a raw query runner with the read-only guard. */
export function guarded(run: QueryFn): QueryFn {
  return async (sql: string) => {
    assertReadOnlySql(sql)
    return run(sql)
  }
}

async function one(q: QueryFn, sql: string): Promise<any> {
  const rows = await q(sql)
  return rows[0] ?? null
}

/** Runs a section, converting missing-structure errors into explicit findings. */
async function section<T>(fn: () => Promise<T>): Promise<T | { unavailable: string }> {
  try {
    return await fn()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (/no such table: (\w+)/i.test(message)) return { unavailable: `TABLE_ABSENT: ${/no such table: (\w+)/i.exec(message)![1]}` }
    if (/no such column: ([\w.]+)/i.test(message)) return { unavailable: `COLUMN_ABSENT: ${/no such column: ([\w.]+)/i.exec(message)![1]}` }
    throw err
  }
}

const QR_MODULE_TARGETS: Record<string, string> = {
  clientes: "Cliente",
  proyectos: "Proyecto",
  tareas: "Tarea",
  facturacion: "Factura",
  documentos: "Documento",
}

interface FkDriftRef {
  child: string
  childColumn: string
  parent: string
  parentColumn: string
}

/** Parse the drift manifest's foreign-key entries into orphan-check targets. */
export function fkTargetsFromManifest(manifestPath: string): FkDriftRef[] {
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))
  const targets: FkDriftRef[] = []
  for (const e of manifest.entries as any[]) {
    if (e.kind !== "foreign-key" || e.direction !== "history-lacks") continue
    // identifier shape: Parent(from->to[,from2->to2])[update:…,delete:…]
    const m = /^(\w+)\(([\w>,-]+)\)\[/.exec(e.identifier ?? "")
    if (!m) continue
    const [, parent, pairs] = m
    const firstPair = pairs.split(",")[0]
    const [from, to] = firstPair.split("->")
    if (from && to) targets.push({ child: e.table, childColumn: from, parent, parentColumn: to })
  }
  // Deterministic order, no duplicates.
  const seen = new Set<string>()
  return targets
    .filter((t) => {
      const k = `${t.child}.${t.childColumn}->${t.parent}.${t.parentColumn}`
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .sort((a, b) => (`${a.child}.${a.childColumn}` < `${b.child}.${b.childColumn}` ? -1 : 1))
}

export interface AuditOptions {
  manifestPath?: string
}

export async function runAudit(rawQuery: QueryFn, options: AuditOptions = {}): Promise<Record<string, unknown>> {
  const q = guarded(rawQuery)
  const manifestPath = options.manifestPath ?? join(REPO_ROOT, "prisma", "migrations", "drift-manifest.json")

  const tablesPresent = new Set<string>(
    (await q("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")).map((r: any) => r.name),
  )

  const count = async (table: string): Promise<number | string> =>
    tablesPresent.has(table) ? Number((await one(q, `SELECT COUNT(*) c FROM "${table}"`)).c) : "TABLE_ABSENT"

  // ── Row counts for every M1-relevant table ────────────────────────────────
  const rowCounts: Record<string, number | string> = {}
  for (const t of [
    "Workspace", "WorkspaceMember", "Vertical", "User", "Usuario", "Cliente", "Proyecto", "Tarea",
    "WorkspaceTask", "InboxTodo", "InboxEntry", "Conversation", "Message", "Factura", "Documento",
    "QRCode", "ClientAuth", "ClientProject", "ClientInvoice", "ClientFile",
    "ClientAsset", "ClientRequest", "ClientRequestAsset", "ForteSnapshot",
  ]) {
    rowCounts[t] = await count(t)
  }

  // ── D2 — retirement candidates ────────────────────────────────────────────
  const d2: Record<string, unknown> = {}
  for (const t of ["ClientProject", "ClientInvoice", "ClientFile"]) {
    d2[t] = await section(async () => {
      if (!tablesPresent.has(t)) return { unavailable: `TABLE_ABSENT: ${t}` }
      const total = Number((await one(q, `SELECT COUNT(*) c FROM "${t}"`)).c)
      const clientes = Number((await one(q, `SELECT COUNT(DISTINCT "clienteId") c FROM "${t}"`)).c)
      const orphans = Number(
        (await one(q, `SELECT COUNT(*) c FROM "${t}" x LEFT JOIN "Cliente" p ON p."id" = x."clienteId" WHERE p."id" IS NULL`)).c,
      )
      const range = await one(q, `SELECT MIN("createdAt") oldest, MAX("createdAt") newest FROM "${t}"`)
      return { total, distinctClientes: clientes, orphanClienteRefs: orphans, oldest: range?.oldest ?? null, newest: range?.newest ?? null }
    })
  }

  // ── D5 — Factura.items ────────────────────────────────────────────────────
  const facturaItems = await section(async () => {
    const r = await one(
      q,
      `SELECT COUNT(*) total,
              SUM(CASE WHEN "items" IS NULL THEN 1 ELSE 0 END) nulls,
              SUM(CASE WHEN "items" = '' THEN 1 ELSE 0 END) empty,
              SUM(CASE WHEN "items" IS NOT NULL AND TRIM("items") = '' AND "items" <> '' THEN 1 ELSE 0 END) whitespaceOnly,
              SUM(CASE WHEN "items" IS NOT NULL AND TRIM("items") <> '' AND json_valid("items") = 1 THEN 1 ELSE 0 END) validJson,
              SUM(CASE WHEN "items" IS NOT NULL AND TRIM("items") <> '' AND json_valid("items") = 0 THEN 1 ELSE 0 END) invalidJson,
              SUM(CASE WHEN json_valid("items") = 1 AND json_type("items") = 'array' THEN 1 ELSE 0 END) jsonArrays,
              SUM(CASE WHEN json_valid("items") = 1 AND json_type("items") <> 'array' THEN 1 ELSE 0 END) jsonNonArrays,
              MIN(LENGTH("items")) minLen, MAX(LENGTH("items")) maxLen, CAST(AVG(LENGTH("items")) AS INTEGER) avgLen
         FROM "Factura"`,
    )
    return r
  })

  // ── D5 — Documento.url ────────────────────────────────────────────────────
  const documentoUrl = await section(async () => {
    const r = await one(
      q,
      `SELECT COUNT(*) total,
              SUM(CASE WHEN "url" IS NULL THEN 1 ELSE 0 END) nulls,
              SUM(CASE WHEN "url" = '' THEN 1 ELSE 0 END) empty,
              SUM(CASE WHEN "url" IS NOT NULL AND "url" <> '' AND TRIM("url") = '' THEN 1 ELSE 0 END) whitespaceOnly,
              SUM(CASE WHEN "url" LIKE 'https://%' THEN 1 ELSE 0 END) https,
              SUM(CASE WHEN "url" LIKE 'http://%' THEN 1 ELSE 0 END) http,
              SUM(CASE WHEN "url" LIKE '/%' THEN 1 ELSE 0 END) relative,
              SUM(CASE WHEN "url" LIKE '%vercel-storage%' OR "url" LIKE '%blob%' THEN 1 ELSE 0 END) blobProvider,
              SUM(CASE WHEN "url" IS NOT NULL AND TRIM("url") <> '' AND "url" NOT LIKE 'https://%' AND "url" NOT LIKE 'http://%' AND "url" NOT LIKE '/%' THEN 1 ELSE 0 END) otherShape
         FROM "Documento"`,
    )
    const dup = await one(
      q,
      `SELECT COUNT(*) c FROM (SELECT "url" FROM "Documento" WHERE "url" IS NOT NULL AND "url" <> '' GROUP BY "url" HAVING COUNT(*) > 1)`,
    )
    return { ...r, duplicateUrlGroups: Number(dup.c) }
  })

  // ── Legacy quartet ────────────────────────────────────────────────────────
  const legacy: Record<string, unknown> = {}
  for (const [t, wsColumn] of [
    ["Usuario", null],
    ["Tarea", "workspaceId"],
    ["InboxTodo", "workspaceId"],
    ["InboxEntry", "workspaceId"],
  ] as Array<[string, string | null]>) {
    legacy[t] = await section(async () => {
      if (!tablesPresent.has(t)) return { unavailable: `TABLE_ABSENT: ${t}` }
      const total = Number((await one(q, `SELECT COUNT(*) c FROM "${t}"`)).c)
      const range = await one(q, `SELECT MIN("createdAt") oldest, MAX("createdAt") newest FROM "${t}"`)
      const noWorkspace = wsColumn
        ? Number((await one(q, `SELECT COUNT(*) c FROM "${t}" WHERE "${wsColumn}" IS NULL`)).c)
        : "NOT_WORKSPACE_SCOPED"
      return { total, oldest: range?.oldest ?? null, newest: range?.newest ?? null, noWorkspace }
    })
  }

  // ── QRCode.workspaceId derivability ───────────────────────────────────────
  const qrAudit = await section(async () => {
    if (!tablesPresent.has("QRCode")) return { unavailable: "TABLE_ABSENT: QRCode" }
    const total = Number((await one(q, `SELECT COUNT(*) c FROM "QRCode"`)).c)
    const columnPresent = (await q(`PRAGMA table_info("QRCode")`)).some((c: any) => c.name === "workspaceId")
    const withWs = columnPresent
      ? Number((await one(q, `SELECT COUNT(*) c FROM "QRCode" WHERE "workspaceId" IS NOT NULL`)).c)
      : "COLUMN_ABSENT"
    const scopeFilter = columnPresent ? `WHERE x."workspaceId" IS NULL` : ""
    const byModule = await q(`SELECT "module", COUNT(*) c FROM "QRCode" GROUP BY "module" ORDER BY "module"`)
    const derivability: Record<string, unknown> = {}
    for (const row of byModule) {
      const moduleName = String(row.module)
      const target = QR_MODULE_TARGETS[moduleName]
      if (!target || !tablesPresent.has(target)) {
        derivability[moduleName] = { rows: Number(row.c), classification: "UNKNOWN", reason: target ? `target table absent` : "unmapped module" }
        continue
      }
      const counts = await one(
        q,
        `SELECT
           SUM(CASE WHEN p."id" IS NOT NULL AND p."workspaceId" IS NOT NULL THEN 1 ELSE 0 END) deterministic,
           SUM(CASE WHEN p."id" IS NOT NULL AND p."workspaceId" IS NULL THEN 1 ELSE 0 END) ambiguous,
           SUM(CASE WHEN p."id" IS NULL THEN 1 ELSE 0 END) orphaned
         FROM "QRCode" x LEFT JOIN "${target}" p ON p."id" = x."recordId"
         ${scopeFilter ? scopeFilter + " AND" : "WHERE"} x."module" = '${moduleName.replace(/'/g, "''")}'`,
      )
      derivability[moduleName] = {
        rows: Number(row.c),
        DETERMINISTIC: Number(counts?.deterministic ?? 0),
        AMBIGUOUS: Number(counts?.ambiguous ?? 0),
        ORPHANED: Number(counts?.orphaned ?? 0),
      }
    }
    return { total, workspaceIdColumnPresent: columnPresent, withWorkspaceId: withWs, byModuleDerivability: derivability }
  })

  // ── InboxTodo.workspaceTaskId mapping ────────────────────────────────────
  const inboxTodoAudit = await section(async () => {
    if (!tablesPresent.has("InboxTodo")) return { unavailable: "TABLE_ABSENT: InboxTodo" }
    const total = Number((await one(q, `SELECT COUNT(*) c FROM "InboxTodo"`)).c)
    const columnPresent = (await q(`PRAGMA table_info("InboxTodo")`)).some((c: any) => c.name === "workspaceTaskId")
    const linked = columnPresent
      ? Number((await one(q, `SELECT COUNT(*) c FROM "InboxTodo" WHERE "workspaceTaskId" IS NOT NULL`)).c)
      : "COLUMN_ABSENT"
    const scope = columnPresent ? `WHERE t."workspaceTaskId" IS NULL` : ""
    const mapping = await q(
      `SELECT CASE WHEN candidates = 1 THEN 'EXACT' WHEN candidates > 1 THEN 'AMBIGUOUS' ELSE 'NO_MATCH' END k, COUNT(*) c
         FROM (SELECT t."id",
                      (SELECT COUNT(*) FROM "WorkspaceTask" w
                        WHERE w."sourceType" = 'inbox_todo' AND w."sourceId" = t."id" AND w."workspaceId" = t."workspaceId") candidates
                 FROM "InboxTodo" t ${scope})
        GROUP BY k ORDER BY k`,
    )
    const classes: Record<string, number> = { EXACT: 0, AMBIGUOUS: 0, NO_MATCH: 0 }
    for (const row of mapping) classes[row.k] = Number(row.c)
    return { total, workspaceTaskIdColumnPresent: columnPresent, linked, unlinkedMapping: classes }
  })

  // ── Multitenant integrity ─────────────────────────────────────────────────
  const integrity: Record<string, unknown> = {}
  const nullWorkspace: Record<string, number> = {}
  const orphanWorkspace: Record<string, number> = {}
  for (const t of [...tablesPresent].sort()) {
    if (t === "Workspace" || t === "_prisma_migrations") continue
    const cols = await q(`PRAGMA table_info("${t}")`)
    if (!cols.some((c: any) => c.name === "workspaceId")) continue
    const nulls = Number((await one(q, `SELECT COUNT(*) c FROM "${t}" WHERE "workspaceId" IS NULL`)).c)
    if (nulls > 0) nullWorkspace[t] = nulls
    const orphans = Number(
      (await one(q, `SELECT COUNT(*) c FROM "${t}" x LEFT JOIN "Workspace" w ON w."id" = x."workspaceId" WHERE x."workspaceId" IS NOT NULL AND w."id" IS NULL`)).c,
    )
    if (orphans > 0) orphanWorkspace[t] = orphans
  }
  integrity.rowsWithoutWorkspace = nullWorkspace
  integrity.rowsWithNonexistentWorkspace = orphanWorkspace

  // FK orphans + cross-tenant mismatches, driven by the drift manifest.
  const fkOrphans: Record<string, number> = {}
  const crossTenant: Record<string, number> = {}
  for (const fk of fkTargetsFromManifest(manifestPath)) {
    if (!tablesPresent.has(fk.child) || !tablesPresent.has(fk.parent)) continue
    const key = `${fk.child}.${fk.childColumn} -> ${fk.parent}.${fk.parentColumn}`
    const orphan = await section(async () =>
      Number(
        (await one(
          q,
          `SELECT COUNT(*) c FROM "${fk.child}" x LEFT JOIN "${fk.parent}" p ON p."${fk.parentColumn}" = x."${fk.childColumn}"
            WHERE x."${fk.childColumn}" IS NOT NULL AND p."${fk.parentColumn}" IS NULL`,
        )).c,
      ),
    )
    if (typeof orphan === "number") {
      if (orphan > 0) fkOrphans[key] = orphan
    } else {
      fkOrphans[key] = -1 // structure absent; recorded via section marker below
    }
    // Cross-tenant: both sides carry workspaceId and disagree.
    const childCols = await q(`PRAGMA table_info("${fk.child}")`)
    const parentCols = await q(`PRAGMA table_info("${fk.parent}")`)
    if (childCols.some((c: any) => c.name === "workspaceId") && parentCols.some((c: any) => c.name === "workspaceId")) {
      const mismatch = await section(async () =>
        Number(
          (await one(
            q,
            `SELECT COUNT(*) c FROM "${fk.child}" x JOIN "${fk.parent}" p ON p."${fk.parentColumn}" = x."${fk.childColumn}"
              WHERE x."workspaceId" IS NOT NULL AND p."workspaceId" IS NOT NULL AND x."workspaceId" <> p."workspaceId"`,
          )).c,
        ),
      )
      if (typeof mismatch === "number" && mismatch > 0) crossTenant[key] = mismatch
    }
  }
  integrity.fkOrphans = fkOrphans
  integrity.crossTenantMismatches = crossTenant

  return {
    rowCounts,
    d2RetirementCandidates: d2,
    d5FacturaItems: facturaItems,
    d5DocumentoUrl: documentoUrl,
    legacyParallelConcepts: legacy,
    qrWorkspaceAudit: qrAudit,
    inboxTodoWorkspaceTaskAudit: inboxTodoAudit,
    multitenantIntegrity: integrity,
  }
}

/** Audit a local SQLite file, opened read-only so writes are impossible. */
export async function auditSqliteFile(dbPath: string, options: AuditOptions = {}): Promise<Record<string, unknown>> {
  const { DatabaseSync } = await import("node:sqlite")
  const db = new DatabaseSync(dbPath, { readOnly: true })
  try {
    return await runAudit(async (sql) => db.prepare(sql).all(), options)
  } finally {
    db.close()
  }
}

/** Audit a remote libsql database. Read-only enforced by the SQL guard. */
export async function auditLibsqlUrl(url: string, authToken: string | undefined, options: AuditOptions = {}): Promise<Record<string, unknown>> {
  const { createClient } = await import("@libsql/client")
  const client = createClient({ url, authToken })
  try {
    return await runAudit(async (sql) => {
      const result = await client.execute(sql)
      return result.rows as any[]
    }, options)
  } finally {
    client.close()
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const dbFlag = process.argv.indexOf("--db")
  const explicitPath = dbFlag !== -1 ? process.argv[dbFlag + 1] : undefined
  const envUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL

  const emit = (label: string, report: Record<string, unknown>) => {
    process.stdout.write(JSON.stringify({ datasource: label, generatedBy: "scripts/audit-core-03c-m1.ts", report }, null, 2) + "\n")
  }

  const fail = (message: string, code: number) => {
    console.error(`[audit-m1] ${message}`)
    process.exit(code)
  }

  ;(async () => {
    if (explicitPath) {
      emit("LOCAL_FILE (path via --db)", await auditSqliteFile(explicitPath))
    } else if (envUrl?.startsWith("file:")) {
      emit("LOCAL_FILE (from environment)", await auditSqliteFile(envUrl.slice("file:".length)))
    } else if (envUrl) {
      // Remote: never print the URL or token. The credential may technically
      // permit writes; this tool only ever issues guarded SELECT/PRAGMA.
      emit("REMOTE_LIBSQL (credentials from environment, redacted)", await auditLibsqlUrl(envUrl, process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN))
    } else {
      fail("no datasource available: pass --db <sqlite file> or provide TURSO_DATABASE_URL/DATABASE_URL. Evidence must not be invented.", 2)
    }
  })().catch((err) => fail(err instanceof Error ? err.message : String(err), 1))
}
