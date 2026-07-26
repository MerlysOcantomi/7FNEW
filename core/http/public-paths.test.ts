import assert from "node:assert/strict"
import test from "node:test"
import { isStaticAssetPath } from "./public-paths"

test("Vercel analytics script is a static asset (not auth-gated)", () => {
  assert.equal(isStaticAssetPath("/_vercel/insights/script.js"), true)
  assert.equal(isStaticAssetPath("/_vercel/speed-insights/script.js"), true)
})

test("Next internal assets remain static", () => {
  assert.equal(isStaticAssetPath("/_next/static/chunks/x.js"), true)
  assert.equal(isStaticAssetPath("/favicon.ico"), true)
})

test("metadata icon files are public assets", () => {
  assert.equal(isStaticAssetPath("/icon.svg"), true)
  assert.equal(isStaticAssetPath("/icon-light-32x32.png"), true)
  assert.equal(isStaticAssetPath("/icon-dark-32x32.png"), true)
  assert.equal(isStaticAssetPath("/apple-icon.png"), true)
})

test("real app routes are NOT static assets", () => {
  assert.equal(isStaticAssetPath("/today"), false)
  assert.equal(isStaticAssetPath("/api/clientes"), false)
  assert.equal(isStaticAssetPath("/lab/enter"), false)
  assert.equal(isStaticAssetPath("/"), false)
  // Must not be fooled by a route that merely starts similarly.
  assert.equal(isStaticAssetPath("/icon-gallery"), false)
})
