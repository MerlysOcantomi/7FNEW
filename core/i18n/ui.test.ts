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

// ─── namespace registry (P2) ───────────────────────────────────────────────────

test("getUIMessages: exposes exactly the seven canonical namespaces", () => {
  assert.deepEqual(Object.keys(getUIMessages("en")).sort(), [
    "billing",
    "calendar",
    "clients",
    "common",
    "nav",
    "settings",
    "today",
  ])
})

test("new namespaces: representative English strings are present", () => {
  const t = getUIMessages("en")
  assert.equal(t.settings.title, "Settings")
  assert.equal(t.settings.language.appLabel, "App language")
  assert.equal(t.today.title, "Today")
  assert.equal(t.clients.newButton, "New client")
  assert.equal(t.calendar.empty, "No events scheduled.")
  assert.equal(t.billing.newInvoice, "New invoice")
})

test("new namespaces: nested semantic objects (empty, language)", () => {
  const t = getUIMessages("en")
  assert.equal(typeof t.settings.language, "object")
  assert.equal(typeof t.today.empty, "object")
  assert.equal(t.today.empty.title, "Nothing for today yet")
  assert.equal(t.clients.empty.body, "Add your first client to get started.")
})

test("clients: typed functions interpolate vertical vocabulary and counts", () => {
  const clients = getNamespace("en", "clients")
  // The noun comes from the vocabulary resolver as data — never from a key.
  assert.equal(
    clients.searchPlaceholder({ clientPlural: "clientas" }),
    "Search clientas, company, or email…",
  )
  // Basic pluralization: the vocabulary noun carries the plural form.
  assert.equal(clients.count(1, "client"), "1 client")
  assert.equal(clients.count(3, "clients"), "3 clients")
  assert.equal(clients.count(5, "clientas"), "5 clientas")
})

// ─── getNamespace ──────────────────────────────────────────────────────────────

test("getNamespace: common matches getUIMessages(...).common", () => {
  assert.equal(getNamespace("en", "common"), getUIMessages("en").common)
})

test("getNamespace: nav matches getUIMessages(...).nav", () => {
  assert.equal(getNamespace("en", "nav"), getUIMessages("en").nav)
})

test("getNamespace: resolves the new namespaces with per-namespace inference", () => {
  assert.equal(getNamespace("en", "settings"), getUIMessages("en").settings)
  assert.equal(getNamespace("en", "billing"), getUIMessages("en").billing)
  // es/de have no real content yet: namespace resolution falls back to English.
  assert.equal(getNamespace("es", "today"), getNamespace("en", "today"))
  assert.equal(getNamespace("de", "clients"), getNamespace("en", "clients"))
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

test("legacy TranslationSet did not absorb the UI namespaces", () => {
  const legacy = getTranslations("en") as unknown as Record<string, unknown>
  for (const ns of ["settings", "today", "clients", "calendar", "billing"]) {
    assert.ok(!(ns in legacy), `legacy TranslationSet must not gain "${ns}"`)
  }
})
