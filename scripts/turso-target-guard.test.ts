/**
 * Turso target guard — conservative allow-list policy.
 *
 * Proves that only databases whose name carries an explicit non-production
 * marker are provisioned automatically, that every ambiguous or unparseable
 * URL is refused, and that nothing credential-shaped can reach a log line.
 *
 * Runs entirely offline: no database, no network, no credentials.
 *
 * Run: npm run test:turso-guard
 */

import assert from "node:assert/strict"
import test from "node:test"

import {
  assertWritableTarget,
  classifyDatabaseName,
  parseTursoUrl,
  resolveTursoTarget,
  sanitizeForLog,
} from "../prisma/turso-schema"

// ---------------------------------------------------------------------------
// Name classification
// ---------------------------------------------------------------------------

/** Names that MUST be refused automatically (production or unrecognised). */
const BLOCKED_NAMES = [
  "7f",
  "7f-7frames",
  "sevenef",
  "sevenef-live",
  "sevenef-prod",
  "sevenef-production",
  // unrecognised names — no explicit environment marker
  "app",
  "7fnew",
  "seven-frames",
  "sevenef-main",
  "skina",
  "db",
  "",
  // a production marker wins even next to a safe one
  "7f-prod-test",
  "lab-production",
]

/** Names that carry an unambiguous non-production marker. */
const ALLOWED_NAMES = [
  "sevenef-mr-forte-lab",
  "sevenef-mr-forte-lab-7frames",
  "sevenef-preview",
  "forte-mc-dev",
  "7f-lab",
  "7f-preview",
  "app-staging",
  "app_test",
  "sandbox",
  "my-development-db",
  "forte-develop",
]

test("target guard blocks production and unrecognised database names", async (t) => {
  for (const name of BLOCKED_NAMES) {
    await t.test(`blocks "${name}"`, () => {
      const classification = classifyDatabaseName(name)
      assert.equal(classification.safe, false, `expected "${name}" to be refused`)
      assert.ok(classification.reason.length > 0)
    })
  }
})

test("target guard allows only explicitly marked non-production names", async (t) => {
  for (const name of ALLOWED_NAMES) {
    await t.test(`allows "${name}"`, () => {
      const classification = classifyDatabaseName(name)
      assert.equal(classification.safe, true, `expected "${name}" to be allowed`)
    })
  }
})

test("the policy is allow-list, not deny-list: an unknown name is production", () => {
  // The exact failure mode of the previous heuristic: a name nobody thought of.
  for (const name of ["totally-new-database", "xyz123", "forte", "turso"]) {
    assert.equal(classifyDatabaseName(name).safe, false, name)
  }
})

// ---------------------------------------------------------------------------
// URL parsing
// ---------------------------------------------------------------------------

test("parseTursoUrl accepts well-formed libsql URLs", () => {
  const plain = parseTursoUrl("libsql://sevenef-mr-forte-lab.turso.io", "TURSO_DATABASE_URL")
  assert.equal(plain.dbName, "sevenef-mr-forte-lab")
  assert.equal(plain.url, "libsql://sevenef-mr-forte-lab.turso.io")

  const regional = parseTursoUrl(
    "libsql://sevenef-mr-forte-lab.aws-eu-west-1.turso.io",
    "TURSO_DATABASE_URL",
  )
  assert.equal(regional.dbName, "sevenef-mr-forte-lab")
  assert.equal(regional.host, "sevenef-mr-forte-lab.aws-eu-west-1.turso.io")

  const withPort = parseTursoUrl("libsql://lab-db.turso.io:8080", "TURSO_DATABASE_URL")
  assert.equal(withPort.url, "libsql://lab-db.turso.io:8080")

  // A trailing slash is not an ambiguous path.
  assert.equal(parseTursoUrl("libsql://lab-db.turso.io/", "TURSO_DATABASE_URL").dbName, "lab-db")
})

const REJECTED_URLS: Array<[label: string, url: string]> = [
  ["not a URL at all", "definitely-not-a-url"],
  ["empty string", ""],
  ["file: protocol", "file:./dev.db"],
  ["http: protocol", "https://7f-7frames.turso.io"],
  ["userinfo (guard bypass + credential leak)", "libsql://leakeduser:leakedpass@7f-7frames.turso.io"],
  ["username only", "libsql://leakedtoken@7f-7frames.turso.io"],
  ["query parameters (token in URL)", "libsql://lab-db.turso.io?authToken=leakedsecret"],
  ["unexpected path component", "libsql://lab-db.turso.io/some/path"],
  ["IPv4 literal", "libsql://127.0.0.1"],
  ["IPv6 literal", "libsql://[::1]"],
]

