import assert from "node:assert/strict"
import test from "node:test"

import { getUIMessages, getNamespace } from "./ui"
// Legacy barrel must keep exposing its full API alongside the new UI layer.
import {
  parseLocale,
  getTranslations,
  isValidLocale,
  resolveLocaleFromConfig,
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
} from "./index"

// ─── getUIMessages: shape ──────────────────────────────────────────────────────

test("getUIMessages: en returns common and nav namespaces", () => {
  const t = getUIMessages("en")
  assert.equal(typeof t.common, "object")
  assert.equal(typeof t.nav, "object")
  assert.equal(t.common.saveChanges, "Save changes")
  assert.equal(t.nav.today, "Today")
})

test("getUIMessages: english contains no empty strings (deep)", () => {
  const walk = (value: unknown, path: string) => {
    if (typeof value === "string") {
      assert.ok(value.length > 0, `empty string at ${path}`)
      return
    }
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`)
    }
  }
  walk(getUIMessages("en"), "en")
})

// ─── getUIMessages: fallback ───────────────────────────────────────────────────

test("getUIMessages: null/undefined → English", () => {
  assert.equal(getUIMessages(null), getUIMessages("en"))
  assert.equal(getUIMessages(undefined), getUIMessages("en"))
})

test("getUIMessages: unknown locale (fr/xyz) → English", () => {
  assert.equal(getUIMessages("fr"), getUIMessages("en"))
  assert.equal(getUIMessages("xyz"), getUIMessages("en"))
})

test("getUIMessages: en-GB resolves English", () => {
  assert.equal(getUIMessages("en-GB"), getUIMessages("en"))
})

test("getUIMessages: es/es-MX/de/de-CH fall back to English while locale UI messages are not implemented", () => {
  const english = getUIMessages("en")
  assert.equal(getUIMessages("es"), english)
  assert.equal(getUIMessages("es-MX"), english)
  assert.equal(getUIMessages("de"), english)
  assert.equal(getUIMessages("de-CH"), english)
})

// ─── getNamespace ──────────────────────────────────────────────────────────────

test("getNamespace: common matches getUIMessages(...).common", () => {
  assert.equal(getNamespace("en", "common"), getUIMessages("en").common)
})

test("getNamespace: nav matches getUIMessages(...).nav", () => {
  assert.equal(getNamespace("en", "nav"), getUIMessages("en").nav)
})

// ─── legacy API compatibility ──────────────────────────────────────────────────

test("legacy @core/i18n API remains importable and behaves", () => {
  assert.equal(typeof parseLocale, "function")
  assert.equal(typeof getTranslations, "function")
  assert.equal(typeof isValidLocale, "function")
  assert.equal(typeof resolveLocaleFromConfig, "function")
  assert.deepEqual(SUPPORTED_LOCALES, ["en", "es", "de"])
  assert.equal(DEFAULT_LOCALE, "en")
  assert.equal(parseLocale("es-MX"), "es")
  assert.ok(isValidLocale("en"))
  assert.ok(!isValidLocale("fr"))
  assert.equal(getTranslations("de").locale, "de")
  assert.equal(resolveLocaleFromConfig(JSON.stringify({ locale: "es" })), "es")
})
