/**
 * `turso:bootstrap` — empty-only schema creation.
 *
 * Proves the contract: the production guard cannot be skipped, the caller
 * cannot choose the connection or the DDL, it creates the whole schema on an
 * empty database, it refuses every non-empty database without touching it, it
 * never issues a column-adding or repairing statement, and a failure anywhere
 * rolls the whole thing back to an empty database.
 *
 * HOW THE POSITIVE PATH IS TESTED
 * -------------------------------
 * `bootstrapTursoFromEnv(env)` takes one parameter and opens its own
 * connection, so there is nothing to inject. The tests substitute
 * `createClient` on the cached `@libsql/client` module instead
 * (`scripts/turso-test-support.ts`), which redirects the write to a throwaway
 * local file while the real resolution, the real guard, the real DDL and the
 * real transaction all still run. The substitution exists only in the test
 * process — production imports nothing from the harness and exposes no hook.
 *
 * Runs entirely against throwaway LOCAL SQLite files — it never connects to
 * any remote database, so it is safe in CI without credentials or the proxy.
 *
 * Run: npm run test:turso-bootstrap
 */

import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test, { type TestContext } from "node:test"

import { type Client } from "@libsql/client"
import * as bootstrapModule from "../prisma/bootstrap-turso"
import {
  BootstrapVerificationError,
  DatabaseNotEmptyError,
  NOT_EMPTY_MESSAGE,
  bootstrapTursoFromEnv,
  type BootstrapResult,
} from "../prisma/bootstrap-turso"
import * as tursoSchema from "../prisma/turso-schema"
import {
  PROJECT_ROOT,
  asReadOnly,
  applicationTableNames,
  canonicalStructureFromDdl,
  compareStructures,
  generateCanonicalDdl,
  introspectStructure,
  parseSchemaModels,
  resolveTursoTarget,
  assertBootstrapTarget,
  classifyDatabaseName,
  type ProvisionEnv,
  type TursoTarget,
} from "../prisma/turso-schema"
import {
  openLocalResource,
  substituteLibsqlClient,
  type LibsqlSubstitute,
  type SubstituteOptions,
} from "./turso-test-support"

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let cachedDdl: string | undefined
/** The canonical DDL for the real schema. Generated once — Prisma is slow. */
function realDdl(): string {
  cachedDdl ??= generateCanonicalDdl()
  return cachedDdl
}

/** An environment whose database name passes the guard. */
function labEnv(name = "bootstrap-sandbox"): ProvisionEnv {
  const env = { TURSO_DATABASE_URL: `libsql://${name}.turso.io` }
  assert.equal(
    resolveTursoTarget(env).classification.safe,
    true,
    `fixture target "${name}" must be non-production`,
  )
  return env
}

/** An environment for a name the guard must refuse. */
function refusedEnv(name: string): ProvisionEnv {
  return { TURSO_DATABASE_URL: `libsql://${name}.turso.io` }
}

/** A throwaway file-backed SQLite database, cleaned up when the test ends. */
function tempDb(t: TestContext, label = "db"): { client: Client; path: string } {
  const dir = mkdtempSync(join(tmpdir(), "turso-bootstrap-"))
  const path = join(dir, `${label}.db`)
  const client = openLocalResource(`file:${path}`)
  t.after(() => {
    client.close()
    rmSync(dir, { recursive: true, force: true })
  })
  return { client, path }
}

/**
 * Redirect production's write connection to a local database for the duration
 * of one test. Restored automatically, so a leaked substitution can never make
 * a later test pass for the wrong reason.
 */
function redirect(t: TestContext, options: SubstituteOptions): LibsqlSubstitute {
  const substitute = substituteLibsqlClient(options)
  t.after(() => substitute.restore())
  return substitute
}

/** Statements production asked to write, in order. */
function writes(substitute: LibsqlSubstitute): string[] {
  return substitute.statements.filter((s) => s.via === "executeMultiple").map((s) => s.sql)
}

// ---------------------------------------------------------------------------
// 0. The harness itself can only reach local resources
// ---------------------------------------------------------------------------

test("the test harness refuses every remote URL", () => {
  for (const url of [
    "libsql://sevenef-mr-forte-lab.turso.io",
    "https://sevenef-mr-forte-lab.turso.io",
    "http://localhost:8080",
    "wss://sevenef-mr-forte-lab.turso.io",
  ]) {
    assert.throws(
      () => openLocalResource(url),
      /refuses to open/,
      `the harness must refuse ${url.split(":")[0]}:`,
    )
  }

  // …and anything that is not file: is refused too, rather than guessed at.
  assert.throws(() => openLocalResource(":memory:"), /only opens file: URLs/)
})

