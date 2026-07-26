import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"
import {
  assertTursoUrlAllowed,
  computeTursoFingerprint,
  normalizeTursoUrl,
  verifyTursoFingerprint,
} from "./database-fingerprint"

const DEPLOYMENT = { VERCEL_ENV: "production" }
const LOCAL_OPTIN = { SEVENEF_LAB_LOCAL_DEV_ENABLED: "true" }
const LOCAL_NO_OPTIN = {}

test("deployment: libsql:// allowed", () => {
  assert.deepEqual(assertTursoUrlAllowed("libsql://demo.turso.io", DEPLOYMENT), { ok: true })
})

test("deployment: https:// allowed", () => {
  assert.deepEqual(assertTursoUrlAllowed("https://demo.turso.io", DEPLOYMENT), { ok: true })
})

test("deployment: file: rejected", () => {
  assert.deepEqual(assertTursoUrlAllowed("file:/data/dev.db", DEPLOYMENT), {
    ok: false,
    reason: "local-url-in-deployment",
  })
})

test("deployment: http://localhost rejected", () => {
  assert.deepEqual(assertTursoUrlAllowed("http://localhost:8080", DEPLOYMENT), {
    ok: false,
    reason: "local-url-in-deployment",
  })
})

test("local opt-in: file: allowed", () => {
  assert.deepEqual(assertTursoUrlAllowed("file:/data/dev.db", LOCAL_OPTIN), { ok: true })
})

test("local opt-in: http://127.0.0.1 allowed", () => {
  assert.deepEqual(assertTursoUrlAllowed("http://127.0.0.1:8080", LOCAL_OPTIN), { ok: true })
})

test("no local opt-in: local URL rejected", () => {
  assert.deepEqual(assertTursoUrlAllowed("file:/data/dev.db", LOCAL_NO_OPTIN), {
    ok: false,
    reason: "local-url-not-opted-in",
  })
})

test("remote http (non-localhost) is never accepted", () => {
  assert.equal(assertTursoUrlAllowed("http://evil.example.com", LOCAL_OPTIN).ok, false)
  assert.equal(assertTursoUrlAllowed("http://evil.example.com", DEPLOYMENT).ok, false)
})

test("unsupported scheme rejected regardless of context", () => {
  assert.deepEqual(assertTursoUrlAllowed("ftp://x", DEPLOYMENT), { ok: false, reason: "unsupported-scheme" })
})

const sha = (s: string) => createHash("sha256").update(s, "utf8").digest("hex")

test("URL absent / empty → empty", () => {
  assert.deepEqual(normalizeTursoUrl(undefined), { ok: false, reason: "empty" })
  assert.deepEqual(normalizeTursoUrl("   "), { ok: false, reason: "empty" })
})

test("non-URL input → invalid-url", () => {
  assert.deepEqual(normalizeTursoUrl("not a url"), { ok: false, reason: "invalid-url" })
})

test("unsupported scheme → unsupported-scheme", () => {
  assert.deepEqual(normalizeTursoUrl("ftp://mydb.turso.io"), { ok: false, reason: "unsupported-scheme" })
})

test("libsql URL: host lowercased, query (authToken) dropped", () => {
  const r = normalizeTursoUrl("libsql://MyDB-Org.Turso.IO/?authToken=SECRETXYZ")
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.normalized, "libsql://mydb-org.turso.io/")
    assert.doesNotMatch(r.normalized, /SECRETXYZ/i)
  }
})

test("https and file schemes are supported", () => {
  assert.equal(normalizeTursoUrl("https://mydb.turso.io").ok, true)
  assert.equal(normalizeTursoUrl("file:./local-demo.db").ok, true)
})

test("computeTursoFingerprint is deterministic and matches sha256 of the normalized form", () => {
  const url = "libsql://mydb.turso.io/"
  const fp = computeTursoFingerprint(url)
  assert.equal(fp, sha("libsql://mydb.turso.io/"))
  assert.equal(computeTursoFingerprint("libsql://MyDB.Turso.io/"), fp) // case-insensitive host
})

test("different databases produce different fingerprints", () => {
  assert.notEqual(
    computeTursoFingerprint("libsql://demo-db.turso.io/"),
    computeTursoFingerprint("libsql://prod-db.turso.io/"),
  )
})

test("verifyTursoFingerprint: exact match → true (constant-time buffer compare)", () => {
  const url = "libsql://demo-db.turso.io/"
  const expected = computeTursoFingerprint(url)!
  assert.equal(verifyTursoFingerprint(url, expected), true)
  assert.equal(verifyTursoFingerprint(url, expected.toUpperCase()), true)
})

test("verifyTursoFingerprint: different URL → false", () => {
  const expected = computeTursoFingerprint("libsql://demo-db.turso.io/")!
  assert.equal(verifyTursoFingerprint("libsql://prod-db.turso.io/", expected), false)
})

test("verifyTursoFingerprint: malformed / wrong-length expected → false, never throws", () => {
  const url = "libsql://demo-db.turso.io/"
  assert.equal(verifyTursoFingerprint(url, "abc"), false)
  assert.equal(verifyTursoFingerprint(url, ""), false)
  assert.equal(verifyTursoFingerprint(url, undefined), false)
  assert.equal(verifyTursoFingerprint(undefined, computeTursoFingerprint(url)!), false)
})

test("a database name containing 'demo' is NOT accepted without a matching fingerprint", () => {
  const expected = computeTursoFingerprint("libsql://the-real-demo.turso.io/")!
  // A different URL that merely contains 'demo' must still fail.
  assert.equal(verifyTursoFingerprint("libsql://demo-impostor.turso.io/", expected), false)
})
