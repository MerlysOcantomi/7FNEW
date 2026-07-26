/**
 * Turso schema provisioning — derived from `prisma/schema.prisma`.
 *
 * WHAT THIS IS
 * ------------
 * An **additive bootstrap** tool, not a migration engine. Prisma's migration
 * engine cannot talk to a remote Turso database (the datasource in
 * `schema.prisma` is `sqlite`/`file:` and the engine has no `libsql://`
 * connector), so this module:
 *
 *   1. asks the Prisma CLI to render the canonical DDL for the CURRENT
 *      `schema.prisma` (`migrate diff --from-empty --to-schema --script`);
 *   2. materialises that DDL in a throwaway LOCAL SQLite file and introspects
 *      it — that introspection, not a regex over the DDL text, is the
 *      canonical structure;
 *   3. introspects the target database with the same code;
 *   4. compares the two structures and splits the differences into
 *      *supported additive* work and *everything else*;
 *   5. applies only the additive work, then re-introspects and proves the
 *      target now matches the canonical structure.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 * --------------------------------
 * It never drops, rewrites or rebuilds an existing table. Any non-additive
 * difference (type / nullability / default / primary key change, a new or
 * changed foreign key on an existing table, a renamed or removed table or
 * column, an incompatible index) aborts with `manual migration required`
 * BEFORE anything is written. See `docs/turso-schema-deploy.md`.
 *
 * Every exported piece is pure or takes an injected client, so the drift
 * detector (`scripts/turso-schema-drift.test.ts`) exercises the real code.
 */

import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

import { createClient } from "@libsql/client"

/** Repository root, resolved from this module's own location (never `cwd`). */
export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..")

// ---------------------------------------------------------------------------
// Logging hygiene
// ---------------------------------------------------------------------------

/**
 * Strip anything credential-shaped from text that is about to be logged or
 * embedded in an error message. Applied to every child-process stderr.
 */
export function sanitizeForLog(text: string): string {
  return text
    .replace(/\b[a-z+]*sql:\/\/\S*/gi, "<redacted-url>")
    .replace(/\bhttps?:\/\/[^\s/]*:[^\s/]*@\S*/gi, "<redacted-url>")
    .replace(/\b(authToken|auth_token|token|password|secret)\s*[=:]\s*\S+/gi, "$1=<redacted>")
    .replace(/\bBearer\s+\S+/gi, "Bearer <redacted>")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "<redacted-jwt>")
}

// ---------------------------------------------------------------------------
// Target resolution & the conservative production guard
// ---------------------------------------------------------------------------

/**
 * A database is provisioned automatically ONLY when its name carries one of
 * these markers as a whole token (split on `-`, `_`, `.`). Anything else —
 * including every name we do not recognise — is treated as production.
 */
export const SAFE_ENVIRONMENT_MARKERS = [
  "lab",
  "preview",
  "dev",
  "develop",
  "development",
  "staging",
  "test",
  "sandbox",
] as const

/**
 * Tokens that mark a database as production even when a safe marker is also
 * present (`7f-prod-test` is production, not a test database).
 */
export const PRODUCTION_MARKERS = ["prod", "production", "live", "main", "master"] as const

/**
 * The subset of the environment this module reads. Looser than
 * `NodeJS.ProcessEnv` (which Next.js augments with required keys) so tests can
 * pass a small literal.
 */
export type ProvisionEnv = Record<string, string | undefined>

export interface TargetClassification {
  /** True only when the name carries an unambiguous non-production marker. */
  safe: boolean
  /** Human-readable justification, safe to log. */
  reason: string
}

/** Split a database name into comparable tokens. */
function nameTokens(dbName: string): string[] {
  return dbName.toLowerCase().split(/[-_.]+/).filter(Boolean)
}

/**
 * Conservative, allow-list classification. Unknown ⇒ production ⇒ blocked.
 * Never guesses in the permissive direction.
 */
export function classifyDatabaseName(dbName: string): TargetClassification {
  const tokens = nameTokens(dbName)

  const production = tokens.find((t) => (PRODUCTION_MARKERS as readonly string[]).includes(t))
  if (production) {
    return { safe: false, reason: `name carries the production marker "${production}"` }
  }

  const safe = tokens.find((t) => (SAFE_ENVIRONMENT_MARKERS as readonly string[]).includes(t))
  if (safe) {
    return { safe: true, reason: `name carries the non-production marker "${safe}"` }
  }

  return {
    safe: false,
    reason:
      "name carries no explicit non-production marker " +
      `(expected one of: ${SAFE_ENVIRONMENT_MARKERS.join(", ")})`,
  }
}

export interface ParsedTursoUrl {
  /** Sanitized connection URL: scheme, host and port only. */
  url: string
  /** Hostname, e.g. `sevenef-mr-forte-lab.aws-eu-west-1.turso.io`. */
  host: string
  /** First host label — the database name. Safe to log. */
  dbName: string
}

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i
const DB_NAME_RE = /^[a-z0-9][a-z0-9_-]*$/i

/**
 * Parse a `libsql://` URL strictly with `new URL()`. Rejects everything
 * ambiguous, and never echoes the input back (it may carry credentials).
 *
 * @param source name of the environment variable the value came from — the
 *   only part of the input that is safe to put in an error message.
 */
