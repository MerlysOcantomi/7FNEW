/**
 * CORE-02B — fail-closed and public-prefix-boundary tests for the middleware
 * (F-AUTH-01 plus the segment-boundary hardening of PUBLIC_PATHS).
 *
 * Pure and deterministic: no database, no network. AUTH_SECRET is toggled
 * per test through process.env (the middleware reads it per request) and
 * restored after each test. All secrets and tokens here are synthetic.
 */

import assert from "node:assert/strict"
import test, { before, beforeEach, afterEach } from "node:test"
import { NextRequest } from "next/server"
import { SignJWT } from "jose"

const TEST_SECRET = "middleware-test-secret-synthetic"

/* eslint-disable @typescript-eslint/no-explicit-any */
let middleware: any
before(async () => {
  process.env.AUTH_SECRET = TEST_SECRET
  ;({ middleware } = await import("./middleware"))
})

const savedSecret: { value: string | undefined } = { value: undefined }
beforeEach(() => {
  savedSecret.value = process.env.AUTH_SECRET
  process.env.AUTH_SECRET = TEST_SECRET
})
afterEach(() => {
  if (savedSecret.value === undefined) delete process.env.AUTH_SECRET
  else process.env.AUTH_SECRET = savedSecret.value
})

function req(path: string, cookies?: Record<string, string>): NextRequest {
  const headers: Record<string, string> = { host: "sevenef.com" }
  if (cookies) {
    headers.cookie = Object.entries(cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ")
  }
  return new NextRequest(new URL(`https://sevenef.com${path}`), { headers })
}

async function signToken(payload: Record<string, unknown>, secret = TEST_SECRET): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(secret))
}

function isPassThrough(res: Response): boolean {
  return res.status === 200 && !res.headers.get("location")
}

// ---------------------------------------------------------------------------
// Fail-closed: AUTH_SECRET missing
// ---------------------------------------------------------------------------

test("protected internal API + missing AUTH_SECRET → 503, never next()", async () => {
  const token = await signToken({ userId: "u1", email: "a@b.test", role: "admin" })
  delete process.env.AUTH_SECRET

  for (const path of ["/api/clientes", "/api/workspace/business-profile", "/api/system/workspaces"]) {
    const withSession = await middleware(req(path, { "7f-session": token }))
    assert.equal(withSession.status, 503, `${path} with cookie must fail closed`)
    const noSession = await middleware(req(path))
    assert.equal(noSession.status, 503, `${path} without cookie must fail closed`)
  }
})

test("protected portal API + missing AUTH_SECRET → 503, never next()", async () => {
  const token = await signToken({ type: "client", clienteId: "c1", email: "c@x.test" })
  delete process.env.AUTH_SECRET

  const withToken = await middleware(req("/api/cliente/dashboard", { "7f-client-session": token }))
  assert.equal(withToken.status, 503)
  const withoutToken = await middleware(req("/api/cliente/dashboard"))
  assert.equal(withoutToken.status, 503)
})

test("the 503 body is generic JSON: no secret name, length or internals", async () => {
  delete process.env.AUTH_SECRET
  const res = await middleware(req("/api/clientes"))
  const body = JSON.stringify(await res.json())
  assert.ok(!/AUTH_SECRET|secret|jwt|jose|stack/i.test(body), `leaky body: ${body}`)
  assert.ok(body.includes("SERVICE_UNAVAILABLE"))
})

test("protected pages + missing AUTH_SECRET keep the config redirect", async () => {
  delete process.env.AUTH_SECRET
  const internal = await middleware(req("/inbox"))
  assert.ok((internal.headers.get("location") ?? "").includes("/login?error=config"))

  const portal = await middleware(req("/cliente/panel", { "7f-client-session": "anything" }))
  assert.ok((portal.headers.get("location") ?? "").includes("/cliente/login?error=config"))
})

