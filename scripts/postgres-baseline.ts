/**
 * PostgreSQL baseline tooling (NEON-02, adapted to the canonical PostgreSQL
 * schema in NEON-03).
 *
 * ONE canonical schema, ONE generated history:
 *
 *   prisma/schema.prisma                       canonical (provider "postgresql" since NEON-03)
 *     └─ generate-init ─▶ prisma/migrations-postgres/0_init/migration.sql
 *                                                empty → canonical, produced by
 *                                                `prisma migrate diff`, audited,
 *                                                IMMUTABLE once written
 *          └─ verify ─▶ EMPTY local PostgreSQL proven empty first (read-only), then
 *                        the history applied by THIS run, ledger checked, `migrate diff`
 *                        applied-DB → canonical schema EMPTY, second deploy a no-op
 *
 * Until NEON-03 the canonical schema carried the SQLite provider and a derived
 * PostgreSQL variant (`generated/schema.postgres.prisma`) fed this tooling.
 * That derivation no longer exists: the canonical schema IS the PostgreSQL
 * schema, and `0_init` is regenerated from it byte-for-byte (the file's
 * sha256 is pinned below). The SQLite history (`prisma/migrations`) is legacy
 * and is verified by `scripts/build-db-from-history.ts`; the two histories
 * never share a directory.
 *
 * Baseline immutability (R3): `generate-init` writes 0_init only when it does
 * not exist; an existing byte-identical file is reported unchanged; an existing
 * DIFFERENT file is a hard failure with no override flag. Schema changes after
 * publication belong in a NEW PostgreSQL migration, never in a rewritten 0_init.
 *
 * Verify contract (R3): the database behind POSTGRES_VERIFY_URL must be EMPTY
 * and disposable. Emptiness is proven BEFORE any DDL with read-only checks
 * (a `DO` block over information_schema executed through `prisma db execute`,
 * plus `prisma migrate diff --from-empty --to-config-datasource`). The first
 * `migrate deploy` must apply `0_init` in this invocation ("No pending
 * migrations" is NOT accepted), the ledger must hold exactly the expected
 * completed rows, the applied database must equal the canonical schema, and a
 * second deploy must be a no-op.
 *
 * Safety: `verify` refuses any database host that is not loopback unless
 * POSTGRES_VERIFY_ALLOW_REMOTE=1 is set explicitly. That override bypasses
 * ONLY the hostname restriction — never the empty-database requirement, the
 * ledger requirements or the baseline immutability. DATABASE_URL, DIRECT_URL
 * and Turso variables are removed from every child process; the repository
 * `prisma.config.ts` is never used (a temporary, dotenv-free config names the
 * disposable database explicitly); connection URLs are never printed.
 *
 * CLI:
 *   tsx scripts/postgres-baseline.ts generate-init
 *   POSTGRES_VERIFY_URL=postgresql://…@127.0.0.1:5432/empty tsx scripts/postgres-baseline.ts verify
 */

import { createHash } from "node:crypto"
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { REPO_ROOT, redactConnectionUrls, runPrisma, writeTempPrismaConfig, type TempPrismaConfig } from "./lib/prisma-cli"

export { redactConnectionUrls }

export const CANONICAL_SCHEMA_PATH = join(REPO_ROOT, "prisma", "schema.prisma")
export const POSTGRES_MIGRATIONS_DIR = join(REPO_ROOT, "prisma", "migrations-postgres")
export const POSTGRES_INIT_SQL_PATH = join(POSTGRES_MIGRATIONS_DIR, "0_init", "migration.sql")
export const BASELINE_MIGRATION_NAME = "0_init"

/**
 * The PostgreSQL history, in order. `0_init` is the immutable baseline whose
 * content is pinned by sha256; later schema changes append NEW entries here
 * (and a new directory) — they never touch `0_init`.
 */
export const EXPECTED_POSTGRES_MIGRATIONS = [
  BASELINE_MIGRATION_NAME,
  "7_finesse_appointments_v2",
] as const
export const BASELINE_SHA256 = "679d9d18e72a3fa101bd96f6c39b2194ba38ae86de35359a3e46be8d662af30e"