// ---------------------------------------------------------------------------
// 1. The guard cannot be skipped
// ---------------------------------------------------------------------------

const REFUSED_NAMES = [
  "sevenef-prod",
  "7f",
  "sevenef-live",
  "unknown-name",
  "7f-prod-test",
  "main",
  "master",
]

test("a refused target never opens a connection", async (t) => {
  const { client } = tempDb(t, "never-opened")
  const substitute = redirect(t, { redirectTo: client })

  for (const name of REFUSED_NAMES) {
    await t.test(`refuses "${name}" before opening a connection`, async () => {
      const before = substitute.clientsHandedOut

      await assert.rejects(() => bootstrapTursoFromEnv(refusedEnv(name)), /Refusing to bootstrap/)

      assert.equal(
        substitute.clientsHandedOut,
        before,
        `a connection was opened for "${name}"`,
      )
    })
  }

  assert.deepEqual(substitute.remoteRequests, [], "no remote target was ever dialled")
  assert.deepEqual(substitute.statements, [], "no statement was issued")
})

test("no environment variable can unlock a refused target", async (t) => {
  const { client } = tempDb(t, "no-override")
  const substitute = redirect(t, { redirectTo: client })

  await assert.rejects(
    () =>
      bootstrapTursoFromEnv({
        TURSO_DATABASE_URL: "libsql://7f-7frames.turso.io",
        TURSO_PROVISION_ALLOW_PRODUCTION: "7f-7frames",
        TURSO_ALLOW_PRODUCTION: "7f-7frames",
        TURSO_FORCE: "1",
        FORCE: "1",
        ALLOW_PRODUCTION: "true",
        NODE_ENV: "test",
      }),
    /Refusing to bootstrap/,
  )
  assert.equal(substitute.clientsHandedOut, 0)

  // The same variables set on the real process environment change nothing.
  const previous = { ...process.env }
  for (const key of ["TURSO_PROVISION_ALLOW_PRODUCTION", "TURSO_FORCE", "FORCE", "NODE_ENV"]) {
    process.env[key] = key === "NODE_ENV" ? "test" : "7f-7frames"
  }
  try {
    await assert.rejects(
      () => bootstrapTursoFromEnv(refusedEnv("7f-7frames")),
      /Refusing to bootstrap/,
    )
  } finally {
    process.env = previous
  }
  assert.equal(substitute.clientsHandedOut, 0)
  assert.deepEqual(substitute.statements, [])
})

test("the entry point takes an environment and nothing else", () => {
  const exported = Object.entries(bootstrapModule)
    .filter(([, value]) => typeof value === "function")
    .map(([name]) => name)
    .sort()

  assert.deepEqual(exported, [
    "BootstrapVerificationError",
    "DatabaseNotEmptyError",
    "bootstrapTursoFromEnv",
  ])

  for (const gone of [
    "bootstrapSchema",
    "bootstrapSchemaInternal",
    "bootstrapTursoTarget",
    "provisionSchema",
    "openWriteConnection",
    "defaultClientFactory",
  ]) {
    assert.equal(
      (bootstrapModule as unknown as Record<string, unknown>)[gone],
      undefined,
      `${gone} must not be exported — it would bypass the internal resolution`,
    )
  }

  // No exported value carries an injectable dependency either: the only
  // non-function exports must be plain data.
  for (const [name, value] of Object.entries(bootstrapModule)) {
    if (typeof value === "function") continue
    assert.equal(typeof value, "string", `unexpected exported value "${name}"`)
  }

  // `env` has a default, so `length` is 0 — the point is that the source
  // declares exactly one parameter and never reads a second.
  const source = readFileSync(join(PROJECT_ROOT, "prisma/bootstrap-turso.ts"), "utf8")
  const signature = /export async function bootstrapTursoFromEnv\(([\s\S]*?)\)\s*:/.exec(source)
  assert.ok(signature, "the exported signature must be findable")
  assert.equal(
    signature[1].split(",").filter((p) => p.trim()).length,
    1,
    `bootstrapTursoFromEnv must declare exactly one parameter, got: ${signature[1].trim()}`,
  )
  for (const banned of ["BootstrapOptions", "BootstrapClientFactory", "options."]) {
    assert.ok(!source.includes(banned), `${banned} must be gone from the production module`)
  }
})

