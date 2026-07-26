/**
 * Turso schema provisioning — derived from `prisma/schema.prisma`.
 *
 * WHY THIS EXISTS
 * ---------------
 * Prisma's migration engine cannot talk to a remote Turso database directly:
 * the datasource in `schema.prisma` is `sqlite` (a `file:` URL) and the
 * migration engine has no `libsql://` connector. Historically this was worked
 * around by hand-writing every `CREATE TABLE` / `CREATE INDEX` into
 * `push-turso.ts`, which then drifted from `schema.prisma` (42 vs 52 tables).
 *
 * This module removes the manual list: it asks the Prisma CLI to render the
 * canonical DDL for the CURRENT `schema.prisma` (`migrate diff --from-empty
 * --to-schema`), makes each statement idempotent, and lets a libsql client
 * apply it. `schema.prisma` stays the single source of truth; there is no
 * parallel SQL artifact to keep in sync.
 *
 * The pieces here are pure/inspectable so they can be unit-tested and reused
 * by the drift detector (`scripts/turso-schema-drift.test.ts`).
 */

import { execFileSync } from "node:child_process"

/** A resolved provisioning target, with credentials kept out of logs. */
export interface TursoTarget {
  /** Full connection URL (contains no token; the token is separate). */
  url: string
  /** Auth token, if any. Never logged. */
  authToken?: string
  /** First host label, e.g. `sevenef-mr-forte-lab-7frames`. Safe to log. */
  dbName: string
  /** Which env var supplied the URL (for transparent logging). */
  urlSource: "TURSO_DATABASE_URL" | "DATABASE_URL"
  /** Heuristic: does the name look like a production database? */
  looksLikeProduction: boolean
}

/**
 * Environment variable precedence (documented, deliberate):
 *
 *   URL:   TURSO_DATABASE_URL  →  DATABASE_URL (only when it is a libsql:// URL)
 *   TOKEN: TURSO_AUTH_TOKEN    →  DATABASE_AUTH_TOKEN
 *
 * This is intentionally the OPPOSITE default from `core/db.ts` (which prefers
 * `DATABASE_URL`). This is a Turso-specific provisioning tool: a local
 * `DATABASE_URL=file:./dev.db` must never be mistaken for the remote target,
 * so `TURSO_DATABASE_URL` wins and a non-libsql `DATABASE_URL` is ignored.
 */
export function resolveTursoTarget(env: NodeJS.ProcessEnv = process.env): TursoTarget {
  let url: string | undefined
  let urlSource: TursoTarget["urlSource"] | undefined

  if (env.TURSO_DATABASE_URL) {
    url = env.TURSO_DATABASE_URL
    urlSource = "TURSO_DATABASE_URL"
  } else if (env.DATABASE_URL && env.DATABASE_URL.startsWith("libsql://")) {
    url = env.DATABASE_URL
    urlSource = "DATABASE_URL"
  }

  if (!url || !urlSource) {
    throw new Error(
      "No Turso target configured. Set TURSO_DATABASE_URL to a libsql:// URL " +
        "(or DATABASE_URL to a libsql:// URL). A file: DATABASE_URL is ignored " +
        "on purpose so local dev is never provisioned as Turso.",
    )
  }

  if (!url.startsWith("libsql://")) {
    throw new Error(
      `Turso target must be a libsql:// URL (got "${url.split("://")[0]}://…"). ` +
        "Point TURSO_DATABASE_URL at the remote database.",
    )
  }

  const authToken =
    urlSource === "TURSO_DATABASE_URL"
      ? env.TURSO_AUTH_TOKEN || env.DATABASE_AUTH_TOKEN
      : env.DATABASE_AUTH_TOKEN || env.TURSO_AUTH_TOKEN

  const dbName = databaseNameFromUrl(url)

  return {
    url,
    authToken,
    dbName,
    urlSource,
    looksLikeProduction: looksLikeProduction(dbName),
  }
}

