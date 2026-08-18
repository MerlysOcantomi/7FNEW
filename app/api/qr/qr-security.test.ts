/**
 * CORE-03C-2B — workspace-scoping regression tests for the /api/qr/* routes.
 *
 * The routes were audited as already correct (POST stores the
 * server-resolved workspace from `requireWriteAccess`, GET/DELETE scope by
 * `workspaceId`); these tests lock that behavior in, now that
 * `QRCode.workspaceId` exists in the migration history (2_add_link_columns).
 *
 * Test doubles only:
 *   - Database: a throwaway local SQLite file built FROM THE MIGRATION
 *     HISTORY itself (`prisma migrate deploy` over prisma/migrations with a
 *     temporary config that never imports dotenv), so the tests also prove
 *     the deployed history supports the runtime's QR access patterns.
 *   - Request scope: a minimal synthetic Next work/work-unit store so
 *     next/headers `cookies()` works outside a server (same shim as
 *     app/api/ai/ai-security.test.ts).
 * No remote database, no credentials, synthetic secrets only.
 */

import assert from "node:assert/strict"
import test, { before, after } from "node:test"
import { execSync } from "node:child_process"
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AsyncLocalStorage } from "node:async_hooks"

/* eslint-disable @typescript-eslint/no-explicit-any */
;(globalThis as any).AsyncLocalStorage = AsyncLocalStorage

const REPO = process.cwd()
const TEST_SECRET = "qr-security-test-secret-synthetic"

const dir = mkdtempSync(join(tmpdir(), "qr-security-"))
const dbUrl = `file:${join(dir, "qr.db")}`
process.env.DATABASE_URL = dbUrl
delete process.env.DATABASE_AUTH_TOKEN
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN
process.env.AUTH_SECRET = TEST_SECRET


let workAsyncStorage: any
let workUnitAsyncStorage: any
let RequestCookies: any
let db: any
let wsA: any
let wsB: any
let tokenA = "" // member of wsA only
let tokenB = "" // member of wsB only
let tokenOrphan = "" // valid session, no workspace

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