test("assertBootstrapTarget ignores a forged classification", () => {
  // The exact escalation the audit found: a hand-built target claiming to be
  // safe about a production URL. The guard recomputes from the URL instead.
  const forged: TursoTarget = {
    url: "libsql://7f-7frames.aws-eu-west-1.turso.io",
    host: "7f-7frames.aws-eu-west-1.turso.io",
    dbName: "7f-7frames",
    urlSource: "TURSO_DATABASE_URL",
    classification: { safe: true, reason: "trust me" },
  }
  assert.throws(() => assertBootstrapTarget(forged), /Refusing to bootstrap "7f-7frames"/)

  // A forged *reason* on a genuinely safe name changes nothing either way.
  const genuine = resolveTursoTarget(labEnv())
  assert.doesNotThrow(() =>
    assertBootstrapTarget({ ...genuine, classification: { safe: false, reason: "nonsense" } }),
  )
})

test("assertBootstrapTarget refuses a target whose fields disagree with its URL", () => {
  const base = resolveTursoTarget({ TURSO_DATABASE_URL: "libsql://sevenef-prod.turso.io" })

  const cases: Array<[label: string, target: TursoTarget, pattern: RegExp]> = [
    [
      "production URL relabelled as a dev database",
      { ...base, dbName: "sevenef-dev", classification: { safe: true, reason: "forged" } },
      /database name does not match its URL/,
    ],
    [
      "host that does not come from the URL",
      { ...base, host: "sevenef-dev.turso.io" },
      /host does not match its URL/,
    ],
    [
      "dbName that is not the first label of the host",
      { ...base, dbName: "turso" },
      /database name does not match its URL/,
    ],
    [
      "safe-looking host pasted onto a production URL",
      {
        ...base,
        host: "bootstrap-sandbox.turso.io",
        dbName: "bootstrap-sandbox",
        classification: { safe: true, reason: "forged" },
      },
      /host does not match its URL/,
    ],
  ]

  for (const [label, target, pattern] of cases) {
    assert.throws(() => assertBootstrapTarget(target), pattern, label)
  }

  // …and a coherent, genuinely safe target still passes.
  assert.doesNotThrow(() => assertBootstrapTarget(resolveTursoTarget(labEnv())))
})

test("a safe environment opens one connection, to the internally derived target", async (t) => {
  const { client } = tempDb(t, "connect-once")
  const substitute = redirect(t, { redirectTo: client })
  const env = labEnv()

  const result = await bootstrapTursoFromEnv(env)

  assert.equal(substitute.remoteRequests.length, 1)

  // Everything the connection was opened with was derived inside the module.
  const expected = resolveTursoTarget(env)
  assert.equal(substitute.remoteRequests[0].url, expected.url)
  assert.equal(substitute.remoteRequests[0].authToken, expected.authToken)
  assert.equal(expected.host, "bootstrap-sandbox.turso.io")
  assert.equal(expected.dbName, "bootstrap-sandbox")
  assert.equal(classifyDatabaseName(expected.dbName).safe, true)
  assert.ok(result.tables > 0)
})

// ---------------------------------------------------------------------------
// 1b. The caller cannot supply a client or a DDL (7F-TURSO-09B)
// ---------------------------------------------------------------------------

/**
 * The hostile-caller shape. TypeScript rejects a second argument outright (see
 * the `@ts-expect-error` below), so the runtime probe has to go through a cast
 * — which is exactly the point: JavaScript lets anyone pass extra arguments,
 * and the defence has to be that nothing reads them.
 */
type HostileCall = (env: ProvisionEnv, options: unknown) => Promise<BootstrapResult>

const MALICIOUS_DDL = `CREATE TABLE "Pwned" ("id" TEXT NOT NULL PRIMARY KEY);`

test("the public signature rejects a dependency options object", () => {
  const spy = () => {
    throw new Error("unreachable")
  }

  // @ts-expect-error — the public bootstrap accepts no dependency options
  void (() => bootstrapTursoFromEnv(labEnv(), { createClient: spy, ddl: MALICIOUS_DDL }))
})

