/**
 * Middleware regression tests (PRESENCE-03 hotfix + managed Finesse domain).
 *
 * A previous version rewrote ANY host not in an env allowlist to Presence and
 * could hijack the app's own production domain. These tests keep that fix while
 * allowing one explicit managed namespace: getfinesse.app.
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

function rewriteTarget(res: Response): string {
  return res.headers.get("x-middleware-rewrite") ?? ""
}

/** True when the middleware response rewrites into Presence. */
function rewritesToPresence(res: Response): boolean {
  const rw = rewriteTarget(res)
  return rw.includes("/sites/by-host") || rw.includes("/sites/")
}

const NON_FINESSE_HOSTS = ["sevenef.com", "www.sevenef.com", "localhost", "app-7fnew.vercel.app", "totally-unknown-host.example"]

test("non-Finesse hosts are never rewritten into Presence on the root path", async () => {
  for (const host of NON_FINESSE_HOSTS) {
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

test("Finesse apex, www and stable preview hosts rewrite the public root to /finesse", async () => {
  for (const host of ["getfinesse.app", "www.getfinesse.app", "preview.getfinesse.app"]) {
    const res = await middleware(req(host, "/"))
    const target = rewriteTarget(res)
    assert.ok(target.includes("/finesse"), `${host} should rewrite to /finesse, got: ${target}`)
    assert.equal(rewritesToPresence(res), false)
  }
})

test("a valid customer subdomain under getfinesse.app rewrites to the matching Presence slug", async () => {
  const cases = [
    ["jenny.getfinesse.app", "/sites/jenny"],
    ["studio-bella.getfinesse.app", "/sites/studio-bella"],
  ] as const

  for (const [host, expectedPath] of cases) {
    const res = await middleware(req(host, "/"))
    const target = rewriteTarget(res)
    assert.ok(target.includes(expectedPath), `${host} should rewrite to ${expectedPath}, got: ${target}`)
    assert.equal(rewritesToPresence(res), true)
  }
})

test("reserved Finesse subdomains never become customer Presence slugs", async () => {
  for (const host of ["app.getfinesse.app", "preview.getfinesse.app", "api.getfinesse.app", "admin.getfinesse.app", "support.getfinesse.app"]) {
    const res = await middleware(req(host, "/"))
    assert.equal(rewritesToPresence(res), false, `${host} must remain reserved`)
  }
})

test("nested and malformed Finesse hosts are not accepted as managed Presence slugs", async () => {
  for (const host of ["x.y.getfinesse.app", "-bad.getfinesse.app", "bad-.getfinesse.app"]) {
    const res = await middleware(req(host, "/"))
    assert.equal(rewritesToPresence(res), false, `${host} must not enter Presence`)
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

test("managed Finesse host routing applies only to the root path", async () => {
  const res = await middleware(req("jenny.getfinesse.app", "/inbox"))
  assert.equal(rewritesToPresence(res), false)
  const location = res.headers.get("location") ?? ""
  assert.ok(location.includes("/login"), "non-root app paths keep normal auth routing")
})

test("/sites/<slug> is public and passes through (Presence slug route still works)", async () => {
  const res = await middleware(req("sevenef.com", "/sites/demo-studio"))
  const location = res.headers.get("location") ?? ""
  assert.ok(!location.includes("/login"), "/sites/<slug> must not be auth-redirected")
  assert.equal(rewritesToPresence(res), false)
})

test("/api/sites/<slug>/reception is public (the Fanny reception API is not auth-gated)", async () => {
  const res = await middleware(req("sevenef.com", "/api/sites/demo-studio/reception"))
  const location = res.headers.get("location") ?? ""
  assert.ok(!location.includes("/login"), "public reception API must not be auth-redirected")
  assert.equal(res.status, 200)
})

test("internal routes, login and verticals are unaffected", async () => {
  const login = await middleware(req("sevenef.com", "/login"))
  assert.ok(!(login.headers.get("location") ?? "").includes("/login=") )

  const vertical = await middleware(req("sevenef.com", "/finanzas"))
  assert.ok((vertical.headers.get("location") ?? "").includes("/login"))
  assert.equal(rewritesToPresence(vertical), false)

  const api = await middleware(req("sevenef.com", "/api/workspace/business-profile"))
  assert.equal(rewritesToPresence(api), false)
})

test("/finesse (public Finesse landing) is public; lookalike and private routes stay protected", async () => {
  for (const path of ["/finesse", "/finesse/"]) {
    const res = await middleware(req("sevenef.com", path))
    const location = res.headers.get("location") ?? ""
    assert.ok(!location.includes("/login"), `${path} must not be auth-redirected`)
  }
  for (const path of ["/finessex", "/finesse-admin", "/today", "/inbox", "/api/today/beauty"]) {
    const res = await middleware(req("sevenef.com", path))
    const location = res.headers.get("location") ?? ""
    const status = res.status
    assert.ok(location.includes("/login") || status === 401 || status === 403 || status === 503, `${path} must stay protected (got ${status} ${location})`)
  }
})

test("NEON-05 write freeze (defence in depth): mutating /api requests get 503 while SEVENF_OPERATION_MODE=freeze-writes or invalid; GET and pages pass; normal restores", async () => {
  const previous = process.env.SEVENF_OPERATION_MODE
  try {
    process.env.SEVENF_OPERATION_MODE = "freeze-writes"
    for (const path of ["/api/inbox/public/send", "/api/inbox/email/inbound", "/api/sites/x/reception", "/api/clientes", "/api/cron/imap-sync"]) {
      for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
        const res = await middleware(new NextRequest(new URL(`https://sevenef.com${path}`), { method, headers: { host: "sevenef.com" } }))
        assert.equal(res.status, 503, `${method} ${path}`)
        assert.equal(res.headers.get("retry-after"), "60")
        assert.equal((await res.json()).error.code, "OPERATION_FROZEN")
      }
    }
    const get = await middleware(req("sevenef.com", "/api/sites/x/reception"))
    assert.notEqual(get.status, 503)
    const page = await middleware(req("sevenef.com", "/login"))
    assert.notEqual(page.status, 503)
    process.env.SEVENF_OPERATION_MODE = "not-a-mode"
    const invalid = await middleware(new NextRequest(new URL("https://sevenef.com/api/clientes"), { method: "POST", headers: { host: "sevenef.com" } }))
    assert.equal(invalid.status, 503, "an invalid mode fails closed")
    process.env.SEVENF_OPERATION_MODE = "normal"
    const back = await middleware(new NextRequest(new URL("https://sevenef.com/api/inbox/public/send"), { method: "POST", headers: { host: "sevenef.com" } }))
    assert.notEqual(back.status, 503)
  } finally {
    if (previous === undefined) delete process.env.SEVENF_OPERATION_MODE
    else process.env.SEVENF_OPERATION_MODE = previous
  }
})
