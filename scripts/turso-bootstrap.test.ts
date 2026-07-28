/**
 * `turso:bootstrap` — empty-only schema creation.
 *
 * Proves the contract: the production guard cannot be skipped, it creates the
 * whole schema on an empty database, it refuses every non-empty database
 * without touching it, it never issues a column-adding or repairing statement,
 * and a failure anywhere rolls the whole thing back to an empty database.
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

import { createClient, type Client } from "@libsql/client"
import * as bootstrapModule from "../prisma/bootstrap-turso"
import {
  BootstrapVerificationError,
  DatabaseNotEmptyError,
  NOT_EMPTY_MESSAGE,
  bootstrapTursoFromEnv,
  type BootstrapClient,
  type BootstrapTransaction,
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
  const client = createClient({ url: `file:${path}` })
  t.after(() => {
    client.close()
    rmSync(dir, { recursive: true, force: true })
  })
  return { client, path }
}

interface SpiedCall {
  via: "execute" | "executeMultiple"
  sql: string
}

interface Injection {
  factory: bootstrapModule.BootstrapClientFactory
  /** Targets the factory was called with — empty when the guard refused first. */
  targets: TursoTarget[]
  calls: SpiedCall[]
}

/**
 * A client factory backed by a local SQLite file. Records every statement so we
 * can prove what was NOT run, and every factory invocation so we can prove the
 * guard refused before a connection was ever opened.
 *
 * `close()` is a no-op: the entry point closes what it opened, and the tests
 * keep inspecting the same database afterwards.
 */
function inject(client: Client): Injection {
  const targets: TursoTarget[] = []
  const calls: SpiedCall[] = []
  return {
    targets,
    calls,
    factory: (target) => {
      targets.push(target)
      const wrapped: BootstrapClient = {
        async transaction(mode: "write") {
          const tx = await client.transaction(mode)
          const tracked: BootstrapTransaction = {
            async execute(sql: string) {
              calls.push({ via: "execute", sql })
              return tx.execute(sql)
            },
            async executeMultiple(sql: string) {
              calls.push({ via: "executeMultiple", sql })
              return tx.executeMultiple(sql)
            },
            commit: () => tx.commit(),
            rollback: () => tx.rollback(),
            close: () => tx.close(),
          }
          return tracked
        },
        close: () => {},
      }
      return wrapped
    },
  }
}

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

test("a refused target never reaches the client factory", async (t) => {
  for (const name of REFUSED_NAMES) {
    await t.test(`refuses "${name}" before opening a connection`, async () => {
      let invocations = 0

      await assert.rejects(
        () =>
          bootstrapTursoFromEnv(refusedEnv(name), {
            ddl: `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY);`,
            createClient: () => {
              invocations++
              throw new Error("the client factory must never be reached for a refused target")
            },
          }),
        /Refusing to bootstrap/,
      )

      assert.equal(invocations, 0, `the factory was invoked for "${name}"`)
    })
  }
})

test("no environment variable can unlock a refused target", async () => {
  let invocations = 0
  await assert.rejects(
    () =>
      bootstrapTursoFromEnv(
        {
          TURSO_DATABASE_URL: "libsql://7f-7frames.turso.io",
          TURSO_PROVISION_ALLOW_PRODUCTION: "7f-7frames",
          TURSO_ALLOW_PRODUCTION: "7f-7frames",
          TURSO_FORCE: "1",
          FORCE: "1",
          ALLOW_PRODUCTION: "true",
        },
        {
          ddl: `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY);`,
          createClient: () => {
            invocations++
            throw new Error("unreachable")
          },
        },
      ),
    /Refusing to bootstrap/,
  )
  assert.equal(invocations, 0)

  // The same variables set on the real process environment change nothing.
  const previous = { ...process.env }
  for (const key of ["TURSO_PROVISION_ALLOW_PRODUCTION", "TURSO_FORCE", "FORCE"]) {
    process.env[key] = "7f-7frames"
  }
  try {
    await assert.rejects(
      () =>
        bootstrapTursoFromEnv(refusedEnv("7f-7frames"), {
          ddl: `CREATE TABLE "T" ("id" TEXT NOT NULL PRIMARY KEY);`,
          createClient: () => {
            invocations++
            throw new Error("unreachable")
          },
        }),
      /Refusing to bootstrap/,
    )
  } finally {
    process.env = previous
  }
  assert.equal(invocations, 0)
})

