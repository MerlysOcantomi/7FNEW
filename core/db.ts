import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/generated/prisma/client"
import { writeGuardExtension } from "@core/db-write-guard"

/**
 * Prisma client — PostgreSQL runtime (NEON-03), LAZILY initialised (CORE-03A).
 *
 * PROVIDER
 * --------
 * The ONLY database the runtime speaks to is PostgreSQL, through
 * `@prisma/adapter-pg` over a `pg` connection pool. `DATABASE_URL` must be a
 * `postgresql://` connection string — in production the Neon POOLED endpoint;
 * `DIRECT_URL` (the direct endpoint) is read exclusively by the Prisma CLI via
 * `prisma.config.ts` for migrations and is never read here.
 *
 * There is NO SQLite / libSQL / Turso path left in this module: a `file:`,
 * `libsql://` or any non-PostgreSQL URL is refused on first use, and the
 * legacy `TURSO_DATABASE_URL` / `DATABASE_AUTH_TOKEN` / `TURSO_AUTH_TOKEN`
 * variables are ignored entirely (they may still exist in the environment
 * until the Turso decommission; they cannot select a database).
 *
 * WHY THIS IS LAZY
 * ----------------
 * This module used to read the connection env vars, `throw` when they were
 * absent, and construct the adapter plus the `PrismaClient` — all at MODULE
 * SCOPE. Because `import` is transitive, that made a database URL a
 * prerequisite for merely *loading* any file that reached this one, however
 * indirectly. A pure-logic module could not be imported without credentials.
 *
 * The concrete cost, recorded as F-DB-02 in `docs/evolution/CORE-00-AUDIT.md`:
 * `modules/inbox/transport/transport.test.ts` tests nothing but pure routing
 * logic, yet it failed with "DATABASE_URL must be set" simply because one of
 * its imports transitively reached this file. That is also why the suite
 * could not run in a clean CI container: the whole test run demanded
 * production-shaped secrets it has no business holding.
 *
 * HOW IT IS LAZY
 * --------------
 * `prisma` is a `Proxy` standing in for the real client. Nothing happens until
 * the first PROPERTY ACCESS on it (`db.usuario`, `db.$transaction`,
 * `db.$queryRawUnsafe`, …), at which point `getClient()` reads the
 * environment, builds the adapter and instantiates `PrismaClient` exactly
 * once. Importing this module — or anything that imports it — performs no
 * environment read, no allocation and no I/O. The `pg` pool itself connects
 * on the first query, not on construction.
 *
 * Two details make the stand-in faithful rather than merely convincing:
 *
 *   - Functions are returned BOUND to the real client. Left unbound, calling
 *     `db.$transaction(...)` would run with `this` set to the proxy; any
 *     internal `this.#privateField` access in the generated client would then
 *     throw a `TypeError`, because a proxy does not carry the target's private
 *     fields. Binding sidesteps that entire class of failure.
 *   - `has`, `ownKeys` and `getOwnPropertyDescriptor` are forwarded too, so
 *     reflection over the client behaves as it did before.
 *
 * FAIL-CLOSED
 * -----------
 * A real access with no configured URL, or with a URL that is not PostgreSQL,
 * throws BEFORE the adapter is built. There is deliberately no fallback: no
 * default `file:` database (which would silently create an empty local DB and
 * make queries "succeed" against nothing), no placeholder URL, no legacy
 * Turso variable, and no `NODE_ENV === "test"` bypass (which would let a
 * mistake in production take a different path than the one that was tested).
 * Messages name the environment VARIABLES and, at most, the URL scheme —
 * never a value — so a misconfiguration never turns into a credential leak.
 *
 * WRITE GUARD (NEON-05)
 * ---------------------
 * The client is built with the `database.write` extension from
 * `core/db-write-guard.ts`: every write-class operation (model writes, raw
 * execution, raw queries that could write, and the same operations inside
 * `$transaction`) asks the Privileged Operations core first and is refused
 * with a `PrivilegedOperationDeniedError` while the operating mode is
 * `freeze-writes` (`SEVENF_OPERATION_MODE`). Reads are never gated here.
 *
 * TLS
 * ---
 * `pg` treats `sslmode=require` as an alias of `verify-full` and emits a
 * deprecation warning for it; the documented form is the explicit
 * `sslmode=verify-full` (see `sslPosture` and `.env.example`). A non-loopback
 * URL without it is warned about once; never refused, so a configuration
 * slip cannot take production down.
 */

/**
 * Dev-only cache so Next.js hot reload reuses one client instead of leaking a
 * new connection pool on every recompile. Namespaced to avoid colliding with
 * anything else parked on `globalThis`, and deliberately NOT exported: there
 * is no supported way for a test or another module to swap the client this
 * module hands out. Tests that need a different client must isolate the
 * module in a separate process.
 */
const GLOBAL_CACHE_KEY = "__7fPrismaClient"

const globalForPrisma = globalThis as unknown as {
  [GLOBAL_CACHE_KEY]?: PrismaClient
}

/** Resolved once, on first real use. */
let client: PrismaClient | undefined

/** URL schemes the runtime accepts. Everything else is refused. */
const POSTGRES_SCHEMES: ReadonlySet<string> = new Set(["postgresql:", "postgres:"])

/**
 * Connection-pool ceiling PER PROCESS. Serverless instances are many and
 * short-lived, and they all share the database's connection budget through
 * the pooled endpoint, so the per-instance pool stays small by default.
 * `DATABASE_POOL_MAX` overrides it (positive integer) for tuning in a real
 * environment without a code change; an invalid value is a configuration
 * error, not something to paper over with the default.
 */