export function parseTursoUrl(raw: string, source: string): ParsedTursoUrl {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(`${source} is not a valid URL. Expected libsql://<database>-<org>.turso.io`)
  }

  if (parsed.protocol !== "libsql:") {
    throw new Error(
      `${source} must use the libsql: protocol (got "${parsed.protocol}"). ` +
        "A file: URL is refused on purpose so local dev is never provisioned as Turso.",
    )
  }
  if (parsed.username || parsed.password) {
    throw new Error(
      `${source} embeds credentials in the URL (user:password@). Refusing to continue: ` +
        "the database name cannot be identified safely and the value would leak into logs. " +
        "Pass the token via TURSO_AUTH_TOKEN instead.",
    )
  }
  if (parsed.search) {
    throw new Error(
      `${source} carries query parameters. Refusing to continue: they may contain a token ` +
        "and would leak into logs. Pass the token via TURSO_AUTH_TOKEN instead.",
    )
  }
  if (parsed.pathname && parsed.pathname !== "/") {
    throw new Error(
      `${source} has an unexpected path component. Expected libsql://<database>-<org>.turso.io`,
    )
  }

  const host = parsed.hostname
  if (!host) throw new Error(`${source} has an empty hostname.`)
  if (/^\d+(\.\d+)*$/.test(host) || host.startsWith("[")) {
    throw new Error(
      `${source} points at an IP literal, so no database name can be derived from it. ` +
        "Expected libsql://<database>-<org>.turso.io",
    )
  }
  if (!HOSTNAME_RE.test(host)) {
    throw new Error(
      `${source} has an ambiguous hostname (IP literals and non-DNS hosts are refused). ` +
        "Expected libsql://<database>-<org>.turso.io",
    )
  }

  const dbName = host.split(".")[0]
  if (!dbName || !DB_NAME_RE.test(dbName)) {
    throw new Error(`${source} has a hostname whose first label is not a usable database name.`)
  }

  return { url: `libsql://${host}${parsed.port ? `:${parsed.port}` : ""}`, host, dbName }
}

export interface TursoTarget {
  /** Sanitized URL (scheme + host + port). Contains no credentials. */
  url: string
  /** Auth token, if any. Never logged. */
  authToken?: string
  /** First host label, e.g. `sevenef-mr-forte-lab`. Safe to log. */
  dbName: string
  /** Which env var supplied the URL (for transparent logging). */
  urlSource: "TURSO_DATABASE_URL" | "DATABASE_URL"
  /** Which env var supplied the token, if any. */
  tokenSource?: "TURSO_AUTH_TOKEN" | "DATABASE_AUTH_TOKEN"
  /** Conservative environment classification. */
  classification: TargetClassification
}

/**
 * Environment variable precedence (documented, deliberate):
 *
 *   URL:   TURSO_DATABASE_URL  →  DATABASE_URL (only when it is a libsql:// URL)
 *   TOKEN: paired with whichever variable supplied the URL —
 *            URL from TURSO_DATABASE_URL → TURSO_AUTH_TOKEN, then DATABASE_AUTH_TOKEN
 *            URL from DATABASE_URL       → DATABASE_AUTH_TOKEN, then TURSO_AUTH_TOKEN
 *
 * Pairing the token with its URL avoids sending one database's token to
 * another. This is intentionally the OPPOSITE default from `core/db.ts` (which
 * prefers `DATABASE_URL`): this is a Turso-specific provisioning tool, so a
 * local `DATABASE_URL=file:./dev.db` must never be mistaken for the remote
 * target.
 */
export function resolveTursoTarget(env: ProvisionEnv = process.env): TursoTarget {
  let raw: string | undefined
  let urlSource: TursoTarget["urlSource"] | undefined

  if (env.TURSO_DATABASE_URL) {
    raw = env.TURSO_DATABASE_URL
    urlSource = "TURSO_DATABASE_URL"
  } else if (env.DATABASE_URL && env.DATABASE_URL.startsWith("libsql://")) {
    raw = env.DATABASE_URL
    urlSource = "DATABASE_URL"
  }

  if (!raw || !urlSource) {
    throw new Error(
      "No Turso target configured. Set TURSO_DATABASE_URL to a libsql:// URL " +
        "(or DATABASE_URL to a libsql:// URL). A file: DATABASE_URL is ignored " +
        "on purpose so local dev is never provisioned as Turso.",
    )
  }

  const { url, dbName } = parseTursoUrl(raw, urlSource)

  const tokenOrder: Array<NonNullable<TursoTarget["tokenSource"]>> =
    urlSource === "TURSO_DATABASE_URL"
      ? ["TURSO_AUTH_TOKEN", "DATABASE_AUTH_TOKEN"]
      : ["DATABASE_AUTH_TOKEN", "TURSO_AUTH_TOKEN"]
  const tokenSource = tokenOrder.find((name) => env[name])

  return {
    url,
    authToken: tokenSource ? env[tokenSource] : undefined,
    dbName,
    urlSource,
    tokenSource,
    classification: classifyDatabaseName(dbName),
  }
}

/**
 * Throw unless the target is safe to write. A target that is not classified as
 * a non-production environment is refused unless
 * `TURSO_PROVISION_ALLOW_PRODUCTION` exactly equals its name (reinforced,
 * opt-in override — there is no global "force" switch).
 */