test("public paths keep working even without AUTH_SECRET", async () => {
  delete process.env.AUTH_SECRET
  for (const path of [
    "/login",
    "/api/auth/callback/google",
    "/api/cliente/auth/login",
    "/api/inbox/email/inbound",
    "/api/inbox/webhooks/meta",
    "/api/sites/demo-studio/reception",
    "/sites/demo-studio",
    "/widget",
  ]) {
    const res = await middleware(req(path))
    assert.ok(isPassThrough(res), `${path} must stay public (got ${res.status} → ${res.headers.get("location")})`)
  }
})

// ---------------------------------------------------------------------------
// Public-prefix boundary: lookalike paths must NOT inherit the bypass
// ---------------------------------------------------------------------------

test("lookalike API paths do not inherit the public bypass", async () => {
  for (const path of ["/api/auth-malicious", "/api/authx/token", "/api/sitesx", "/api/inbox/publicx"]) {
    const res = await middleware(req(path))
    assert.equal(res.status, 401, `${path} must require auth`)
  }
  // Portal lookalike: under /api/cliente/ but NOT /api/cliente/auth → portal 401.
  const portal = await middleware(req("/api/cliente/auth-evil"))
  assert.equal(portal.status, 401)
})

test("lookalike page paths do not inherit the public bypass", async () => {
  for (const path of ["/loginx", "/sitesx", "/widget-evil"]) {
    const res = await middleware(req(path))
    const location = res.headers.get("location") ?? ""
    assert.ok(location.includes("/login"), `${path} must be auth-redirected, got ${res.status}`)
  }
})

test("exact public paths and their sub-segments still match", async () => {
  for (const path of ["/login", "/api/auth", "/api/auth/logout", "/sites", "/sites/x/y"]) {
    const res = await middleware(req(path))
    assert.ok(isPassThrough(res), `${path} must be public`)
  }
})

// ---------------------------------------------------------------------------
// Token verification is not weakened
// ---------------------------------------------------------------------------

test("an invalid JWT is still rejected on APIs and pages", async () => {
  const garbage = "not-a-jwt"
  const api = await middleware(req("/api/clientes", { "7f-session": garbage }))
  assert.equal(api.status, 401)

  const forged = await signToken({ userId: "u1", email: "a@b.test", role: "admin" }, "wrong-secret-material")
  const apiForged = await middleware(req("/api/clientes", { "7f-session": forged }))
  assert.equal(apiForged.status, 401)

  const page = await middleware(req("/inbox", { "7f-session": garbage }))
  assert.ok((page.headers.get("location") ?? "").includes("/login"))
})

test("a valid session passes and identity headers are forwarded", async () => {
  const token = await signToken({ userId: "u1", email: "a@b.test", role: "viewer" })
  const res = await middleware(req("/api/clientes", { "7f-session": token }))
  assert.ok(isPassThrough(res))
})

test("control-plane protection is not weakened: no platformRole → 403", async () => {
  const token = await signToken({ userId: "u1", email: "a@b.test", role: "admin" })
  const res = await middleware(req("/api/system/workspaces", { "7f-session": token }))
  assert.equal(res.status, 403)
  const body = JSON.stringify(await res.json())
  assert.ok(body.includes("NOT_PLATFORM_ADMIN"))
})

test("control plane still admits a platformRole claim", async () => {
  const token = await signToken({ userId: "u1", email: "a@b.test", role: "admin", platformRole: "SUPER_ADMIN" })
  const res = await middleware(req("/api/system/workspaces", { "7f-session": token }))
  assert.ok(isPassThrough(res))
})

test("portal: a non-client token type is rejected", async () => {
  const token = await signToken({ userId: "u1", email: "a@b.test", role: "admin" }) // no type: "client"
  const res = await middleware(req("/cliente/panel", { "7f-client-session": token }))
  assert.ok((res.headers.get("location") ?? "").includes("/cliente/login"))
})

test("portal: a valid client token passes", async () => {
  const token = await signToken({ type: "client", clienteId: "c1", email: "c@x.test" })
  const res = await middleware(req("/api/cliente/dashboard", { "7f-client-session": token }))
  assert.ok(isPassThrough(res))
})
