import assert from "node:assert/strict"
import test from "node:test"
import { createServer, type Server } from "node:http"
import { AddressInfo } from "node:net"
import { Client } from "pg"
import { parse as parsePgConnectionString } from "pg-connection-string"
import { AIExecutionError } from "@/engines/ai"
import { pendingBackgroundTaskCount, trackBackgroundTask, unreviewedBackgroundOutcomes } from "@core/background-tasks"
import {
  blockedOutboundAttempts,
  connectionStringFor,
  installOutboundNetworkGuard,
  isMissingProviderKeyError,
  isOutboundNetworkGuardActive,
  provisionTestDatabase,
  queryRaw,
  resolveTestDatabaseTarget,
  settleBackgroundTasks,
  TEST_DATABASE_URL_VAR,
  uninstallOutboundNetworkGuard,
} from "./postgres"

/**
 * NEON-03-R1 — the test database helper only ever connects to the LOOPBACK
 * destination it validated. Pure checks on synthetic URLs (no server is
 * contacted), plus a connect spy proving that a rejected URL never opens a
 * connection. The installed parser (pg 8.23 / pg-connection-string 2.14)
 * is exercised directly to document WHY a query string can never be
 * accepted.
 */

const SECRET = "s3cret-PW"

function expectRejected(url: string, reason: RegExp): void {
  assert.throws(
    () => resolveTestDatabaseTarget(url),
    (e: unknown) => {
      assert.ok(e instanceof Error, "throws an Error")
      assert.match(e.message, reason)
      assert.match(e.message, new RegExp(TEST_DATABASE_URL_VAR), "names the variable")
      // Never the value: no password, no host from the input, not the input itself.
      assert.doesNotMatch(e.message, /s3cret|remote\.invalid|evil\.invalid|10\.0\.0\.|%2F/i, "never echoes the password or the host")
      if (url) assert.ok(!e.message.includes(url), "never echoes the URL")
      return true
    },
  )
}

test("the installed pg parser lets a query string move the destination (why query strings are refused)", () => {
  const base = `postgresql://test:${SECRET}@127.0.0.1:5432/postgres`
  assert.equal(parsePgConnectionString(base).host, "127.0.0.1")
  assert.equal(parsePgConnectionString(`${base}?host=remote.invalid`).host, "remote.invalid", "?host= overrides the authority host")
  assert.equal(parsePgConnectionString(`${base}?host=a.invalid&host=remote.invalid`).host, "remote.invalid", "last repeated key wins")
  assert.equal(parsePgConnectionString(`${base}?ho%73t=remote.invalid`).host, "remote.invalid", "percent-encoded key is decoded")
  assert.equal(parsePgConnectionString(`${base}?host=%2Fvar%2Frun%2Fpostgresql`).host, "/var/run/postgresql", "?host= can name a socket directory")
  assert.equal(parsePgConnectionString(`${base}?port=9999`).port, "9999", "?port= overrides the port")
  // The same override survives into a real client's effective parameters.
  const client = new Client({ connectionString: `${base}?host=remote.invalid` })
  assert.equal(client.host, "remote.invalid")
})

test("accepted: plain loopback URLs, with and without password/port, IPv6 included", () => {
  assert.deepEqual(resolveTestDatabaseTarget(`postgresql://postgres:${SECRET}@127.0.0.1:5432/postgres`), {
    host: "127.0.0.1",
    port: 5432,
    user: "postgres",
    password: SECRET,
    database: "postgres",
  })
  assert.deepEqual(resolveTestDatabaseTarget("postgres://u@localhost/db_1"), { host: "localhost", port: 5432, user: "u", password: "", database: "db_1" })
  assert.deepEqual(resolveTestDatabaseTarget("postgresql://u:p%40ss@[::1]:5433/x"), { host: "::1", port: 5433, user: "u", password: "p@ss", database: "x" })
})

test("rejected before any connection: remote hosts, socket destinations and unsupported schemes", () => {
  expectRejected(`postgresql://test:${SECRET}@remote.invalid:5432/postgres`, /LOOPBACK/)
  expectRejected(`postgresql://test:${SECRET}@10.0.0.7/postgres`, /LOOPBACK/)
  expectRejected(`postgresql://test:${SECRET}@%2Fvar%2Frun%2Fpostgresql/postgres`, /LOOPBACK/)
  expectRejected("socket:/var/run/postgresql?db=postgres", /postgresql:\/\/ scheme/)
  expectRejected(`libsql://test:${SECRET}@127.0.0.1/postgres`, /postgresql:\/\/ scheme/)
  expectRejected("file:./dev.db", /postgresql:\/\/ scheme/)
  expectRejected("not a url", /not a valid URL/)
  expectRejected("", /is not set/)
})