export function assertWritableTarget(
  target: TursoTarget,
  env: ProvisionEnv = process.env,
): void {
  if (target.classification.safe) return
  if (env.TURSO_PROVISION_ALLOW_PRODUCTION === target.dbName) return
  throw new Error(
    `Refusing to provision "${target.dbName}": ${target.classification.reason}. ` +
      "Only databases explicitly marked as a non-production environment " +
      `(${SAFE_ENVIRONMENT_MARKERS.join(", ")}) are provisioned automatically. ` +
      `If this is intentional, set TURSO_PROVISION_ALLOW_PRODUCTION="${target.dbName}".`,
  )
}

// ---------------------------------------------------------------------------
// Canonical DDL generation (cwd-independent)
// ---------------------------------------------------------------------------

export interface GenerateDdlOptions {
  /** Schema path, absolute or relative to `projectRoot`. */
  schemaPath?: string
  /** Repository root. Defaults to this module's own repository. */
  projectRoot?: string
}

/**
 * Render the canonical schema DDL from `schema.prisma` via the locally
 * installed Prisma CLI.
 *
 * Resolves the schema and the CLI from `projectRoot` (derived from this
 * module's location, not from `cwd`), runs the CLI through `process.execPath`
 * with an explicit `cwd`, and never reaches the network: no `npx` lookup, no
 * global install, no version check.
 */
export function generateCanonicalDdl(options: GenerateDdlOptions = {}): string {
  const projectRoot = options.projectRoot ?? PROJECT_ROOT
  const schemaPath = resolve(projectRoot, options.schemaPath ?? "prisma/schema.prisma")
  const cli = join(projectRoot, "node_modules", "prisma", "build", "index.js")

  if (!existsSync(schemaPath)) {
    throw new Error(`Prisma schema not found at ${schemaPath} (project root: ${projectRoot}).`)
  }
  if (!existsSync(cli)) {
    throw new Error(
      `Prisma CLI not found at ${cli}. Run \`npm ci\` in ${projectRoot} — ` +
        "the CLI is never downloaded on demand.",
    )
  }

  let out: string
  try {
    out = execFileSync(
      process.execPath,
      [cli, "migrate", "diff", "--from-empty", "--to-schema", schemaPath, "--script"],
      {
        cwd: projectRoot,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        maxBuffer: 32 * 1024 * 1024,
        env: { ...process.env, CHECKPOINT_DISABLE: "1", PRISMA_HIDE_UPDATE_MESSAGE: "1" },
      },
    )
  } catch (err) {
    const e = err as { status?: number | null; stderr?: string | Buffer }
    const stderr = e.stderr ? sanitizeForLog(String(e.stderr)).trim() : "(no stderr)"
    throw new Error(
      "Prisma failed to render the canonical DDL.\n" +
        `  schema:       ${schemaPath}\n` +
        `  project root: ${projectRoot}\n` +
        `  exit status:  ${e.status ?? "unknown"}\n` +
        "  stderr:\n" +
        stderr.replace(/^/gm, "    "),
    )
  }

  const ddl = out.trim()
  if (!ddl) throw new Error(`Prisma produced an empty DDL for ${schemaPath}.`)
  return ddl
}

// ---------------------------------------------------------------------------
// SQL statement scanning (no format-sensitive regexes)
// ---------------------------------------------------------------------------

/**
 * Split a SQL script into statements with a real scanner: string literals,
 * quoted identifiers and comments are respected, so a `;` or `--` inside a
 * literal never splits or truncates a statement.
 */
export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = []
  let current = ""
  let i = 0

  while (i < sql.length) {
    const ch = sql[i]

    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch
      current += ch
      i++
      while (i < sql.length) {
        current += sql[i]
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            current += sql[i + 1]
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      continue
    }

    if (ch === "[") {
      current += ch
      i++
      while (i < sql.length && sql[i] !== "]") current += sql[i++]
      if (i < sql.length) current += sql[i++]
      continue
    }

    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++
      continue
    }

    if (ch === "/" && sql[i + 1] === "*") {
      i += 2
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++
      i += 2
      continue
    }

    if (ch === ";") {
      if (current.trim()) statements.push(current.trim())
      current = ""
      i++
      continue
    }

    current += ch
    i++
  }

  if (current.trim()) statements.push(current.trim())
  return statements
}

export type DdlStatementKind = "table" | "index" | "pragma"

export interface ClassifiedStatement {
  kind: DdlStatementKind
  sql: string
}

/**
 * Classify every statement of the canonical DDL. Unknown statement classes are
 * a hard error — they are never silently treated as tables, because a future
 * Prisma release emitting e.g. `CREATE TRIGGER` or `ALTER TABLE` would
 * otherwise be applied blindly by a bootstrap tool that cannot reason about it.
 */
export function classifyDdlStatements(ddl: string): ClassifiedStatement[] {
  const classified: ClassifiedStatement[] = []
  const unknown: string[] = []

  for (const sql of splitSqlStatements(ddl)) {
    const head = sql.replace(/\s+/g, " ").trim()
    if (/^CREATE\s+TABLE\b/i.test(head)) classified.push({ kind: "table", sql })
    else if (/^CREATE\s+(UNIQUE\s+)?INDEX\b/i.test(head)) classified.push({ kind: "index", sql })
    else if (/^PRAGMA\b/i.test(head)) classified.push({ kind: "pragma", sql })
    else unknown.push(head.slice(0, 120))
  }

  if (unknown.length) {
    throw new Error(
      "manual migration required — the canonical DDL contains statement classes this " +
        "additive bootstrap tool does not support:\n" +
        unknown.map((s) => `  - ${s}…`).join("\n") +
        "\nApply these by hand and extend prisma/turso-schema.ts before re-running.",
    )
  }
  if (!classified.some((s) => s.kind === "table")) {
    throw new Error("Canonical DDL contains no CREATE TABLE statements. Is schema.prisma valid?")
  }
  return classified
}

