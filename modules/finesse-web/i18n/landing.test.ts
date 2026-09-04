import assert from "node:assert/strict"
import test from "node:test"
import { getFinesseLandingMessages } from "./index"
import { en } from "./en"
import { es } from "./es"

function shape(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(shape)
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, shape(v)]))
  }
  return typeof value
}

test("landing catalogs: es and en expose the same structure; other locales fall back to English", () => {
  assert.deepEqual(shape({ ...es, locale: "x" }), shape({ ...en, locale: "x" }))
  assert.equal(getFinesseLandingMessages("es").locale, "es")
  assert.equal(getFinesseLandingMessages("es-MX").locale, "es")
  assert.equal(getFinesseLandingMessages("en").locale, "en")
  assert.equal(getFinesseLandingMessages("de").locale, "en")
  assert.equal(getFinesseLandingMessages("fr-CH").locale, "en")
  assert.equal(getFinesseLandingMessages(null).locale, "en")
  assert.equal(getFinesseLandingMessages("nonsense").locale, "en")
})

test("brand rules: Finesse is the brand; SevenF only as the footer credit; no 'SevenF Beauty' / 'by SevenF' in hero", () => {
  for (const c of [es, en]) {
    const json = JSON.stringify(c)
    assert.ok(!/SevenF Beauty|7F Beauty/.test(json), "no SevenF/7F Beauty")
    assert.ok(!/Finesse,? by SevenF/.test(json), "no 'Finesse by SevenF' anywhere on the landing")
    assert.equal(c.footer.poweredBy, "Powered by SevenF")
    const withoutFooter = JSON.stringify({ ...c, footer: null })
    assert.ok(!/SevenF|Sevenef|7F/.test(withoutFooter), "SevenF appears only in the footer credit")
    assert.equal(c.brand, "Finesse")
    assert.match(c.hero.cta, /Finesse/)
  }
})

test("honesty rules: no fake proof, no unbuilt integrations, no prices, no internal agents", () => {
  for (const c of [es, en]) {
    const json = JSON.stringify(c)
    assert.ok(!/Fresha|Booksy|Treatwell|Recovery|migraci|migrat/i.test(json), "no unbuilt migration/recovery claims")
    assert.ok(!/€|\$|precio|pricing|\/mes|per month/i.test(json), "no prices")
    assert.ok(!/(\d[\d.,]*\s*\+?\s*(usuari|users|salones|salons|clients?\b.*(confían|trust)))/i.test(json), "no user counts")
    assert.ok(!/★|estrellas|\bstars\b|testimon|opiniones|reseñ|\breviews\b|valoraci/i.test(json), "no ratings/testimonials")
    assert.ok(!/Fanny|Freya|Fiona|Felix|Forte|Fathom|Francis/.test(json), "no internal agents")
    assert.ok(!/Smart Inbox|Enterprise|enterprise/.test(json), "no product/architecture jargon")
    assert.ok(!/clienta/i.test(json), "client-neutral noun (repo rule)")
    assert.ok(c.messages.previewLabel.length > 0, "inbox visual carries a discreet preview label")
    assert.ok(!/Probar|Try|trial|prueba/i.test(c.hero.cta + c.nav.cta + c.finalCta.cta), "CTA never promises a trial")
  }
  // The inbox example never claims a live transport.
  assert.ok(!/ya funciona|conectado|integraci/i.test(JSON.stringify(es.messages)))
})
