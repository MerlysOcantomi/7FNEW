/**
 * NEON-03 — POST /api/workspaces/create on REAL PostgreSQL: the workspace and
 * its OWNER membership are one atomic unit, a duplicate slug is a 409, and a
 * membership that cannot be written (session for a user that no longer
 * exists) leaves NO orphan workspace behind.
 *
 * Test doubles: a synthetic Next request scope so `cookies()` works outside a
 * server (same shim as app/api/ai/ai-security.test.ts) and a synthetic
 * AUTH_SECRET. No remote database, no real credentials.
 */

import assert from "node:assert/strict"
import test, { before, after } from "node:test"
import { AsyncLocalStorage } from "node:async_hooks"
import { provisionTestDatabase, queryRaw, type ProvisionedDatabase } from "@/test/support/postgres"

/* eslint-disable @typescript-eslint/no-explicit-any */
;(globalThis as any).AsyncLocalStorage = AsyncLocalStorage

const TEST_SECRET = "workspaces-create-test-secret-synthetic"
process.env.AUTH_SECRET = TEST_SECRET

let database: ProvisionedDatabase
let db: any
let workAsyncStorage: any
let workUnitAsyncStorage: any
let RequestCookies: any
let POST: (request: any) => Promise<Response>
let sign: (payload: Record<string, unknown>) => Promise<string>
let owner: any

async function inScope(cookieHeader: string, fn: () => Promise<Response>): Promise<Response> {
  const headers = new Headers(cookieHeader ? { cookie: cookieHeader } : {})
  const reqCookies = new RequestCookies(headers)
  const workStore: any = { route: "/test", forceStatic: false, dynamicShouldError: false }
  const workUnitStore: any = {
    type: "request",
    phase: "action",
    headers,
    cookies: reqCookies,
    mutableCookies: reqCookies,
    userspaceMutableCookies: reqCookies,
    implicitTags: { tags: [] },
  }
  return workAsyncStorage.run(workStore, () => workUnitAsyncStorage.run(workUnitStore, fn))
}

function createRequest(body: Record<string, unknown>) {
  return new Request("https://sevenef.test/api/workspaces/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

before(async () => {
  database = await provisionTestDatabase("workspaces-create")
  ;({ workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external"))
  ;({ workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external"))
  ;({ RequestCookies } = await import("next/dist/server/web/spec-extension/cookies"))
  const { SignJWT } = await import("jose")
  ;({ db } = await import("@core/db"))
  ;({ POST } = await import("./create/route"))

  sign = (payload) =>
    new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(TEST_SECRET))
  owner = await db.user.create({ data: { email: "creator@test.local", nombre: "Creator", role: "viewer" } })
})

after(async () => {
  await db.$disconnect()
  await database.dispose()
})

test("unauthenticated → 401, nothing written", async () => {
  const res = await inScope("", () => POST(createRequest({ nombre: "X", slug: "x" })))
  assert.equal(res.status, 401)
  assert.equal(await db.workspace.count(), 0)
})

test("creates the workspace and its OWNER membership together", async () => {
  const token = await sign({ userId: owner.id, email: owner.email, role: "viewer" })
  const res = await inScope(`7f-session=${token}`, () => POST(createRequest({ nombre: "Studio", slug: "Studio One" })))
  assert.equal(res.status, 200)
  const body = await res.json()
  const data = body.data ?? body
  assert.equal(data.slug, "studio-one")
  assert.equal(data.role, "OWNER")
  const membership = await db.workspaceMember.findUnique({ where: { userId_workspaceId: { userId: owner.id, workspaceId: data.id } } })
  assert.equal(membership?.role, "OWNER")
})

test("a duplicate slug is a 409 CONFLICT (unique index is the real guard)", async () => {
  const token = await sign({ userId: owner.id, email: owner.email, role: "viewer" })
  const res = await inScope(`7f-session=${token}`, () => POST(createRequest({ nombre: "Again", slug: "studio-one" })))
  assert.equal(res.status, 409)
  assert.equal(await db.workspace.count({ where: { slug: "studio-one" } }), 1)
})

test("a session whose user no longer exists cannot leave an orphan workspace (membership FK fails → rollback)", async () => {
  const ghostToken = await sign({ userId: "ghost-user-id", email: "ghost@test.local", role: "viewer" })
  const before = await db.workspace.count()
  const res = await inScope(`7f-session=${ghostToken}`, () => POST(createRequest({ nombre: "Ghost", slug: "ghost-ws" })))
  assert.notEqual(res.status, 200)
  assert.equal(await db.workspace.count(), before, "the workspace insert must have been rolled back")
  const rows = await queryRaw<{ cnt: string }>(database, `SELECT COUNT(*) AS cnt FROM "Workspace" WHERE "slug" = $1`, ["ghost-ws"])
  assert.equal(Number(rows[0].cnt), 0)
})