const DEFAULT_POOL_MAX = 5
/** Fail fast on an unreachable database instead of hanging a request. */
const CONNECTION_TIMEOUT_MS = 10_000

function resolvePoolMax(): number {
  const raw = process.env.DATABASE_POOL_MAX
  if (raw === undefined || raw === "") return DEFAULT_POOL_MAX
  const parsed = Number(raw)
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error("[7F] DATABASE_POOL_MAX must be a positive integer when set.")
  }
  return parsed
}

/**
 * The connection string must be a PostgreSQL URL. Only the scheme is ever
 * mentioned in an error; the value never is.
 */
function assertPostgresConnectionString(url: string): void {
  let scheme: string | null = null
  try {
    scheme = new URL(url).protocol
  } catch {
    throw new Error(
      "[7F] DATABASE_URL is not a valid URL. It must be a postgresql:// connection string " +
        "(the pooled endpoint in production).",
    )
  }
  if (!POSTGRES_SCHEMES.has(scheme)) {
    throw new Error(
      `[7F] DATABASE_URL has scheme "${scheme}" but the runtime is PostgreSQL only. ` +
        "Set DATABASE_URL to a postgresql:// connection string. SQLite, libSQL and Turso URLs " +
        "are refused; there is no fallback and TURSO_DATABASE_URL is not consulted.",
    )
  }
}

export type SslPosture = "verify-full" | "deprecated-alias" | "disabled" | "absent" | "loopback"

/**
 * Pure, value-free description of the TLS posture of a connection string.
 * `loopback` = no TLS expected (local disposable databases); `absent` = a
 * remote host with no `sslmode` (pg then negotiates nothing explicit);
 * `deprecated-alias` = `require`, `prefer` or `verify-ca` (aliases of
 * `verify-full` in pg 8.16+, warned as deprecated); `disabled` = `disable`.
 */
export function sslPosture(url: string): SslPosture {
  const parsed = new URL(url)
  const host = parsed.hostname === "[::1]" ? "::1" : parsed.hostname
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return "loopback"
  const mode = parsed.searchParams.get("sslmode")
  if (mode === null || mode === "") return "absent"
  if (mode === "verify-full") return "verify-full"
  if (mode === "disable" || mode === "allow") return "disabled"
  return "deprecated-alias"
}

let sslWarned = false

function warnSslPostureOnce(url: string): void {
  if (sslWarned) return
  const posture = sslPosture(url)
  if (posture === "verify-full" || posture === "loopback") return
  sslWarned = true
  console.warn(
    `[7F] DATABASE_URL TLS posture is "${posture}". Use an explicit sslmode=verify-full ` +
      "(pg treats require/prefer/verify-ca as deprecated aliases of verify-full). See .env.example.",
  )
}

function createClient(): PrismaClient {
  const connectionString = process.env.DATABASE_URL

  if (!connectionString) {
    throw new Error(
      "[7F] Database access attempted without a configured connection. " +
        "Set DATABASE_URL to a postgresql:// connection string before running any query. " +
        "(TURSO_DATABASE_URL is no longer consulted: the runtime is PostgreSQL only.)",
    )
  }

  assertPostgresConnectionString(connectionString)
  warnSslPostureOnce(connectionString)

  const adapter = new PrismaPg(
    {
      connectionString,
      max: resolvePoolMax(),
      connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    },
    {
      /**
       * The adapter already attaches its own listeners, so an idle-connection
       * error can never surface as an unhandled 'error' event; this callback
       * only makes such errors visible in the logs.
       */
      onPoolError: (error) => {
        console.error("[7F] PostgreSQL pool error:", error.message)
      },
    },
  )
  /**
   * The extended client has the same runtime surface as `PrismaClient`; the
   * extension only interposes the `database.write` check. The cast keeps the
   * exported type unchanged for the ~130 importers.
   */
  return new PrismaClient({ adapter }).$extends(writeGuardExtension) as unknown as PrismaClient
}

/**
 * Resolve the singleton. Synchronous on purpose: JavaScript runs this to
 * completion before any other task can observe a half-built state, so two
 * "concurrent" callers can never race into two different clients.
 */
function getClient(): PrismaClient {
  if (client) return client

  const cached = globalForPrisma[GLOBAL_CACHE_KEY]
  if (cached) {
    client = cached
    return cached
  }

  const created = createClient()
  client = created
  if (process.env.NODE_ENV !== "production") {
    globalForPrisma[GLOBAL_CACHE_KEY] = created
  }
  return created
}

/**
 * The exported client. Same shape, same usage and same identity semantics as
 * before — `db.model.findMany()`, `db.$transaction()`, `db.$queryRawUnsafe()`
 * all behave identically — only the moment of construction changed.
 */
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const instance = getClient()
    /**
     * `instance` is passed as the receiver so any getter on the client runs
     * against the real object rather than re-entering this trap.
     */
    const value = Reflect.get(instance, property, instance)
    return typeof value === "function" ? value.bind(instance) : value
  },
  set(_target, property, value) {
    return Reflect.set(getClient(), property, value)
  },
  has(_target, property) {
    return Reflect.has(getClient(), property)
  },
  ownKeys() {
    return Reflect.ownKeys(getClient())
  },
  getOwnPropertyDescriptor(_target, property) {
    const descriptor = Reflect.getOwnPropertyDescriptor(getClient(), property)
    if (!descriptor) return undefined
    /**
     * The proxy target is an empty, extensible object that does not actually
     * own this property, so reporting a non-configurable descriptor would
     * violate a proxy invariant and throw. Marking it configurable keeps
     * reflection working without lying about anything callers can observe.
     */
    return { ...descriptor, configurable: true }
  },
}) as PrismaClient

export { prisma as db }