export const VERIFY_URL_VAR = "POSTGRES_VERIFY_URL"

export function sha256(text: string | Buffer): string {
  return createHash("sha256").update(text).digest("hex")
}

/**
 * The canonical schema must declare exactly one datasource, and its provider
 * must be `postgresql`. Anything else is a hard failure: this tooling never
 * derives, rewrites or guesses a provider.
 */
export function assertCanonicalPostgresSchema(schema: string): void {
  const lines = schema.split("\n")
  const providers: string[] = []
  let inDatasource = false
  for (const line of lines) {
    if (/^datasource\s+\w+\s*\{/.test(line)) inDatasource = true
    else if (/^\}/.test(line)) inDatasource = false
    const match = inDatasource ? /^\s*provider\s*=\s*"([^"]+)"\s*$/.exec(line) : null
    if (match) providers.push(match[1])
  }
  if (providers.length !== 1) {
    throw new Error(`postgres-baseline: expected exactly one datasource provider line in prisma/schema.prisma, found ${providers.length}`)
  }
  if (providers[0] !== "postgresql") {
    throw new Error(`postgres-baseline: canonical datasource provider is "${providers[0]}", not "postgresql" — the PostgreSQL history cannot be generated or verified from it`)
  }
}

/** SQLite constructs that must never appear in the PostgreSQL baseline. */
export const SQLITE_REMNANT_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  { name: "PRAGMA", regex: /\bPRAGMA\b/i },
  { name: "DATETIME type", regex: /\bDATETIME\b/i },
  { name: "AUTOINCREMENT", regex: /\bAUTOINCREMENT\b/i },
  { name: "rowid", regex: /\browid\b/i },
  { name: "sqlite_ internals", regex: /\bsqlite_/i },
  { name: "table rebuild (new_ prefix)", regex: /CREATE TABLE "new_/ },
  { name: "INSERT INTO (data copy)", regex: /\bINSERT INTO\b/i },
  { name: "RENAME TO", regex: /\bRENAME TO\b/i },
  { name: "DROP TABLE", regex: /\bDROP TABLE\b/i },
  { name: "? placeholder", regex: /\?/ },
  { name: "strftime()", regex: /\bstrftime\s*\(/i },
  { name: "datetime()", regex: /\bdatetime\s*\(/i },
  { name: "json_extract()", regex: /\bjson_extract\s*\(/i },
]

/** PostgreSQL constructs that the fidelity-first target does not use. */
export const UNEXPECTED_POSTGRES_PATTERNS: ReadonlyArray<{ name: string; regex: RegExp }> = [
  { name: "SERIAL", regex: /\bSERIAL\b/ },
  { name: "IDENTITY", regex: /GENERATED .* AS IDENTITY/ },
  { name: "JSONB", regex: /\bJSONB\b/ },
  { name: "CREATE TYPE (enum)", regex: /\bCREATE TYPE\b/ },
  { name: "gen_random_uuid", regex: /gen_random_uuid/ },
  { name: "UUID type", regex: /\bUUID\b/ },
  { name: "DEFERRABLE", regex: /\bDEFERRABLE\b/ },
  { name: "CREATE EXTENSION", regex: /\bCREATE EXTENSION\b/ },
  { name: "TIMESTAMPTZ", regex: /\bTIMESTAMPTZ\b|WITH TIME ZONE/ },
  { name: "NUMERIC/DECIMAL", regex: /\b(NUMERIC|DECIMAL)\b/ },
]

export interface BaselineCounts {
  createTable: number
  createIndex: number
  createUniqueIndex: number
  foreignKeys: number
  onDeleteCascade: number
  onDeleteSetNull: number
  onDeleteRestrict: number
  primaryKeys: number
}

export function countBaseline(sql: string): BaselineCounts {
  const count = (re: RegExp) => (sql.match(re) ?? []).length
  return {
    createTable: count(/^CREATE TABLE /gm),
    createIndex: count(/^CREATE INDEX /gm),
    createUniqueIndex: count(/^CREATE UNIQUE INDEX /gm),
    foreignKeys: count(/FOREIGN KEY/g),
    onDeleteCascade: count(/ON DELETE CASCADE/g),
    onDeleteSetNull: count(/ON DELETE SET NULL/g),
    onDeleteRestrict: count(/ON DELETE RESTRICT/g),
    primaryKeys: count(/PRIMARY KEY/g),
  }
}

/** Static audit of a generated baseline: SQLite remnants and unexpected PostgreSQL constructs. */
export function auditBaselineSql(sql: string): string[] {
  const findings: string[] = []
  for (const { name, regex } of SQLITE_REMNANT_PATTERNS) if (regex.test(sql)) findings.push(`SQLite remnant: ${name}`)
  for (const { name, regex } of UNEXPECTED_POSTGRES_PATTERNS) if (regex.test(sql)) findings.push(`unexpected PostgreSQL construct: ${name}`)
  const identifiersOver63 = new Set((sql.match(/"[A-Za-z0-9_]{64,}"/g) ?? []).map((s) => s.slice(1, -1)))
  for (const ident of identifiersOver63) findings.push(`identifier longer than 63 characters (PostgreSQL would truncate): ${ident}`)
  return findings
}

// ─── Pure contracts (unit-tested) ───────────────────────────────────────────

/**
 * Baseline immutability. `existing` is the current 0_init on disk (null when
 * absent), `fresh` the newly generated SQL. There is deliberately no override.
 */
export function reconcileBaseline(existing: string | null, fresh: string): "write" | "unchanged" {
  if (existing === null) return "write"
  if (existing === fresh) return "unchanged"
  throw new Error(
    `postgres-baseline: ${BASELINE_MIGRATION_NAME} already exists and DIFFERS from a fresh generation (existing sha256=${sha256(existing)}, fresh sha256=${sha256(fresh)}). A published baseline is immutable: schema changes belong in a NEW PostgreSQL migration, never in a rewritten ${BASELINE_MIGRATION_NAME}.`,
  )
}

/**
 * READ-ONLY emptiness assertion, executed through `prisma db execute`. Counts
 * every base table outside the system schemas; a non-zero count raises, which
 * makes the CLI exit non-zero BEFORE any DDL. `_prisma_migrations` counts as a
 * user table on purpose: a database that already carries a ledger is not empty.
 */
export const EMPTY_DATABASE_ASSERTION_SQL = [
  "DO $$",
  "DECLARE n integer;",
  "BEGIN",
  "  SELECT COUNT(*) INTO n FROM information_schema.tables",
  "   WHERE table_type = 'BASE TABLE' AND table_schema NOT IN ('pg_catalog', 'information_schema');",
  "  IF n <> 0 THEN",
  "    RAISE EXCEPTION 'POSTGRES_BASELINE_NOT_EMPTY: % user table(s) present', n;",
  "  END IF;",
  "END $$;",
  "",
].join("\n")

/**
 * READ-ONLY ledger assertion: exactly the expected migrations, each recorded
 * once as a completed, single-step, non-rolled-back row — and nothing else.
 */
export function ledgerAssertionSql(expected: readonly string[] = EXPECTED_POSTGRES_MIGRATIONS): string {
  const names = expected.map((name) => `'${name}'`).join(", ")
  return [
    "DO $$",
    "DECLARE total integer; ok integer;",
    "BEGIN",
    '  SELECT COUNT(*) INTO total FROM "_prisma_migrations";',
    '  SELECT COUNT(DISTINCT migration_name) INTO ok FROM "_prisma_migrations"',
    `   WHERE migration_name IN (${names}) AND applied_steps_count = 1`,
    "     AND finished_at IS NOT NULL AND rolled_back_at IS NULL;",
    `  IF total <> ${expected.length} OR ok <> ${expected.length} THEN`,
    "    RAISE EXCEPTION 'POSTGRES_BASELINE_LEDGER_INVALID: % row(s), % valid expected row(s)', total, ok;",
    "  END IF;",
    "END $$;",
    "",
  ].join("\n")
}

export const LEDGER_ASSERTION_SQL = ledgerAssertionSql()

/** The first deploy must have applied 0_init in THIS invocation. */
export function assertFirstDeployApplied(output: string): void {
  if (/No pending migrations/.test(output)) {
    throw new Error("postgres-baseline: the first migrate deploy found nothing to apply — the database was not empty (0_init already recorded). verify requires an EMPTY disposable database.")
  }
  if (!new RegExp(`Applying migration \`${BASELINE_MIGRATION_NAME}\``).test(output) || !/successfully applied/.test(output)) {
    throw new Error(`postgres-baseline: unexpected first migrate deploy output (expected ${BASELINE_MIGRATION_NAME} to be applied now):\n${redactConnectionUrls(output)}`)
  }
}

/** The second deploy must be a no-op. */
export function assertRedeployNoop(output: string): void {
  if (!/No pending migrations/.test(output)) {
    throw new Error(`postgres-baseline: second migrate deploy was not a no-op:\n${redactConnectionUrls(output)}`)
  }
}

/**
 * `migrate diff --script` output that is the EXPLICIT empty-migration marker
 * and nothing else. Blank output is NOT an empty diff: Prisma 7.4.1 prints
 * nothing at all (exit 0) when the config it loaded has no datasource, so an
 * absent marker is treated as "no diff was computed" and fails closed.
 */
export const EMPTY_MIGRATION_MARKER = "-- This is an empty migration"

export function isEmptyDiff(output: string): boolean {
  const lines = output.split("\n").filter((l) => l.trim() && !/^Loaded Prisma config/.test(l))
  return lines.length === 1 && lines[0].startsWith(EMPTY_MIGRATION_MARKER)
}

/**
 * `migrate diff --from-empty --to-schema` never opens a connection, but Prisma
 * 7.4.1 silently emits NOTHING unless the loaded config declares a datasource
 * url. generate-init therefore hands the CLI a temporary config carrying this
 * loopback placeholder (port 1: nothing listens) — if Prisma ever did connect,
 * the command would fail loudly instead of producing a wrong baseline.
 */
export const NO_CONNECTION_PLACEHOLDER_URL = "postgresql://placeholder@127.0.0.1:1/never-connected"

/** Verify never runs against a non-loopback host unless explicitly allowed. */
export function assertLocalPostgresUrl(url: string, allowRemote = process.env.POSTGRES_VERIFY_ALLOW_REMOTE === "1"): void {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error(`postgres-baseline: ${VERIFY_URL_VAR} is not a valid URL`)
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`postgres-baseline: ${VERIFY_URL_VAR} must be a postgresql:// URL (got scheme ${parsed.protocol})`)
  }
  const host = parsed.hostname
  const loopback = host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]"
  if (!loopback && !allowRemote) {
    throw new Error("postgres-baseline: verify only runs against a LOOPBACK PostgreSQL by default (an ephemeral, empty database). POSTGRES_VERIFY_ALLOW_REMOTE=1 bypasses ONLY this hostname check — never the empty-database, ledger or immutability requirements — and is meant for a disposable non-production database, never Neon production.")
  }
}

