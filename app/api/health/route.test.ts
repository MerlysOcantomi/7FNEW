/**
 * CORE-02B — containment tests for /api/health (F-AUTH-04).
 *
 * The endpoint must be a bare liveness probe: no environment variables, no
 * database connection, no infrastructure detail, no cross-tenant counts and
 * no raw error text. The test deletes every DB-related variable before
 * importing the route, so any reintroduced dependency on them fails loudly.
 */

import assert from "node:assert/strict"
import test, { before } from "node:test"

const DB_VARS = [
  "DATABASE_URL",
  "DATABASE_AUTH_TOKEN",
  "TURSO_DATABASE_URL",
  "TURSO_AUTH_TOKEN",
] as const

/* eslint-disable @typescript-eslint/no-explicit-any */
let GET: any
before(async () => {
  // No DB configuration at all: the route must not need or read any of it.
  for (const name of DB_VARS) delete process.env[name]
  ;({ GET } = await import("./route"))
})

test("health responds 200 with the minimal liveness body", async () => {
  const res = await GET()
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, { ok: true })
})

test("health is deterministic and leaks nothing", async () => {
  const res = await GET()
  const serialized = JSON.stringify(await res.json())

  // Nothing infrastructure-shaped may appear in the body.
  const forbidden = [
    /libsql/i,
    /turso/i,
    /prisma/i,
    /https?:\/\//i,
    /DATABASE/i,
    /TOKEN/i,
    /count/i,
    /chars/i,
    /error/i,
    /\.io|\.com|\.tech/i, // hostnames
  ]
  for (const pattern of forbidden) {
    assert.ok(!pattern.test(serialized), `body must not match ${pattern}: ${serialized}`)
  }

  // Exactly one key: ok. Any richer contract needs platform authorization first.
  assert.deepEqual(Object.keys(await (await GET()).json()), ["ok"])
})

test("health does not require a session context to answer safely", async () => {
  // Called with no request scope, no cookies and no env: must not throw.
  const res = await GET()
  assert.equal(res.status, 200)
})
