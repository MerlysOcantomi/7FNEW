import assert from "node:assert/strict"
import test from "node:test"

import { SETTINGS_ITEMS } from "./settings-items"
import { getUIMessages } from "../../core/i18n/ui"
import { BEAUTY_NAV_PROFILE } from "../../core/vertical-packs/nav-profile"

// ─── Routing contract (7F-FIX01) ──────────────────────────────────────────────

test("business profile settings entry routes to /business-profile, never the overview", () => {
  const item = SETTINGS_ITEMS.find((i) => i.catalogKey === "businessProfile")
  assert.ok(item, "settings catalogue must expose a business profile entry")
  assert.equal(item.href, "/business-profile")
  assert.ok(!item.comingSoon, "business profile is live — must not render as 'Soon'")
})

test("no settings entry points at the overview route '/'", () => {
  for (const item of SETTINGS_ITEMS) {
    assert.notEqual(item.href, "/", `${item.id} must not route to the overview`)
  }
})

test("workspace settings entry keeps routing to /administracion", () => {
  const item = SETTINGS_ITEMS.find((i) => i.catalogKey === "workspaceSettings")
  assert.equal(item?.href, "/administracion")
})

test("'Mi salón' (Beauty overview) keeps pointing at '/'", () => {
  const mySalon = BEAUTY_NAV_PROFILE.items.find((i) => i.id === "my-salon")
  assert.equal(mySalon?.href, "/")
})

test("every settings entry either links somewhere or is marked coming soon", () => {
  for (const item of SETTINGS_ITEMS) {
    assert.ok(
      Boolean(item.href) !== Boolean(item.comingSoon),
      `${item.id} must have exactly one of href / comingSoon`,
    )
  }
})

// ─── i18n copy contract ───────────────────────────────────────────────────────

test("every settings entry has non-empty en + es copy", () => {
  const en = getUIMessages("en").settings.accountCenter.items
  const es = getUIMessages("es").settings.accountCenter.items
  for (const item of SETTINGS_ITEMS) {
    for (const [locale, catalog] of [["en", en], ["es", es]] as const) {
      const copy = catalog[item.catalogKey]
      assert.ok(copy?.label?.length, `${locale}.${item.catalogKey}.label missing`)
      assert.ok(copy?.description?.length, `${locale}.${item.catalogKey}.description missing`)
    }
  }
})

test("business profile copy is localized (en/es differ and es is Spanish)", () => {
  const en = getUIMessages("en").settings.accountCenter.items.businessProfile
  const es = getUIMessages("es").settings.accountCenter.items.businessProfile
  assert.equal(en.label, "Business profile")
  assert.equal(es.label, "Perfil del negocio")
})