// ─── Process helpers ────────────────────────────────────────────────────────

/** Run a read-only assertion script through `prisma db execute`; throws on RAISE. */
function runAssertion(sql: string, config: TempPrismaConfig): void {
  runPrisma(["db", "execute", "--stdin", "--config", config.configPath], { input: sql })
}

function out(line: string): void {
  process.stdout.write(`${line}\n`)
}

function readCanonicalSchema(): string {
  const schema = readFileSync(CANONICAL_SCHEMA_PATH, "utf8")
  assertCanonicalPostgresSchema(schema)
  return schema
}

// ─── Commands ───────────────────────────────────────────────────────────────

export function commandGenerateInit(): void {
  readCanonicalSchema()
  const config = writeTempPrismaConfig({
    schemaPath: CANONICAL_SCHEMA_PATH,
    migrationsDir: POSTGRES_MIGRATIONS_DIR,
    url: NO_CONNECTION_PLACEHOLDER_URL,
    prefix: "postgres-baseline-init-",
  })
  let sql: string
  try {
    sql = runPrisma(["migrate", "diff", "--from-empty", "--to-schema", CANONICAL_SCHEMA_PATH, "--script", "--config", config.configPath])
  } finally {
    config.cleanup()
  }
  if (!sql.trim()) throw new Error("postgres-baseline: migrate diff produced no output — refusing to treat a blank result as a baseline")
  const findings = auditBaselineSql(sql)
  if (findings.length > 0) throw new Error(`postgres-baseline: generated ${BASELINE_MIGRATION_NAME} failed the static audit:\n  - ${findings.join("\n  - ")}`)
  const existing = existsSync(POSTGRES_INIT_SQL_PATH) ? readFileSync(POSTGRES_INIT_SQL_PATH, "utf8") : null
  const action = reconcileBaseline(existing, sql)
  if (action === "unchanged") {
    out(`[postgres-baseline] ${BASELINE_MIGRATION_NAME} unchanged sha256=${sha256(sql)}`)
    return
  }
  mkdirSync(dirname(POSTGRES_INIT_SQL_PATH), { recursive: true })
  writeFileSync(POSTGRES_INIT_SQL_PATH, sql)
  writeFileSync(join(POSTGRES_MIGRATIONS_DIR, "migration_lock.toml"), '# Please do not edit this file manually\n# It should be added in your version-control system (e.g., Git)\nprovider = "postgresql"\n')
  const c = countBaseline(sql)
  out(`[postgres-baseline] wrote ${POSTGRES_INIT_SQL_PATH} sha256=${sha256(sql)} tables=${c.createTable} indexes=${c.createIndex + c.createUniqueIndex} (unique ${c.createUniqueIndex}) fks=${c.foreignKeys} cascade=${c.onDeleteCascade} setnull=${c.onDeleteSetNull}`)
}