test("a hostile JavaScript caller's second argument is never read", async (t) => {
  const { client } = tempDb(t, "hostile-second-arg")
  const substitute = redirect(t, { redirectTo: client })

  let hostileFactoryCalls = 0
  const hostileFactory = () => {
    hostileFactoryCalls++
    throw new Error("the caller-supplied factory must never be reached")
  }

  const hostile = bootstrapTursoFromEnv as unknown as HostileCall
  const result = await hostile(labEnv(), {
    createClient: hostileFactory,
    ddl: MALICIOUS_DDL,
    // Names a future refactor might reintroduce — none may be honoured either.
    client,
    target: { dbName: "7f", classification: { safe: true, reason: "forged" } },
    renderDdl: () => MALICIOUS_DDL,
    onConnect: hostileFactory,
  })

  assert.equal(hostileFactoryCalls, 0, "the caller-supplied factory was invoked")

  // The connection actually opened is the one derived from the environment.
  assert.equal(substitute.remoteRequests.length, 1)
  assert.equal(substitute.remoteRequests[0].url, resolveTursoTarget(labEnv()).url)

  // The caller's DDL was never executed; the real schema was.
  const applied = writes(substitute)
  assert.equal(applied.length, 1)
  assert.equal(applied[0], realDdl())
  assert.ok(!applied[0].includes("Pwned"), "the malicious DDL reached the database")

  const tables = await applicationTableNames(asReadOnly(client))
  assert.ok(!tables.includes("Pwned"), "the malicious table exists")
  assert.equal(tables.length, result.tables)
})

test("a forged production target with a hostile factory and DDL is refused first", async (t) => {
  const { client } = tempDb(t, "hostile-refused")
  const substitute = redirect(t, { redirectTo: client })

  let hostileFactoryCalls = 0
  const hostile = bootstrapTursoFromEnv as unknown as HostileCall

  await assert.rejects(
    () =>
      hostile(refusedEnv("7f-7frames"), {
        createClient: () => {
          hostileFactoryCalls++
          throw new Error("unreachable")
        },
        ddl: MALICIOUS_DDL,
        target: {
          url: "libsql://7f-7frames.turso.io",
          dbName: "bootstrap-sandbox",
          classification: { safe: true, reason: "forged" },
        },
      }),
    /Refusing to bootstrap "7f-7frames"/,
  )

  assert.equal(hostileFactoryCalls, 0)
  assert.equal(substitute.clientsHandedOut, 0, "a connection was opened for a refused target")
  assert.deepEqual(substitute.statements, [], "something was written for a refused target")
  assert.deepEqual(await applicationTableNames(asReadOnly(client)), [])
})

test("NODE_ENV=test opens no injection path", async (t) => {
  const { client } = tempDb(t, "node-env")
  const substitute = redirect(t, { redirectTo: client })
  // `process.env.NODE_ENV` is typed read-only by the Next.js ambient types, so
  // it is written through an index alias — the runtime effect is the same.
  const mutableEnv = process.env as Record<string, string | undefined>
  const previous = mutableEnv.NODE_ENV

  mutableEnv.NODE_ENV = "test"
  try {
    // Still refused for a production name…
    await assert.rejects(
      () => bootstrapTursoFromEnv(refusedEnv("sevenef-prod")),
      /Refusing to bootstrap/,
    )
    assert.equal(substitute.clientsHandedOut, 0)

    // …and still ignores a hostile second argument on a safe name.
    const hostile = bootstrapTursoFromEnv as unknown as HostileCall
    await hostile(labEnv(), { ddl: MALICIOUS_DDL })
    assert.equal(writes(substitute)[0], realDdl())
  } finally {
    if (previous === undefined) delete mutableEnv.NODE_ENV
    else mutableEnv.NODE_ENV = previous
  }

  // No test-only escape hatch was added to the production sources.
  const sources = ["prisma/turso-schema.ts", "prisma/bootstrap-turso.ts", "prisma/verify-turso.ts"]
    .map((f) => readFileSync(join(PROJECT_ROOT, f), "utf8"))
    .join("\n")
  for (const hatch of ["__testing", "NODE_ENV", "ALLOW_PRODUCTION", "TURSO_FORCE"]) {
    assert.ok(!sources.includes(hatch), `${hatch} must not appear in the production sources`)
  }
})

// ---------------------------------------------------------------------------
// 2. Empty database — the only supported case
// ---------------------------------------------------------------------------

