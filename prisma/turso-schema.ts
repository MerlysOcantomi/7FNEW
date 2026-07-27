/**
 * Turso schema tooling — shared foundation for `bootstrap-turso.ts` and
 * `verify-turso.ts`.
 *
 * SCOPE
 * -----
 * This is **not** a migration engine, and it deliberately never repairs an
 * existing database. It supports exactly two operations:
 *
 *   `turso:bootstrap` — create the whole schema on an EMPTY database.
 *   `turso:verify`    — compare a database against `schema.prisma`, read-only.
 *
 * Anything else — adding a column, completing a half-created database,
 * reconciling drift, deciding which changes are "safe" — is out of scope by
 * design. A database that has drifted needs a hand-written migration; this
 * module's job is to tell you so, precisely, and never to guess.
 *
 * HOW THE CANONICAL STRUCTURE IS OBTAINED
 * ---------------------------------------
 * Prisma's migration engine cannot reach a remote Turso database, so the
 * Prisma CLI renders the schema's DDL, that DDL is materialised in a throwaway
 * LOCAL SQLite file, and the result is introspected. That introspection — not
 * a regex over SQL text — is the canonical structure both tools compare
 * against. The target database is read with the same introspection code.
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
 * embedded in an error message. Applied to child-process stderr and to every
 * error surfaced by the two CLIs.
 *
 * Two layers, because pattern matching alone cannot be trusted here:
 *
 * 1. **By construction** — `secrets` are the exact values this process holds
 *    (the auth token, the host, the URL). They are removed literally, so a leak
 *    does not depend on a regex anticipating the shape of the surrounding text.
 *    That matters: a DNS failure repeats the hostname as bare text
 *    (`getaddrinfo ENOTFOUND lab-x.turso.io`), where no URL pattern matches.
 * 2. **By pattern** — a generic sweep for credentials that did not come from
 *    this process, such as a connection string quoted back by the Prisma CLI.
 *
 * @param secrets values known to be sensitive; short or empty entries are
 *   ignored so a one-character value cannot blank out the whole message.
 */
export function sanitizeForLog(text: string, secrets: ReadonlyArray<string | undefined> = []): string {
  let out = text

  for (const secret of secrets) {
    if (secret && secret.length >= 4) out = out.split(secret).join("<redacted>")
  }

  return (
    out
      // Any scheme, not just libsql/https: a Prisma error can quote a
      // postgres://, mongodb+srv://, sqlserver:// or prisma+postgres:// URL.
      .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "<redacted-url>")
      // A bare Turso hostname left in error text after the URL was redacted.
      .replace(/\b(?:[a-z0-9-]+\.)+turso\.io\b/gi, "<redacted-host>")
      // key=value, including env-var names such as TURSO_AUTH_TOKEN=… where the
      // underscore prefix defeats a leading word boundary.
      .replace(
        /[A-Za-z0-9_]*(?:auth_?token|token|password|secret|api_?key)\s*[=:]\s*\S+/gi,
        "<redacted-credential>",
      )
      .replace(/\bBearer\s+\S+/gi, "Bearer <redacted>")
      .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "<redacted-jwt>")
  )
}

// ---------------------------------------------------------------------------
// Target resolution & the conservative production guard
// ---------------------------------------------------------------------------

/**
 * A database may be written to ONLY when its name carries one of these markers
 * as a whole token (split on `-`, `_`, `.`). Anything else — including every
 * name we do not recognise — is treated as production.
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
        "A file: URL is refused on purpose so local dev is never mistaken for Turso.",
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
  /**
   * Full hostname. NOT for logging — it is carried so the CLIs can hand it to
   * `sanitizeForLog` as a known secret, because error text from the network
   * layer repeats it as bare words no URL pattern matches.
   */
  host: string
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
 * prefers `DATABASE_URL`): these are Turso-specific tools, so a local
 * `DATABASE_URL=file:./dev.db` must never be mistaken for the remote target.
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
        "on purpose so local dev is never mistaken for Turso.",
    )
  }

  const { url, host, dbName } = parseTursoUrl(raw, urlSource)

  const tokenOrder: Array<NonNullable<TursoTarget["tokenSource"]>> =
    urlSource === "TURSO_DATABASE_URL"
      ? ["TURSO_AUTH_TOKEN", "DATABASE_AUTH_TOKEN"]
      : ["DATABASE_AUTH_TOKEN", "TURSO_AUTH_TOKEN"]
  const tokenSource = tokenOrder.find((name) => env[name])

  return {
    url,
    host,
    authToken: tokenSource ? env[tokenSource] : undefined,
    dbName,
    urlSource,
    tokenSource,
    classification: classifyDatabaseName(dbName),
  }
}