export function commandVerify(): void {
  const url = process.env[VERIFY_URL_VAR]
  if (!url) throw new Error(`postgres-baseline: ${VERIFY_URL_VAR} is not set (point it at an EMPTY, ephemeral local PostgreSQL database)`)
  assertLocalPostgresUrl(url)

  // 1. The canonical schema is the PostgreSQL schema.
  readCanonicalSchema()
  out("[postgres-baseline] 1/7 canonical schema provider is postgresql: OK")

  // 2. The history directory holds exactly the expected migrations; 0_init is pinned and audit-clean.
  const dirs = readdirSync(POSTGRES_MIGRATIONS_DIR, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort()
  if (JSON.stringify(dirs) !== JSON.stringify([...EXPECTED_POSTGRES_MIGRATIONS].sort())) {
    throw new Error(`postgres-baseline: prisma/migrations-postgres holds ${JSON.stringify(dirs)}, expected ${JSON.stringify(EXPECTED_POSTGRES_MIGRATIONS)}`)
  }
  if (!existsSync(POSTGRES_INIT_SQL_PATH)) throw new Error(`postgres-baseline: ${POSTGRES_INIT_SQL_PATH} is missing — run generate-init`)
  const existing = readFileSync(POSTGRES_INIT_SQL_PATH, "utf8")
  const findings = auditBaselineSql(existing)
  if (findings.length > 0) throw new Error(`postgres-baseline: ${BASELINE_MIGRATION_NAME} failed the static audit:\n  - ${findings.join("\n  - ")}`)
  const hash = sha256(existing)
  if (hash !== BASELINE_SHA256) throw new Error(`postgres-baseline: ${BASELINE_MIGRATION_NAME} sha256=${hash} differs from the pinned baseline ${BASELINE_SHA256} — the baseline is immutable`)
  out(`[postgres-baseline] 2/7 history=${JSON.stringify(dirs)}; ${BASELINE_MIGRATION_NAME} audit-clean and pinned sha256=${hash}`)

  const config = writeTempPrismaConfig({
    schemaPath: CANONICAL_SCHEMA_PATH,
    migrationsDir: POSTGRES_MIGRATIONS_DIR,
    url,
    prefix: "postgres-baseline-verify-",
  })
  try {
    // 3. READ-ONLY preflight, BEFORE any DDL: the database must be empty.
    try {
      runAssertion(EMPTY_DATABASE_ASSERTION_SQL, config)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      const match = /POSTGRES_BASELINE_NOT_EMPTY: [^\n]*/.exec(detail)
      throw new Error(`postgres-baseline: db:postgres:verify requires an EMPTY disposable database and refused to touch this one — ${match ? match[0] : detail}`)
    }
    const fromEmpty = runPrisma(["migrate", "diff", "--from-empty", "--to-config-datasource", "--script", "--config", config.configPath])
    if (!isEmptyDiff(fromEmpty)) {
      throw new Error("postgres-baseline: db:postgres:verify requires an EMPTY disposable database — `migrate diff --from-empty --to-config-datasource` is not empty, nothing was applied")
    }
    out("[postgres-baseline] 3/7 preflight: database is EMPTY (read-only check, no DDL executed)")

    // 4. Apply from zero — 0_init must be applied by THIS invocation.
    const deploy1 = runPrisma(["migrate", "deploy", "--config", config.configPath])
    assertFirstDeployApplied(deploy1)
    out(`[postgres-baseline] 4/7 migrate deploy applied ${BASELINE_MIGRATION_NAME} now: OK`)

    // 5. Ledger: exactly the expected completed, single-step, non-rolled-back rows.
    try {
      runAssertion(LEDGER_ASSERTION_SQL, config)
    } catch (err) {
      const detail = err instanceof Error ? err.message : String(err)
      const match = /POSTGRES_BASELINE_LEDGER_INVALID: [^\n]*/.exec(detail)
      throw new Error(`postgres-baseline: migration ledger does not hold exactly ${JSON.stringify(EXPECTED_POSTGRES_MIGRATIONS)} — ${match ? match[0] : detail}`)
    }
    out(`[postgres-baseline] 5/7 ledger: exactly ${EXPECTED_POSTGRES_MIGRATIONS.length} completed row(s) ${JSON.stringify(EXPECTED_POSTGRES_MIGRATIONS)} (applied_steps_count=1, finished, not rolled back)`)

    // 6. Applied database ↔ canonical schema must be an empty diff.
    const diff = runPrisma(["migrate", "diff", "--from-config-datasource", "--to-schema", CANONICAL_SCHEMA_PATH, "--script", "--config", config.configPath])
    if (!isEmptyDiff(diff)) throw new Error(`postgres-baseline: applied database differs from the canonical schema:\n${redactConnectionUrls(diff)}`)
    out("[postgres-baseline] 6/7 applied DB → canonical schema diff: EMPTY")

    // 7. Second deploy is a no-op.
    assertRedeployNoop(runPrisma(["migrate", "deploy", "--config", config.configPath]))
    out("[postgres-baseline] 7/7 second migrate deploy: no-op")
    out("[postgres-baseline] OK — EMPTY → history applied now → ledger correct → schema equals canonical → redeploy no-op")
  } finally {
    config.cleanup()
  }
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const [command, ...rest] = process.argv.slice(2)
  try {
    if (rest.length > 0) throw new Error(`postgres-baseline: unexpected argument(s): ${rest.join(" ")} (this tool takes no flags)`)
    switch (command) {
      case "generate-init":
        commandGenerateInit()
        break
      case "verify":
        commandVerify()
        break
      default:
        throw new Error("usage: postgres-baseline.ts <generate-init|verify>")
    }
  } catch (err) {
    console.error(`[postgres-baseline] FAIL: ${err instanceof Error ? err.message : String(err)}`)
    process.exit(1)
  }
}
