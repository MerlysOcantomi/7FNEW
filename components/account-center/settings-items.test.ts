import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

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
  // Approved entity labels (SETTINGS-BUSINESS-PROFILE-01): the structural
  // entry shows the general concept in every vertical — never "Mi Salón".
  assert.equal(en.label, "Business Profile")
  assert.equal(es.label, "Perfil del negocio")
})

// ─── Canonical entity contract (SETTINGS-BUSINESS-PROFILE-01) ────────────────

test("the /business-profile page title matches the settings entry label per locale", () => {
  for (const locale of ["en", "es"] as const) {
    const settings = getUIMessages(locale).settings
    assert.equal(
      settings.businessProfilePage.title,
      settings.accountCenter.items.businessProfile.label,
      `${locale}: page header and settings entry must name the same entity`,
    )
  }
})

test("business profile page chrome is localized (en/es differ, no Spanish leaks into en)", () => {
  const en = getUIMessages("en").settings.businessProfilePage
  const es = getUIMessages("es").settings.businessProfilePage
  assert.equal(en.title, "Business Profile")
  assert.equal(es.title, "Perfil del negocio")
  assert.notEqual(en.description, es.description)
  assert.notEqual(en.loading, es.loading)
  assert.ok(es.description.length > 0 && es.loading.length > 0)
})

// ─── Full-form localization (BUSINESS-PROFILE-I18N-02) ───────────────────────

const FIELD_KEYS = [
  "businessName",
  "businessDescription",
  "services",
  "tone",
  "languages",
  "region",
  "workingHours",
  "attentionRules",
] as const

test("every business profile form string is present and non-empty in en and es", () => {
  for (const locale of ["en", "es"] as const) {
    const page = getUIMessages(locale).settings.businessProfilePage
    for (const scalar of [
      page.title, page.description, page.loading, page.loadError, page.saveError,
      page.save, page.saving, page.saved, page.add,
      page.operatingContext.title, page.operatingContext.description,
    ]) {
      assert.ok(scalar.length > 0, `${locale}: empty page-level string`)
    }
    for (const key of FIELD_KEYS) {
      const field = page.fields[key]
      assert.ok(field.label.length > 0, `${locale}.${key}.label empty`)
      assert.ok(field.placeholder.length > 0, `${locale}.${key}.placeholder empty`)
      const hint = typeof field.hint === "function" ? field.hint(20) : field.hint
      assert.ok(hint.length > 0, `${locale}.${key}.hint empty`)
    }
  }
})

test("es form copy matches the approved translations", () => {
  const page = getUIMessages("es").settings.businessProfilePage
  assert.equal(page.fields.businessName.label, "Nombre del negocio")
  assert.equal(page.fields.businessName.hint, "Cómo conocen tus clientes tu negocio")
  assert.equal(page.fields.businessDescription.label, "Descripción")
  assert.equal(page.fields.services.label, "Servicios")
  assert.equal(page.fields.services.placeholder, "Añadir un servicio...")
  assert.equal(page.fields.tone.label, "Tono")
  assert.equal(page.fields.tone.hint, "Cómo deben comunicarse los agentes en nombre de tu negocio")
  assert.equal(page.fields.languages.label, "Idiomas")
  assert.equal(page.fields.languages.placeholder, "Añadir un idioma...")
  assert.equal(page.fields.region.label, "Región o mercado")
  assert.equal(page.fields.workingHours.label, "Horario de atención")
  assert.equal(page.fields.attentionRules.label, "Reglas de atención")
  assert.equal(page.fields.attentionRules.placeholder, "Añadir una regla...")
  assert.equal(page.operatingContext.title, "Contexto operativo")
  assert.equal(page.add, "Añadir")
  assert.equal(
    page.description,
    "Define la identidad de tu negocio. Este contexto ayuda a Fanny y a otros agentes a entender quién eres y qué ofreces.",
  )
})

test("en form copy keeps the canonical English source", () => {
  const page = getUIMessages("en").settings.businessProfilePage
  assert.equal(page.fields.businessName.label, "Business Name")
  assert.equal(page.fields.services.hint(20), "What your business offers (max 20)")
  assert.equal(page.fields.services.placeholder, "Add a service...")
  assert.equal(page.operatingContext.title, "Operating context")
  assert.equal(page.add, "Add")
  assert.equal(page.save, "Save Profile")
})

test("placeholders, buttons and notices all change with the locale", () => {
  const en = getUIMessages("en").settings.businessProfilePage
  const es = getUIMessages("es").settings.businessProfilePage
  for (const key of FIELD_KEYS) {
    assert.notEqual(en.fields[key].placeholder, es.fields[key].placeholder, `${key}.placeholder`)
    assert.notEqual(en.fields[key].label, es.fields[key].label, `${key}.label`)
  }
  assert.notEqual(en.add, es.add)
  assert.notEqual(en.save, es.save)
  assert.notEqual(en.saving, es.saving)
  assert.notEqual(en.saved, es.saved)
  assert.notEqual(en.loadError, es.loadError)
  assert.notEqual(en.saveError, es.saveError)
  assert.notEqual(en.loading, es.loading)
})

test("user-entered values pass through remove labels untranslated (data is never localized)", () => {
  for (const locale of ["en", "es"] as const) {
    const fields = getUIMessages(locale).settings.businessProfilePage.fields
    assert.ok(fields.services.removeAria("Balayage Premium").includes("Balayage Premium"))
    assert.ok(fields.languages.removeAria("Português").includes("Português"))
    assert.ok(fields.attentionRules.removeAria("VIP primero").includes("VIP primero"))
  }
})

test("counted hints embed the runtime maximum", () => {
  for (const locale of ["en", "es"] as const) {
    const fields = getUIMessages(locale).settings.businessProfilePage.fields
    assert.ok(fields.services.hint(20).includes("20"))
    assert.ok(fields.attentionRules.hint(20).includes("20"))
  }
})

test("the page source keeps no hardcoded visible copy", () => {
  const source = readFileSync(
    join(process.cwd(), "app", "business-profile", "page.tsx"),
    "utf8",
  )
  // Former literals — every one must now resolve from the catalog.
  const forbidden = [
    '"Business Profile"', '"Business Name"', '"Description"', '"Services"',
    '"Tone"', '"Languages"', '"Region / market"', '"Working hours"',
    '"Attention rules"', "Add a service", "Add a language", "Add a rule",
    "Save Profile", "Saving...", '> Add<', "Operating context",
    "Could not load business profile", "Could not save profile",
    "aria-label={`Remove", "How your business is known",
  ]
  for (const literal of forbidden) {
    assert.ok(!source.includes(literal), `hardcoded copy still present: ${literal}`)
  }
})

test("no locale ever names the Business Profile entity 'Mi Salón'", () => {
  for (const locale of ["en", "es"] as const) {
    const settings = getUIMessages(locale).settings
    const labels = [
      settings.accountCenter.items.businessProfile.label,
      settings.businessProfilePage.title,
    ]
    for (const label of labels) {
      assert.ok(
        !/mi salón/i.test(label),
        `${locale}: "${label}" must not present the entity as the Beauty overview`,
      )
    }
  }
})
