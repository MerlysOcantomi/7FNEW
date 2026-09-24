import assert from "node:assert/strict"
import test from "node:test"
import {
  buildInitialEntryWorkspaceConfig,
  getEntryProductByKey,
  matchesEntryProductWorkspace,
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


test("resolves the canonical Bonabasto preview host only", () => {
  assert.equal(resolveEntryProductFromHost("preview-bonabasto.sevenef.com")?.key, "bonabasto")
  assert.equal(resolveEntryProductFromHost("PREVIEW-BONABASTO.SEVENEF.COM:443")?.key, "bonabasto")
  assert.equal(resolveEntryProductFromHost("evil.preview-bonabasto.sevenef.com"), null)
  assert.equal(resolveEntryProductFromHost("preview-food.sevenef.com"), null)
})

test("Bonabasto entry contract preserves family and experience separately", () => {
  const bonabasto = getEntryProductByKey("bonabasto")
  assert.ok(bonabasto)
  assert.equal(bonabasto.verticalKey, "food-hospitality")
  assert.equal(bonabasto.experienceKey, "bonabasto")
  assert.equal(bonabasto.onboardingPath, "/onboarding/bonabasto")
  assert.equal(bonabasto.homePath, "/today")
  assert.equal(bonabasto.selfServe, false)

  const config = JSON.parse(buildInitialEntryWorkspaceConfig(bonabasto))
  assert.equal(config.experience.key, "bonabasto")
  assert.equal(config.onboarding.product, "bonabasto")
})

test("product workspace matching distinguishes experiences inside one family", () => {
  const bonabasto = getEntryProductByKey("bonabasto")!
  assert.equal(
    matchesEntryProductWorkspace(
      { verticalKey: "food-hospitality", config: JSON.stringify({ experience: { key: "bonabasto" } }) },
      bonabasto,
    ),
    true,
  )
  assert.equal(
    matchesEntryProductWorkspace(
      { verticalKey: "food-hospitality", config: JSON.stringify({ experience: { key: "club" } }) },
      bonabasto,
    ),
    false,
  )
  assert.equal(
    matchesEntryProductWorkspace({ verticalKey: "food-hospitality", config: null }, bonabasto),
    false,
  )
})

test("legacy Finesse workspaces still match before experienceKey persistence", () => {
  const finesse = getEntryProductByKey("finesse")!
  assert.equal(matchesEntryProductWorkspace({ verticalKey: "beauty", config: null }, finesse), true)
})
