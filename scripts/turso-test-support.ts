/**
 * Test support for the Turso tooling. **Never imported by production code.**
 *
 * WHY THIS EXISTS
 * ---------------
 * `bootstrapTursoFromEnv(env)` takes one parameter. It renders the DDL and
 * opens the write connection itself, so there is no argument a test can use to
 * point the write at a local file — which is exactly the property that closes
 * the dependency bypass, and exactly what makes the positive path awkward to
 * test.
 *
 * The seam used instead is the module registry: this file substitutes
 * `createClient` on the cached `@libsql/client` module, so the production call
 * site inside `bootstrap-turso.ts` resolves to a stand-in at call time. The
 * production module is untouched, imports nothing from here, and exposes no
 * hook — the substitution lives entirely in the test process.
 *
 * WHY THIS CANNOT WEAKEN PRODUCTION
 * ---------------------------------
 *   - Nothing in `prisma/` imports this file; it is reachable only from tests.
 *   - It exports no way to reach `bootstrapSchemaInternal` and adds no export
 *     to the production modules.
 *   - It never reads `process.env`, so it cannot pick up a real target.
 *   - `openLocalResource` is the ONLY place it opens a connection, and it
 *     refuses `libsql:`, `http:` and `https:` outright. A remote URL cannot be
 *     opened through this harness even by mistake — `turso-bootstrap.test.ts`
 *     asserts that refusal.
 *   - A remote URL that production asks for is RECORDED and REDIRECTED to a
 *     local temporary database. It is never dialled.
 *
 * It deliberately contains no copy of the production logic: the tests still run
 * the real resolution, the real guard, the real DDL and the real transaction.
 */

import { createClient, type Client, type Transaction } from "@libsql/client"

/** Schemes that would leave the machine. Refused, never opened. */
const REMOTE_SCHEME = /^(libsql|https?|wss?):/i

/**
 * Open a local, temporary SQLite resource — the only connection this harness
 * ever opens. Anything that is not a `file:` URL is refused, so no test path,
 * however it is wired, can reach a real database.
 */
export function openLocalResource(url: string): Client {
  if (REMOTE_SCHEME.test(url)) {
    throw new Error(
      `turso test support refuses to open "${url.split(":")[0]}:" — ` +
        "tests only ever open local temporary resources.",
    )
  }
  if (!/^file:/i.test(url)) {
    throw new Error(`turso test support only opens file: URLs (got "${url.split(":")[0]}:").`)
  }
  return createClient({ url })
}

/** One statement production issued through a redirected client. */
export interface RecordedStatement {
  via: "execute" | "executeMultiple"
  sql: string
}

/** One `createClient({ url, authToken })` production asked for. */
export interface ClientRequest {
  url: string
  authToken?: string
}

export interface LibsqlSubstitute {
  /** Every request, local and remote, in order. */
  requests: ClientRequest[]
  /** Only the requests for a remote target — what production tried to dial. */
  remoteRequests: ClientRequest[]
  /** Statements issued through a redirected client. */
  statements: RecordedStatement[]
  /** How many redirected clients were handed out. */
  clientsHandedOut: number
  restore(): void
}

export interface SubstituteOptions {
  /**
   * The local temporary database every remote request is redirected to, opened
   * by the test through `openLocalResource`. A function is called once per
   * remote request, so a concurrency test can hand each run its own connection
   * to the same file.
   */
  redirectTo: Client | (() => Client)
  /**
   * Wrap the stand-in before it reaches production — used to model a client
   * whose `close()` throws.
   */
  wrapClient?(client: Record<string, unknown>): Record<string, unknown>
  /**
   * Intercept the single DDL write. Receives the SQL production asked to apply
   * and a function that really applies it, so a test can apply a prefix and
   * then fail (engine error mid-script) or apply something extra (a structure
   * that will not verify). The SQL production *asked* for is recorded either
   * way, so "what the tool wrote" stays assertable.
   */
  interceptWrite?(sql: string, apply: (sql: string) => Promise<void>): Promise<void>
}

/**
 * Substitute `createClient` on the cached `@libsql/client` module.
 *
 * `file:` requests — the throwaway database `canonicalStructureFromDdl` builds,
 * and the tests' own fixtures — pass straight through. A remote request is
 * recorded and answered with a stand-in bound to `redirectTo`; no socket is
 * opened for it.
 *
 * Always paired with `restore()` in a `t.after(...)`.
 */
export function substituteLibsqlClient(options: SubstituteOptions): LibsqlSubstitute {
  /**
   * The cached module object, not a namespace import: esbuild compiles
   * `import * as ns` into a copy with non-configurable getters, which cannot be
   * substituted. `require` returns the live object every call site reads from.
   */
  const libsql = require("@libsql/client") as { createClient: typeof createClient }
  const original = libsql.createClient

  const substitute: LibsqlSubstitute = {
    requests: [],
    remoteRequests: [],
    statements: [],
    clientsHandedOut: 0,
    restore() {
      libsql.createClient = original
    },
  }

  libsql.createClient = ((config: { url: string; authToken?: string }) => {
    const request: ClientRequest = { url: config.url, authToken: config.authToken }
    substitute.requests.push(request)

    if (!REMOTE_SCHEME.test(config.url)) return original(config)

    substitute.remoteRequests.push(request)
    substitute.clientsHandedOut++

    const local =
      typeof options.redirectTo === "function" ? options.redirectTo() : options.redirectTo

    const standIn: Record<string, unknown> = {
      async transaction(mode: "write") {
        const tx: Transaction = await local.transaction(mode)
        return {
          async execute(sql: string) {
            substitute.statements.push({ via: "execute", sql })
            return tx.execute(sql)
          },
          async executeMultiple(sql: string) {
            substitute.statements.push({ via: "executeMultiple", sql })
            const apply = (actual: string) => tx.executeMultiple(actual)
            if (options.interceptWrite) return options.interceptWrite(sql, apply)
            return apply(sql)
          },
          commit: () => tx.commit(),
          rollback: () => tx.rollback(),
          close: () => tx.close(),
        }
      },
      /**
       * A no-op: the entry point closes what it opened, and the tests go on
       * inspecting the same database afterwards.
       */
      close: () => {},
    }

    const handed = options.wrapClient ? options.wrapClient(standIn) : standIn
    return handed as unknown as ReturnType<typeof createClient>
  }) as typeof createClient

  return substitute
}
