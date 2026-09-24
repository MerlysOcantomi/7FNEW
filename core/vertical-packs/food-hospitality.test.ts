import assert from "node:assert/strict"
import test from "node:test"
import {
  BONABASTO_EXPERIENCE_KEY,
  FOOD_HOSPITALITY_PACK,
  buildFoodHospitalityDefaultConfig,
} from "./food-hospitality"
import { mapVerticalKeyToBusinessType } from "@core/personalization"

test("Food Hospitality pack identifies Bonabasto without granting future modules", () => {
  assert.equal(FOOD_HOSPITALITY_PACK.verticalKey, "food-hospitality")
  assert.equal(FOOD_HOSPITALITY_PACK.defaultExperienceKey, BONABASTO_EXPERIENCE_KEY)
  assert.equal(FOOD_HOSPITALITY_PACK.verticalName, "Bonabasto")
  assert.equal(FOOD_HOSPITALITY_PACK.today.mode, "work_first")
  assert.equal(FOOD_HOSPITALITY_PACK.today.targetMode, "order_first")
  assert.equal(FOOD_HOSPITALITY_PACK.today.activateRealForRealWorkspaces, false)

  for (const notBuilt of ["catalog", "orders", "inventory", "kitchen", "ticketing"]) {
    assert.ok(
      !FOOD_HOSPITALITY_PACK.recommendedModules.includes(notBuilt),
      `BONA-00 must not recommend unbuilt module ${notBuilt}`,
    )
  }
})

test("Food Hospitality default config stays declarative and capability-neutral", () => {
  const config = JSON.parse(buildFoodHospitalityDefaultConfig())
  assert.equal(config.nav.profile, "food-hospitality")
  assert.equal(config.today.mode, "work_first")
  assert.equal(config.today.targetMode, "order_first")
  assert.equal(config.experience, undefined)
  assert.equal(config.entitlements, undefined)
  assert.equal(config.capabilities, undefined)
})

test("Food Hospitality maps to its own business type", () => {
  assert.equal(mapVerticalKeyToBusinessType("food-hospitality"), "food-hospitality")
})