test("rejected: an apparently local URL whose query string would override the destination (or anything else)", () => {
  const base = `postgresql://test:${SECRET}@127.0.0.1:5432/postgres`
  expectRejected(`${base}?host=remote.invalid`, /query string/)
  expectRejected(`${base}?host=a.invalid&host=remote.invalid`, /query string/)
  expectRejected(`${base}?ho%73t=remote.invalid`, /query string/)
  expectRejected(`${base}?host=%2Fvar%2Frun%2Fpostgresql`, /query string/)
  expectRejected(`${base}?port=9999`, /query string/)
  expectRejected(`${base}?hostaddr=10.0.0.1`, /query string/)
  expectRejected(`${base}?sslmode=require`, /query string/)
  expectRejected(`${base}?options=-c%20search_path%3Dx`, /query string/)
  expectRejected(`${base}?`, /query string/)
  expectRejected("postgresql:///postgres?host=127.0.0.1", /query string|LOOPBACK/)
  expectRejected(`${base}#frag`, /fragment/)
})

test("rejected: malformed database, user or port", () => {
  expectRejected(`postgresql://test:${SECRET}@127.0.0.1:5432/`, /exactly one database/)
  expectRejected(`postgresql://test:${SECRET}@127.0.0.1:5432/a/b`, /exactly one database/)
  expectRejected(`postgresql://test:${SECRET}@127.0.0.1:5432/na-me`, /exactly one database/)
  expectRejected(`postgresql://:${SECRET}@127.0.0.1:5432/postgres`, /user name/)
  expectRejected(`postgresql://test:${SECRET}@127.0.0.1:70000/postgres`, /valid URL|invalid port/)
})

test("the connection string handed to Prisma/DATABASE_URL is built from the validated parameters and parses back to them", () => {
  const target = resolveTestDatabaseTarget(`postgresql://us%40er:${SECRET}@localhost:5433/t7f_x`)
  const url = connectionStringFor({ ...target, database: "t7f_x_1_abcd" })
  assert.equal(url, `postgresql://us%40er:${encodeURIComponent(SECRET)}@localhost:5433/t7f_x_1_abcd`)
  assert.ok(!url.includes("?") && !url.includes("#"))
  const parsed = parsePgConnectionString(url)
  assert.equal(parsed.host, "localhost")
  assert.equal(parsed.port, "5433")
  assert.equal(parsed.user, "us@er")
  assert.equal(parsed.password, SECRET)
  assert.equal(parsed.database, "t7f_x_1_abcd")
  assert.equal(connectionStringFor({ host: "::1", port: 5432, user: "u", password: "", database: "d" }), "postgresql://u@[::1]:5432/d")
})

test("a rejected TEST_DATABASE_URL never opens a connection (zero pg connect calls, no DDL)", async () => {
  const saved = process.env[TEST_DATABASE_URL_VAR]
  const originalConnect = Client.prototype.connect
  let connectCalls = 0
  // The stub NEVER delegates to the real connect: it counts and throws, so a
  // validator regression fails this test instead of opening a real socket.
  Client.prototype.connect = function stubbedConnect(this: Client) {
    connectCalls++
    throw new Error("[7F test] connect() must not be reached for a rejected URL")
  } as typeof Client.prototype.connect
  try {
    for (const bad of [
      `postgresql://test:${SECRET}@remote.invalid:5432/postgres`,
      `postgresql://test:${SECRET}@127.0.0.1:5432/postgres?host=remote.invalid`,
      `postgresql://test:${SECRET}@127.0.0.1:5432/postgres?port=1`,
      "socket:/var/run/postgresql?db=postgres",
      "",
    ]) {
      if (bad) process.env[TEST_DATABASE_URL_VAR] = bad
      else delete process.env[TEST_DATABASE_URL_VAR]
      await assert.rejects(provisionTestDatabase("rejected"), (e: unknown) => {
        assert.ok(e instanceof Error)
        assert.match(e.message, new RegExp(TEST_DATABASE_URL_VAR))
        assert.doesNotMatch(e.message, /s3cret|remote\.invalid/)
        return true
      })
    }
    assert.equal(connectCalls, 0, "no connection may be attempted for a rejected URL")
  } finally {
    Client.prototype.connect = originalConnect
    if (saved === undefined) delete process.env[TEST_DATABASE_URL_VAR]
    else process.env[TEST_DATABASE_URL_VAR] = saved
  }
})

