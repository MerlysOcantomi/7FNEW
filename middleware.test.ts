/**
 * Middleware regression tests (PRESENCE-03 hotfix).
 *
 * A previous version rewrote ANY host not in an env allowlist to the Presence
 * `/sites/by-host/<host>` route, which hijacked the app's own production domain
 * (e.g. sevenef.com) whenever that host was not listed in the env. These tests
 * lock in the fix: the middleware performs NO host-based rewriting, so the main
 * Sevenef app is always served on its own domains, and no unknown hostname is
 * ever used as a fallback into Presence.
 */

import test from "node:test"
import assert from "node:assert/strict"
import { NextRequest } from "next/server"

process.env.AUTH_SECRET = "test-secret-not-for-prod"

/* eslint-disable @typescript-eslint/no-explicit-any */
let middleware: any
test.before(async () => {
  ;({ middleware } = await import("./middleware"))
})

function req(host: string, path: string): NextRequest {
  return new NextRequest(new URL(`https://${host}${path}`), {
    headers: { host },
  })
}

/** True when the middleware response rewrites into the Presence by-host route. */
function rewritesToPresence(res: Response): boolean {
  const rw = res.headers.get("x-middleware-rewrite") ?? ""
  return rw.includes("/sites/by-host") || rw.includes("/sites/")
}

const HOSTS = ["sevenef.com", "www.sevenef.com", "localhost", "app-7fnew.vercel.app", "totally-unknown-host.example"]

test("NO host is ever rewritten into Presence on the root path", async () => {
  for (const host of HOSTS) {
    const res = await middleware(req(host, "/"))
    assert.equal(rewritesToPresence(res), false, `${host} must not be rewritten to Presence`)
  }
})

test("sevenef.com and www.sevenef.com serve the app (redirect to /login when unauthenticated), not Presence", async () => {
  for (const host of ["sevenef.com", "www.sevenef.com"]) {
    const res = await middleware(req(host, "/"))
    const location = res.headers.get("location") ?? ""
    assert.ok(location.includes("/login"), `${host} "/" should route into the app (login), got: ${location}`)
    assert.equal(rewritesToPresence(res), false)
  }
})

test("an unknown hostname is NEVER used as a Presence fallback", async () => {
  const res = await middleware(req("random-customer-domain.com", "/"))
  assert.equal(rewritesToPresence(res), false)
  const location = res.headers.get("location") ?? ""
  assert.ok(location.includes("/login"), "unknown host falls through to normal app routing, not Presence")
})

test("localhost and Vercel preview hosts route to the app, not Presence", async () => {
  for (const host of ["localhost", "preview-xyz.vercel.app"]) {
    const res = await middleware(req(host, "/inbox"))
    assert.equal(rewritesToPresence(res), false, `${host} must not enter Presence`)
  }
})

test("/sites/<slug> is public and passes through (Presence slug route still works)", async () => {
  const res = await middleware(req("sevenef.com", "/sites/demo-studio"))
  // Public path → NextResponse.next(); never a redirect to /login and never a rewrite.
  const location = res.headers.get("location") ?? ""
  assert.ok(!location.includes("/login"), "/sites/<slug> must not be auth-redirected")
  assert.equal(rewritesToPresence(res), false)
})

test("/api/sites/<slug>/reception is public (the Fanny reception API is not auth-gated)", async () => {
  const res = await middleware(req("sevenef.com", "/api/sites/demo-studio/reception"))
  const location = res.headers.get("location") ?? ""
  assert.ok(!location.includes("/login"), "public reception API must not be auth-redirected")
  // A public API route returns next() (no 401 JSON, no rewrite).
  assert.equal(res.status, 200)
})

test("internal routes, login and verticals are unaffected", async () => {
  // /login is public → passes through.
  const login = await middleware(req("sevenef.com", "/login"))
  assert.ok(!(login.headers.get("location") ?? "").includes("/login=") )

  // A vertical route without a session → redirected into the app login, not Presence.
  const vertical = await middleware(req("sevenef.com", "/finanzas"))
  assert.ok((vertical.headers.get("location") ?? "").includes("/login"))
  assert.equal(rewritesToPresence(vertical), false)

  // An API route without a session → 401 JSON, not a Presence rewrite.
  const api = await middleware(req("sevenef.com", "/api/workspace/business-profile"))
  assert.equal(rewritesToPresence(api), false)
})
