/**
 * Ask Finesse i18n — catalog integrity tests.
 *
 * Mirrors the Marketing namespace guarantees (P4.MARKETING-5L):
 * - five REAL catalogs (structural parity, no empty strings, no English
 *   copies masquerading as translations);
 * - no `Clienta/Clientas` anywhere (banned by product decision);
 * - counted prompts are functions that actually carry the count;
 * - every page key has a label, an intro and at least one static suggestion
 *   in every language;
 * - external invalid locales fall back to English, official codes never do.
 */

import test from "node:test"
import assert from "node:assert/strict"

import { SUPPORTED_LOCALES } from "@core/i18n"
import {
  FINESSE_ASSISTANT_MESSAGES,
  getFinesseAssistantMessages,
  type FinesseAssistantMessages,
} from "./i18n"
import type { FinesseAssistantPageKey } from "./finesse-assistant"

const CATALOGS = SUPPORTED_LOCALES.map((code) => FINESSE_ASSISTANT_MESSAGES[code])

const ALL_PAGES: FinesseAssistantPageKey[] = [
  "my-salon",
  "today",
  "agenda",
  "clients",
  "messages",
  "catalog",
  "marketing",
  "billing",
  "team",
  "settings",
  "other",
]

/** Collect every leaf path of a catalog ("intros.today", "today.fillGaps.prompt()"…). */
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

/** Collect every plain string leaf (path + value), skipping functions. */
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

test("all five official locales ship an assistant catalog", () => {
  assert.deepEqual(Object.keys(FINESSE_ASSISTANT_MESSAGES).sort(), [...SUPPORTED_LOCALES].sort())
  for (const code of SUPPORTED_LOCALES) {
    assert.equal(FINESSE_ASSISTANT_MESSAGES[code].locale, code)
  }
})

test("catalogs are structurally identical (typed parity, no missing keys)", () => {
  const reference = leafPaths(FINESSE_ASSISTANT_MESSAGES.en).sort()
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
  const en = FINESSE_ASSISTANT_MESSAGES.en
  // Representative fields that MUST differ from English in every other locale
  // (brand strings like panelTitle/panelSubtitle are constant by design).
  const probes: Array<(m: FinesseAssistantMessages) => string> = [
    (m) => m.launcherLabel,
    (m) => m.intros["my-salon"],
    (m) => m.honestyNote,
    (m) => m.unavailable.description,
    (m) => m.staticSuggestions["my-salon"][0],
    (m) => m.dynamicSuggestions.overview.earningsDrop.prompt,
    (m) => m.dynamicSuggestions.today.fillGaps.prompt(2),
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

test("counted prompts carry the observed count in every language", () => {
  for (const catalog of CATALOGS) {
    const d = catalog.dynamicSuggestions
    const counted = [
      d.today.fillGaps.prompt,
      d.today.firstMove.prompt,
      d.agenda.fillTomorrow.prompt,
      d.agenda.pendingConfirmation.prompt,
      d.clients.overdueRebooking.prompt,
      d.messages.needReply.prompt,
      d.marketing.reviewReady.prompt,
    ]
    for (const phrase of counted) {
      const out = phrase(7)
      assert.ok(out.trim().length > 0, `${catalog.locale}: empty counted prompt`)
      assert.ok(out.includes("7"), `${catalog.locale}: "${out}" must include the count`)
    }
  }
})

test("every page key has a label, an intro and static suggestions everywhere", () => {
  for (const catalog of CATALOGS) {
    for (const page of ALL_PAGES) {
      assert.ok(catalog.pageLabels[page]?.trim().length > 0, `${catalog.locale}: label for ${page}`)
      assert.ok(catalog.intros[page]?.trim().length > 0, `${catalog.locale}: intro for ${page}`)
      assert.ok(
        catalog.staticSuggestions[page]?.length >= 1,
        `${catalog.locale}: static suggestions for ${page}`,
      )
    }
    // Page-awareness: My Salon and Agenda must not share the same prompts.
    assert.notDeepEqual(catalog.staticSuggestions["my-salon"], catalog.staticSuggestions.agenda)
  }
})

test("getFinesseAssistantMessages: official codes resolve natively, junk falls back to en", () => {
  for (const code of SUPPORTED_LOCALES) {
    assert.equal(getFinesseAssistantMessages(code).locale, code)
  }
  // Regional variants keep their base catalog.
  assert.equal(getFinesseAssistantMessages("es-MX").locale, "es")
  assert.equal(getFinesseAssistantMessages("de-CH").locale, "de")
  // Only invalid EXTERNAL locales reach the English fallback.
  assert.equal(getFinesseAssistantMessages("xx").locale, "en")
  assert.equal(getFinesseAssistantMessages(null).locale, "en")
  assert.equal(getFinesseAssistantMessages(undefined).locale, "en")
})
