/**
 * PostgreSQL test infrastructure (NEON-03 / R1) — one DISPOSABLE database per
 * test file, built from the real PostgreSQL migration history.
 *
 * CONTRACT
 * --------
 *   - `TEST_DATABASE_URL` names a LOOPBACK PostgreSQL server the suite may
 *     `CREATE DATABASE` on: `postgresql://user[:password]@<loopback>[:port]/db`
 *     and NOTHING else — no query string, no fragment, no socket path. The
 *     installed `pg` parser (pg 8.23 / pg-connection-string 2.14) honours
 *     `?host=`, repeated or percent-encoded keys, `?port=` and socket paths,
 *     any of which would move the effective destination away from the
 *     hostname that was validated. So the URL is never handed to `pg` or to
 *     Prisma: it is parsed ONCE into an explicit `TestConnectionTarget`
 *     (host, port, user, password, database), and every connection — the
 *     admin client, CREATE DATABASE, the migration URL, `DATABASE_URL` for the
 *     runtime, the raw read-back client and DROP DATABASE — is built from
 *     those validated values. There is no override for non-loopback hosts.
 *   - When the variable is missing or invalid the test file FAILS in
 *     `before()`, before any connection is opened. Nothing is skipped, and
 *     there is no SQLite fallback.
 *   - Errors never echo the value: no password, no URL.
 *   - Provisioning also makes the process deterministic for background work:
 *     provider API keys are removed (AI/e-mail providers fail closed with an
 *     explicit error instead of being called), outbound HTTP to any
 *     non-loopback host is blocked and recorded, and fire-and-forget runtime
 *     work is recorded through `core/background-tasks.ts`. Tests settle that
 *     work explicitly (`settleBackgroundTasks`) before asserting on it and
 *     before `dispose()`, which refuses to drop a database while tasks are
 *     still in flight, while settled outcomes were never reviewed, or while
 *     any server session is still open (no `WITH (FORCE)`: leaks are
 *     surfaced, never killed). The network guard is restored only after the
 *     drop, so isolation holds through the whole teardown.
 *
 * Node's test runner executes files in parallel processes; the pid + random
 * suffix keeps concurrently provisioned databases apart.
 */

import { randomBytes } from "node:crypto"
import { join } from "node:path"
import { Client } from "pg"
import { CONNECTION_ENV_KEYS, REPO_ROOT, runPrisma, writeTempPrismaConfig } from "../../scripts/lib/prisma-cli"
import {
  drainBackgroundTasks,
  pendingBackgroundTaskCount,
  startBackgroundTaskRecording,
  stopBackgroundTaskRecording,
  unreviewedBackgroundOutcomes,
  type BackgroundTaskOutcome,
} from "@core/background-tasks"

export const TEST_DATABASE_URL_VAR = "TEST_DATABASE_URL"
export const TEST_DATABASE_PREFIX = "t7f_"

/** Provider credentials the suite must never be able to use. */
export const PROVIDER_ENV_KEYS = ["OPENAI_API_KEY", "DEEPSEEK_API_KEY", "RESEND_API_KEY"] as const

const POSTGRES_MIGRATIONS_DIR = join(REPO_ROOT, "prisma", "migrations-postgres")
const CANONICAL_SCHEMA_PATH = join(REPO_ROOT, "prisma", "schema.prisma")

const LOOPBACK_HOSTS: ReadonlySet<string> = new Set(["localhost", "127.0.0.1", "[::1]"])
const DEFAULT_PORT = 5432

/** Explicit connection parameters. Never a connection string. */
export interface TestConnectionTarget {
  readonly host: string
  readonly port: number
  readonly user: string
  readonly password: string
  readonly database: string
}

export interface ProvisionedDatabase {
  /** Validated parameters of the throwaway database (host/port are the loopback ones that were checked). */
  readonly target: TestConnectionTarget
  /** Connection string BUILT from `target` (no query string) — what `DATABASE_URL` and the migration config carry. */
  readonly url: string
  readonly name: string
  /**
   * Drop the database. Refuses while background tasks are pending or while
   * any server session on the database is still open; disconnect the Prisma
   * client first. Never uses `WITH (FORCE)`: a session that outlives the
   * disconnect is a leak to surface, not something to kill.
   */
  dispose(): Promise<void>
}

class TestDatabaseConfigError extends Error {
  constructor(reason: string) {
    super(`[7F test] ${TEST_DATABASE_URL_VAR} ${reason}`)
    this.name = "TestDatabaseConfigError"
  }
}

/**
 * Parse and validate the admin URL into explicit parameters. Pure: no I/O,
 * no connection. Every rejection names the rule, never the value.
 */