test("with the real TEST_DATABASE_URL the admin target is the validated loopback host and the provisioned URL carries no query string", async () => {
  const admin = resolveTestDatabaseTarget()
  assert.ok(["localhost", "127.0.0.1", "::1"].includes(admin.host))
  const database = await provisionTestDatabase("support-roundtrip")
  try {
    assert.equal(database.target.host, admin.host)
    assert.equal(database.target.port, admin.port)
    assert.equal(database.url, connectionStringFor(database.target))
    assert.equal(process.env.DATABASE_URL, database.url)
    assert.ok(!database.url.includes("?"))
    assert.equal(parsePgConnectionString(database.url).host, admin.host)
    assert.equal(process.env.OPENAI_API_KEY, undefined)
    assert.equal(process.env.DEEPSEEK_API_KEY, undefined)
    assert.equal(process.env.TURSO_DATABASE_URL, undefined)
  } finally {
    await database.dispose()
  }
})

test("dispose() refuses to drop while a session is still open on the database, then succeeds once it is closed (no FORCE)", async () => {
  const database = await provisionTestDatabase("support-leak")
  const leaked = new Client({ host: database.target.host, port: database.target.port, user: database.target.user, password: database.target.password, database: database.target.database })
  await leaked.connect()
  try {
    await assert.rejects(database.dispose(), (e: unknown) => {
      assert.ok(e instanceof Error)
      assert.match(e.message, /session\(s\) still open/)
      assert.match(e.message, /client backend/)
      return true
    })
    // The database survived the refusal and is still usable.
    assert.equal((await queryRaw<{ one: number }>(database, "SELECT 1 AS one"))[0].one, 1)
  } finally {
    await leaked.end()
  }
  await database.dispose()
  const gone = await queryRaw<{ cnt: string }>(
    { ...database, target: { ...database.target, database: resolveTestDatabaseTarget().database } },
    "SELECT COUNT(*) AS cnt FROM pg_database WHERE datname = $1",
    [database.name],
  )
  assert.equal(Number(gone[0].cnt), 0)
})

// ─── R1: background outcomes can never vanish unreviewed ────────────────────

test("a background rejection that settled BEFORE dispose() is not discarded: dispose refuses, settle surfaces it, then teardown completes", async () => {
  const database = await provisionTestDatabase("support-unreviewed")
  try {
    // A production-style site: the task rejects and the site swallows it.
    trackBackgroundTask("probe:reject", Promise.reject(new Error("boom-unreviewed"))).catch(() => null)
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(pendingBackgroundTaskCount(), 0, "the task has settled")
    assert.deepEqual(unreviewedBackgroundOutcomes().map((o) => `${o.label}:${o.status}`), ["probe:reject:rejected"])

    await assert.rejects(database.dispose(), /never reviewed.*probe:reject: rejected/)
    assert.equal((await queryRaw<{ one: number }>(database, "SELECT 1 AS one"))[0].one, 1, "the database survived the refusal")

    // The only way out is to review: settle fails the test with the real error…
    await assert.rejects(settleBackgroundTasks(), /unexpected background task failure[\s\S]*probe:reject: Error: boom-unreviewed/)
    assert.deepEqual(unreviewedBackgroundOutcomes(), [], "…and the outcome is consumed by that review")
  } finally {
    await database.dispose()
  }
})

// ─── R1: the expected AI failure is the exact contract, not a pattern ───────

test("isMissingProviderKeyError recognises only the adapter's missing-credentials error", () => {
  const missing = new AIExecutionError({ code: "provider_unavailable", provider: "deepseek", message: "DEEPSEEK_API_KEY is not set in environment variables" })
  const missingOpenAi = new AIExecutionError({ code: "provider_unavailable", provider: "openai", message: "OPENAI_API_KEY no configurada" })
  assert.equal(isMissingProviderKeyError(missing), true)
  assert.equal(isMissingProviderKeyError(missingOpenAi), true)
  // Same type, message mentions API_KEY, different cause → NOT the contract.
  const upstreamRejected = new AIExecutionError({ code: "provider_error", provider: "deepseek", message: "Incorrect API_KEY provided: sk-***", status: 401 })
  assert.equal(isMissingProviderKeyError(upstreamRejected), false)
  const wrongMessage = new AIExecutionError({ code: "provider_unavailable", provider: "deepseek", message: "DEEPSEEK_API_KEY rejected by provider" })
  assert.equal(isMissingProviderKeyError(wrongMessage), false)
  const wrongProvider = new AIExecutionError({ code: "provider_unavailable", provider: "openai", message: "DEEPSEEK_API_KEY is not set in environment variables" })
  assert.equal(isMissingProviderKeyError(wrongProvider), false)
  const plain = Object.assign(new Error("DEEPSEEK_API_KEY is not set in environment variables"), { code: "provider_unavailable", provider: "deepseek" })
  assert.equal(isMissingProviderKeyError(plain), false, "a plain Error dressed up is not an AIExecutionError")
})

