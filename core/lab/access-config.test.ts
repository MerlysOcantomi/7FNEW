import assert from "node:assert/strict"
import test from "node:test"
import {
  LAB_ACCESS_TTL,
  parseLabTtlMinutes,
  readLabAccessConfig,
} from "./access-config"

const VALID_HASH = "a".repeat(64) // 64 hex chars
const STRONG_SECRET = "lab-token-secret-".padEnd(40, "x") // >= 32, distinct

function env(over: Record<string, string | undefined>): Record<string, string | undefined> {
  return {
    SEVENEF_LAB_ACCESS_KEY_SHA256: VALID_HASH,
    SEVENEF_LAB_ACCESS_TOKEN_SECRET: STRONG_SECRET,
    SEVENEF_LAB_ACCESS_TTL_MINUTES: "120",
    AUTH_SECRET: "totally-different-auth-secret-value-xx",
    ...over,
  }
}

test("valid config → ok with normalized values", () => {
  const result = readLabAccessConfig(env({}))
  assert.equal(result.ok, true)
  if (result.ok) {
    assert.equal(result.config.keyHashHex, VALID_HASH)
    assert.equal(result.config.tokenSecret, STRONG_SECRET)
    assert.equal(result.config.ttlMinutes, 120)
  }
})

// --- Key hash (1-3) ---

test("hash absent → missing-key-hash", () => {
  const result = readLabAccessConfig(env({ SEVENEF_LAB_ACCESS_KEY_SHA256: undefined }))
  assert.deepEqual(result, { ok: false, reason: "missing-key-hash" })
})

test("hash wrong length → invalid-key-hash", () => {
  const result = readLabAccessConfig(env({ SEVENEF_LAB_ACCESS_KEY_SHA256: "abc123" }))
  assert.deepEqual(result, { ok: false, reason: "invalid-key-hash" })
})

test("hash with non-hex characters → invalid-key-hash", () => {
  const result = readLabAccessConfig(env({ SEVENEF_LAB_ACCESS_KEY_SHA256: "z".repeat(64) }))
  assert.deepEqual(result, { ok: false, reason: "invalid-key-hash" })
})

test("uppercase hex hash is accepted and normalized to lowercase", () => {
  const result = readLabAccessConfig(env({ SEVENEF_LAB_ACCESS_KEY_SHA256: "A".repeat(64) }))
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.config.keyHashHex, "a".repeat(64))
})

// --- Token secret (4-6) ---

test("token secret absent → missing-token-secret", () => {
  const result = readLabAccessConfig(env({ SEVENEF_LAB_ACCESS_TOKEN_SECRET: undefined }))
  assert.deepEqual(result, { ok: false, reason: "missing-token-secret" })
})

test("token secret too short → weak-token-secret", () => {
  const result = readLabAccessConfig(env({ SEVENEF_LAB_ACCESS_TOKEN_SECRET: "short" }))
  assert.deepEqual(result, { ok: false, reason: "weak-token-secret" })
})

test("token secret equal to AUTH_SECRET → token-secret-reuses-auth-secret", () => {
  const shared = "shared-secret-value-with-enough-length-32"
  const result = readLabAccessConfig(
    env({ SEVENEF_LAB_ACCESS_TOKEN_SECRET: shared, AUTH_SECRET: shared }),
  )
  assert.deepEqual(result, { ok: false, reason: "token-secret-reuses-auth-secret" })
})

test("token secret equal to the key hash → token-secret-matches-key-hash", () => {
  const result = readLabAccessConfig(env({ SEVENEF_LAB_ACCESS_TOKEN_SECRET: VALID_HASH }))
  assert.deepEqual(result, { ok: false, reason: "token-secret-matches-key-hash" })
})

// --- TTL (7-12) ---

test("TTL absent → documented default", () => {
  const result = readLabAccessConfig(env({ SEVENEF_LAB_ACCESS_TTL_MINUTES: undefined }))
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.config.ttlMinutes, LAB_ACCESS_TTL.default)
})

test("TTL zero → invalid-ttl", () => {
  assert.deepEqual(readLabAccessConfig(env({ SEVENEF_LAB_ACCESS_TTL_MINUTES: "0" })), {
    ok: false,
    reason: "invalid-ttl",
  })
})

test("TTL negative → invalid-ttl", () => {
  assert.deepEqual(readLabAccessConfig(env({ SEVENEF_LAB_ACCESS_TTL_MINUTES: "-30" })), {
    ok: false,
    reason: "invalid-ttl",
  })
})

test("TTL decimal → invalid-ttl", () => {
  assert.deepEqual(readLabAccessConfig(env({ SEVENEF_LAB_ACCESS_TTL_MINUTES: "60.5" })), {
    ok: false,
    reason: "invalid-ttl",
  })
})

test("TTL above the max → invalid-ttl", () => {
  assert.deepEqual(
    readLabAccessConfig(env({ SEVENEF_LAB_ACCESS_TTL_MINUTES: String(LAB_ACCESS_TTL.max + 1) })),
    { ok: false, reason: "invalid-ttl" },
  )
})

test("TTL below the min → invalid-ttl", () => {
  assert.deepEqual(
    readLabAccessConfig(env({ SEVENEF_LAB_ACCESS_TTL_MINUTES: String(LAB_ACCESS_TTL.min - 1) })),
    { ok: false, reason: "invalid-ttl" },
  )
})

test("TTL NaN / non-numeric → invalid-ttl", () => {
  assert.deepEqual(readLabAccessConfig(env({ SEVENEF_LAB_ACCESS_TTL_MINUTES: "soon" })), {
    ok: false,
    reason: "invalid-ttl",
  })
})

test("TTL valid within bounds → ok", () => {
  const result = readLabAccessConfig(env({ SEVENEF_LAB_ACCESS_TTL_MINUTES: "45" }))
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.config.ttlMinutes, 45)
})

// --- parseLabTtlMinutes direct ---

test("parseLabTtlMinutes boundaries", () => {
  assert.deepEqual(parseLabTtlMinutes(String(LAB_ACCESS_TTL.min)), {
    ok: true,
    minutes: LAB_ACCESS_TTL.min,
  })
  assert.deepEqual(parseLabTtlMinutes(String(LAB_ACCESS_TTL.max)), {
    ok: true,
    minutes: LAB_ACCESS_TTL.max,
  })
  assert.deepEqual(parseLabTtlMinutes(undefined), { ok: true, minutes: LAB_ACCESS_TTL.default })
  assert.deepEqual(parseLabTtlMinutes("1e3"), { ok: false })
  assert.deepEqual(parseLabTtlMinutes(" 60 "), { ok: true, minutes: 60 })
})

// --- Failure reasons never leak values ---

test("config denials expose only { ok, reason } — no secret or hash values", () => {
  const cases = [
    env({ SEVENEF_LAB_ACCESS_KEY_SHA256: undefined }),
    env({ SEVENEF_LAB_ACCESS_TOKEN_SECRET: "short" }),
    env({ SEVENEF_LAB_ACCESS_TTL_MINUTES: "0" }),
  ]
  for (const e of cases) {
    const result = readLabAccessConfig(e)
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.deepEqual(Object.keys(result).sort(), ["ok", "reason"])
      assert.doesNotMatch(result.reason, new RegExp(STRONG_SECRET))
      assert.doesNotMatch(result.reason, new RegExp(VALID_HASH))
    }
  }
})