export function resolveTestDatabaseTarget(raw: string | undefined = process.env[TEST_DATABASE_URL_VAR]): TestConnectionTarget {
  if (!raw) {
    throw new TestDatabaseConfigError(
      "is not set. PostgreSQL integration tests need an ephemeral LOCAL PostgreSQL 16 " +
        "(e.g. `docker run --rm -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16`) and " +
        `${TEST_DATABASE_URL_VAR}=postgresql://postgres:postgres@127.0.0.1:5432/postgres. There is no SQLite fallback and tests are never skipped.`,
    )
  }
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    throw new TestDatabaseConfigError("is not a valid URL")
  }
  if (parsed.protocol !== "postgresql:" && parsed.protocol !== "postgres:") {
    throw new TestDatabaseConfigError("must use the postgresql:// scheme (socket:, libsql:, file: and everything else are refused)")
  }
  if (parsed.search !== "" || raw.includes("?")) {
    throw new TestDatabaseConfigError(
      "must not carry a query string: pg honours parameters such as host, port and sslmode that would change the destination after validation",
    )
  }
  if (parsed.hash !== "" || raw.includes("#")) {
    throw new TestDatabaseConfigError("must not carry a fragment")
  }
  const host = parsed.hostname
  if (!LOOPBACK_HOSTS.has(host)) {
    throw new TestDatabaseConfigError(
      "must point at a LOOPBACK host (localhost, 127.0.0.1 or [::1]) — never a remote server, a socket path or an encoded host. " +
        "Tests create and drop databases; there is no override.",
    )
  }
  let port = DEFAULT_PORT
  if (parsed.port !== "") {
    port = Number(parsed.port)
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new TestDatabaseConfigError("has an invalid port")
  }
  const segments = parsed.pathname.split("/").filter(Boolean)
  if (segments.length !== 1 || !/^[A-Za-z0-9_]+$/.test(segments[0])) {
    throw new TestDatabaseConfigError("must name exactly one database (letters, digits, underscore)")
  }
  const user = decodeURIComponent(parsed.username)
  if (!user) throw new TestDatabaseConfigError("must carry a user name")
  const password = decodeURIComponent(parsed.password)
  return { host: host === "[::1]" ? "::1" : host, port, user, password, database: segments[0] }
}

/** Build a connection string from validated parameters — user/password encoded, no query string. */
export function connectionStringFor(target: TestConnectionTarget): string {
  const host = target.host.includes(":") ? `[${target.host}]` : target.host
  const auth = target.password ? `${encodeURIComponent(target.user)}:${encodeURIComponent(target.password)}` : encodeURIComponent(target.user)
  return `postgresql://${auth}@${host}:${target.port}/${target.database}`
}

function databaseNameFor(label: string): string {
  const safe = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 24)
  return `${TEST_DATABASE_PREFIX}${safe || "test"}_${process.pid}_${randomBytes(4).toString("hex")}`
}

/** PostgreSQL identifiers are quoted; the generated name only contains [a-z0-9_]. */
function quoteIdent(name: string): string {
  if (!/^[a-z0-9_]+$/.test(name)) throw new Error(`[7F test] refusing to use database name ${JSON.stringify(name)}`)
  return `"${name}"`
}

/** Every client is constructed from explicit parameters — `pg` never sees a connection string. */
function clientFor(target: TestConnectionTarget): Client {
  return new Client({ host: target.host, port: target.port, user: target.user, password: target.password, database: target.database })
}

async function withClient<T>(target: TestConnectionTarget, fn: (client: Client) => Promise<T>): Promise<T> {
  const client = clientFor(target)
  await client.connect()
  try {
    return await fn(client)
  } finally {
    await client.end()
  }
}

// ─── Outbound network guard ─────────────────────────────────────────────────

const outboundAttempts: string[] = []
/** The wrapper currently installed on `globalThis.fetch`, and the fetch it wrapped. */
let guardedFetch: typeof fetch | null = null
let wrappedFetch: typeof fetch | null = null

function isLoopbackHostname(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname) || hostname === "::1"
}

function hostnameOf(url: string, base?: string): string {
  try {
    return new URL(url, base).hostname
  } catch {
    return "(unparseable)"
  }
}

/**
 * Block any HTTP request to a non-loopback host and record the attempt. The
 * paths under test reach the network only through the global `fetch` (the AI
 * chat adapters resolve it at call time; the Resend SDK uses it too), so this
 * is a deterministic guarantee for THESE tests, not a general firewall
 * (SMTP/IMAP sockets are not HTTP and are never reached without credentials).
 *
 * Redirects are never followed: an allowed loopback request is issued with
 * `redirect: "manual"`, and a 3xx answer whose Location leaves loopback is
 * recorded and refused, so a permitted origin cannot bounce to a forbidden one.
 *
 * State is the wrapper identity, not a flag: the guard is "active" only while
 * `globalThis.fetch` IS the wrapper. Installing wraps whatever fetch is
 * current; uninstalling restores exactly the function that was wrapped.
 */
