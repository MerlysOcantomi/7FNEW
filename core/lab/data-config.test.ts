import assert from "node:assert/strict"
import test from "node:test"
import { readLabDataConfig } from "./data-config"
import { LAB_DEMO_IDENTITY } from "./demo-identity"

const VALID_FP = "b".repeat(64)
const STRONG_AUTH = "auth-secret-value-with-enough-entropy-xx"

function env(over: Record<string, string | undefined>): Record<string, string | undefined> {
  return {
    SEVENEF_LAB_DATA_ENABLED: "true",
    SEVENEF_LAB_EXPECTED_DATABASE_URL_SHA256: VALID_FP,
    AUTH_SECRET: STRONG_AUTH,
    SEVENEF_LAB_ACCESS_TOKEN_SECRET: "different-access-token-secret-xxxxxxxxxx",
    SEVENEF_LAB_ACCESS_KEY_SHA256: "a".repeat(64),
    ...over,
  }
}

test("valid config → ok with defaults", () => {
  const r = readLabDataConfig(env({}))
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.config.expectedDbFingerprint, VALID_FP)
    assert.equal(r.config.userId, LAB_DEMO_IDENTITY.userId)
    assert.equal(r.config.userEmail, LAB_DEMO_IDENTITY.userEmail)
    assert.equal(r.config.workspaceId, LAB_DEMO_IDENTITY.workspaceId)
    assert.equal(r.config.workspaceSlug, LAB_DEMO_IDENTITY.workspaceSlug)
  }
})

test("data flag absent / wrong → disabled", () => {
  assert.deepEqual(readLabDataConfig(env({ SEVENEF_LAB_DATA_ENABLED: undefined })), { ok: false, reason: "disabled" })
  assert.deepEqual(readLabDataConfig(env({ SEVENEF_LAB_DATA_ENABLED: "TRUE" })), { ok: false, reason: "disabled" })
  assert.deepEqual(readLabDataConfig(env({ SEVENEF_LAB_DATA_ENABLED: "1" })), { ok: false, reason: "disabled" })
})

test("fingerprint absent / short / non-hex → invalid-fingerprint-hash", () => {
  assert.deepEqual(readLabDataConfig(env({ SEVENEF_LAB_EXPECTED_DATABASE_URL_SHA256: undefined })), { ok: false, reason: "invalid-fingerprint-hash" })
  assert.deepEqual(readLabDataConfig(env({ SEVENEF_LAB_EXPECTED_DATABASE_URL_SHA256: "abc" })), { ok: false, reason: "invalid-fingerprint-hash" })
  assert.deepEqual(readLabDataConfig(env({ SEVENEF_LAB_EXPECTED_DATABASE_URL_SHA256: "z".repeat(64) })), { ok: false, reason: "invalid-fingerprint-hash" })
})

test("demo email must be on the reserved .invalid TLD", () => {
  assert.deepEqual(readLabDataConfig(env({ SEVENEF_LAB_USER_EMAIL: "someone@gmail.com" })), { ok: false, reason: "invalid-identity" })
  assert.equal(readLabDataConfig(env({ SEVENEF_LAB_USER_EMAIL: "demo@sevenef.invalid" })).ok, true)
})

test("AUTH_SECRET absent → auth-secret-missing", () => {
  assert.deepEqual(readLabDataConfig(env({ AUTH_SECRET: undefined })), { ok: false, reason: "auth-secret-missing" })
})

test("AUTH_SECRET too short → auth-secret-weak", () => {
  assert.deepEqual(readLabDataConfig(env({ AUTH_SECRET: "short" })), { ok: false, reason: "auth-secret-weak" })
})

test("AUTH_SECRET equal to the access token secret → auth-secret-reuses-access-secret", () => {
  const shared = "shared-secret-value-with-enough-length-32chars"
  assert.deepEqual(
    readLabDataConfig(env({ AUTH_SECRET: shared, SEVENEF_LAB_ACCESS_TOKEN_SECRET: shared })),
    { ok: false, reason: "auth-secret-reuses-access-secret" },
  )
})

test("AUTH_SECRET equal to the access key hash → auth-secret-matches-key-hash", () => {
  const hash = "c".repeat(64)
  assert.deepEqual(
    readLabDataConfig(env({ AUTH_SECRET: hash, SEVENEF_LAB_ACCESS_KEY_SHA256: hash })),
    { ok: false, reason: "auth-secret-matches-key-hash" },
  )
})

test("AUTH_SECRET mirrored into a NEXT_PUBLIC_* var → auth-secret-exposed-public", () => {
  assert.deepEqual(
    readLabDataConfig(env({ NEXT_PUBLIC_LEAK: STRONG_AUTH })),
    { ok: false, reason: "auth-secret-exposed-public" },
  )
})

test("denials expose only { ok, reason } — no secret values", () => {
  const cases = [
    env({ AUTH_SECRET: undefined }),
    env({ SEVENEF_LAB_EXPECTED_DATABASE_URL_SHA256: "bad" }),
    env({ NEXT_PUBLIC_LEAK: STRONG_AUTH }),
  ]
  for (const e of cases) {
    const r = readLabDataConfig(e)
    assert.equal(r.ok, false)
    if (!r.ok) {
      assert.deepEqual(Object.keys(r).sort(), ["ok", "reason"])
      assert.doesNotMatch(r.reason, new RegExp(STRONG_AUTH))
      assert.doesNotMatch(r.reason, new RegExp(VALID_FP))
    }
  }
})
