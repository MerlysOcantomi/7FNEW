import assert from "node:assert/strict"
import test from "node:test"
import { isTrustedLabOrigin } from "./access-origin"

test("exact same-host https origin → trusted", () => {
  assert.equal(
    isTrustedLabOrigin({
      origin: "https://lab.example.com",
      requestHost: "lab.example.com",
      requireHttps: true,
    }),
    true,
  )
})

test("origin host different from request host → rejected", () => {
  assert.equal(
    isTrustedLabOrigin({
      origin: "https://attacker.test",
      requestHost: "lab.example.com",
      requireHttps: true,
    }),
    false,
  )
})

test("malicious suffix host in origin → rejected", () => {
  assert.equal(
    isTrustedLabOrigin({
      origin: "https://lab.example.com.attacker.test",
      requestHost: "lab.example.com",
      requireHttps: true,
    }),
    false,
  )
})

test("missing origin → rejected", () => {
  assert.equal(
    isTrustedLabOrigin({ origin: undefined, requestHost: "lab.example.com", requireHttps: true }),
    false,
  )
  assert.equal(
    isTrustedLabOrigin({ origin: "", requestHost: "lab.example.com", requireHttps: true }),
    false,
  )
})

test("http origin rejected when https is required (deployments)", () => {
  assert.equal(
    isTrustedLabOrigin({
      origin: "http://lab.example.com",
      requestHost: "lab.example.com",
      requireHttps: true,
    }),
    false,
  )
})

test("http origin allowed only when https is not required (local dev)", () => {
  assert.equal(
    isTrustedLabOrigin({
      origin: "http://localhost:3000",
      requestHost: "localhost:3000",
      requireHttps: false,
    }),
    true,
  )
})

test("malformed origin → rejected", () => {
  assert.equal(
    isTrustedLabOrigin({ origin: "not a url", requestHost: "lab.example.com", requireHttps: true }),
    false,
  )
})

test("case-insensitive host comparison", () => {
  assert.equal(
    isTrustedLabOrigin({
      origin: "https://LAB.Example.com",
      requestHost: "lab.example.com",
      requireHttps: true,
    }),
    true,
  )
})
