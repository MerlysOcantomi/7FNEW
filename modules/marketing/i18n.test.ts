/**
 * Finesse Marketing i18n — catalog integrity tests (P4.MARKETING-5L).
 *
 * Guards the mission's non-negotiables:
 * - five REAL catalogs (structural parity, no empty strings, no English
 *   copies masquerading as translations);
 * - no `Clienta/Clientas` anywhere (banned by product decision);
 * - counted phrases are functions that actually inflect;
 * - the honesty layer (preview chip + tooltip) exists in every language;
 * - external invalid locales fall back to English, official codes never do.
 */

import test from "node:test"
import assert from "node:assert/strict"

import { SUPPORTED_LOCALES } from "@core/i18n"
import {
  MARKETING_MESSAGES,
  getBeautyMarketingMessages,
  type BeautyMarketingMessages,
} from "./i18n"

const CATALOGS = SUPPORTED_LOCALES.map((code) => MARKETING_MESSAGES[code])

/** Collect every leaf path of a catalog ("header.title", "a11y.workPhotoAlt()"…). */
function leafPaths(value: unknown, prefix = ""): string[] {
  if (typeof value === "function") return [`${prefix}()`]
  if (Array.isArray(value)) return [prefix]
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) =>
      leafPaths(v, prefix ? `${prefix}.${k}` : k),
    )
  }
  return [prefix]
}

/** Collect every plain string leaf (path + value), skipping functions/arrays. */
function stringLeaves(value: unknown, prefix = ""): Array<[string, string]> {
  if (typeof value === "string") return [[prefix, value]]
  if (Array.isArray(value)) return value.flatMap((v, i) => stringLeaves(v, `${prefix}[${i}]`))
  if (value !== null && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) =>
      stringLeaves(v, prefix ? `${prefix}.${k}` : k),
    )
  }
  return []
}

test("all five official locales ship a Marketing catalog", () => {
  assert.deepEqual(Object.keys(MARKETING_MESSAGES).sort(), [...SUPPORTED_LOCALES].sort())
  for (const code of SUPPORTED_LOCALES) {
    assert.equal(MARKETING_MESSAGES[code].locale, code)
  }
})

test("catalogs are structurally identical (typed parity, no missing keys)", () => {
  const reference = leafPaths(MARKETING_MESSAGES.en).sort()
  for (const catalog of CATALOGS) {
    assert.deepEqual(
      leafPaths(catalog).sort(),
      reference,
      `catalog ${catalog.locale} diverges structurally from en`,
    )
  }
})

test("no catalog contains empty strings", () => {
  for (const catalog of CATALOGS) {
    for (const [path, value] of stringLeaves(catalog)) {
      assert.ok(value.trim().length > 0, `${catalog.locale}:${path} is empty`)
    }
  }
})

test("non-English catalogs are real translations, not English copies", () => {
  const en = MARKETING_MESSAGES.en
  // Representative fields that MUST differ from English in every other locale.
  const probes: Array<(m: BeautyMarketingMessages) => string> = [
    (m) => m.header.description,
    (m) => m.featured.channelPendingNote,
    (m) => m.upload.successToast,
    (m) => m.preview.chip,
    (m) => m.demo.freyaMessage,
    (m) => m.draftTemplates.caption({ subject: "Test", clientName: null, beforeAfter: false }),
  ]
  for (const catalog of CATALOGS) {
    if (catalog.locale === "en") continue
    for (const probe of probes) {
      assert.notEqual(
        probe(catalog),
        probe(en),
        `catalog ${catalog.locale} copies English content`,
      )
    }
  }
})

test("Clienta/Clientas is banned from every catalog", () => {
  for (const catalog of CATALOGS) {
    for (const [path, value] of stringLeaves(catalog)) {
      assert.ok(
        !/clienta/i.test(value),
        `${catalog.locale}:${path} contains a banned "Clienta" variant: "${value}"`,
      )
    }
  }
})

test("counted phrases inflect and carry the count", () => {
  for (const catalog of CATALOGS) {
    const counted = [
      catalog.header.readyPhotos,
      catalog.header.scheduledPosts,
      catalog.header.activeCampaigns,
      catalog.freya.readyForReview,
      catalog.campaigns.activeCountHint,
    ]
    for (const phrase of counted) {
      const one = phrase(1)
      const many = phrase(3)
      assert.ok(one.trim().length > 0 && many.trim().length > 0)
      assert.notEqual(one, many, `${catalog.locale}: singular and plural are identical`)
      assert.ok(many.includes("3"), `${catalog.locale}: "${many}" must include the count`)
    }
  }
})

test("campaign transition toasts are full sentences for every status", () => {
  const statuses = [
    "sugerida",
    "aprobada",
    "programada",
    "activa",
    "pausada",
    "finalizada",
  ] as const
  for (const catalog of CATALOGS) {
    for (const status of statuses) {
      const toast = catalog.campaigns.transitionToast(status)
      assert.ok(toast.trim().length > 0, `${catalog.locale}: empty toast for ${status}`)
    }
  }
})

test("the honesty layer (preview chip + tooltip) exists in every language", () => {
  const expectedChips: Record<string, string> = {
    es: "Vista previa · datos de ejemplo",
    en: "Preview · sample data",
    de: "Vorschau · Beispieldaten",
    fr: "Aperçu · données d’exemple",
    it: "Anteprima · dati di esempio",
  }
  for (const catalog of CATALOGS) {
    assert.equal(catalog.preview.chip, expectedChips[catalog.locale])
    assert.ok(catalog.preview.tooltip.length > 0)
  }
})

test("no ad-tech jargon in any locale's campaign copy", () => {
  for (const catalog of CATALOGS) {
    const text = JSON.stringify(catalog.campaigns).toLowerCase()
    for (const banned of ["funnel", "roas"]) {
      assert.ok(!text.includes(banned), `${catalog.locale} campaigns copy includes "${banned}"`)
    }
  }
})

test("getBeautyMarketingMessages: official codes resolve natively, junk falls back to en", () => {
  for (const code of SUPPORTED_LOCALES) {
    assert.equal(getBeautyMarketingMessages(code).locale, code)
  }
  // Regional variants keep their base catalog.
  assert.equal(getBeautyMarketingMessages("es-MX").locale, "es")
  assert.equal(getBeautyMarketingMessages("de-CH").locale, "de")
  // Only invalid EXTERNAL locales reach the English fallback.
  assert.equal(getBeautyMarketingMessages("xx").locale, "en")
  assert.equal(getBeautyMarketingMessages(null).locale, "en")
  assert.equal(getBeautyMarketingMessages(undefined).locale, "en")
})
