/**
 * PostgreSQL test infrastructure (NEON-03) — one DISPOSABLE database per test
 * file, built from the real PostgreSQL migration history.
 *
 * CONTRACT
 * --------
 *   - `TEST_DATABASE_URL` must point at a LOOPBACK PostgreSQL server (an
 *     ephemeral local instance or the CI service container) as a role allowed
 *     to `CREATE DATABASE`. There is no override for non-loopback hosts: tests
 *     create and drop databases and must never be pointed at a shared server.
 *   - When the variable is missing or invalid the test file FAILS in
 *     `before()`. Nothing is skipped, and there is no SQLite fallback: a suite
 *     that silently passes without exercising PostgreSQL would be worthless.
 *   - Each call creates a fresh database (`t7f_<label>_<pid>_<random>`), runs
 *     `prisma migrate deploy` over `prisma/migrations-postgres` through a
 *     temporary dotenv-free config, points `DATABASE_URL` at it and removes
 *     every legacy connection variable, so the lazily initialised `core/db.ts`
 *     imported afterwards can only ever reach that throwaway database.
 *   - `dispose()` disconnects nothing on its own (the caller owns the Prisma
 *     client) and drops the database with `WITH (FORCE)`.
 *
 * Node's test runner executes files in parallel processes; the pid + random
 * suffix keeps concurrently provisioned databases apart.
 */

import { randomBytes } from "node:crypto"
import { join } from "node:path"
import { Client } from "pg"
import { CONNECTION_ENV_KEYS, REPO_ROOT, runPrisma, writeTempPrismaConfig } from "../../scripts/lib/prisma-cli"

export const TEST_DATABASE_URL_VAR = "TEST_DATABASE_URL"
export const TEST_DATABASE_PREFIX = "t7f_"

const POSTGRES_MIGRATIONS_DIR = join(REPO_ROOT, "prisma", "migrations-postgres")
const CANONICAL_SCHEMA_PATH = join(REPO_ROOT, "prisma", "schema.prisma")

export interface ProvisionedDatabase {
  /** Connection string of the throwaway database (already in `process.env.DATABASE_URL`). */
  readonly url: string
  readonly name: string
  /** Drop the database. Disconnect the Prisma client first; open sessions are terminated anyway. */
  dispose(): Promise<void>
}

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"])

/** Validate the admin URL: present, PostgreSQL, loopback. Never echoes the value. */
export function resolveTestDatabaseAdminUrl(raw: string | undefined = process.env[TEST_DATABASE_URL_VAR]): URL {
  if (!raw) {
    throw new Error(
      `[7F test] ${TEST_DATABASE_URL_VAR} is not set. PostgreSQL integration tests need an ephemeral LOCAL PostgreSQL 16 ` +
        `(e.g. \`docker run --rm -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16\`) and ` +
        `${TEST_DATABASE_URL_VAR}=postgresql://postgres:postgres@127.0.0.1:5432/postgres. There is no SQLite fallback and tests are never skipped.`,
    )
  }
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new Error(`[7F test] ${TEST_DATABASE_URL_VAR} is not a valid URL`)
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new Error(`[7F test] ${TEST_DATABASE_URL_VAR} must be a postgresql:// URL (got scheme ${parsed.protocol})`)
  }
  if (!LOOPBACK_HOSTS.has(parsed.hostname)) {
    throw new Error(
      `[7F test] ${TEST_DATABASE_URL_VAR} must point at a LOOPBACK host (localhost, 127.0.0.1 or ::1). ` +
        "Tests create and drop databases; they never run against a shared or remote server, and there is no override.",
    )
  }
  return parsed
}

function databaseNameFor(label: string): string {
  const safe = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24)
  return `${TEST_DATABASE_PREFIX}${safe || "test"}_${process.pid}_${randomBytes(4).toString("hex")}`
}

function withDatabase(admin: URL, name: string): string {
  const url = new URL(admin.toString())
  url.pathname = `/${name}`
  return url.toString()
}

/** PostgreSQL identifiers are quoted; the generated name only contains [a-z0-9_]. */
function quoteIdent(name: string): string {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`[7F test] refusing to use database name ${JSON.stringify(name)}`)
  return `"${name}"`
}

async function withAdminClient<T>(admin: URL, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: admin.toString() })
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

/**
 * Create a fresh database from the PostgreSQL history and make it THE runtime
 * database for this process: `DATABASE_URL` is set, every other connection
 * variable is removed. Import `@core/db` only AFTER awaiting this.
 */
export async function provisionTestDatabase(label: string): Promise<ProvisionedDatabase> {
  const admin = resolveTestDatabaseAdminUrl()
  const name = databaseNameFor(label)
  await withAdminClient(admin, (client) => client.query(`CREATE DATABASE ${quoteIdent(name)}`))
  const url = withDatabase(admin, name)

  const config = writeTempPrismaConfig({
    schemaPath: CANONICAL_SCHEMA_PATH,
    migrationsDir: POSTGRES_MIGRATIONS_DIR,
    url,
    prefix: `t7f-${name}-`,
  })
  try {
    runPrisma(["migrate", "deploy", "--config", config.configPath])
  } catch (err) {
    await dropDatabase(admin, name).catch(() => undefined)
    throw err
  } finally {
    config.cleanup()
  }

  for (const key of CONNECTION_ENV_KEYS) delete process.env[key]
  process.env.DATABASE_URL = url

  let disposed = false
  return {
    url,
    name,
    async dispose() {
      if (disposed) return
      disposed = true
      await dropDatabase(admin, name)
    },
  }
}

async function dropDatabase(admin: URL, name: string): Promise<void> {
  await withAdminClient(admin, (client) => client.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)} WITH (FORCE)`))
}

/**
 * Raw read-back helper for assertions that must NOT go through the code under
 * test (mirrors the former libSQL `raw.execute` usage in the SQLite tests).
 */
export async function queryRaw<T extends Record<string, unknown> = Record<string, unknown>>(
  url: string,
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  const client = new Client({ connectionString: url })
  await client.connect()
  try {
    const result = await client.query(sql, params as unknown[])
    return result.rows as T[]
  } finally {
    await client.end()
  }
}
