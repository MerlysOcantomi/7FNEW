import assert from "node:assert/strict"
import test from "node:test"
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createClient, type Client } from "@libsql/client"

/**
 * CORE-03A — lazy-initialisation tests for `core/db.ts` (F-DB-02).
 *
 * MODULE ISOLATION BY SUBPROCESS
 * ------------------------------
 * `core/db.ts` caches its client in a module-level binding, so "what happens
 * on the very first access" can only be observed once per process. Rather than
 * adding a `__resetClient()` escape hatch to production code — which would be
 * a permanent way for a test, or a mistake, to swap the real client — this
 * file RE-EXECUTES ITSELF in child processes with controlled environments.
 * The `CORE_DB_TEST_CHILD` variable selects the scenario; without it the file
 * behaves as a normal test module.
 *
 * Nothing here touches Turso, Neon or any remote database. The only database
 * used is a throwaway SQLite file created under the OS temp directory and
 * deleted in `test.after`.
 */

const CHILD_MODE_ENV = "CORE_DB_TEST_CHILD"
const DB_ENV_KEYS = [
  "DATABASE_URL",
  "TURSO_DATABASE_URL",
  "DATABASE_AUTH_TOKEN",
  "TURSO_AUTH_TOKEN",
] as const

/** Marker the parent looks for in the child's stdout. */
const REPORT_PREFIX = "CORE_DB_REPORT:"

interface ChildReport {
  importThrew: string | null
  transitiveImportThrew: string | null
  dbIsObject: boolean
  prismaIsObject: boolean
  sameBinding: boolean
  /** Error observed on the FIRST real property access, if any. */
  accessErrorName: string | null
  accessErrorMessage: string | null
  /** Socket-like handles that appeared while importing. */
  newSocketHandles: string[]
  /** Files matching *.db that appeared under the working directory. */
  newDbFiles: string[]
}

// ───────────────────────────────────────────────────────────────────────────
// Child scenarios
// ───────────────────────────────────────────────────────────────────────────

function socketHandles(): string[] {
  const info = process.getActiveResourcesInfo?.() ?? []
  return info.filter((entry) => /socket|tcp|tls|pipe/i.test(entry))
}