/** Extract the first host label from a libsql:// URL (no credentials). */
export function databaseNameFromUrl(url: string): string {
  const withoutScheme = url.replace(/^[a-z]+:\/\//i, "")
  const host = withoutScheme.split("/")[0]
  return host.split(".")[0] || host
}

/**
 * Heuristic production guard. Flags names that look like the production `7f`
 * database (or anything explicitly marked prod). Deliberately does NOT flag
 * lab/preview/dev/staging names (e.g. `sevenef-mr-forte-lab-*`).
 */
export function looksLikeProduction(dbName: string): boolean {
  const name = dbName.toLowerCase()
  if (/(^|[-_])(lab|preview|dev|develop|development|staging|test|sandbox)([-_]|$)/.test(name)) {
    return false
  }
  return (
    /^7f([-_]|$)/.test(name) ||
    /(^|[-_])prod(uction)?([-_]|$)/.test(name) ||
    /sevenef[-_]?prod/.test(name)
  )
}

/**
 * Throw unless the target is safe to write. A production-looking target is
 * refused unless `TURSO_PROVISION_ALLOW_PRODUCTION` exactly equals its name
 * (reinforced, opt-in override — no global "force" switch).
 */
export function assertWritableTarget(
  target: TursoTarget,
  env: NodeJS.ProcessEnv = process.env,
): void {
  if (!target.looksLikeProduction) return
  const override = env.TURSO_PROVISION_ALLOW_PRODUCTION
  if (override && override === target.dbName) return
  throw new Error(
    `Refusing to provision "${target.dbName}": the name looks like PRODUCTION. ` +
      `If this is intentional, set TURSO_PROVISION_ALLOW_PRODUCTION="${target.dbName}".`,
  )
}

/**
 * Render the canonical schema DDL from `schema.prisma` via the Prisma CLI.
 * This is the single source of truth for every table/index the deploy creates.
 */
export function generateCanonicalDdl(schemaPath = "prisma/schema.prisma"): string {
  const out = execFileSync(
    "npx",
    ["--no-install", "prisma", "migrate", "diff", "--from-empty", "--to-schema", schemaPath, "--script"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 32 * 1024 * 1024 },
  )
  const ddl = out.trim()
  if (!/CREATE TABLE/i.test(ddl)) {
    throw new Error(
      "Prisma produced no DDL. Is the Prisma CLI available and schema.prisma valid?",
    )
  }
  return ddl
}

/**
 * Make canonical DDL safe to re-apply: add `IF NOT EXISTS` to every
 * `CREATE TABLE` / `CREATE [UNIQUE] INDEX`. Purely additive — never drops.
 */
export function toIdempotentDdl(ddl: string): string {
  return ddl
    .replace(/^CREATE TABLE "/gm, 'CREATE TABLE IF NOT EXISTS "')
    .replace(/^CREATE UNIQUE INDEX "/gm, 'CREATE UNIQUE INDEX IF NOT EXISTS "')
    .replace(/^CREATE INDEX "/gm, 'CREATE INDEX IF NOT EXISTS "')
}

/** A parsed table definition from the canonical DDL. */
export interface ParsedTable {
  name: string
  /** Column name → the full column definition line (without trailing comma). */
  columns: Map<string, string>
}

/** Parse `CREATE TABLE` blocks into { name, columns } from canonical DDL. */
export function parseTables(ddl: string): ParsedTable[] {
  const tables: ParsedTable[] = []
  const tableRe = /CREATE TABLE(?: IF NOT EXISTS)? "([^"]+)"\s*\(([\s\S]*?)\n\);/g
  let m: RegExpExecArray | null
  while ((m = tableRe.exec(ddl))) {
    const [, name, body] = m
    const columns = new Map<string, string>()
    for (const rawLine of body.split("\n")) {
      const line = rawLine.trim().replace(/,$/, "")
      const col = line.match(/^"([^"]+)"\s+(.+)$/)
      // Skip table-level constraints (FOREIGN KEY, PRIMARY KEY (...), etc.).
      if (col && !/^(CONSTRAINT|FOREIGN|PRIMARY|UNIQUE|CHECK)\b/i.test(line)) {
        columns.set(col[1], `"${col[1]}" ${col[2]}`)
      }
    }
    tables.push({ name, columns })
  }
  return tables
}

/** Collect object names the DDL creates, for reporting and drift checks. */
export function parseObjectNames(ddl: string): { tables: string[]; indexes: string[] } {
  const tables: string[] = []
  const indexes: string[] = []
  for (const m of ddl.matchAll(/CREATE TABLE(?: IF NOT EXISTS)? "([^"]+)"/g)) tables.push(m[1])
  for (const m of ddl.matchAll(/CREATE (?:UNIQUE )?INDEX(?: IF NOT EXISTS)? "([^"]+)"/g)) indexes.push(m[1])
  return { tables, indexes }
}

/** Model (= table) names declared in `schema.prisma` — the source of truth. */
export function parseSchemaModels(schemaSource: string): string[] {
  const models: string[] = []
  for (const m of schemaSource.matchAll(/^model\s+(\w+)\s*\{/gm)) {
    // A `@@map("name")` would rename the table; assert none slipped in.
    models.push(m[1])
  }
  return models
}

/**
 * Minimal libsql-client surface used by the provisioner. Both the real
 * `@libsql/client` and a local file-backed test client satisfy it.
 */
export interface SqlExecutor {
  execute(sql: string): Promise<{ rows: Array<Record<string, unknown>> }>
  executeMultiple(sql: string): Promise<void>
}

export interface ProvisionReport {
  tables: string[]
  indexes: string[]
  /** Columns added to tables that already existed (schema evolution). */
  addedColumns: string[]
  /** Non-fatal issues (e.g. a NOT NULL column that could not be back-filled). */
  warnings: string[]
}

/** Split idempotent DDL into table statements and index statements. */
export function splitDdlStatements(ddl: string): { tableDdl: string; indexDdl: string } {
  const statements = ddl
    .split(/;\s*$/m)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter(Boolean)
  const tableDdl: string[] = []
  const indexDdl: string[] = []
  for (const s of statements) {
    if (/^CREATE\s+(?:UNIQUE\s+)?INDEX/i.test(s)) indexDdl.push(`${s};`)
    else tableDdl.push(`${s};`)
  }
  return { tableDdl: tableDdl.join("\n"), indexDdl: indexDdl.join("\n") }
}

/**
 * Apply the canonical schema to `client`, idempotently, in three ordered
 * phases:
 *   1. `CREATE TABLE IF NOT EXISTS` for every table.
 *   2. `ALTER TABLE ADD COLUMN` for columns missing from tables that already
 *      existed (so an older database converges to the current schema).
 *   3. `CREATE [UNIQUE] INDEX IF NOT EXISTS` for every index.
 *
 * Indexes come last on purpose: an index may reference a column that phase 2
 * has just added, and creating it earlier would fail with "no such column".
 *
 * Never drops or rewrites existing objects, so it is safe to re-run and never
 * destroys data. Column additions that SQLite cannot perform automatically
 * (e.g. a NOT NULL column without a default on a populated table) are reported
 * as warnings rather than aborting the whole run.
 */
export async function provisionSchema(client: SqlExecutor, ddl: string): Promise<ProvisionReport> {
  const idempotent = toIdempotentDdl(ddl)
  const { tableDdl, indexDdl } = splitDdlStatements(idempotent)

  // Phase 1 — tables.
  await client.executeMultiple(`PRAGMA foreign_keys=OFF;\n${tableDdl}`)

  // Phase 2 — reconcile columns on pre-existing tables.
  const addedColumns: string[] = []
  const warnings: string[] = []
  for (const table of parseTables(ddl)) {
    const info = await client.execute(`PRAGMA table_info("${table.name}")`)
    const existing = new Set(info.rows.map((r) => String(r.name)))
    for (const [col, def] of table.columns) {
      if (existing.has(col)) continue
      try {
        await client.execute(`ALTER TABLE "${table.name}" ADD COLUMN ${def}`)
        addedColumns.push(`${table.name}.${col}`)
      } catch (err) {
        warnings.push(
          `Could not add column ${table.name}.${col}: ${err instanceof Error ? err.message : String(err)}`,
        )
      }
    }
  }

  // Phase 3 — indexes, now that every column they reference exists.
  if (indexDdl) await client.executeMultiple(`PRAGMA foreign_keys=OFF;\n${indexDdl}`)

  const { tables, indexes } = parseObjectNames(idempotent)
  return { tables, indexes, addedColumns, warnings }
}