test("an empty database gets the complete schema", async (t) => {
  const canonical = await canonicalStructureFromDdl(realDdl())
  const models = parseSchemaModels(readFileSync(join(PROJECT_ROOT, "prisma/schema.prisma"), "utf8"))

  const { client } = tempDb(t, "empty")
  redirect(t, { redirectTo: client })
  const result = await bootstrapTursoFromEnv(labEnv())

  await t.test("every model reaches the database as a table", async () => {
    const tables = await applicationTableNames(asReadOnly(client))
    const missing = models.filter((m) => !tables.includes(m))
    assert.deepEqual(missing, [], `models not created: ${missing.join(", ")}`)
    assert.equal(tables.length, models.length)
    assert.equal(result.tables, models.length)
  })

  await t.test("tables, indexes and foreign keys match the canonical structure", async () => {
    const actual = await introspectStructure(asReadOnly(client))
    const report = compareStructures(canonical, actual)
    assert.deepEqual(report.drift, [])
    assert.deepEqual(report.unverifiable, [])
    assert.equal(report.verdict, "identical")
    assert.ok(result.indexes > 0)
    assert.ok(result.foreignKeys > 0)
  })

  await t.test("integrity checks are clean", () => {
    assert.equal(result.foreignKeyViolations, 0)
    assert.equal(result.integrityCheck, "ok")
  })
})

// ---------------------------------------------------------------------------
// 3. Non-empty databases are refused, untouched
// ---------------------------------------------------------------------------

test("a second run is refused and changes nothing", async (t) => {
  const { client } = tempDb(t, "twice")
  redirect(t, { redirectTo: client })

  await bootstrapTursoFromEnv(labEnv())
  const before = await introspectStructure(asReadOnly(client))

  await assert.rejects(
    () => bootstrapTursoFromEnv(labEnv()),
    (err: unknown) => {
      assert.ok(err instanceof DatabaseNotEmptyError)
      assert.ok(
        err.message.startsWith(NOT_EMPTY_MESSAGE),
        `expected the contract refusal, got: ${err.message}`,
      )
      return true
    },
  )

  assert.deepEqual(await introspectStructure(asReadOnly(client)), before)
})

test("a database with a single unrelated table is refused", async (t) => {
  const { client } = tempDb(t, "one-table")
  await client.executeMultiple(`CREATE TABLE "Leftover" ("id" TEXT NOT NULL PRIMARY KEY);`)
  redirect(t, { redirectTo: client })

  await assert.rejects(
    () => bootstrapTursoFromEnv(labEnv()),
    (err: unknown) => {
      assert.ok(err instanceof DatabaseNotEmptyError)
      assert.deepEqual(err.tables, ["Leftover"])
      return true
    },
  )

  assert.deepEqual(await applicationTableNames(asReadOnly(client)), ["Leftover"])
})

test("a partially created database is refused, not completed", async (t) => {
  const canonical = await canonicalStructureFromDdl(realDdl())
  const { client } = tempDb(t, "partial")

  // Half a schema: the first five tables, as an interrupted run would leave it.
  const partial = canonical.tables.slice(0, 5)
  await client.executeMultiple(
    `PRAGMA foreign_keys=OFF;\n${partial.map((tb) => `${tb.createSql};`).join("\n")}`,
  )
  const before = await introspectStructure(asReadOnly(client))
  redirect(t, { redirectTo: client })

  await assert.rejects(
    () => bootstrapTursoFromEnv(labEnv()),
    (err: unknown) => {
      assert.ok(err instanceof DatabaseNotEmptyError)
      assert.equal(err.tables.length, 5)
      return true
    },
  )

  // Still five tables — nothing was completed, added or reconciled.
  assert.deepEqual(await introspectStructure(asReadOnly(client)), before)
})

test("_prisma_migrations makes a database non-empty", async (t) => {
  const { client } = tempDb(t, "prisma-migrations")
  await client.executeMultiple(
    `CREATE TABLE "_prisma_migrations" ("id" TEXT NOT NULL PRIMARY KEY, "migration_name" TEXT);
     INSERT INTO "_prisma_migrations" ("id","migration_name") VALUES ('m1','20260101_init');`,
  )
  redirect(t, { redirectTo: client })

  await assert.rejects(
    () => bootstrapTursoFromEnv(labEnv()),
    (err: unknown) => {
      assert.ok(err instanceof DatabaseNotEmptyError)
      assert.deepEqual(err.tables, ["_prisma_migrations"])
      return true
    },
  )

  // Non-destructive: the migration history is still there, untouched.
  const rows = await client.execute(`SELECT "migration_name" FROM "_prisma_migrations"`)
  assert.equal(rows.rows.length, 1)
  assert.equal(String(rows.rows[0].migration_name), "20260101_init")
  assert.deepEqual(await applicationTableNames(asReadOnly(client)), ["_prisma_migrations"])
})