export function installOutboundNetworkGuard(): void {
  if (isOutboundNetworkGuardActive()) return
  // A fresh guard session starts with an empty attempt list (attempts belong
  // to the guard that recorded them; `settleBackgroundTasks` checks them
  // before the guard is ever uninstalled).
  outboundAttempts.length = 0
  const inner = globalThis.fetch
  const wrapper = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url
    const hostname = hostnameOf(url)
    if (!isLoopbackHostname(hostname)) {
      outboundAttempts.push(hostname)
      throw new Error(`[7F test] outbound HTTP call blocked: ${hostname}`)
    }
    const response = await inner(input, { ...init, redirect: "manual" })
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location")
      const target = location ? hostnameOf(location, url) : "(no location)"
      if (!isLoopbackHostname(target)) {
        outboundAttempts.push(target)
        throw new Error(`[7F test] outbound HTTP redirect blocked: ${target}`)
      }
    }
    return response
  }) as typeof fetch
  wrappedFetch = inner
  guardedFetch = wrapper
  globalThis.fetch = wrapper
}

/** True only while `globalThis.fetch` is the guard wrapper itself. */
export function isOutboundNetworkGuardActive(): boolean {
  return guardedFetch !== null && globalThis.fetch === guardedFetch
}

/** Restore the fetch that was wrapped. If something else replaced fetch meanwhile, only the bookkeeping is cleared. */
export function uninstallOutboundNetworkGuard(): void {
  if (isOutboundNetworkGuardActive() && wrappedFetch) globalThis.fetch = wrappedFetch
  guardedFetch = null
  wrappedFetch = null
}

/** Hostnames that something tried to reach through `fetch` since the guard was installed. */
export function blockedOutboundAttempts(): readonly string[] {
  return [...outboundAttempts]
}

// ─── Background work ────────────────────────────────────────────────────────

export interface BackgroundExpectations {
  /**
   * Provider keys are removed by provisioning, so conversation intelligence
   * (`ingest:intelligence`) is EXPECTED to reject with the concrete
   * missing-credentials error of the AI execution contract (see
   * `isMissingProviderKeyError`). Short-intent persistence handles that same
   * failure internally and FULFILS with `{ status: "failed", stage: "execute" }`
   * — never an allowed rejection. Set when the test exercises a path that
   * starts intelligence; any other rejection still fails the test.
   */
  aiDisabled?: boolean
}

const AI_BACKGROUND_LABELS: ReadonlySet<string> = new Set(["ingest:intelligence"])

/**
 * The exact "no credentials" contract of `engines/ai`: an `AIExecutionError`
 * with code `provider_unavailable` whose message is the adapter's own
 * missing-key message for that provider. Anything else — the same error type
 * with another code, or a message that merely mentions API_KEY (an upstream
 * "invalid API key" rejection, for instance) — is NOT the missing-credentials
 * case and stays unexpected.
 */
const MISSING_KEY_MESSAGES: Readonly<Record<string, string>> = {
  deepseek: "DEEPSEEK_API_KEY is not set in environment variables",
  openai: "OPENAI_API_KEY no configurada",
}

export function isMissingProviderKeyError(error: unknown): boolean {
  if (!(error instanceof Error) || error.name !== "AIExecutionError") return false
  const { code, provider, message } = error as Error & { code?: unknown; provider?: unknown }
  if (code !== "provider_unavailable" || typeof provider !== "string") return false
  return MISSING_KEY_MESSAGES[provider] === message
}

function isExpectedAiDisabledFailure(outcome: BackgroundTaskOutcome): boolean {
  return outcome.status === "rejected" && AI_BACKGROUND_LABELS.has(outcome.label) && isMissingProviderKeyError(outcome.error)
}

/**
 * Wait until every tracked background task has settled and CONSUME the
 * outcomes. Throws — failing the test — on any rejection that is not
 * explicitly expected, and on any blocked outbound network attempt. Must run
 * while the transport isolation is still in place (guard or a test-owned spy
 * on top of it): the guard's own bookkeeping is checked here.
 */
export async function settleBackgroundTasks(expectations: BackgroundExpectations = {}): Promise<BackgroundTaskOutcome[]> {
  const outcomes = await drainBackgroundTasks()
  const unexpected = outcomes.filter((o) => o.status === "rejected" && !(expectations.aiDisabled && isExpectedAiDisabledFailure(o)))
  if (unexpected.length > 0) {
    const detail = unexpected.map((o) => `${o.label}: ${o.error instanceof Error ? `${o.error.name}: ${o.error.message}` : String(o.error)}`)
    throw new Error(`[7F test] unexpected background task failure(s):\n  - ${detail.join("\n  - ")}`)
  }
  const attempts = blockedOutboundAttempts()
  if (attempts.length > 0) throw new Error(`[7F test] a provider call reached the network layer: ${attempts.join(", ")}`)
  return outcomes
}

