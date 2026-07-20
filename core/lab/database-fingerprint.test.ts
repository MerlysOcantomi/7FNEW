import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"
import {
  computeTursoFingerprint,
  normalizeTursoUrl,
  verifyTursoFingerprint,
} from "./database-fingerprint"

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
