import { test } from "node:test"
import assert from "node:assert/strict"
import {
  presenceSectionRegistry,
  PRESENCE_SECTION_KINDS,
  PRESENCE_SECTION_DEFINITIONS,
} from "./sections"

test("all declared section kinds are registered exactly once", () => {
  assert.equal(presenceSectionRegistry.size, PRESENCE_SECTION_KINDS.length)
  for (const kind of PRESENCE_SECTION_KINDS) {
    assert.ok(presenceSectionRegistry.has(kind), `missing section: ${kind}`)
  }
})

test("registry covers the required initial sections", () => {
  const required = [
    "hero",
    "services",
    "gallery",
    "reviews",
    "team",
    "booking",
    "whatsapp",
    "location",
    "faq",
    "promotions",
  ] as const
  for (const kind of required) {
    assert.ok(presenceSectionRegistry.get(kind), `expected section ${kind}`)
  }
})

test("re-registering an existing section throws", () => {
  const hero = presenceSectionRegistry.get("hero")!
  assert.throws(() => presenceSectionRegistry.register(hero), /already registered/)
})

test("default kinds are a non-empty subset of all kinds", () => {
  const defaults = presenceSectionRegistry.getDefaultKinds()
  assert.ok(defaults.length > 0)
  for (const kind of defaults) {
    assert.ok((PRESENCE_SECTION_KINDS as readonly string[]).includes(kind))
  }
})

test("every section declares at least one business-profile source", () => {
  for (const def of PRESENCE_SECTION_DEFINITIONS) {
    assert.ok(
      def.businessProfileSources.length > 0,
      `section ${def.kind} declares no data source`,
    )
  }
})
