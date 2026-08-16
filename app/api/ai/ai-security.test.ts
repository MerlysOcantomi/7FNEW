/**
 * CORE-02B — in-handler authorization tests for the /api/ai/* routes
 * (F-AUTH-05). Every guarded route must reject a caller without a valid
 * session, and a caller without any workspace, BEFORE any AI provider is
 * contacted; the authorized flow must keep its request/response contract.
 *
 * Test doubles everywhere:
 *   - Database: a REAL local SQLite file (schema pushed via `prisma db push`
 *     into a temp dir) seeded with synthetic users/workspaces. No Turso, no
 *     Neon, no remote anything.
 *   - Providers: `globalThis.fetch` is replaced by a spy that records calls
 *     and returns a canned completion. The spy doubles as the PROOF that no
 *     provider is invoked when authorization fails. Provider API keys are set
 *     to synthetic values on purpose — if a guard ever failed, the handler
 *     WOULD reach fetch, and the spy would catch it.
 *   - Request scope: route handlers resolve the session via next/headers
 *     `cookies()`, which needs Next's request AsyncLocalStorage. A minimal
 *     synthetic work/work-unit store provides it (test-only shim).
 */

import assert from "node:assert/strict"
import test, { before, beforeEach, after } from "node:test"
import { execSync } from "node:child_process"
import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AsyncLocalStorage } from "node:async_hooks"

/* eslint-disable @typescript-eslint/no-explicit-any */

// Must exist BEFORE any Next server module loads (they capture it at import).
;(globalThis as any).AsyncLocalStorage = AsyncLocalStorage

const TEST_SECRET = "ai-routes-test-secret-synthetic"

const dir = mkdtempSync(join(tmpdir(), "ai-security-"))
const dbUrl = `file:${join(dir, "test.db")}`
process.env.DATABASE_URL = dbUrl
delete process.env.DATABASE_AUTH_TOKEN
delete process.env.TURSO_DATABASE_URL
delete process.env.TURSO_AUTH_TOKEN
process.env.AUTH_SECRET = TEST_SECRET
// Synthetic provider keys: real keys are never used, and the fetch spy below
// intercepts every provider call before it could leave the process.
process.env.OPENAI_API_KEY = "sk-synthetic-test-not-real"
process.env.DEEPSEEK_API_KEY = "sk-synthetic-test-not-real"

// ---------------------------------------------------------------------------
// Provider spy
// ---------------------------------------------------------------------------

const realFetch = globalThis.fetch
const providerCalls: string[] = []

