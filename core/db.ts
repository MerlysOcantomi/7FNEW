import { PrismaLibSql } from "@prisma/adapter-libsql"
import { PrismaClient } from "@/generated/prisma/client"

/**
 * Prisma client — LAZILY initialised (CORE-03A, fixes F-DB-02).
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
 * logic, yet it failed with "DATABASE_URL or TURSO_DATABASE_URL must be set"
 * simply because one of its imports transitively reached this file. That is
 * also why the suite could not run in a clean CI container: the whole test
 * run demanded production-shaped secrets it has no business holding.
 *
 * HOW IT IS LAZY
 * --------------
 * `prisma` is a `Proxy` standing in for the real client. Nothing happens until
 * the first PROPERTY ACCESS on it (`db.usuario`, `db.$transaction`,
 * `db.$queryRawUnsafe`, …), at which point `getClient()` reads the
 * environment, builds the adapter and instantiates `PrismaClient` exactly
 * once. Importing this module — or anything that imports it — performs no
 * environment read, no allocation and no I/O.
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
 * A real access with no configured URL throws BEFORE the adapter is built.
 * There is deliberately no fallback: no default `file:` database (which would
 * silently create an empty local DB and make queries "succeed" against
 * nothing), no placeholder URL, and no `NODE_ENV === "test"` bypass (which
 * would let a mistake in production take a different path than the one that
 * was tested). The message names the environment VARIABLES only — never their
 * values — so a misconfiguration never turns into a credential leak.
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

function createClient(): PrismaClient {
  const url = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL

  if (!url) {
    throw new Error(
      "[7F] Database access attempted without a configured connection. " +
        "Set DATABASE_URL (or TURSO_DATABASE_URL) before running any query.",
    )
  }

  const authToken = process.env.DATABASE_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN
  const adapter = new PrismaLibSql({ url, authToken })
  return new PrismaClient({ adapter })
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