test("settleBackgroundTasks({ aiDisabled }) accepts the exact contract and rejects a look-alike AIExecutionError", async () => {
  const database = await provisionTestDatabase("support-ai-contract")
  try {
    trackBackgroundTask("ingest:intelligence", Promise.reject(new AIExecutionError({ code: "provider_unavailable", provider: "deepseek", message: "DEEPSEEK_API_KEY is not set in environment variables" }))).catch(() => null)
    const accepted = await settleBackgroundTasks({ aiDisabled: true })
    assert.deepEqual(accepted.map((o) => `${o.label}:${o.status}`), ["ingest:intelligence:rejected"])

    trackBackgroundTask("ingest:intelligence", Promise.reject(new AIExecutionError({ code: "provider_error", provider: "deepseek", message: "Incorrect API_KEY provided", status: 401 }))).catch(() => null)
    await assert.rejects(settleBackgroundTasks({ aiDisabled: true }), /unexpected background task failure[\s\S]*ingest:intelligence: AIExecutionError: Incorrect API_KEY provided/)

    // The same contract error under a label that is NOT intelligence is unexpected too.
    trackBackgroundTask("message:short-intent", Promise.reject(new AIExecutionError({ code: "provider_unavailable", provider: "deepseek", message: "DEEPSEEK_API_KEY is not set in environment variables" }))).catch(() => null)
    await assert.rejects(settleBackgroundTasks({ aiDisabled: true }), /message:short-intent: AIExecutionError/)
  } finally {
    await database.dispose()
  }
})

// ─── R1: outbound network guard ─────────────────────────────────────────────

function startLoopbackServer(): Promise<Server> {
  const server = createServer((req, res) => {
    if (req.url === "/redirect-off-loopback") {
      res.writeHead(302, { Location: "https://remote.invalid/landing" })
      res.end()
    } else if (req.url === "/redirect-loopback") {
      res.writeHead(302, { Location: "/ok" })
      res.end()
    } else {
      res.writeHead(200, { "Content-Type": "text/plain" })
      res.end("ok")
    }
  })
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server)))
}

test("the outbound guard blocks non-loopback hosts, never follows a redirect off loopback, keeps identity-based state and restores cleanly", async () => {
  const server = await startLoopbackServer()
  const port = (server.address() as AddressInfo).port
  const base = `http://127.0.0.1:${port}`
  const before = globalThis.fetch
  installOutboundNetworkGuard()
  try {
    assert.equal(isOutboundNetworkGuardActive(), true)
    assert.deepEqual(blockedOutboundAttempts(), [], "a fresh guard session starts clean")

    // Loopback works; a loopback→loopback redirect is returned unfollowed (3xx), never auto-followed.
    assert.equal(await (await fetch(`${base}/ok`)).text(), "ok")
    assert.equal((await fetch(`${base}/redirect-loopback`)).status, 302)

    // Direct non-loopback: blocked before any socket, recorded.
    await assert.rejects(fetch("https://remote.invalid/api"), /outbound HTTP call blocked: remote\.invalid/)
    // Allowed origin bouncing off loopback: blocked, recorded — the redirect is never followed.
    await assert.rejects(fetch(`${base}/redirect-off-loopback`), /outbound HTTP redirect blocked: remote\.invalid/)
    assert.deepEqual(blockedOutboundAttempts(), ["remote.invalid", "remote.invalid"])
    // …and a settle while the guard holds attempts fails the test.
    await assert.rejects(settleBackgroundTasks(), /reached the network layer: remote\.invalid/)

    // State is the wrapper identity: a spy installed on top means "not active"…
    const guarded = globalThis.fetch
    const spy = (async () => new Response("spy")) as typeof fetch
    globalThis.fetch = spy
    assert.equal(isOutboundNetworkGuardActive(), false)
    // …uninstalling then does NOT clobber the foreign function, only clears bookkeeping…
    uninstallOutboundNetworkGuard()
    assert.equal(globalThis.fetch, spy)
    assert.equal(isOutboundNetworkGuardActive(), false)
    globalThis.fetch = guarded
    // …while a re-install wraps whatever is current and a plain uninstall restores it exactly.
    installOutboundNetworkGuard()
    assert.equal(isOutboundNetworkGuardActive(), true)
    uninstallOutboundNetworkGuard()
    assert.equal(isOutboundNetworkGuardActive(), false)
    assert.equal(globalThis.fetch, guarded, "restored to the function that was wrapped")
    globalThis.fetch = before
  } finally {
    uninstallOutboundNetworkGuard()
    globalThis.fetch = before
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
})

test("provisioning installs the guard and dispose() restores the original fetch only after the drop", async () => {
  const original = globalThis.fetch
  const database = await provisionTestDatabase("support-guard-lifecycle")
  assert.equal(isOutboundNetworkGuardActive(), true)
  assert.notEqual(globalThis.fetch, original)
  await database.dispose()
  assert.equal(isOutboundNetworkGuardActive(), false)
  assert.equal(globalThis.fetch, original)
})