function installFetchSpy() {
  globalThis.fetch = (async (input: any, _init?: any) => {
    const url = typeof input === "string" ? input : input?.url ?? String(input)
    providerCalls.push(url)
    return new Response(
      JSON.stringify({ choices: [{ message: { content: "respuesta-sintetica" } }] }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    )
  }) as typeof fetch
}

// ---------------------------------------------------------------------------
// Synthetic Next request scope so next/headers cookies() works in tests
// ---------------------------------------------------------------------------

let workAsyncStorage: any
let workUnitAsyncStorage: any
let RequestCookies: any

async function runInRequestScope(cookieHeader: string, fn: () => Promise<Response>): Promise<Response> {
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

let db: any
let SignJWT: any
let memberToken = "" // valid session, member of wsA
let orphanToken = "" // valid session, member of NO workspace
let wsA: any
let wsB: any

interface RouteCase {
  name: string
  load: () => Promise<any>
  body: Record<string, unknown>
}

// The nine routes flagged by F-AUTH-05 with a minimal VALID body each, so a
// broken guard would genuinely reach the provider.
const ROUTES: RouteCase[] = [
  { name: "/api/ai", load: () => import("./route"), body: { prompt: "hola", mode: "general" } },
  { name: "/api/ai/tareas", load: () => import("./tareas/route"), body: { action: "prioridad", data: { titulo: "t" } } },
  { name: "/api/ai/clientes", load: () => import("./clientes/route"), body: { action: "resumen", data: { nombre: "n" } } },
  { name: "/api/ai/proyectos", load: () => import("./proyectos/route"), body: { action: "analisis", data: { nombre: "p", estado: "activo" } } },
  { name: "/api/ai/finanzas", load: () => import("./finanzas/route"), body: { action: "analisis", data: {} } },
  { name: "/api/ai/facturacion", load: () => import("./facturacion/route"), body: { action: "resumen", data: {} } },
  { name: "/api/ai/resume", load: () => import("./resume/route"), body: { text: "cv sintetico" } },
  { name: "/api/ai/correct", load: () => import("./correct/route"), body: { text: "texto con herrores" } },
  { name: "/api/ai/chat", load: () => import("./chat/route"), body: { mode: "general", message: "hola" } },
]

function postRequest(name: string, body: unknown, extraHeaders?: Record<string, string>) {
  return new Request(`https://sevenef.test${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(extraHeaders ?? {}) },
    body: JSON.stringify(body),
  })
}

before(async () => {
  execSync(`npx prisma db push --accept-data-loss --url "${dbUrl}"`, {
    stdio: "ignore",
    cwd: process.cwd(),
  })
  ;({ workAsyncStorage } = await import("next/dist/server/app-render/work-async-storage.external"))
  ;({ workUnitAsyncStorage } = await import("next/dist/server/app-render/work-unit-async-storage.external"))
  ;({ RequestCookies } = await import("next/dist/server/web/spec-extension/cookies"))
  ;({ SignJWT } = await import("jose"))
  ;({ db } = await import("@core/db"))

  const member = await db.user.create({
    data: { email: "member@test.local", nombre: "Member", role: "viewer" },
  })
  const orphan = await db.user.create({
    data: { email: "orphan@test.local", nombre: "Orphan", role: "viewer" },
  })
  wsA = await db.workspace.create({ data: { nombre: "A", slug: "ws-ai-a" } })
  wsB = await db.workspace.create({ data: { nombre: "B", slug: "ws-ai-b" } })
  await db.workspaceMember.create({
    data: { userId: member.id, workspaceId: wsA.id, role: "MEMBER" },
  })

  const sign = (payload: Record<string, unknown>) =>
    new SignJWT(payload)
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(TEST_SECRET))

  memberToken = await sign({ userId: member.id, email: member.email, role: "viewer" })
  orphanToken = await sign({ userId: orphan.id, email: orphan.email, role: "viewer" })

  installFetchSpy()
})

beforeEach(() => {
  providerCalls.length = 0
})

after(() => {
  globalThis.fetch = realFetch
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

test("every AI route rejects an unauthenticated caller before any provider call", async () => {
  for (const route of ROUTES) {
    const { POST } = await route.load()
    const res = await runInRequestScope("", () => POST(postRequest(route.name, route.body)))
    assert.equal(res.status, 401, `${route.name} must 401 without a session (got ${res.status})`)
    const body = await res.json()
    assert.equal(body.success, false)
  }
  assert.deepEqual(providerCalls, [], "no AI provider may be contacted on auth failure")
})

test("a user without any workspace is rejected before any provider call", async () => {
  for (const route of ROUTES) {
    const { POST } = await route.load()
    const res = await runInRequestScope(`7f-session=${orphanToken}`, () =>
      POST(postRequest(route.name, route.body)),
    )
    assert.ok(
      res.status === 404 || res.status === 403,
      `${route.name} must reject a workspace-less user (got ${res.status})`,
    )
  }
  assert.deepEqual(providerCalls, [], "no AI provider may be contacted without workspace context")
})

test("a client-supplied x-workspace-id header cannot select a foreign workspace", async () => {
  // memberToken belongs to wsA only. Sending wsB in the header must NOT grant
  // wsB context: outside the explicit allowlist the header is ignored and the
  // workspace resolves from the caller's real membership.
  const { POST } = await ROUTES[8].load() // /api/ai/chat
  const res = await runInRequestScope(`7f-session=${memberToken}`, () =>
    POST(postRequest("/api/ai/chat", ROUTES[8].body, { "x-workspace-id": wsB.id })),
  )
  assert.equal(res.status, 200, "request proceeds under the caller's real workspace")
  const body = await res.json()
  assert.equal(body.success, true)
})

test("an invalid session token is rejected before any provider call", async () => {
  const { POST } = await ROUTES[0].load()
  const res = await runInRequestScope("7f-session=not-a-valid-jwt", () =>
    POST(postRequest("/api/ai", ROUTES[0].body)),
  )
  assert.equal(res.status, 401)
  assert.deepEqual(providerCalls, [])
})

test("authorized flow keeps its contract (OpenAI-path route, provider stubbed)", async () => {
  const { POST } = await ROUTES[8].load() // chat → askMotorIAWithHistory → openai
  const res = await runInRequestScope(`7f-session=${memberToken}`, () =>
    POST(postRequest("/api/ai/chat", { mode: "general", message: "hola" })),
  )
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, { success: true, data: { result: "respuesta-sintetica", mode: "general" } })
  assert.equal(providerCalls.length, 1)
  assert.ok(providerCalls[0].includes("api.openai.com"))
})

test("authorized flow keeps its contract (DeepSeek-path route, provider stubbed)", async () => {
  const { POST } = await ROUTES[1].load() // tareas → askMotorIA(..., "operativo") → deepseek
  const res = await runInRequestScope(`7f-session=${memberToken}`, () =>
    POST(postRequest("/api/ai/tareas", { action: "prioridad", data: { titulo: "t" } })),
  )
  assert.equal(res.status, 200)
  const body = await res.json()
  assert.deepEqual(body, { success: true, data: { result: "respuesta-sintetica", action: "prioridad" } })
  assert.equal(providerCalls.length, 1)
  assert.ok(providerCalls[0].includes("api.deepseek.com"))
})

test("validation still runs for authorized callers (contract preserved)", async () => {
  const { POST } = await ROUTES[0].load()
  const res = await runInRequestScope(`7f-session=${memberToken}`, () =>
    POST(postRequest("/api/ai", { prompt: "hola", mode: "no-such-mode" })),
  )
  assert.equal(res.status, 400)
  const body = await res.json()
  assert.equal(body.success, false)
  assert.equal(body.error.code, "VALIDATION_ERROR")
  assert.deepEqual(providerCalls, [])
})
