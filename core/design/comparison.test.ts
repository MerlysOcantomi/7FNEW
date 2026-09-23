import test from "node:test"
import assert from "node:assert/strict"
import { DEFAULT_DESIGN_CONTRACT } from "./contracts"
import { captureDesignReference, compareDesignChoices, applyDesignReference } from "./comparison"

const design = () => captureDesignReference(DEFAULT_DESIGN_CONTRACT)

test("reference captures every nested object without sharing editor state", () => {
  const b = design(), a = captureDesignReference(b)
  assert.deepEqual(a, b)
  for (const key of ["brand", "palette", "typography", "shape", "surfaces", "effects", "motion"] as const) assert.notEqual(a[key], b[key])
  b.brand.name = "Studio"; b.palette.family = "petrol-night"; b.effects.glow = "off"
  assert.equal(a.brand.name, "sevenef"); assert.equal(a.palette.family, "north-sea"); assert.equal(a.effects.glow, "subtle")
})

test("unchanged choices have no differences", () => {
  assert.deepEqual(compareDesignChoices(design(), design()), [])
})

test("only changed sections are described, in stable order", () => {
  const a = design(), b = design()
  b.palette.family = "petrol-night"; b.typography.display = "georgia"; b.effects.shadow = "deep"
  const diff = compareDesignChoices(a, b)
  assert.deepEqual(diff.map(d => d.section), ["palette", "typography", "effects"])
  assert.equal(diff[0].reference, "north-sea / dark")
  assert.equal(diff[0].working, "petrol-night / dark")
  assert.equal(compareDesignChoices(b, a)[0].reference, "petrol-night / dark")
})

test("all editable visual groups participate", () => {
  const a = design(), b = design()
  b.brand.name = "Finesse"; b.palette.family = "petrol-night"; b.typography.scale = "editorial"
  b.density = "spacious"; b.shape.radius = "soft"; b.surfaces.default = "tinted"
  b.effects.blur = "strong"; b.motion.ai = "none"
  assert.deepEqual(compareDesignChoices(a, b).map(d => d.section), ["brand", "palette", "typography", "density", "shape", "surfaces", "effects", "motion"])
})

test("preview page is not counted as a design change", () => {
  const a = design(), b = design()
  a.pagePreset = "landing"; b.pagePreset = "presence"
  assert.deepEqual(compareDesignChoices(a, b), [])
})

test("equivalent legacy petrol IDs and default mono do not add noise", () => {
  const a = design(), b = design()
  a.palette.family = "petrol"; b.palette.family = "petrol-night"
  delete a.typography.mono; b.typography.mono = "system-mono"
  a.brand.name = " sevenef "
  assert.deepEqual(compareDesignChoices(a, b), [])
})

test("a changed logo reference is not overlooked", () => {
  const a = design(), b = design()
  b.brand.logoRef = "assets/brand-logo.svg"
  assert.equal(compareDesignChoices(a, b)[0].section, "brand")
})

test("adopting reference keeps B's page and does not mutate A", () => {
  const a = design(), b = design()
  a.pagePreset = "landing"; b.pagePreset = "components"; b.palette.family = "petrol-night"
  const next = applyDesignReference(a, b)
  assert.equal(next.pagePreset, "components"); assert.equal(next.palette.family, "north-sea")
  assert.equal(a.pagePreset, "landing"); assert.equal(b.palette.family, "petrol-night")
  next.shape.radius = "precise"
  assert.equal(a.shape.radius, "rounded-premium")
})

test("adopting reference does not introduce an absent page preference", () => {
  const a = design(), b = design(); a.pagePreset = "presence"
  assert.equal(Object.hasOwn(applyDesignReference(a, b), "pagePreset"), false)
})

test("comparison reads frozen contracts without mutation", () => {
  const a = design(), b = design()
  b.density = "compact"
  for (const obj of [a, b]) {
    for (const value of Object.values(obj)) if (typeof value === "object" && value !== null) Object.freeze(value)
    Object.freeze(obj)
  }
  assert.equal(compareDesignChoices(a, b).length, 1)
})

test("brand separators and literal logo IDs cannot hide a difference", () => {
  const a = design(), b = design()
  a.brand.name = "Studio / North"; a.brand.logoRef = "mark"
  b.brand.name = "Studio"; b.brand.logoRef = "North / mark"
  const [difference] = compareDesignChoices(a, b)
  assert.equal(difference.section, "brand")
  assert.notEqual(difference.reference, difference.working)
  a.brand.name = "Studio"; delete a.brand.logoRef; b.brand.logoRef = "no logo"
  assert.equal(compareDesignChoices(a, b).length, 1)
})