// ─── Provisioning ───────────────────────────────────────────────────────────

/**
 * Create a fresh database from the PostgreSQL history and make it THE runtime
 * database for this process: `DATABASE_URL` is set (built from validated
 * parameters), every other connection variable and every provider key is
 * removed, outbound HTTP is guarded and background work is recorded. Import
 * `@core/db` only AFTER awaiting this.
 */
export async function provisionTestDatabase(label: string): Promise<ProvisionedDatabase> {
  const admin = resolveTestDatabaseTarget()
  const name = databaseNameFor(label)
  const target: TestConnectionTarget = { ...admin, database: name }
  const url = connectionStringFor(target)

  for (const key of PROVIDER_ENV_KEYS) delete process.env[key]
  installOutboundNetworkGuard()
  startBackgroundTaskRecording()

  await withClient(admin, (client) => client.query(`CREATE DATABASE ${quoteIdent(name)}`))

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
    target,
    url,
    name,
    async dispose() {
      if (disposed) return
      // 1. Nothing may still be running against the database.
      const pending = pendingBackgroundTaskCount()
      if (pending > 0) {
        throw new Error(`[7F test] refusing to drop ${name}: ${pending} background task(s) still pending — call settleBackgroundTasks() first`)
      }
      // 2. Nothing may have settled without being validated: a rejection that
      //    happened before teardown must surface, never vanish with the recording.
      const unreviewed = unreviewedBackgroundOutcomes()
      if (unreviewed.length > 0) {
        throw new Error(
          `[7F test] refusing to drop ${name}: ${unreviewed.length} settled background outcome(s) were never reviewed — ` +
            unreviewed.map((o) => `${o.label}: ${o.status}`).join(", ") +
            " — call settleBackgroundTasks() first",
        )
      }
      // 3. The server must show no session on the database (pool close is observed, never forced).
      const open = await waitForNoSessions(admin, name)
      if (open.length > 0) {
        throw new Error(
          `[7F test] refusing to drop ${name}: ${open.length} session(s) still open after disconnect — ` +
            open.map((row) => `${row.backend_type}/${row.state ?? "?"}: ${row.query}`).join("; "),
        )
      }
      stopBackgroundTaskRecording()
      await dropDatabase(admin, name)
      disposed = true
      // 4. Transport isolation stays in place through the whole teardown; restore it last.
      uninstallOutboundNetworkGuard()
    },
  }
}

interface SessionRow {
  backend_type: string
  state: string | null
  query: string
}

/**
 * Wait until the server reports NO session on the database, then return the
 * rows that remain (empty on success).
 *
 * Why a wait at all: `pg-pool`'s `end()` resolves as soon as its client list
 * is empty (`_pulseQueue` → `_endCallback`), while each client's `Terminate`
 * is still in flight on the socket — so Prisma's `$disconnect()` can return
 * a few hundred microseconds before the backend has actually gone. Dropping
 * in that window (with FORCE) killed the backend mid-handshake and produced
 * "terminating connection due to administrator command" on the pool's idle
 * error listener. This is a bounded wait on an OBSERVABLE condition
 * (`pg_stat_activity`), not a sleep: it returns on the first poll that shows
 * zero sessions, and gives up after a short budget so a genuine leak (a
 * client a test forgot to end) fails the file with the offending sessions.
 */
async function waitForNoSessions(admin: TestConnectionTarget, name: string): Promise<SessionRow[]> {
  const POLL_MS = 10
  const MAX_POLLS = 100
  return withClient(admin, async (client) => {
    let rows: SessionRow[] = []
    for (let i = 0; i < MAX_POLLS; i++) {
      rows = (
        await client.query(
          `SELECT backend_type, state, left(query, 80) AS query FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()`,
          [name],
        )
      ).rows as SessionRow[]
      if (rows.length === 0) return []
      await new Promise((resolve) => setTimeout(resolve, POLL_MS))
    }
    return rows
  })
}

async function dropDatabase(admin: TestConnectionTarget, name: string): Promise<void> {
  await withClient(admin, (client) => client.query(`DROP DATABASE IF EXISTS ${quoteIdent(name)}`))
}

/**
 * Raw read-back helper for assertions that must NOT go through the code under
 * test. Connects with the provisioned database's explicit parameters.
 */
export async function queryRaw<T extends Record<string, unknown> = Record<string, unknown>>(
  database: ProvisionedDatabase,
  sql: string,
  params: readonly unknown[] = [],
): Promise<T[]> {
  return withClient(database.target, async (client) => (await client.query(sql, params as unknown[])).rows as T[])
}
