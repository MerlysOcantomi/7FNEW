import { test } from "node:test"
import assert from "node:assert/strict"
import {
  planHostRewrite,
  appHostsFromEnv,
  normalizeHostHeader,
  hostFromUrl,
} from "./host-routing"

const APP = ["app.sevenef.com"]

test("FEATURE OFF: no rewrite when no app hosts are configured", () => {
  assert.equal(planHostRewrite({ hostHeader: "client.com", pathname: "/", appHosts: [] }), null)
})

test("the app's own host is never rewritten", () => {
  assert.equal(planHostRewrite({ hostHeader: "app.sevenef.com", pathname: "/", appHosts: APP }), null)
  assert.equal(planHostRewrite({ hostHeader: "APP.sevenef.com:443", pathname: "/inbox", appHosts: APP }), null)
})

test("vercel preview, localhost and bare IPs are never rewritten", () => {
  assert.equal(planHostRewrite({ hostHeader: "x.vercel.app", pathname: "/", appHosts: APP }), null)
  assert.equal(planHostRewrite({ hostHeader: "localhost:3000", pathname: "/", appHosts: APP }), null)
  assert.equal(planHostRewrite({ hostHeader: "127.0.0.1", pathname: "/", appHosts: APP }), null)
})

test("internal / api / static / auth paths are never rewritten", () => {
  for (const p of ["/api/x", "/_next/static/y", "/sites/foo", "/login", "/cliente/login", "/widget/chat", "/favicon.ico"]) {
    assert.equal(planHostRewrite({ hostHeader: "client.com", pathname: p, appHosts: APP }), null, p)
  }
})

test("an external custom host on a root path rewrites to the by-host route", () => {
  const d = planHostRewrite({ hostHeader: "MyStudio.com", pathname: "/", appHosts: APP })
  assert.deepEqual(d, { rewritePath: "/sites/by-host/mystudio.com" })
})

test("host header is normalized before rewrite", () => {
  const d = planHostRewrite({ hostHeader: "www.MyStudio.com:8080", pathname: "/", appHosts: APP })
  assert.deepEqual(d, { rewritePath: "/sites/by-host/www.mystudio.com" })
})

test("normalizeHostHeader lowercases, drops port and trailing dot", () => {
  assert.equal(normalizeHostHeader("Studio.COM:443"), "studio.com")
  assert.equal(normalizeHostHeader("studio.com."), "studio.com")
  assert.equal(normalizeHostHeader(null), "")
})

test("hostFromUrl parses bare and full URLs", () => {
  assert.equal(hostFromUrl("https://app.sevenef.com"), "app.sevenef.com")
  assert.equal(hostFromUrl("app.sevenef.com"), "app.sevenef.com")
  assert.equal(hostFromUrl(undefined), null)
})

test("appHostsFromEnv extracts hosts from the known env vars", () => {
  const hosts = appHostsFromEnv({ NEXT_PUBLIC_APP_URL: "https://app.sevenef.com", VERCEL_URL: "preview.vercel.app" })
  assert.ok(hosts.includes("app.sevenef.com"))
  assert.ok(hosts.includes("preview.vercel.app"))
})