/** Model (= table) names declared in `schema.prisma` — an independent source. */
export function parseSchemaModels(schemaSource: string): string[] {
  return [...schemaSource.matchAll(/^model\s+(\w+)\s*\{/gm)].map((m) => m[1])
}

/**
 * Explicit non-support guard for `@@map`.
 *
 * Everything the provisioner does is derived from the DDL, so a `@@map` would
 * be applied correctly — but the drift detector's independent cross-check
 * ("every model in schema.prisma exists as a table") assumes model name ===
 * table name. Rather than let that check silently compare the wrong things,
 * `@@map` is refused until the cross-check is taught about it.
 *
 * Field-level `@map` is fully supported: the physical column name comes from
 * the DDL on both sides of every comparison.
 */
export function assertModelNamesMatchTables(schemaSource: string): void {
  const mapped = [...schemaSource.matchAll(/^\s*@@map\s*\(\s*"([^"]*)"/gm)].map((m) => m[1])
  if (mapped.length) {
    throw new Error(
      `schema.prisma uses @@map (${mapped.join(", ")}), so a model name is no longer its table ` +
        "name. The Turso drift detector's model↔table cross-check must be updated before this " +
        "can land — see scripts/turso-schema-drift.test.ts.",
    )
  }
}

// ---------------------------------------------------------------------------
// Structural introspection
// ---------------------------------------------------------------------------

/** Minimal libsql-client surface used here. */
export interface SqlExecutor {
  execute(sql: string): Promise<{ rows: Array<Record<string, unknown>> }>
  executeMultiple(sql: string): Promise<void>
}

export interface ColumnStructure {
  name: string
  /** Declared type, normalized (upper-case, whitespace collapsed). */
  type: string
  notNull: boolean
  /** Default expression as SQLite reports it, normalized. */
  defaultValue: string | null
  /** 1-based position within the primary key; 0 when not part of it. */
  pkPosition: number
  /** `PRAGMA table_xinfo` hidden flag (0 normal, 2/3 generated, 1 virtual). */
  hidden: number
}

export interface ForeignKeyStructure {
  columns: string[]
  referencedTable: string
  referencedColumns: string[]
  onUpdate: string
  onDelete: string
}

export interface IndexStructure {
  name: string
  unique: boolean
  /** `c` = CREATE INDEX, `u` = UNIQUE constraint, `pk` = PRIMARY KEY. */
  origin: string
  /** Key columns in order; `DESC` suffixed when descending. */
  columns: string[]
  partial: boolean
  /** Normalized `sqlite_master.sql`; null for engine-managed indexes. */
  sql: string | null
}

export interface TableStructure {
  name: string
  columns: ColumnStructure[]
  foreignKeys: ForeignKeyStructure[]
  indexes: IndexStructure[]
  /** Normalized `sqlite_master.sql` — used verbatim to create the table. */
  createSql: string | null
}

export interface DatabaseStructure {
  tables: TableStructure[]
}

/** Tables owned by the engine or by other tooling; never part of the schema. */
export function isInternalTable(name: string): boolean {
  return (
    name.startsWith("sqlite_") ||
    name.startsWith("_litestream") ||
    name.startsWith("libsql_") ||
    name === "_prisma_migrations"
  )
}

function normalizeSql(sql: unknown): string | null {
  if (sql === null || sql === undefined) return null
  return String(sql).replace(/\s+/g, " ").trim()
}

function normalizeType(type: unknown): string {
  return String(type ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase()
}

function normalizeDefault(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).replace(/\s+/g, " ").trim()
  if (!text) return null
  return /^(current_timestamp|current_date|current_time|null|true|false)$/i.test(text)
    ? text.toUpperCase()
    : text
}

/** Escape a SQLite identifier for interpolation into a PRAGMA / DDL string. */
function quoteIdent(name: string): string {
  return `"${name.replace(/"/g, '""')}"`
}

/** Stable identity of a foreign key, independent of declaration order. */
export function foreignKeyKey(fk: ForeignKeyStructure): string {
  return `${fk.columns.join(",")}->${fk.referencedTable}(${fk.referencedColumns.join(",")})`
}

/**
 * Stable identity of an index. Explicit indexes are keyed by name; indexes the
 * engine creates for UNIQUE / PRIMARY KEY constraints get positional names
 * (`sqlite_autoindex_…`), so those are keyed by their columns instead.
 */
export function indexKey(index: IndexStructure): string {
  return index.origin === "c" ? `c:${index.name}` : `${index.origin}:${index.columns.join(",")}`
}

/**
 * Read the full structure of a database: tables, columns (type, nullability,
 * default, primary-key position, hidden flag), foreign keys (grouped, with
 * their actions) and indexes (uniqueness, key columns and order, partiality).
 *
 * The same function reads the canonical reference and the live target, so both
 * sides of every comparison are produced identically.
 */
export async function introspectStructure(client: SqlExecutor): Promise<DatabaseStructure> {
  const master = await client.execute(
    "SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name",
  )
  const tableRows = master.rows
    .map((r) => ({ name: String(r.name), sql: normalizeSql(r.sql) }))
    .filter((t) => !isInternalTable(t.name))

  const indexMaster = await client.execute("SELECT name, sql FROM sqlite_master WHERE type = 'index'")
  const indexSql = new Map<string, string | null>()
  for (const r of indexMaster.rows) indexSql.set(String(r.name), normalizeSql(r.sql))

  const tables: TableStructure[] = []
  for (const { name, sql } of tableRows) {
    const ident = quoteIdent(name)

    const info = await client.execute(`PRAGMA table_xinfo(${ident})`)
    const columns: ColumnStructure[] = info.rows.map((r) => ({
      name: String(r.name),
      type: normalizeType(r.type),
      notNull: Number(r.notnull) === 1,
      defaultValue: normalizeDefault(r.dflt_value),
      pkPosition: Number(r.pk ?? 0),
      hidden: Number(r.hidden ?? 0),
    }))

    const fkRows = await client.execute(`PRAGMA foreign_key_list(${ident})`)
    const grouped = new Map<number, Array<Record<string, unknown>>>()
    for (const r of fkRows.rows) {
      const id = Number(r.id)
      const bucket = grouped.get(id)
      if (bucket) bucket.push(r)
      else grouped.set(id, [r])
    }
    const foreignKeys: ForeignKeyStructure[] = [...grouped.values()]
      .map((rows) => {
        const ordered = [...rows].sort((a, b) => Number(a.seq) - Number(b.seq))
        return {
          columns: ordered.map((r) => String(r.from)),
          referencedTable: String(ordered[0].table),
          // A null `to` means "the referenced table's primary key".
          referencedColumns: ordered.map((r) => (r.to === null ? "" : String(r.to))),
          onUpdate: String(ordered[0].on_update ?? "NO ACTION").toUpperCase(),
          onDelete: String(ordered[0].on_delete ?? "NO ACTION").toUpperCase(),
        }
      })
      .sort((a, b) => foreignKeyKey(a).localeCompare(foreignKeyKey(b)))

    const idxRows = await client.execute(`PRAGMA index_list(${ident})`)
    const indexes: IndexStructure[] = []
    for (const r of idxRows.rows) {
      const idxName = String(r.name)
      const xinfo = await client.execute(`PRAGMA index_xinfo(${quoteIdent(idxName)})`)
      const keyColumns = xinfo.rows
        .filter((c) => Number(c.key) === 1)
        .sort((a, b) => Number(a.seqno) - Number(b.seqno))
        .map(
          (c) =>
            `${c.name === null ? "<expr>" : String(c.name)}${Number(c.desc) === 1 ? " DESC" : ""}`,
        )
      indexes.push({
        name: idxName,
        unique: Number(r.unique) === 1,
        origin: String(r.origin ?? "c"),
        columns: keyColumns,
        partial: Number(r.partial ?? 0) === 1,
        sql: indexSql.get(idxName) ?? null,
      })
    }
    indexes.sort((a, b) => indexKey(a).localeCompare(indexKey(b)))

    tables.push({ name, columns, foreignKeys, indexes, createSql: sql })
  }

  return { tables }
}

/**
 * Materialise the canonical DDL in a throwaway local SQLite file and read its
 * structure back. This — not a regex over the DDL text — is the source of
 * truth every comparison and every generated statement is built from.
 */
export async function canonicalStructureFromDdl(ddl: string): Promise<DatabaseStructure> {
  classifyDdlStatements(ddl)

  const dir = mkdtempSync(join(tmpdir(), "turso-canonical-"))
  const client = createClient({ url: `file:${join(dir, "canonical.db")}` })
  try {
    await client.executeMultiple(`PRAGMA foreign_keys=OFF;\n${ddl}`)
    return await introspectStructure(client)
  } finally {
    client.close()
    rmSync(dir, { recursive: true, force: true })
  }
}

// ---------------------------------------------------------------------------
// Structural comparison
// ---------------------------------------------------------------------------

export type IssueKind =
  | "missing-table"
  | "missing-column"
  | "missing-index"
  | "column-mismatch"
  | "primary-key-mismatch"
  | "foreign-key-missing"
  | "foreign-key-mismatch"
  | "foreign-key-extra"
  | "index-mismatch"
  | "extra-table"
  | "extra-column"
  | "extra-index"
  | "column-not-addable"
  | "unique-index-duplicates"

export interface StructuralIssue {
  kind: IssueKind
  /** `Table`, `Table.column` or an index name. Safe to log. */
  object: string
  detail: string
}

export interface PlannedColumn {
  table: string
  column: ColumnStructure
  /** SQLite only accepts this `ADD COLUMN` while the table is empty. */
  requiresEmptyTable: boolean
}

export interface PlannedIndex {
  table: string
  index: IndexStructure
  sql: string
  /** UNIQUE index over a pre-existing table: existing rows may violate it. */
  requiresUniquenessCheck: boolean
}

export interface SchemaPlan {
  /** Tables to create verbatim from the canonical `CREATE TABLE`. */
  createTables: TableStructure[]
  addColumns: PlannedColumn[]
  createIndexes: PlannedIndex[]
  /** Differences this tool refuses to apply. Non-empty ⇒ abort. */
  blocking: StructuralIssue[]
  /** Objects present in the target but absent from the schema. */
  extra: StructuralIssue[]
}

/** A default SQLite cannot evaluate while adding a column to an existing table. */
export function isNonConstantDefault(value: string | null): boolean {
  if (value === null) return false
  return /^\(/.test(value) || /^(CURRENT_TIMESTAMP|CURRENT_DATE|CURRENT_TIME)$/i.test(value)
}

function describeColumn(c: ColumnStructure): string {
  return [
    c.type || "(no type)",
    c.notNull ? "NOT NULL" : "NULL",
    c.defaultValue === null ? "no default" : `DEFAULT ${c.defaultValue}`,
    c.pkPosition > 0 ? `PK#${c.pkPosition}` : "not PK",
  ].join(", ")
}

/**
 * Compare the canonical structure against a live one and split every
 * difference into work we can safely apply and work that requires a human.
 *
 * Pure and synchronous: checks that need to read data (an empty-table check, a
 * uniqueness check) are flagged here and resolved by `preflightPlan`.
 */
export function diffStructures(expected: DatabaseStructure, actual: DatabaseStructure): SchemaPlan {
  const plan: SchemaPlan = {
    createTables: [],
    addColumns: [],
    createIndexes: [],
    blocking: [],
    extra: [],
  }

  const actualByName = new Map(actual.tables.map((t) => [t.name, t]))
  const expectedByName = new Map(expected.tables.map((t) => [t.name, t]))

  for (const table of expected.tables) {
    const live = actualByName.get(table.name)

    if (!live) {
      if (!table.createSql) {
        plan.blocking.push({
          kind: "missing-table",
          object: table.name,
          detail: "canonical CREATE TABLE statement unavailable",
        })
        continue
      }
      plan.createTables.push(table)
      for (const index of table.indexes) {
        if (index.origin !== "c" || !index.sql) continue
        plan.createIndexes.push({
          table: table.name,
          index,
          sql: index.sql,
          requiresUniquenessCheck: false,
        })
      }
      continue
    }

    // --- columns -----------------------------------------------------------
    const liveColumns = new Map(live.columns.map((c) => [c.name, c]))
    const fkColumns = new Set(table.foreignKeys.flatMap((fk) => fk.columns))

    for (const column of table.columns) {
      const liveColumn = liveColumns.get(column.name)

      if (!liveColumn) {
        if (column.pkPosition > 0) {
          plan.blocking.push({
            kind: "primary-key-mismatch",
            object: `${table.name}.${column.name}`,
            detail: "missing column belongs to the primary key; SQLite cannot add it",
          })
          continue
        }
        if (column.hidden !== 0) {
          plan.blocking.push({
            kind: "column-not-addable",
            object: `${table.name}.${column.name}`,
            detail: `generated/hidden column (hidden=${column.hidden}) cannot be added safely`,
          })
          continue
        }
        if (fkColumns.has(column.name)) {
          plan.blocking.push({
            kind: "foreign-key-missing",
            object: `${table.name}.${column.name}`,
            detail:
              "missing column participates in a foreign key; SQLite cannot add a foreign key " +
              "to an existing table",
          })
          continue
        }
        if (isNonConstantDefault(column.defaultValue)) {
          plan.blocking.push({
            kind: "column-not-addable",
            object: `${table.name}.${column.name}`,
            detail: `SQLite cannot ADD COLUMN with the non-constant default ${column.defaultValue}`,
          })
          continue
        }
        plan.addColumns.push({
          table: table.name,
          column,
          requiresEmptyTable: column.notNull && column.defaultValue === null,
        })
        continue
      }

      const differences: string[] = []
      if (liveColumn.type !== column.type) {
        differences.push(`type ${liveColumn.type || "(none)"} → ${column.type || "(none)"}`)
      }
      if (liveColumn.notNull !== column.notNull) {
        differences.push(
          `${liveColumn.notNull ? "NOT NULL" : "NULL"} → ${column.notNull ? "NOT NULL" : "NULL"}`,
        )
      }
      if (liveColumn.defaultValue !== column.defaultValue) {
        differences.push(
          `default ${liveColumn.defaultValue ?? "(none)"} → ${column.defaultValue ?? "(none)"}`,
        )
      }
      if (liveColumn.hidden !== column.hidden) {
        differences.push(`hidden ${liveColumn.hidden} → ${column.hidden}`)
      }
      if (differences.length) {
        plan.blocking.push({
          kind: "column-mismatch",
          object: `${table.name}.${column.name}`,
          detail: `${differences.join("; ")} (expected: ${describeColumn(column)})`,
        })
      }
      if (liveColumn.pkPosition !== column.pkPosition) {
        plan.blocking.push({
          kind: "primary-key-mismatch",
          object: `${table.name}.${column.name}`,
          detail: `primary-key position ${liveColumn.pkPosition} → ${column.pkPosition}`,
        })
      }
    }

    const expectedColumns = new Set(table.columns.map((c) => c.name))
    for (const column of live.columns) {
      if (!expectedColumns.has(column.name)) {
        plan.extra.push({
          kind: "extra-column",
          object: `${table.name}.${column.name}`,
          detail: "column exists in the database but not in schema.prisma",
        })
      }
    }

    // --- foreign keys ------------------------------------------------------
    const liveFks = new Map(live.foreignKeys.map((fk) => [foreignKeyKey(fk), fk]))
    for (const fk of table.foreignKeys) {
      const key = foreignKeyKey(fk)
      const liveFk = liveFks.get(key)
      if (!liveFk) {
        plan.blocking.push({
          kind: "foreign-key-missing",
          object: `${table.name} ${key}`,
          detail:
            "foreign key declared in schema.prisma is absent; SQLite cannot add one to an " +
            "existing table",
        })
        continue
      }
      if (liveFk.onDelete !== fk.onDelete || liveFk.onUpdate !== fk.onUpdate) {
        plan.blocking.push({
          kind: "foreign-key-mismatch",
          object: `${table.name} ${key}`,
          detail:
            `ON DELETE ${liveFk.onDelete} → ${fk.onDelete}, ` +
            `ON UPDATE ${liveFk.onUpdate} → ${fk.onUpdate}`,
        })
      }
    }
    const expectedFks = new Set(table.foreignKeys.map(foreignKeyKey))
    for (const fk of live.foreignKeys) {
      const key = foreignKeyKey(fk)
      if (!expectedFks.has(key)) {
        plan.blocking.push({
          kind: "foreign-key-extra",
          object: `${table.name} ${key}`,
          detail: "foreign key exists in the database but not in schema.prisma",
        })
      }
    }

    // --- indexes -----------------------------------------------------------
    const liveIndexes = new Map(live.indexes.map((i) => [indexKey(i), i]))
    for (const index of table.indexes) {
      const key = indexKey(index)
      const liveIndex = liveIndexes.get(key)

      if (!liveIndex) {
        if (index.origin !== "c" || !index.sql) {
          plan.blocking.push({
            kind: "index-mismatch",
            object: `${table.name} ${key}`,
            detail: "engine-managed index is absent; it belongs to a table definition change",
          })
          continue
        }
        plan.createIndexes.push({
          table: table.name,
          index,
          sql: index.sql,
          requiresUniquenessCheck: index.unique,
        })
        continue
      }

      const differences: string[] = []
      if (liveIndex.unique !== index.unique) {
        differences.push(
          `${liveIndex.unique ? "UNIQUE" : "non-unique"} → ${index.unique ? "UNIQUE" : "non-unique"}`,
        )
      }
      if (liveIndex.columns.join(",") !== index.columns.join(",")) {
        differences.push(`columns (${liveIndex.columns.join(", ")}) → (${index.columns.join(", ")})`)
      }
      if (liveIndex.partial !== index.partial) {
        differences.push(`${liveIndex.partial ? "partial" : "full"} → ${index.partial ? "partial" : "full"}`)
      }
      if (index.partial && liveIndex.sql !== index.sql) {
        differences.push("partial-index predicate differs")
      }
      if (differences.length) {
        plan.blocking.push({
          kind: "index-mismatch",
          object: `${table.name}.${index.name}`,
          detail: differences.join("; "),
        })
      }
    }
    const expectedIndexes = new Set(table.indexes.map(indexKey))
    for (const index of live.indexes) {
      if (!expectedIndexes.has(indexKey(index))) {
        plan.extra.push({
          kind: "extra-index",
          object: `${table.name}.${index.name}`,
          detail: "index exists in the database but not in schema.prisma",
        })
      }
    }
  }

  for (const table of actual.tables) {
    if (!expectedByName.has(table.name)) {
      plan.extra.push({
        kind: "extra-table",
        object: table.name,
        detail: "table exists in the database but not in schema.prisma",
      })
    }
  }

  return plan
}

/**
 * Resolve the data-dependent checks the pure diff could only flag: a NOT NULL
 * column without a default can only be added while the table is empty, and a
 * UNIQUE index can only be created when the existing rows do not violate it.
 *
 * Runs BEFORE anything is written, so a database that needs a manual migration
 * is never left half-provisioned.
 */
export async function preflightPlan(client: SqlExecutor, plan: SchemaPlan): Promise<SchemaPlan> {
  const addColumns: PlannedColumn[] = []
  for (const planned of plan.addColumns) {
    if (!planned.requiresEmptyTable) {
      addColumns.push(planned)
      continue
    }
    const count = await client.execute(`SELECT count(*) AS n FROM ${quoteIdent(planned.table)}`)
    const rows = Number(count.rows[0].n)
    if (rows === 0) {
      addColumns.push(planned)
      continue
    }
    plan.blocking.push({
      kind: "column-not-addable",
      object: `${planned.table}.${planned.column.name}`,
      detail:
        `NOT NULL without a default, and ${rows} row(s) already exist — ` +
        "SQLite cannot add this column",
    })
  }
  plan.addColumns = addColumns

  // Columns that do not exist yet: an index over one of them cannot have
  // duplicates, because every existing row will read NULL there.
  const pending = new Set(addColumns.map((c) => `${c.table}.${c.column.name}`))

  const createIndexes: PlannedIndex[] = []
  for (const planned of plan.createIndexes) {
    const columns = planned.index.columns
    const bare = columns.map((c) => c.replace(/ DESC$/, ""))
    if (
      !planned.requiresUniquenessCheck ||
      !columns.length ||
      columns.some((c) => c.startsWith("<expr>")) ||
      bare.some((c) => pending.has(`${planned.table}.${c}`))
    ) {
      createIndexes.push(planned)
      continue
    }

    const cols = bare.map(quoteIdent)
    let groups: number
    try {
      const duplicates = await client.execute(
        `SELECT count(*) AS n FROM (SELECT ${cols.join(", ")} FROM ${quoteIdent(planned.table)} ` +
          `WHERE ${cols.map((c) => `${c} IS NOT NULL`).join(" AND ")} ` +
          `GROUP BY ${cols.join(", ")} HAVING count(*) > 1)`,
      )
      groups = Number(duplicates.rows[0].n)
    } catch (err) {
      // The index references something the target does not have — a column
      // that is itself blocked, for instance. Refuse rather than guess.
      plan.blocking.push({
        kind: "index-mismatch",
        object: `${planned.table}.${planned.index.name}`,
        detail:
          `cannot verify the UNIQUE index over (${columns.join(", ")}): ` +
          sanitizeForLog(err instanceof Error ? err.message : String(err)),
      })
      continue
    }

    if (groups === 0) {
      createIndexes.push(planned)
      continue
    }
    plan.blocking.push({
      kind: "unique-index-duplicates",
      object: `${planned.table}.${planned.index.name}`,
      detail:
        `${groups} duplicate value group(s) already exist on (${columns.join(", ")}) — ` +
        "the UNIQUE index cannot be created",
    })
  }
  plan.createIndexes = createIndexes

  return plan
}

// ---------------------------------------------------------------------------
// Applying the additive plan
// ---------------------------------------------------------------------------

/** Rebuild an `ADD COLUMN` definition from the introspected canonical column. */
export function columnDefinition(column: ColumnStructure): string {
  const parts = [quoteIdent(column.name)]
  if (column.type) parts.push(column.type)
  if (column.notNull) parts.push("NOT NULL")
  if (column.defaultValue !== null) parts.push(`DEFAULT ${column.defaultValue}`)
  return parts.join(" ")
}

export class ManualMigrationRequiredError extends Error {
  readonly issues: StructuralIssue[]

  constructor(issues: StructuralIssue[], context: string) {
    super(
      `manual migration required — ${context}\n` +
        issues.map((i) => `  [${i.kind}] ${i.object}: ${i.detail}`).join("\n") +
        "\n\nThis tool only performs additive bootstrap (new tables, new columns, new " +
        "indexes). It never rewrites or rebuilds an existing table. Resolve the " +
        "differences above with a hand-written migration, then re-run.",
    )
    this.name = "ManualMigrationRequiredError"
    this.issues = issues
  }
}

export interface ProvisionReport {
  canonical: DatabaseStructure
  before: DatabaseStructure
  after: DatabaseStructure
  applied: { tables: string[]; columns: string[]; indexes: string[] }
  integrity: { foreignKeyViolations: number; integrityCheck: string }
}

/**
 * Bring `client` up to the canonical structure, additively, and prove it.
 *
 *   1. build the canonical structure from `ddl` (local throwaway database);
 *   2. introspect the target;
 *   3. diff, then resolve the data-dependent checks;
 *   4. abort with `manual migration required` if ANY non-additive difference
 *      remains — nothing has been written at this point;
 *   5. apply tables → columns → indexes (indexes last: they may reference a
 *      column the previous step has just added);
 *   6. re-introspect and require the result to match the canonical structure
 *      exactly;
 *   7. run `PRAGMA foreign_key_check` and `PRAGMA integrity_check`.
 */
export async function provisionSchema(client: SqlExecutor, ddl: string): Promise<ProvisionReport> {
  const canonical = await canonicalStructureFromDdl(ddl)
  const before = await introspectStructure(client)

  const plan = await preflightPlan(client, diffStructures(canonical, before))

  const blockers = [...plan.blocking, ...plan.extra]
  if (blockers.length) {
    throw new ManualMigrationRequiredError(
      blockers,
      `${blockers.length} structural difference(s) cannot be applied additively`,
    )
  }

  const applied = { tables: [] as string[], columns: [] as string[], indexes: [] as string[] }

  if (plan.createTables.length) {
    const sql = plan.createTables.map((t) => `${t.createSql};`).join("\n")
    await client.executeMultiple(`PRAGMA foreign_keys=OFF;\n${sql}`)
    applied.tables = plan.createTables.map((t) => t.name)
  }

  for (const planned of plan.addColumns) {
    await client.execute(
      `ALTER TABLE ${quoteIdent(planned.table)} ADD COLUMN ${columnDefinition(planned.column)}`,
    )
    applied.columns.push(`${planned.table}.${planned.column.name}`)
  }

  if (plan.createIndexes.length) {
    const sql = plan.createIndexes.map((i) => `${i.sql};`).join("\n")
    await client.executeMultiple(`PRAGMA foreign_keys=OFF;\n${sql}`)
    applied.indexes = plan.createIndexes.map((i) => i.index.name)
  }

  // --- verification --------------------------------------------------------
  const after = await introspectStructure(client)
  const residual = diffStructures(canonical, after)
  const remaining: StructuralIssue[] = [
    ...residual.blocking,
    ...residual.extra,
    ...residual.createTables.map((t) => ({
      kind: "missing-table" as const,
      object: t.name,
      detail: "still missing after provisioning",
    })),
    ...residual.addColumns.map((c) => ({
      kind: "missing-column" as const,
      object: `${c.table}.${c.column.name}`,
      detail: "still missing after provisioning",
    })),
    ...residual.createIndexes.map((i) => ({
      kind: "missing-index" as const,
      object: `${i.table}.${i.index.name}`,
      detail: "still missing after provisioning",
    })),
  ]
  if (remaining.length) {
    throw new ManualMigrationRequiredError(
      remaining,
      "the database still differs from schema.prisma after provisioning",
    )
  }

  const fkCheck = await client.execute("PRAGMA foreign_key_check")
  const integrity = await client.execute("PRAGMA integrity_check")
  const integrityCheck = String(Object.values(integrity.rows[0] ?? {})[0] ?? "unknown")

  return {
    canonical,
    before,
    after,
    applied,
    integrity: { foreignKeyViolations: fkCheck.rows.length, integrityCheck },
  }
}