test("a leftover view or trigger makes a database non-empty", async (t) => {
  // The adversarial finding this closes: neither shows up in a `type='table'`
  // query, so bootstrap used to write into the database — and the trigger then
  // survived to fire against the tables it had just created.
  for (const [label, seed, expected] of [
    ["a view", `CREATE TABLE "Seed" ("id" TEXT PRIMARY KEY);\nCREATE VIEW "v_secret" AS SELECT * FROM "Seed";`, ["table Seed", "view v_secret"]],
    [
      "a trigger on a view",
      `CREATE TABLE "Seed" ("id" TEXT PRIMARY KEY);
       CREATE VIEW "v_gate" AS SELECT * FROM "Seed";
       CREATE TRIGGER "evil_exfil" INSTEAD OF INSERT ON "v_gate" BEGIN UPDATE "Seed" SET "id" = 'pwned'; END;`,
      ["table Seed", "trigger evil_exfil", "view v_gate"],
    ],
  ] as const) {
    await t.test(`refuses ${label}`, async (inner) => {
      const { client } = tempDb(inner, label.replace(/\W+/g, "-"))
      await client.executeMultiple(seed)
      const substitute = redirect(inner, { redirectTo: client })

      await assert.rejects(
        () => bootstrapTursoFromEnv(labEnv()),
        (err: unknown) => {
          assert.ok(err instanceof DatabaseNotEmptyError)
          assert.deepEqual(
            err.objects.map((o) => `${o.type} ${o.name}`).sort(),
            [...expected].sort(),
          )
          return true
        },
      )

      // Nothing was written at all.
      assert.deepEqual(
        writes(substitute),
        [],
        "the DDL must never be applied to a non-empty database",
      )
    })
  }
})

test("only engine-internal tables are ignored by the empty check", async (t) => {
  // `libsql_*` is a documented engine prefix and can exist in a fresh database.
  const { client } = tempDb(t, "engine-internal")
  await client.executeMultiple(`CREATE TABLE "libsql_wasm_func_table" ("name" TEXT);`)
  redirect(t, { redirectTo: client })

  const result = await bootstrapTursoFromEnv(labEnv())
  assert.ok(result.tables > 0)

  // …and the allow-list really is just those two prefixes.
  assert.equal(tursoSchema.isInternalTable("sqlite_sequence"), true)
  assert.equal(tursoSchema.isInternalTable("libsql_wasm_func_table"), true)
  for (const name of ["_prisma_migrations", "_litestream_seq", "_litestream_lock", "Workspace"]) {
    assert.equal(tursoSchema.isInternalTable(name), false, name)
  }
})

// ---------------------------------------------------------------------------
// 4. The forbidden operations really are absent
// ---------------------------------------------------------------------------

