import { test } from "node:test"
import assert from "node:assert/strict"
import {
  presenceTemplateRegistry,
  PRESENCE_TEMPLATE_FAMILIES,
} from "./templates"
import { PRESENCE_SECTION_KINDS } from "./sections"
import { isPresenceThemeKey } from "./themes"

test("each of the four families has at least one foundation template", () => {
  for (const family of PRESENCE_TEMPLATE_FAMILIES) {
    const templates = presenceTemplateRegistry.getByFamily(family)
    assert.ok(templates.length > 0, `family ${family} has no template`)
  }
})

test("initial templates are labeled foundation, not ready", () => {
  for (const tpl of presenceTemplateRegistry.getAll()) {
    assert.equal(tpl.status, "foundation", `${tpl.id} should be foundation`)
  }
})

test("templates only reference known sections and valid theme keys", () => {
  for (const tpl of presenceTemplateRegistry.getAll()) {
    for (const ref of tpl.sections) {
      assert.ok(
        (PRESENCE_SECTION_KINDS as readonly string[]).includes(ref.kind),
        `${tpl.id} references unknown section ${ref.kind}`,
      )
    }
    for (const key of tpl.compatibleThemeKeys) {
      assert.ok(isPresenceThemeKey(key), `${tpl.id} has invalid theme ${key}`)
    }
  }
})

test("get() resolves a specific version and the latest version", () => {
  const specific = presenceTemplateRegistry.get("business-site-standard", "0.1.0")
  assert.ok(specific)
  assert.equal(specific!.version, "0.1.0")
  const latest = presenceTemplateRegistry.get("business-site-standard")
  assert.ok(latest)
  assert.equal(latest!.id, "business-site-standard")
})

test("re-registering the same id@version throws", () => {
  const tpl = presenceTemplateRegistry.get("business-site-standard", "0.1.0")!
  assert.throws(() => presenceTemplateRegistry.register(tpl), /already registered/)
})