/**
 * Throw unless the target may be written to.
 *
 * There is **no override**. A production or unrecognised name cannot be
 * unlocked by any environment variable, because the only writing tool
 * (`turso:bootstrap`) is for creating fresh non-production databases.
 * Provisioning production is a different, deliberate procedure.
 */
export function assertBootstrapTarget(target: TursoTarget): void {
  if (target.classification.safe) return
  throw new Error(
    `Refusing to bootstrap "${target.dbName}": ${target.classification.reason}. ` +
      "Only databases explicitly marked as a non-production environment " +
      `(${SAFE_ENVIRONMENT_MARKERS.join(", ")}) can be bootstrapped, and there is no ` +
      "override. Use turso:verify to inspect this database read-only.",
  )
}

// ---------------------------------------------------------------------------
// Canonical DDL generation (cwd-independent, local CLI, no network)
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

/**
 * Replace every string literal, quoted identifier and comment with a space, so
 * keyword scanning cannot be fooled by a keyword inside a value or a name.
 */
export function stripSqlLiterals(sql: string): string {
  let out = ""
  let i = 0

  while (i < sql.length) {
    const ch = sql[i]

    if (ch === "'" || ch === '"' || ch === "`") {
      const quote = ch
      i++
      while (i < sql.length) {
        if (sql[i] === quote) {
          if (sql[i + 1] === quote) {
            i += 2
            continue
          }
          i++
          break
        }
        i++
      }
      out += " "
      continue
    }

    if (ch === "[") {
      while (i < sql.length && sql[i] !== "]") i++
      i++
      out += " "
      continue
    }

    if (ch === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++
      out += " "
      continue
    }

    if (ch === "/" && sql[i + 1] === "*") {
      i += 2
      while (i < sql.length && !(sql[i] === "*" && sql[i + 1] === "/")) i++
      i += 2
      out += " "
      continue
    }

    out += ch
    i++
  }

  return out
}

export type DdlStatementKind = "table" | "index"

export interface ClassifiedStatement {
  kind: DdlStatementKind
  sql: string
}

/**
 * Classify every statement of the canonical DDL. Unknown statement classes are
 * a hard error — they are never silently treated as tables, because a future
 * Prisma release emitting e.g. `CREATE TRIGGER` would otherwise be applied
 * blindly by a tool that cannot reason about it or verify the result.
 */