test("bootstrap issues no repairing statement of any kind", async (t) => {
  const { client } = tempDb(t, "spy")
  const substitute = redirect(t, { redirectTo: client })
  await bootstrapTursoFromEnv(labEnv())

  const forbidden = [/\bALTER\s+TABLE\b/i, /\bDROP\b/i, /\bDELETE\s+FROM\b/i, /\bUPDATE\s+"/i]
  for (const pattern of forbidden) {
    const offending = substitute.statements.filter((c) => pattern.test(c.sql))
    assert.deepEqual(offending, [], `bootstrap issued ${pattern}: ${offending[0]?.sql.slice(0, 80)}`)
  }

  // The only thing ever written is the canonical DDL, verbatim, in one go.
  const applied = writes(substitute)
  assert.equal(applied.length, 1, "the schema is applied as a single canonical script")
  assert.equal(applied[0], realDdl())

  // Everything else is a read that passed the read-only guard.
  for (const call of substitute.statements.filter((c) => c.via === "execute")) {
    assert.doesNotThrow(() => tursoSchema.assertReadOnlySql(call.sql), call.sql.slice(0, 80))
  }
})

test("the additive planner is gone from the public surface", () => {
  const removed = [
    "provisionSchema",
    "diffStructures",
    "preflightPlan",
    "columnDefinition",
    "isNonConstantDefault",
    "ManualMigrationRequiredError",
    "assertWritableTarget",
  ]
  const surface = Object.keys(tursoSchema)
  for (const name of removed) {
    assert.ok(!surface.includes(name), `${name} should no longer be exported`)
  }
  assert.ok(surface.includes("compareStructures"))
  assert.ok(surface.includes("asReadOnly"))
})

test("there is no production override anywhere in the sources", () => {
  const sources = ["prisma/turso-schema.ts", "prisma/bootstrap-turso.ts", "prisma/verify-turso.ts"]
    .map((f) => readFileSync(join(PROJECT_ROOT, f), "utf8"))
    .join("\n")
  assert.ok(
    !/TURSO_PROVISION_ALLOW_PRODUCTION/.test(sources),
    "the production override must be gone entirely",
  )
  // The guard takes a target and nothing else — there is no env parameter to
  // read an override from.
  assert.equal(tursoSchema.assertBootstrapTarget.length, 1)
})

// ---------------------------------------------------------------------------
// 5. Atomicity: rollback and concurrency
// ---------------------------------------------------------------------------

test("a failure mid-run rolls back to an empty database", async (t) => {
  const { client } = tempDb(t, "rollback")

  // The whole canonical schema is really applied, and then a statement that the
  // engine rejects aborts the run — so the rollback has a full schema to undo,
  // not a token table.
  const substitute = redirect(t, {
    redirectTo: client,
    async interceptWrite(sql, apply) {
      await apply(sql)
      await apply(`CREATE INDEX "Workspace_nope_idx" ON "Workspace"("nope");`)
    },
  })

  await assert.rejects(() => bootstrapTursoFromEnv(labEnv()), /no such column: nope/)

  // What the tool asked to write was still exactly the canonical DDL.
  assert.deepEqual(writes(substitute), [realDdl()])

  assert.deepEqual(
    await applicationTableNames(asReadOnly(client)),
    [],
    "rollback must leave the database completely empty",
  )
  const indexes = await client.execute(
    "SELECT count(*) AS n FROM sqlite_master WHERE type='index' AND name NOT LIKE 'sqlite_%'",
  )
  assert.equal(Number(indexes.rows[0].n), 0, "no partial index may survive")
})

test("a database that fails verification is rolled back, not committed", async (t) => {
  const { client } = tempDb(t, "verify-fail")

  // The database ends up holding something the canonical structure does not,
  // and a CHECK constraint PRAGMAs cannot compare. Both must stop the commit.
  const substitute = redirect(t, {
    redirectTo: client,
    async interceptWrite(sql, apply) {
      await apply(sql)
      await apply(`CREATE TABLE "Smuggled" ("id" TEXT NOT NULL PRIMARY KEY, "n" INTEGER CHECK ("n" > 0));`)
    },
  })

  await assert.rejects(
    () => bootstrapTursoFromEnv(labEnv()),
    (err: unknown) => {
      assert.ok(err instanceof BootstrapVerificationError)
      assert.match(err.message, /rolled back/)
      assert.match(err.message, /extra-table/)
      assert.match(err.message, /check-constraint/)
      return true
    },
  )

  assert.deepEqual(writes(substitute), [realDdl()])
  assert.deepEqual(
    await applicationTableNames(asReadOnly(client)),
    [],
    "a failed verification must leave nothing behind",
  )
})

test("a failing close() never masks the real outcome", async (t) => {
  const { client } = tempDb(t, "close-throws")

  // A refusal must still reach the caller as a DatabaseNotEmptyError (exit 2),
  // not as whatever the connection threw on its way out.
  await client.executeMultiple(`CREATE TABLE "Leftover" ("id" TEXT NOT NULL PRIMARY KEY);`)
  const explodingClose = (standIn: Record<string, unknown>) => ({
    ...standIn,
    close: () => {
      throw new Error("close blew up")
    },
  })

  const substitute = redirect(t, { redirectTo: client, wrapClient: explodingClose })
  await assert.rejects(
    () => bootstrapTursoFromEnv(labEnv()),
    (err: unknown) => {
      assert.ok(err instanceof DatabaseNotEmptyError, `got ${(err as Error).message}`)
      return true
    },
  )
  substitute.restore()

  // …and a successful bootstrap still succeeds.
  const { client: fresh } = tempDb(t, "close-throws-ok")
  redirect(t, { redirectTo: fresh, wrapClient: explodingClose })
  const result = await bootstrapTursoFromEnv(labEnv())
  assert.ok(result.tables > 0)
})

test("two concurrent bootstraps leave no partial state and only one succeeds", async (t) => {
  const { path } = tempDb(t, "concurrent")

  const a = openLocalResource(`file:${path}`)
  const b = openLocalResource(`file:${path}`)
  t.after(() => {
    a.close()
    b.close()
  })

  // Each run gets its own connection to the same file, exactly as two operators
  // racing would.
  let handedOut = 0
  redirect(t, { redirectTo: () => (handedOut++ === 0 ? a : b) })

  const results = await Promise.allSettled([
    bootstrapTursoFromEnv(labEnv()),
    bootstrapTursoFromEnv(labEnv()),
  ])
  const fulfilled = results.filter((r) => r.status === "fulfilled")
  const rejected = results.filter((r) => r.status === "rejected")

  assert.equal(fulfilled.length, 1, "exactly one bootstrap may succeed")
  assert.equal(rejected.length, 1)

  // The loser must fail for a legitimate reason: locked out, or it saw the
  // winner's tables. Never a half-written database.
  const reason = (rejected[0] as PromiseRejectedResult).reason
  const message = reason instanceof Error ? reason.message : String(reason)
  assert.ok(
    /SQLITE_BUSY|database is locked|locked|Database is not empty/i.test(message),
    `unexpected concurrent failure: ${message}`,
  )

  // Whatever happened, the database is exactly the canonical schema.
  const canonical = await canonicalStructureFromDdl(realDdl())
  const actual = await introspectStructure(asReadOnly(a))
  assert.equal(compareStructures(canonical, actual).verdict, "identical")
})

// ---------------------------------------------------------------------------
// 6. Error hygiene and import safety
// ---------------------------------------------------------------------------

test("errors never carry credentials", async (t) => {
  const secret = "libsql://leaky-lab.turso.io?authToken=leakedsecret"
  const { client } = tempDb(t, "leaky")

  redirect(t, {
    redirectTo: client,
    wrapClient: () => ({
      transaction: () => {
        throw new Error(`connection to ${secret} failed (Bearer leakedbearer)`)
      },
      close: () => {},
    }),
  })

  await assert.rejects(
    () => bootstrapTursoFromEnv(labEnv()),
    (err: unknown) => {
      assert.ok(err instanceof Error)
      // The raw error still has it; what the CLI prints must not.
      const printed = tursoSchema.sanitizeForLog(err.message)
      assert.ok(!printed.includes("leakedsecret"), printed)
      assert.ok(!printed.includes("leakedbearer"), printed)
      assert.ok(!printed.includes("leaky-lab"), printed)
      return true
    },
  )
})

test("importing the CLI modules runs nothing and opens no connection", () => {
  const script =
    "Promise.all([import('./prisma/bootstrap-turso.ts'), import('./prisma/verify-turso.ts')])" +
    ".then(() => console.log('imported-clean'))"

  const out = execFileSync(process.execPath, ["--import", "tsx", "--eval", script], {
    cwd: PROJECT_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    // No Turso configuration at all: a CLI that ran on import would fail here.
    env: {
      ...process.env,
      TURSO_DATABASE_URL: "",
      TURSO_AUTH_TOKEN: "",
      DATABASE_URL: "",
      DATABASE_AUTH_TOKEN: "",
    },
  })

  assert.equal(out.trim(), "imported-clean")
})

// ---------------------------------------------------------------------------
// 7. Environment independence
// ---------------------------------------------------------------------------

test("bootstrap works from any working directory", async (t) => {
  const original = process.cwd()
  const elsewhere = mkdtempSync(join(tmpdir(), "turso-cwd-"))
  t.after(() => {
    process.chdir(original)
    rmSync(elsewhere, { recursive: true, force: true })
  })

  const { client } = tempDb(t, "from-tmp")
  const substitute = redirect(t, { redirectTo: client })

  process.chdir(elsewhere)
  const result = await bootstrapTursoFromEnv(labEnv())
  process.chdir(original)

  // The DDL the tool rendered from another cwd is the same canonical script.
  assert.deepEqual(writes(substitute), [realDdl()])
  assert.ok(result.tables > 0)
})
