import assert from "node:assert/strict"
import test from "node:test"
import {
  getEntryProductByKey,
  normalizeRequestHost,
  requiresEntryOnboarding,
  resolveEntryProductFromHost,
} from "./product-entry"

test("resolves the managed Finesse domain and its subdomains", () => {
  for (const host of [
    "getfinesse.app",
    "www.getfinesse.app",
    "app.getfinesse.app",
    "studio-bella.getfinesse.app",
    "WWW.GETFINESSE.APP:443",
    "getfinesse.app.",
  ]) {
    assert.equal(resolveEntryProductFromHost(host)?.key, "finesse", host)
  }
})

test("does not confuse unrelated hosts with Finesse", () => {
  for (const host of [
    "sevenef.com",
    "www.sevenef.com",
    "7-fnew.vercel.app",
    "evilgetfinesse.app",
    "getfinesse.app.example.com",
    "",
  ]) {
    assert.equal(resolveEntryProductFromHost(host), null, host)
  }
})

test("normalizes host ports and trailing dots", () => {
  assert.equal(normalizeRequestHost(" WWW.GETFINESSE.APP:443. "), "www.getfinesse.app")
  assert.equal(normalizeRequestHost("www.getfinesse.app:443"), "www.getfinesse.app")
})

test("onboarding gate is migration-safe", () => {
  assert.equal(requiresEntryOnboarding(null, "finesse"), false)
  assert.equal(requiresEntryOnboarding("{}", "finesse"), false)
  assert.equal(requiresEntryOnboarding("not-json", "finesse"), false)
  assert.equal(
    requiresEntryOnboarding(
      JSON.stringify({ onboarding: { product: "finesse", status: "not_started" } }),
      "finesse",
    ),
    true,
  )
  assert.equal(
    requiresEntryOnboarding(
      JSON.stringify({ onboarding: { product: "finesse", status: "completed" } }),
      "finesse",
    ),
    false,
  )
})

test("registry exposes the Finesse product contract", () => {
  const finesse = getEntryProductByKey("finesse")
  assert.equal(finesse?.verticalKey, "beauty")
  assert.equal(finesse?.onboardingPath, "/onboarding/finesse")
  assert.equal(finesse?.homePath, "/today")
  assert.equal(finesse?.selfServe, true)
})