export function classifyDdlStatements(ddl: string): ClassifiedStatement[] {
  const classified: ClassifiedStatement[] = []
  const unknown: string[] = []

  for (const sql of splitSqlStatements(ddl)) {
    const head = stripSqlLiterals(sql).replace(/\s+/g, " ").trim()
    if (/^CREATE\s+TABLE\b/i.test(head)) classified.push({ kind: "table", sql })
    else if (/^CREATE\s+(UNIQUE\s+)?INDEX\b/i.test(head)) classified.push({ kind: "index", sql })
    else unknown.push(head.slice(0, 120))
  }

  if (unknown.length) {
    throw new Error(
      "The canonical DDL contains statement classes these tools do not support:\n" +
        unknown.map((s) => `  - ${s}…`).join("\n") +
        "\nBootstrap and verify only understand CREATE TABLE and CREATE [UNIQUE] INDEX. " +
        "Apply anything else by hand.",
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
 * Everything these tools do is derived from the DDL, so a `@@map` would be
 * handled correctly — but the independent cross-check ("every model in
 * schema.prisma exists as a table") assumes model name === table name. Rather
 * than let that check silently compare the wrong things, `@@map` is refused
 * until the cross-check is taught about it.
 *
 * Field-level `@map` is fully supported: the physical column name comes from
 * the DDL on both sides of every comparison.
 */
export function assertModelNamesMatchTables(schemaSource: string): void {
  const mapped = [...schemaSource.matchAll(/^\s*@@map\s*\(\s*"([^"]*)"/gm)].map((m) => m[1])
  if (mapped.length) {
    throw new Error(
      `schema.prisma uses @@map (${mapped.join(", ")}), so a model name is no longer its table ` +
        "name. The model↔table cross-check must be updated before this can land — see " +
        "scripts/turso-verify.test.ts.",
    )
  }
}

// ---------------------------------------------------------------------------
// Read-only access
// ---------------------------------------------------------------------------

/**
 * The only surface `verify` is ever given for the target database. It has no
 * write methods at all — no `executeMultiple`, no `transaction`, no `batch` —
 * so a corrective statement cannot be issued even by mistake.
 */
export interface ReadOnlyExecutor {
  execute(sql: string): Promise<{ rows: Array<Record<string, unknown>> }>
}

/** A surface that can also write. Used by `bootstrap` inside its transaction. */
export interface SqlExecutor extends ReadOnlyExecutor {
  executeMultiple(sql: string): Promise<void>
}

/**
 * The one query every introspection path issues against a target. Keeping it a
 * single compile-time constant is what lets the read-only guard match statements
 * literally instead of trying to decide whether an arbitrary SELECT is safe.
 */
export const SQLITE_MASTER_QUERY = "SELECT type, name, sql FROM sqlite_master ORDER BY type, name"

/**
 * The complete set of pragmas the read-only guard will forward, with the exact
 * argument shape each one accepts.
 *
 * This is an allow-list, not a pattern: a pragma name that is not a key here is
 * refused, so mutating pragmas — `user_version`, `writable_schema`,
 * `journal_mode`, `foreign_keys`, `application_id`, `cache_size`, … — can never
 * reach the client, in assignment form (`PRAGMA x = 1`) or in the functional
 * form (`PRAGMA x(1)`) that SQLite also accepts as a write.
 *
 * `identifier` — exactly one double-quoted identifier, the form `quoteIdent()`
 *                produces; nothing else, and the argument is required.
 * `none`       — no argument at all.
 *
 * These six are precisely what `introspectStructure` and the bootstrap
 * verification issue. Adding one here is a deliberate act that must be
 * justified: it widens what a "read-only" surface may do.
 */
export const READ_ONLY_PRAGMAS: Readonly<Record<string, "identifier" | "none">> = Object.freeze({
  table_xinfo: "identifier",
  foreign_key_list: "identifier",
  index_list: "identifier",
  index_xinfo: "identifier",
  foreign_key_check: "none",
  integrity_check: "none",
})

/**
 * Whole-statement grammar for an allowed pragma. Anchored at both ends, so a
 * schema prefix (`main.user_version`), an `=` assignment, a bare-word or
 * numeric argument, or any trailing text fails to match.
 */
const READ_ONLY_PRAGMA_RE = /^PRAGMA\s+([A-Za-z_]+)\s*(?:\(\s*"((?:[^"]|"")*)"\s*\))?$/i

/**
 * The complete set of non-PRAGMA statements the read-only guard will forward —
 * literal, not a shape.
 *
 * A blanket "any SELECT is read-only" rule would be wrong for the engine this
 * repository actually ships: the bundled libSQL build registers `writefile`,
 * `readfile`, `fsdir` and `load_extension`, so `SELECT writefile('<db>', '')`
 * truncates the target file without a single write keyword, without a `;` and
 * without a comment. Since every query the introspection issues is a compile-
 * time constant, the guard matches those constants exactly and refuses the rest.
 */
export const READ_ONLY_STATEMENTS: readonly string[] = Object.freeze([
  SQLITE_MASTER_QUERY,
])

/** Raised when the read-only guard refuses to forward a statement. */
export class ReadOnlyGuardError extends Error {
  constructor(reason: string, statement: string) {
    const shown = statement.length > 80 ? `${statement.slice(0, 80)}…` : statement
    super(
      `Read-only guard refused a statement (${reason}): ${shown}\n` +
        "This surface never writes to the target database.",
    )
    this.name = "ReadOnlyGuardError"
  }
}

/**
 * Fail-closed check applied to every statement issued against a target
 * database. Exactly two things are accepted and nothing else:
 *
 *   - one of the literal queries in `READ_ONLY_STATEMENTS`;
 *   - a single `PRAGMA` from `READ_ONLY_PRAGMAS`, in its exact argument shape.
 *
 * Note what is deliberately NOT accepted: an arbitrary `SELECT`. The bundled
 * libSQL build registers `writefile`, `readfile`, `fsdir` and `load_extension`,
 * so a SELECT can truncate or replace the database file — the read-only guard
 * cannot be a check on statement *class*, only on the exact statements this
 * tool is known to issue.
 *
 * Statement separators and comment markers are refused outright, so no suffix
 * can smuggle a second statement past the check.
 */
export function assertReadOnlySql(sql: string): void {
  const statement = sql.trim()

  if (!statement) throw new ReadOnlyGuardError("empty statement", sql)
  if (statement.includes(";")) throw new ReadOnlyGuardError("statement separator", statement)
  if (statement.includes("--") || statement.includes("/*")) {
    throw new ReadOnlyGuardError("comment marker", statement)
  }

  if (READ_ONLY_STATEMENTS.includes(statement.replace(/\s+/g, " "))) return
  if (/^SELECT\b/i.test(statement)) {
    throw new ReadOnlyGuardError("SELECT is not one of the allow-listed queries", statement)
  }

  const match = READ_ONLY_PRAGMA_RE.exec(statement)
  if (!match) throw new ReadOnlyGuardError("not a SELECT or an allow-listed PRAGMA", statement)

  const name = match[1].toLowerCase()
  const argument = match[2]
  const shape = Object.prototype.hasOwnProperty.call(READ_ONLY_PRAGMAS, name)
    ? READ_ONLY_PRAGMAS[name]
    : undefined

  if (!shape) throw new ReadOnlyGuardError(`pragma "${name}" is not on the allow-list`, statement)
  if (shape === "identifier" && argument === undefined) {
    throw new ReadOnlyGuardError(`pragma "${name}" requires a quoted identifier`, statement)
  }
  if (shape === "none" && argument !== undefined) {
    throw new ReadOnlyGuardError(`pragma "${name}" takes no argument`, statement)
  }
}

/**
 * Narrow a client down to a read-only view, enforced twice: the returned type
 * exposes only `execute`, and `assertReadOnlySql` checks every statement before
 * it reaches the wrapped client. A refused statement is never forwarded.
 */
export function asReadOnly(client: ReadOnlyExecutor): ReadOnlyExecutor {
  return {
    async execute(sql: string) {
      assertReadOnlySql(sql)
      return client.execute(sql)
    },
  }
}

// ---------------------------------------------------------------------------
// Structural introspection
// ---------------------------------------------------------------------------

export interface ColumnStructure {
  name: string
  /** Declared type, upper-cased (SQLite type names are case-insensitive). */
  type: string
  notNull: boolean
  /**
   * Default expression EXACTLY as SQLite reports it. Never normalized: a
   * default differing only in whitespace is a real difference, and collapsing
   * it would hide meaning.
   */
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
  /** Collation of each key column, in the same order. */
  collations: string[]
  partial: boolean
  /** Normalized `sqlite_master.sql`; null for engine-managed indexes. */
  sql: string | null
}

export interface TableStructure {
  name: string
  columns: ColumnStructure[]
  foreignKeys: ForeignKeyStructure[]
  indexes: IndexStructure[]
  /** Normalized `sqlite_master.sql` for the table. */
  createSql: string | null
}

export interface DatabaseStructure {
  tables: TableStructure[]
  /**
   * Views and triggers. `schema.prisma` produces none, so anything here is a
   * difference the comparison reports — a stray trigger is not cosmetic, it
   * runs against the application's own tables.
   */
  objects: DatabaseObject[]
}

/**
 * Tables the storage engine itself creates, and which can therefore exist in a
 * genuinely fresh database. Deliberately short — every pattern here is a hole
 * in the "is this database empty?" check, so each one is justified:
 *
 *   `sqlite_*`  SQLite's own objects (`sqlite_sequence`, `sqlite_stat1`,
 *               `sqlite_autoindex_*`). The prefix is reserved by SQLite, so no
 *               application table can occupy it.
 *   `libsql_*`  libSQL/Turso server-side internals (e.g. `libsql_wasm_func_table`).
 *
 * Everything else counts as an application table. In particular
 * `_prisma_migrations` is NOT internal: it records that migrations have already
 * been applied, which is exactly the state `turso:bootstrap` must refuse.
 */
export function isInternalTable(name: string): boolean {
  return name.startsWith("sqlite_") || name.startsWith("libsql_")
}

function normalizeSql(sql: unknown): string | null {
  if (sql === null || sql === undefined) return null
  return String(sql).replace(/\s+/g, " ").trim()
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

/** Anything `sqlite_master` records: a table, index, view or trigger. */
export interface DatabaseObject {
  type: string
  name: string
}

/**
 * Every non-internal object in a database — not just tables.
 *
 * The emptiness gate has to look at views and triggers too. A trigger left
 * behind in an otherwise "empty" database survives the bootstrap and then fires
 * on the tables it creates; a view can shadow a name. Neither shows up in a
 * `type = 'table'` query, so the gate has to consider the whole catalogue.
 */
export async function applicationObjects(reader: ReadOnlyExecutor): Promise<DatabaseObject[]> {
  const result = await reader.execute(SQLITE_MASTER_QUERY)
  return result.rows
    .map((r) => ({ type: String(r.type), name: String(r.name) }))
    .filter((o) => !isInternalTable(o.name))
}

/** Application (non-internal) table names present in a database. */
export async function applicationTableNames(reader: ReadOnlyExecutor): Promise<string[]> {
  const objects = await applicationObjects(reader)
  return objects.filter((o) => o.type === "table").map((o) => o.name)
}

/**
 * Read the full structure of a database: tables, columns (type, nullability,
 * default, primary-key position, hidden flag), foreign keys (grouped, with
 * their actions) and indexes (uniqueness, key columns, order, collation,
 * partiality).
 *
 * Takes a read-only surface, so the same function reads the canonical
 * reference and the live target without ever being able to modify either.
 */
export async function introspectStructure(reader: ReadOnlyExecutor): Promise<DatabaseStructure> {
  const master = await reader.execute(SQLITE_MASTER_QUERY)
  const catalogue = master.rows.map((r) => ({
    type: String(r.type),
    name: String(r.name),
    sql: normalizeSql(r.sql),
  }))

  const tableRows = catalogue.filter((r) => r.type === "table" && !isInternalTable(r.name))

  const indexSql = new Map<string, string | null>()
  for (const r of catalogue) if (r.type === "index") indexSql.set(r.name, r.sql)

  // Views and triggers: schema.prisma declares none, so any that exist are
  // objects the comparison must report rather than quietly ignore.
  const objects: DatabaseObject[] = catalogue
    .filter((r) => (r.type === "view" || r.type === "trigger") && !isInternalTable(r.name))
    .map((r) => ({ type: r.type, name: r.name }))

  const tables: TableStructure[] = []
  for (const { name, sql } of tableRows) {
    const ident = quoteIdent(name)

    const info = await reader.execute(`PRAGMA table_xinfo(${ident})`)
    const columns: ColumnStructure[] = info.rows.map((r) => ({
      name: String(r.name),
      type: String(r.type ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .toUpperCase(),
      notNull: Number(r.notnull) === 1,
      defaultValue: r.dflt_value === null || r.dflt_value === undefined ? null : String(r.dflt_value),
      pkPosition: Number(r.pk ?? 0),
      hidden: Number(r.hidden ?? 0),
    }))

    const fkRows = await reader.execute(`PRAGMA foreign_key_list(${ident})`)
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

    const idxRows = await reader.execute(`PRAGMA index_list(${ident})`)
    const indexes: IndexStructure[] = []
    for (const r of idxRows.rows) {
      const idxName = String(r.name)
      const xinfo = await reader.execute(`PRAGMA index_xinfo(${quoteIdent(idxName)})`)
      const keyRows = xinfo.rows
        .filter((c) => Number(c.key) === 1)
        .sort((a, b) => Number(a.seqno) - Number(b.seqno))
      indexes.push({
        name: idxName,
        unique: Number(r.unique) === 1,
        origin: String(r.origin ?? "c"),
        columns: keyRows.map(
          (c) =>
            `${c.name === null ? "<expr>" : String(c.name)}${Number(c.desc) === 1 ? " DESC" : ""}`,
        ),
        collations: keyRows.map((c) => String(c.coll ?? "BINARY").toUpperCase()),
        partial: Number(r.partial ?? 0) === 1,
        sql: indexSql.get(idxName) ?? null,
      })
    }
    indexes.sort((a, b) => indexKey(a).localeCompare(indexKey(b)))

    tables.push({ name, columns, foreignKeys, indexes, createSql: sql })
  }

  return { tables, objects }
}

/**
 * Materialise the canonical DDL in a throwaway local SQLite file and read its
 * structure back. This — not a regex over the DDL text — is the source of
 * truth every comparison is made against. Nothing here ever touches the target
 * database.
 */
export async function canonicalStructureFromDdl(ddl: string): Promise<DatabaseStructure> {
  classifyDdlStatements(ddl)

  const dir = mkdtempSync(join(tmpdir(), "turso-canonical-"))
  const client = createClient({ url: `file:${join(dir, "canonical.db")}` })
  try {
    await client.executeMultiple(`PRAGMA foreign_keys=OFF;\n${ddl}`)
    return await introspectStructure(asReadOnly(client))
  } finally {
    client.close()
    rmSync(dir, { recursive: true, force: true })
  }
}

// ---------------------------------------------------------------------------
// Read-only structural comparison
// ---------------------------------------------------------------------------

export type FindingKind = "drift" | "unverifiable"

export type FindingCategory =
  | "missing-table"
  | "extra-table"
  | "missing-object"
  | "extra-object"
  | "missing-column"
  | "extra-column"
  | "column-mismatch"
  | "missing-foreign-key"
  | "extra-foreign-key"
  | "foreign-key-mismatch"
  | "missing-index"
  | "extra-index"
  | "index-mismatch"
  | "check-constraint"
  | "generated-column"
  | "expression-index"
  | "collation"
  | "unsupported-construct"

export interface StructuralFinding {
  kind: FindingKind
  category: FindingCategory
  /** `Table`, `Table.column` or an index name. Safe to log. */
  object: string
  detail: string
}

export type VerificationVerdict = "identical" | "drift detected" | "structure not verifiable"

export interface StructuralReport {
  verdict: VerificationVerdict
  /** Differences proven to exist. */
  drift: StructuralFinding[]
  /** Constructs this tool cannot compare faithfully, on either side. */
  unverifiable: StructuralFinding[]
}

/**
 * Constructs SQLite's PRAGMAs do not describe faithfully. Rather than compare
 * what we can see and silently assume the rest matches, we report them and
 * refuse the `identical` verdict.
 */
function unverifiableIn(table: TableStructure, side: string): StructuralFinding[] {
  const findings: StructuralFinding[] = []
  const add = (category: FindingCategory, object: string, detail: string) =>
    findings.push({ kind: "unverifiable", category, object, detail: `${detail} (${side})` })

  if (!table.createSql) {
    add("unsupported-construct", table.name, "no CREATE TABLE statement is recorded for this table")
    return findings
  }

  const bare = stripSqlLiterals(table.createSql)
  if (/\bCHECK\s*\(/i.test(bare)) {
    add("check-constraint", table.name, "CHECK constraints are not exposed by PRAGMA and cannot be compared")
  }
  if (/\bCOLLATE\b/i.test(bare)) {
    add("collation", table.name, "column collations are not exposed by PRAGMA table_xinfo")
  }
  if (/\bGENERATED\s+ALWAYS\b/i.test(bare) || /\bAS\s*\(/i.test(bare)) {
    add("generated-column", table.name, "generated-column expressions are not exposed by PRAGMA")
  }
  if (/\bWITHOUT\s+ROWID\b/i.test(bare)) {
    add("unsupported-construct", table.name, "WITHOUT ROWID tables are not modelled")
  }
  if (/\bSTRICT\b/i.test(bare)) {
    add("unsupported-construct", table.name, "STRICT tables are not modelled")
  }
  if (/\bAUTOINCREMENT\b/i.test(bare)) {
    add("unsupported-construct", table.name, "AUTOINCREMENT is not exposed by PRAGMA table_xinfo")
  }

  for (const column of table.columns) {
    if (column.hidden !== 0) {
      add(
        "generated-column",
        `${table.name}.${column.name}`,
        `hidden/generated column (hidden=${column.hidden}) cannot be compared faithfully`,
      )
    }
  }

  for (const index of table.indexes) {
    if (index.columns.some((c) => c.startsWith("<expr>"))) {
      add(
        "expression-index",
        `${table.name}.${index.name}`,
        "expression indexes are not exposed as columns by PRAGMA index_xinfo",
      )
    }
  }

  return findings
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
 * Compare a live structure against the canonical one and produce a read-only
 * report. This function never produces a plan, a statement, or a suggestion of
 * how to fix anything — it only states what differs.
 *
 * The verdict is `identical` **only** when nothing differs AND nothing on
 * either side falls outside what PRAGMAs describe faithfully.
 */
export function compareStructures(
  expected: DatabaseStructure,
  actual: DatabaseStructure,
): StructuralReport {
  const drift: StructuralFinding[] = []
  const unverifiable: StructuralFinding[] = []
  const driftAt = (category: FindingCategory, object: string, detail: string) =>
    drift.push({ kind: "drift", category, object, detail })

  const actualByName = new Map(actual.tables.map((t) => [t.name, t]))
  const expectedByName = new Map(expected.tables.map((t) => [t.name, t]))

  for (const table of expected.tables) {
    unverifiable.push(...unverifiableIn(table, "schema.prisma"))

    const live = actualByName.get(table.name)
    if (!live) {
      driftAt("missing-table", table.name, "declared in schema.prisma, absent from the database")
      continue
    }
    unverifiable.push(...unverifiableIn(live, "database"))

    // --- columns -----------------------------------------------------------
    const liveColumns = new Map(live.columns.map((c) => [c.name, c]))
    for (const column of table.columns) {
      const liveColumn = liveColumns.get(column.name)
      if (!liveColumn) {
        driftAt(
          "missing-column",
          `${table.name}.${column.name}`,
          `expected ${describeColumn(column)}`,
        )
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
      // Raw comparison: a default differing only in whitespace is a real
      // difference and must never be normalized away.
      if (liveColumn.defaultValue !== column.defaultValue) {
        differences.push(
          `default ${liveColumn.defaultValue ?? "(none)"} → ${column.defaultValue ?? "(none)"}`,
        )
      }
      if (liveColumn.pkPosition !== column.pkPosition) {
        differences.push(`primary-key position ${liveColumn.pkPosition} → ${column.pkPosition}`)
      }
      if (liveColumn.hidden !== column.hidden) {
        differences.push(`hidden ${liveColumn.hidden} → ${column.hidden}`)
      }
      if (differences.length) {
        driftAt("column-mismatch", `${table.name}.${column.name}`, differences.join("; "))
      }
    }

    const expectedColumns = new Set(table.columns.map((c) => c.name))
    for (const column of live.columns) {
      if (!expectedColumns.has(column.name)) {
        driftAt(
          "extra-column",
          `${table.name}.${column.name}`,
          "present in the database, absent from schema.prisma",
        )
      }
    }

    // --- foreign keys ------------------------------------------------------
    const liveFks = new Map(live.foreignKeys.map((fk) => [foreignKeyKey(fk), fk]))
    for (const fk of table.foreignKeys) {
      const key = foreignKeyKey(fk)
      const liveFk = liveFks.get(key)
      if (!liveFk) {
        driftAt("missing-foreign-key", `${table.name} ${key}`, "declared in schema.prisma, absent from the database")
        continue
      }
      if (liveFk.onDelete !== fk.onDelete || liveFk.onUpdate !== fk.onUpdate) {
        driftAt(
          "foreign-key-mismatch",
          `${table.name} ${key}`,
          `ON DELETE ${liveFk.onDelete} → ${fk.onDelete}, ON UPDATE ${liveFk.onUpdate} → ${fk.onUpdate}`,
        )
      }
    }
    const expectedFks = new Set(table.foreignKeys.map(foreignKeyKey))
    for (const fk of live.foreignKeys) {
      const key = foreignKeyKey(fk)
      if (!expectedFks.has(key)) {
        driftAt("extra-foreign-key", `${table.name} ${key}`, "present in the database, absent from schema.prisma")
      }
    }

    // --- indexes -----------------------------------------------------------
    const liveIndexes = new Map(live.indexes.map((i) => [indexKey(i), i]))
    for (const index of table.indexes) {
      const key = indexKey(index)
      const liveIndex = liveIndexes.get(key)
      if (!liveIndex) {
        driftAt("missing-index", `${table.name} ${key}`, "declared in schema.prisma, absent from the database")
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
      if (liveIndex.collations.join(",") !== index.collations.join(",")) {
        differences.push(
          `collations (${liveIndex.collations.join(", ")}) → (${index.collations.join(", ")})`,
        )
      }
      if (liveIndex.partial !== index.partial) {
        differences.push(`${liveIndex.partial ? "partial" : "full"} → ${index.partial ? "partial" : "full"}`)
      }
      if (index.partial && liveIndex.sql !== index.sql) {
        differences.push("partial-index predicate differs")
      }
      if (differences.length) {
        driftAt("index-mismatch", `${table.name}.${index.name}`, differences.join("; "))
      }
    }
    const expectedIndexes = new Set(table.indexes.map(indexKey))
    for (const index of live.indexes) {
      if (!expectedIndexes.has(indexKey(index))) {
        driftAt(
          "extra-index",
          `${table.name}.${index.name}`,
          "present in the database, absent from schema.prisma",
        )
      }
    }
  }

  for (const table of actual.tables) {
    if (!expectedByName.has(table.name)) {
      driftAt("extra-table", table.name, "present in the database, absent from schema.prisma")
      unverifiable.push(...unverifiableIn(table, "database"))
    }
  }

  // --- views and triggers ---------------------------------------------------
  const objectKey = (o: DatabaseObject) => `${o.type} ${o.name}`
  const expectedObjects = new Set(expected.objects.map(objectKey))
  const actualObjects = new Set(actual.objects.map(objectKey))
  for (const o of expected.objects) {
    if (!actualObjects.has(objectKey(o))) {
      driftAt("missing-object", objectKey(o), "declared in schema.prisma, absent from the database")
    }
  }
  for (const o of actual.objects) {
    if (!expectedObjects.has(objectKey(o))) {
      driftAt(
        "extra-object",
        objectKey(o),
        `${o.type} present in the database, absent from schema.prisma` +
          (o.type === "trigger" ? " — a trigger runs against the application's own tables" : ""),
      )
    }
  }

  const verdict: VerificationVerdict = drift.length
    ? "drift detected"
    : unverifiable.length
      ? "structure not verifiable"
      : "identical"

  return { verdict, drift, unverifiable }
}

/** Render a report for a terminal. Contains no URL, host or credential. */
export function formatReport(report: StructuralReport): string {
  const lines = [`Verdict: ${report.verdict}`]
  if (report.drift.length) {
    lines.push("", `Differences (${report.drift.length}):`)
    for (const f of report.drift) lines.push(`  [${f.category}] ${f.object}: ${f.detail}`)
  }
  if (report.unverifiable.length) {
    lines.push("", `Not verifiable (${report.unverifiable.length}):`)
    for (const f of report.unverifiable) lines.push(`  [${f.category}] ${f.object}: ${f.detail}`)
  }
  return lines.join("\n")
}