before(async () => {
  // Build the throwaway DB from the real migration history with a temporary,
  // dotenv-free Prisma config. Guarded env: no DB/Turso variables, no .env.
  symlinkSync(join(REPO, "node_modules"), join(dir, "node_modules"))
  const configPath = join(dir, "prisma.config.ts")
  writeFileSync(
    configPath,
    [
      'import { defineConfig } from "prisma/config"',
      "export default defineConfig({",
      `  schema: ${JSON.stringify(join(REPO, "prisma", "schema.prisma"))},`,
      `  migrations: { path: ${JSON.stringify(join(REPO, "prisma", "migrations"))} },`,
      `  datasource: { url: ${JSON.stringify(dbUrl)} },`,
      "})",
      "",
    ].join("\n"),
  )
  const env = { ...process.env }
  delete env.DATABASE_URL
  delete env.TURSO_DATABASE_URL
  delete env.DATABASE_AUTH_TOKEN
  delete env.TURSO_AUTH_TOKEN
  execSync(`"${join(REPO, "node_modules", ".bin", "prisma")}" migrate deploy --config "${configPath}"`, {
    cwd: REPO,
    stdio: "ignore",
    env: { ...env, DOTENV_CONFIG_PATH: "/dev/null", CHECKPOINT_DISABLE: "1", PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  })

  ;({ workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external"))
  ;({ workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external"))
  ;({ RequestCookies } = await import("next/dist/server/web/spec-extension/cookies"))
  const { SignJWT } = await import("jose")
  ;({ db } = await import("@core/db"))

  wsA = await db.workspace.create({ data: { nombre: "QR A", slug: "ws-qr-a" } })
  wsB = await db.workspace.create({ data: { nombre: "QR B", slug: "ws-qr-b" } })
  const userA = await db.user.create({ data: { email: "qra@test.local", role: "viewer" } })
  const userB = await db.user.create({ data: { email: "qrb@test.local", role: "viewer" } })
  const orphan = await db.user.create({ data: { email: "qro@test.local", role: "viewer" } })
  await db.workspaceMember.create({ data: { userId: userA.id, workspaceId: wsA.id, role: "MEMBER" } })
  await db.workspaceMember.create({ data: { userId: userB.id, workspaceId: wsB.id, role: "MEMBER" } })

  const sign = (u: any) =>
    new SignJWT({ userId: u.id, email: u.email, role: "viewer" })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(TEST_SECRET))
  tokenA = await sign(userA)
  tokenB = await sign(userB)
  tokenOrphan = await sign(orphan)
})

after(() => {
  rmSync(dir, { recursive: true, force: true })
})

function postReq(body: Record<string, unknown>, extraHeaders?: Record<string, string>) {
  return new Request("https://sevenef.test/api/qr/save", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(extraHeaders ?? {}) },
    body: JSON.stringify(body),
  }) as any
}

const QR_BODY = { url: "https://example.test/x", module: "clientes", recordId: "rec-1" }

test("POST without a session fails closed and writes nothing", async () => {
  const { POST } = await import("./save/route")
  const res = await inScope("", () => POST(postReq(QR_BODY)))
  assert.equal(res.status, 401)
  assert.equal(await db.qRCode.count(), 0)
})

test("POST with a session but no workspace is rejected — no default workspace is invented", async () => {
  const { POST } = await import("./save/route")
  const res = await inScope(`7f-session=${tokenOrphan}`, () => POST(postReq(QR_BODY)))
  assert.ok(res.status === 404 || res.status === 403, `expected rejection, got ${res.status}`)
  assert.equal(await db.qRCode.count(), 0)
})

test("POST stores the server-resolved workspace; a conflicting client workspaceId cannot override it", async () => {
  const { POST } = await import("./save/route")
  // Hostile body field AND hostile header, both pointing at wsB.
  const res = await inScope(`7f-session=${tokenA}`, () =>
    POST(postReq({ ...QR_BODY, workspaceId: wsB.id }, { "x-workspace-id": wsB.id })),
  )
  assert.equal(res.status, 200)
  const rows = await db.qRCode.findMany()
  assert.equal(rows.length, 1)
  assert.equal(rows[0].workspaceId, wsA.id, "must store the guard-resolved workspace, never the client's claim")
})

test("GET cannot read another workspace's QR rows", async () => {
  const { GET } = await import("./[module]/[recordId]/route")
  const params = { params: Promise.resolve({ module: "clientes", recordId: "rec-1" }) }
  const mine = await inScope(`7f-session=${tokenA}`, () =>
    GET(new Request("https://sevenef.test/api/qr/clientes/rec-1") as any, params as any),
  )
  assert.equal((await mine.json()).data.length, 1)

  const foreign = await inScope(`7f-session=${tokenB}`, () =>
    GET(new Request("https://sevenef.test/api/qr/clientes/rec-1") as any, params as any),
  )
  assert.equal((await foreign.json()).data.length, 0, "wsB must not see wsA's QR rows")
})

test("DELETE cannot delete another workspace's QR row", async () => {
  const { DELETE } = await import("./delete/[id]/route")
  const row = (await db.qRCode.findMany())[0]
  const params = { params: Promise.resolve({ id: row.id }) }

  const foreign = await inScope(`7f-session=${tokenB}`, () =>
    DELETE(new Request("https://sevenef.test/api/qr/delete/x", { method: "DELETE" }) as any, params as any),
  )
  assert.equal(foreign.status, 404)
  assert.equal(await db.qRCode.count(), 1, "row must survive a cross-workspace delete attempt")

  const own = await inScope(`7f-session=${tokenA}`, () =>
    DELETE(new Request("https://sevenef.test/api/qr/delete/x", { method: "DELETE" }) as any, params as any),
  )
  assert.equal(own.status, 200)
  assert.equal(await db.qRCode.count(), 0)
})
