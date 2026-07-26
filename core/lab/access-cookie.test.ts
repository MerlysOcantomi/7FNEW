import assert from "node:assert/strict"
import test from "node:test"
import {
  LAB_ACCESS_COOKIE_NAME,
  LAB_ACCESS_COOKIE_PATH,
  buildLabAccessClearCookie,
  buildLabAccessCookie,
} from "./access-cookie"

const TOKEN = "header.payload.signature"

test("cookie name differs from the normal session cookies", () => {
  assert.equal(LAB_ACCESS_COOKIE_NAME, "sevenef-lab-access")
  assert.notEqual(LAB_ACCESS_COOKIE_NAME, "7f-session")
  assert.notEqual(LAB_ACCESS_COOKIE_NAME, "wf_workspace")
})

test("access cookie is HttpOnly", () => {
  const cookie = buildLabAccessCookie(TOKEN, { ttlMinutes: 120, secure: true })
  assert.equal(cookie.httpOnly, true)
})

test("access cookie is SameSite=Strict", () => {
  const cookie = buildLabAccessCookie(TOKEN, { ttlMinutes: 120, secure: true })
  assert.equal(cookie.sameSite, "strict")
})

test("access cookie is scoped to Path=/lab", () => {
  const cookie = buildLabAccessCookie(TOKEN, { ttlMinutes: 120, secure: true })
  assert.equal(cookie.path, "/lab")
  assert.equal(cookie.path, LAB_ACCESS_COOKIE_PATH)
})

test("access cookie is Secure in deployments and not-secure only when told", () => {
  assert.equal(buildLabAccessCookie(TOKEN, { ttlMinutes: 120, secure: true }).secure, true)
  assert.equal(buildLabAccessCookie(TOKEN, { ttlMinutes: 120, secure: false }).secure, false)
})

test("access cookie Max-Age matches the TTL in seconds", () => {
  assert.equal(buildLabAccessCookie(TOKEN, { ttlMinutes: 120, secure: true }).maxAge, 120 * 60)
  assert.equal(buildLabAccessCookie(TOKEN, { ttlMinutes: 15, secure: true }).maxAge, 15 * 60)
})

test("access cookie has no Domain attribute (host-only)", () => {
  const cookie = buildLabAccessCookie(TOKEN, { ttlMinutes: 120, secure: true })
  assert.equal("domain" in cookie, false)
})

test("clear cookie empties the value and expires immediately", () => {
  const cookie = buildLabAccessClearCookie({ secure: true })
  assert.equal(cookie.name, LAB_ACCESS_COOKIE_NAME)
  assert.equal(cookie.value, "")
  assert.equal(cookie.maxAge, 0)
  assert.equal(cookie.path, "/lab")
  assert.equal(cookie.httpOnly, true)
  assert.equal(cookie.sameSite, "strict")
  assert.equal("domain" in cookie, false)
})