test("parseTursoUrl refuses every ambiguous or credential-bearing URL", async (t) => {
  for (const [label, url] of REJECTED_URLS) {
    await t.test(`rejects ${label}`, () => {
      assert.throws(
        () => parseTursoUrl(url, "TURSO_DATABASE_URL"),
        (err: unknown) => {
          assert.ok(err instanceof Error)
          // The variable NAME may appear in the message; its VALUE must not.
          assert.ok(
            !/leaked(user|pass|token|secret)/.test(err.message),
            `error leaked credentials: ${err.message}`,
          )
          assert.ok(!err.message.includes("7f-7frames"), `error echoed the host: ${err.message}`)
          return true
        },
      )
    })
  }
})

test("a userinfo URL can no longer smuggle production past the guard", () => {
  // Before: databaseNameFromUrl() returned "user:pass@7f-7frames", which
  // matched no production pattern, so the guard let it through — and the
  // credentials were printed. Now it never gets that far.
  assert.throws(
    () =>
      parseTursoUrl("libsql://user:pass@7f-7frames.aws-eu-west-1.turso.io", "TURSO_DATABASE_URL"),
    /embeds credentials/,
  )
  // The same shape must not survive resolveTursoTarget either.
  assert.throws(
    () => resolveTursoTarget({ TURSO_DATABASE_URL: "libsql://u:p@7f-7frames.turso.io" }),
    /embeds credentials/,
  )
})

// ---------------------------------------------------------------------------
// Target resolution & precedence
// ---------------------------------------------------------------------------

test("resolveTursoTarget applies the documented precedence", () => {
  const target = resolveTursoTarget({
    TURSO_DATABASE_URL: "libsql://forte-mc-dev.turso.io",
    DATABASE_URL: "libsql://7f-7frames.turso.io",
    TURSO_AUTH_TOKEN: "token-a",
    DATABASE_AUTH_TOKEN: "token-b",
  })
  assert.equal(target.dbName, "forte-mc-dev")
  assert.equal(target.urlSource, "TURSO_DATABASE_URL")
  assert.equal(target.tokenSource, "TURSO_AUTH_TOKEN")
  assert.equal(target.authToken, "token-a")
})

test("the token is paired with the variable that supplied the URL", () => {
  const target = resolveTursoTarget({
    DATABASE_URL: "libsql://sevenef-preview.turso.io",
    TURSO_AUTH_TOKEN: "token-a",
    DATABASE_AUTH_TOKEN: "token-b",
  })
  assert.equal(target.urlSource, "DATABASE_URL")
  assert.equal(target.tokenSource, "DATABASE_AUTH_TOKEN")
})

test("a file: DATABASE_URL is ignored so local dev is never provisioned as Turso", () => {
  assert.throws(() => resolveTursoTarget({ DATABASE_URL: "file:./dev.db" }), /No Turso target configured/)
})

test("assertWritableTarget refuses production unless the exact name is opted in", () => {
  const env = { TURSO_DATABASE_URL: "libsql://7f-7frames.aws-eu-west-1.turso.io" }
  const target = resolveTursoTarget(env)
  assert.equal(target.dbName, "7f-7frames")
  assert.equal(target.classification.safe, false)

  assert.throws(() => assertWritableTarget(target, env), /Refusing to provision "7f-7frames"/)

  // A near-miss override must not unlock it.
  assert.throws(
    () => assertWritableTarget(target, { ...env, TURSO_PROVISION_ALLOW_PRODUCTION: "7f" }),
    /Refusing to provision/,
  )

  // The exact name does.
  assert.doesNotThrow(() =>
    assertWritableTarget(target, { ...env, TURSO_PROVISION_ALLOW_PRODUCTION: "7f-7frames" }),
  )
})

test("a lab target needs no override", () => {
  const env = { TURSO_DATABASE_URL: "libsql://sevenef-mr-forte-lab.aws-eu-west-1.turso.io" }
  const target = resolveTursoTarget(env)
  assert.equal(target.classification.safe, true)
  assert.doesNotThrow(() => assertWritableTarget(target, env))
})

// ---------------------------------------------------------------------------
// Log hygiene
// ---------------------------------------------------------------------------

test("sanitizeForLog strips credentials from anything we print", () => {
  const noisy = [
    "connecting to libsql://7f-7frames.aws-eu-west-1.turso.io?authToken=abc123",
    "TURSO_AUTH_TOKEN=eyJhbGciOiJFZERTQSJ9.eyJhIjoicncifQ.signature-part",
    "Authorization: Bearer sk-super-secret-value",
    "password: hunter2",
  ].join("\n")

  const clean = sanitizeForLog(noisy)
  for (const secret of ["abc123", "hunter2", "sk-super-secret-value", "eyJhbGciOiJFZERTQSJ9"]) {
    assert.ok(!clean.includes(secret), `sanitizeForLog leaked "${secret}": ${clean}`)
  }
})
