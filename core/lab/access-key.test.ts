import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import test from "node:test"
import { LAB_ACCESS_KEY_MAX_LENGTH, sha256Hex, verifyLabAccessKey } from "./access-key"

const KEY = "correct horse battery staple · lab"
const KEY_HASH = createHash("sha256").update(KEY, "utf8").digest("hex")

test("sha256Hex produces a 64-char lowercase hex digest", () => {
  const digest = sha256Hex(KEY)
  assert.equal(digest.length, 64)
  assert.match(digest, /^[0-9a-f]{64}$/)
  assert.equal(digest, KEY_HASH)
})

test("correct key → true", () => {
  assert.equal(verifyLabAccessKey(KEY, KEY_HASH), true)
})

test("incorrect key → false", () => {
  assert.equal(verifyLabAccessKey(KEY + "!", KEY_HASH), false)
  assert.equal(verifyLabAccessKey("wrong", KEY_HASH), false)
})

test("empty key → false", () => {
  assert.equal(verifyLabAccessKey("", KEY_HASH), false)
})

test("key with extra surrounding spaces is rejected (no trimming)", () => {
  assert.equal(verifyLabAccessKey(` ${KEY} `, KEY_HASH), false)
  assert.equal(verifyLabAccessKey(`${KEY} `, KEY_HASH), false)
})

test("over-long input is rejected before hashing", () => {
  const huge = "x".repeat(LAB_ACCESS_KEY_MAX_LENGTH + 1)
  assert.equal(verifyLabAccessKey(huge, KEY_HASH), false)
})

test("non-string input → false", () => {
  assert.equal(verifyLabAccessKey(undefined, KEY_HASH), false)
  assert.equal(verifyLabAccessKey(null, KEY_HASH), false)
  assert.equal(verifyLabAccessKey(123 as unknown, KEY_HASH), false)
  assert.equal(verifyLabAccessKey({}, KEY_HASH), false)
})

test("malformed configured digest (wrong length) → false, never throws", () => {
  assert.equal(verifyLabAccessKey(KEY, "abc"), false)
  assert.equal(verifyLabAccessKey(KEY, ""), false)
  assert.equal(verifyLabAccessKey(KEY, "zz".repeat(32)), false)
})

test("the function only ever returns a boolean (no hashes/secrets leaked)", () => {
  const outcomes = [
    verifyLabAccessKey(KEY, KEY_HASH),
    verifyLabAccessKey("nope", KEY_HASH),
    verifyLabAccessKey("", KEY_HASH),
  ]
  for (const o of outcomes) assert.equal(typeof o, "boolean")
})