test("the entry point takes an environment, so no target can be forged", () => {
  // The signature itself is the defence: there is no `target` parameter for a
  // caller to hand a pre-decided classification to.
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
  ]) {
    assert.equal(
      (bootstrapModule as unknown as Record<string, unknown>)[gone],
      undefined,
      `${gone} must not be exported — it would bypass the internal resolution`,
    )
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

test("a safe environment invokes the factory once, with the internally derived target", async (t) => {
  const { client } = tempDb(t, "factory-once")
  const injection = inject(client)
  const env = labEnv()

  const result = await bootstrapTursoFromEnv(env, {
    ddl: realDdl(),
    createClient: injection.factory,
  })

  assert.equal(injection.targets.length, 1)

  // Everything the factory received was derived inside the module from `env`.
  const expected = resolveTursoTarget(env)
  const handed = injection.targets[0]
  assert.equal(handed.url, expected.url)
  assert.equal(handed.host, expected.host)
  assert.equal(handed.dbName, expected.dbName)
  assert.equal(handed.urlSource, expected.urlSource)
  assert.deepEqual(handed.classification, classifyDatabaseName(expected.dbName))
  assert.ok(result.tables > 0)
})

// ---------------------------------------------------------------------------
// 2. Empty database — the only supported case
// ---------------------------------------------------------------------------

test("an empty database gets the complete schema", async (t) => {
  const ddl = realDdl()
  const canonical = await canonicalStructureFromDdl(ddl)
  const models = parseSchemaModels(readFileSync(join(PROJECT_ROOT, "prisma/schema.prisma"), "utf8"))

  const { client } = tempDb(t, "empty")
  const result = await bootstrapTursoFromEnv(labEnv(), {
    ddl,
    createClient: inject(client).factory,
  })

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
  const ddl = realDdl()
  const { client } = tempDb(t, "twice")
  await bootstrapTursoFromEnv(labEnv(), { ddl, createClient: inject(client).factory })

  const before = await introspectStructure(asReadOnly(client))

  await assert.rejects(
    () => bootstrapTursoFromEnv(labEnv(), { ddl, createClient: inject(client).factory }),
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

  await assert.rejects(
    () => bootstrapTursoFromEnv(labEnv(), { ddl: realDdl(), createClient: inject(client).factory }),
    (err: unknown) => {
      assert.ok(err instanceof DatabaseNotEmptyError)
      assert.deepEqual(err.tables, ["Leftover"])
      return true
    },
  )

  assert.deepEqual(await applicationTableNames(asReadOnly(client)), ["Leftover"])
})

test("a partially created database is refused, not completed", async (t) => {
  const ddl = realDdl()
  const canonical = await canonicalStructureFromDdl(ddl)
  const { client } = tempDb(t, "partial")

  // Half a schema: the first five tables, as an interrupted run would leave it.
  const partial = canonical.tables.slice(0, 5)
  await client.executeMultiple(
    `PRAGMA foreign_keys=OFF;\n${partial.map((tb) => `${tb.createSql};`).join("\n")}`,
  )
  const before = await introspectStructure(asReadOnly(client))

  await assert.rejects(
    () => bootstrapTursoFromEnv(labEnv(), { ddl, createClient: inject(client).factory }),
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

  await assert.rejects(
    () => bootstrapTursoFromEnv(labEnv(), { ddl: realDdl(), createClient: inject(client).factory }),
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
    await t.test(`refuses ${label}`, async () => {
      const { client } = tempDb(t, label.replace(/\W+/g, "-"))
      await client.executeMultiple(seed)
      const injection = inject(client)

      await assert.rejects(
        () => bootstrapTursoFromEnv(labEnv(), { ddl: realDdl(), createClient: injection.factory }),
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
        injection.calls.filter((c) => c.via === "executeMultiple"),
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

  const result = await bootstrapTursoFromEnv(labEnv(), {
    ddl: realDdl(),
    createClient: inject(client).factory,
  })
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
  const injection = inject(client)
  await bootstrapTursoFromEnv(labEnv(), { ddl: realDdl(), createClient: injection.factory })

  const forbidden = [/\bALTER\s+TABLE\b/i, /\bDROP\b/i, /\bDELETE\s+FROM\b/i, /\bUPDATE\s+"/i]
  for (const pattern of forbidden) {
    const offending = injection.calls.filter((c) => pattern.test(c.sql))
    assert.deepEqual(offending, [], `bootstrap issued ${pattern}: ${offending[0]?.sql.slice(0, 80)}`)
  }

  // The only thing ever written is the canonical DDL, verbatim, in one go.
  const writes = injection.calls.filter((c) => c.via === "executeMultiple")
  assert.equal(writes.length, 1, "the schema is applied as a single canonical script")
  assert.equal(writes[0].sql, realDdl())

  // Everything else is a read that passed the read-only guard.
  for (const call of injection.calls.filter((c) => c.via === "execute")) {
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

  // A DDL whose last statement fails: the index references a column that does
  // not exist, so the script aborts after several tables already exist.
  const brokenDdl = `CREATE TABLE "A" ("id" TEXT NOT NULL PRIMARY KEY, "label" TEXT);
CREATE TABLE "B" ("id" TEXT NOT NULL PRIMARY KEY);
CREATE INDEX "A_label_idx" ON "A"("label");
CREATE INDEX "B_nope_idx" ON "B"("nope");`

  await assert.rejects(
    () => bootstrapTursoFromEnv(labEnv(), { ddl: brokenDdl, createClient: inject(client).factory }),
    /no such column: nope/,
  )

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

  // A CHECK constraint cannot be compared through PRAGMAs, so the structure is
  // not verifiable and the transaction must not be committed.
  const uncheckableDdl = `CREATE TABLE "A" ("id" TEXT NOT NULL PRIMARY KEY, "n" INTEGER CHECK ("n" > 0));`

  await assert.rejects(
    () =>
      bootstrapTursoFromEnv(labEnv(), {
        ddl: uncheckableDdl,
        createClient: inject(client).factory,
      }),
    (err: unknown) => {
      assert.ok(err instanceof BootstrapVerificationError)
      assert.match(err.message, /rolled back/)
      assert.match(err.message, /structure not verifiable/)
      return true
    },
  )

  assert.deepEqual(await applicationTableNames(asReadOnly(client)), [])
})

test("a failing close() never masks the real outcome", async (t) => {
  const { client } = tempDb(t, "close-throws")

  // A refusal must still reach the caller as a DatabaseNotEmptyError (exit 2),
  // not as whatever the connection threw on its way out.
  await client.executeMultiple(`CREATE TABLE "Leftover" ("id" TEXT NOT NULL PRIMARY KEY);`)
  const explode: BootstrapClient = {
    transaction: (mode) => client.transaction(mode),
    close: () => {
      throw new Error("close blew up")
    },
  }
  await assert.rejects(
    () => bootstrapTursoFromEnv(labEnv(), { ddl: realDdl(), createClient: () => explode }),
    (err: unknown) => {
      assert.ok(err instanceof DatabaseNotEmptyError, `got ${(err as Error).message}`)
      return true
    },
  )

  // …and a successful bootstrap still succeeds.
  const { client: fresh } = tempDb(t, "close-throws-ok")
  const explodeOnFresh: BootstrapClient = {
    transaction: (mode) => fresh.transaction(mode),
    close: () => {
      throw new Error("close blew up")
    },
  }
  const result = await bootstrapTursoFromEnv(labEnv(), {
    ddl: realDdl(),
    createClient: () => explodeOnFresh,
  })
  assert.ok(result.tables > 0)
})

test("two concurrent bootstraps leave no partial state and only one succeeds", async (t) => {
  const ddl = realDdl()
  const { path } = tempDb(t, "concurrent")

  const a = createClient({ url: `file:${path}` })
  const b = createClient({ url: `file:${path}` })
  t.after(() => {
    a.close()
    b.close()
  })

  const results = await Promise.allSettled([
    bootstrapTursoFromEnv(labEnv(), { ddl, createClient: inject(a).factory }),
    bootstrapTursoFromEnv(labEnv(), { ddl, createClient: inject(b).factory }),
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
  const canonical = await canonicalStructureFromDdl(ddl)
  const actual = await introspectStructure(asReadOnly(a))
  assert.equal(compareStructures(canonical, actual).verdict, "identical")
})

// ---------------------------------------------------------------------------
// 6. Error hygiene and import safety
// ---------------------------------------------------------------------------

test("errors never carry credentials", async () => {
  const secret = "libsql://leaky-lab.turso.io?authToken=leakedsecret"

  await assert.rejects(
    () =>
      bootstrapTursoFromEnv(labEnv(), {
        ddl: realDdl(),
        createClient: () => {
          throw new Error(`connection to ${secret} failed (Bearer leakedbearer)`)
        },
      }),
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
  process.chdir(elsewhere)
  const ddl = generateCanonicalDdl()
  const result = await bootstrapTursoFromEnv(labEnv(), {
    ddl,
    createClient: inject(client).factory,
  })
  process.chdir(original)

  assert.equal(ddl, realDdl(), "the DDL must not change with the caller's cwd")
  assert.ok(result.tables > 0)
})