function dbFilesUnderCwd(): string[] {
  const found = spawnSync(
    "find",
    [process.cwd(), "-maxdepth", "3", "-name", "*.db", "-not", "-path", "*/node_modules/*"],
    { encoding: "utf8" },
  )
  return (found.stdout ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

async function runChildScenario(mode: string): Promise<void> {
  const report: ChildReport = {
    importThrew: null,
    transitiveImportThrew: null,
    dbIsObject: false,
    prismaIsObject: false,
    sameBinding: false,
    accessErrorName: null,
    accessErrorMessage: null,
    newSocketHandles: [],
    newDbFiles: [],
  }

  const socketsBefore = new Set(socketHandles())
  const dbFilesBefore = new Set(dbFilesUnderCwd())

  let dbModule: typeof import("@core/db") | null = null
  try {
    dbModule = await import("@core/db")
  } catch (error) {
    report.importThrew = error instanceof Error ? error.message : String(error)
  }

  /**
   * The module that F-DB-02 actually broke: pure routing logic that reaches
   * `@core/db` only transitively, several imports deep.
   */
  try {
    await import("@modules/inbox/transport")
  } catch (error) {
    report.transitiveImportThrew = error instanceof Error ? error.message : String(error)
  }

  report.newSocketHandles = socketHandles().filter((entry) => !socketsBefore.has(entry))
  report.newDbFiles = dbFilesUnderCwd().filter((file) => !dbFilesBefore.has(file))

  if (dbModule) {
    report.dbIsObject = typeof dbModule.db === "object" && dbModule.db !== null
    report.prismaIsObject = typeof dbModule.prisma === "object" && dbModule.prisma !== null
    report.sameBinding = dbModule.db === dbModule.prisma
  }

  if (mode === "no-env" && dbModule) {
    /**
     * First REAL access. With no configured URL this must fail closed, before
     * an adapter or a client is built.
     */
    try {
      const probe = dbModule.db as unknown as Record<string, unknown>
      void probe.usuario
      report.accessErrorMessage = "NO_ERROR_THROWN"
    } catch (error) {
      report.accessErrorName = error instanceof Error ? error.name : typeof error
      report.accessErrorMessage = error instanceof Error ? error.message : String(error)
    }
  }

  /**
   * Written straight to stdout rather than via `console.log`: the parent parses
   * this line, so it must not be reformatted, and the repo lints `console.log`
   * out of source files.
   */
  process.stdout.write(REPORT_PREFIX + JSON.stringify(report) + "\n")
}

// ───────────────────────────────────────────────────────────────────────────
// Parent helpers
// ───────────────────────────────────────────────────────────────────────────

function runChild(mode: string, extraEnv: Record<string, string> = {}): ChildReport {
  // Inherit the ambient environment, then strip every database variable so the
  // child genuinely starts without one.
  const env: NodeJS.ProcessEnv = { ...process.env }
  for (const key of DB_ENV_KEYS) delete env[key]
  env[CHILD_MODE_ENV] = mode
  Object.assign(env, extraEnv)

  const result = spawnSync(
    process.execPath,
    [join(process.cwd(), "node_modules", "tsx", "dist", "cli.mjs"), __filename],
    { env, cwd: process.cwd(), encoding: "utf8" },
  )

  const line = (result.stdout ?? "")
    .split("\n")
    .find((entry) => entry.startsWith(REPORT_PREFIX))

  assert.ok(
    line,
    `child "${mode}" produced no report.\nstatus=${result.status}\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
  )
  return JSON.parse(line.slice(REPORT_PREFIX.length)) as ChildReport
}

// ───────────────────────────────────────────────────────────────────────────
// Entry point: child mode short-circuits before any test is registered
// ───────────────────────────────────────────────────────────────────────────

const childMode = process.env[CHILD_MODE_ENV]

if (childMode) {
  runChildScenario(childMode).then(
    () => process.exit(0),
    (error: unknown) => {
      console.error(error instanceof Error ? (error.stack ?? error.message) : String(error))
      process.exit(1)
    },
  )
} else {
  registerTests()
}

function registerTests() {
  let noEnvReport: ChildReport
  let unreachableUrlReport: ChildReport

  let dir: string
  let dbPath: string
  let raw: Client
  let db: (typeof import("@core/db"))["db"]
  let prisma: (typeof import("@core/db"))["prisma"]

  test.before(async () => {
    // Scenario 1 — no database environment at all.
    noEnvReport = runChild("no-env")

    /**
     * Scenario 2 — a URL IS present but points at a port nothing listens on.
     * If importing opened a connection, this is where it would show up.
     */
    unreachableUrlReport = runChild("unreachable-url", {
      DATABASE_URL: "libsql://127.0.0.1:1",
    })

    // In-process scenario — a real, throwaway local database.
    dir = mkdtempSync(join(tmpdir(), "core-db-lazy-"))
    dbPath = join(dir, "lazy.db")
    raw = createClient({ url: `file:${dbPath}` })
    await raw.execute(`CREATE TABLE "Usuario" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "nombre" TEXT NOT NULL,
      "email" TEXT NOT NULL,
      "rol" TEXT NOT NULL DEFAULT 'miembro',
      "departamento" TEXT,
      "estado" TEXT NOT NULL DEFAULT 'activo',
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL
    )`)
    await raw.execute(`CREATE UNIQUE INDEX "Usuario_email_key" ON "Usuario"("email")`)

    process.env.DATABASE_URL = `file:${dbPath}`
    const loaded = await import("@core/db")
    db = loaded.db
    prisma = loaded.prisma
  })

  test.after(async () => {
    await db.$disconnect()
    raw.close()
    rmSync(dir, { recursive: true, force: true })
  })

  // ── 1-2. Importing needs no database ──────────────────────────────────────

  test("importing core/db with no database environment does not throw", () => {
    assert.equal(
      noEnvReport.importThrew,
      null,
      "importing must not require DATABASE_URL / TURSO_DATABASE_URL",
    )
    assert.equal(noEnvReport.dbIsObject, true)
    assert.equal(noEnvReport.prismaIsObject, true)
    assert.equal(noEnvReport.sameBinding, true, "`db` and `prisma` remain the same binding")
  })

  test("importing a module that reaches core/db transitively does not throw", () => {
    assert.equal(
      noEnvReport.transitiveImportThrew,
      null,
      "@modules/inbox/transport is pure routing logic and must load without a database",
    )
  })

  // ── 3-4. Importing performs no I/O ───────────────────────────────────────

  test("importing creates no database file", () => {
    assert.deepEqual(noEnvReport.newDbFiles, [], "no .db file may be created by an import")
    assert.deepEqual(unreachableUrlReport.newDbFiles, [])
  })

  test("importing opens no connection, even when a URL is configured", () => {
    assert.deepEqual(
      noEnvReport.newSocketHandles,
      [],
      "no socket handle may appear while importing",
    )
    /**
     * The stronger case: the URL points at a port nothing listens on. The
     * import still succeeds and opens nothing, which is only possible because
     * the URL is never read — and no client built — at import time.
     */
    assert.equal(unreachableUrlReport.importThrew, null)
    assert.deepEqual(unreachableUrlReport.newSocketHandles, [])
  })

  // ── 5. First real access fails closed ────────────────────────────────────

  test("the first real access without a URL fails closed, before connecting", () => {
    assert.equal(
      noEnvReport.accessErrorMessage !== "NO_ERROR_THROWN",
      true,
      "a real access with no configured URL must throw",
    )
    assert.equal(noEnvReport.accessErrorName, "Error")

    const message = noEnvReport.accessErrorMessage ?? ""
    assert.match(message, /DATABASE_URL/, "the message must name the variable to set")
    assert.match(message, /TURSO_DATABASE_URL/)

    // Never a value — only variable names.
    assert.ok(!/libsql:\/\//.test(message), "no connection URL may appear")
    assert.ok(!/eyJ|sk-|token=/i.test(message), "no token material may appear")

    // Failing closed means nothing was built, so nothing could have connected.
    assert.deepEqual(noEnvReport.newSocketHandles, [])
    assert.deepEqual(noEnvReport.newDbFiles, [])
  })

  // ── 6. A configured URL initialises correctly ────────────────────────────

  test("with a throwaway file: URL the client initialises and works", async () => {
    assert.equal(db, prisma, "`db` and `prisma` are the same exported binding")
    assert.equal(typeof db.$transaction, "function")
    assert.equal(typeof db.$queryRawUnsafe, "function")
    assert.equal(typeof db.usuario, "object")

    const created = await db.usuario.create({
      data: { nombre: "Lazy Init", email: "lazy@example.test" },
    })
    assert.equal(created.email, "lazy@example.test")

    const found = await db.usuario.findMany({ where: { email: "lazy@example.test" } })
    assert.equal(found.length, 1)

    // Reads through the raw client confirm it really landed in the temp file.
    const verified = await raw.execute(`SELECT COUNT(*) AS cnt FROM "Usuario"`)
    assert.equal(Number(verified.rows[0]?.cnt), 1)
  })

  test("raw queries keep working through the lazy binding", async () => {
    const rows = await db.$queryRawUnsafe<{ one: number }[]>("SELECT 1 AS one")
    assert.equal(Number(rows[0]?.one), 1)
  })

  // ── 7-8. One instance, even under concurrency ────────────────────────────

  test("repeated accesses reuse a single client instance", async () => {
    /**
     * The proxy forwards writes to the underlying client, so a marker written
     * once and read back later proves both accesses reached the SAME object —
     * a second client would not carry it.
     */
    const probe = db as unknown as Record<string, unknown>
    probe.__core03aProbe = "instance-1"

    assert.equal((db as unknown as Record<string, unknown>).__core03aProbe, "instance-1")
    assert.equal((prisma as unknown as Record<string, unknown>).__core03aProbe, "instance-1")

    const reloaded = await import("@core/db")
    assert.equal(
      (reloaded.db as unknown as Record<string, unknown>).__core03aProbe,
      "instance-1",
      "re-importing must not build a second client",
    )
  })

  test("concurrent initialisation cannot produce two clients", async () => {
    /**
     * The resolver is synchronous, so it always runs to completion before any
     * other task observes a half-built state — interleaving is impossible by
     * construction. This asserts the observable consequence.
     */
    const observed = await Promise.all(
      Array.from({ length: 16 }, async () => {
        const probe = db as unknown as Record<string, unknown>
        return probe.__core03aProbe
      }),
    )
    assert.deepEqual(new Set(observed), new Set(["instance-1"]))
  })

  // ── 9. Transactions behave ───────────────────────────────────────────────

  test("$transaction commits and rolls back through the lazy binding", async () => {
    await db.$transaction(async (tx) => {
      await tx.usuario.create({
        data: { nombre: "Committed", email: "committed@example.test" },
      })
    })
    assert.equal(
      (await db.usuario.findMany({ where: { email: "committed@example.test" } })).length,
      1,
      "a committed transaction must persist",
    )

    await assert.rejects(
      db.$transaction(async (tx) => {
        await tx.usuario.create({
          data: { nombre: "Rolled back", email: "rolledback@example.test" },
        })
        throw new Error("forced rollback")
      }),
      /forced rollback/,
    )
    assert.equal(
      (await db.usuario.findMany({ where: { email: "rolledback@example.test" } })).length,
      0,
      "a failed transaction must roll back",
    )
  })
}
