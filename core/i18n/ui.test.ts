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

test("getUIMessages: english and spanish contain no empty strings (deep)", () => {
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
  walk(getUIMessages("es"), "es")
})

// ─── en/es catalog parity (P4.1) ───────────────────────────────────────────────

/**
 * Runtime structural parity: every key path must exist in BOTH catalogs with
 * the same value kind (string vs function). TypeScript already enforces the
 * shared interface; this guard additionally catches any future cast that
 * would silently hide a missing or mistyped key.
 */
function catalogShape(value: unknown, path: string, out: string[]): string[] {
  if (typeof value === "string") out.push(`${path}:string`)
  else if (typeof value === "function") out.push(`${path}:function`)
  else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) catalogShape(v, `${path}.${k}`, out)
  } else {
    out.push(`${path}:INVALID(${typeof value})`)
  }
  return out
}

test("catalog parity: en and es expose identical key structure and value kinds", () => {
  const enShape = catalogShape(getUIMessages("en"), "$", []).sort()
  const esShape = catalogShape(getUIMessages("es"), "$", []).sort()
  assert.deepEqual(esShape, enShape)
  assert.ok(enShape.length > 0)
  assert.ok(!enShape.some((entry) => entry.includes("INVALID")))
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

test("getUIMessages: es/es-MX resolve the real Spanish catalog (P4.1)", () => {
  const spanish = getUIMessages("es")
  assert.notEqual(spanish, getUIMessages("en"))
  assert.equal(getUIMessages("es-MX"), spanish)
  assert.equal(spanish.settings.language.appLabel, "Idioma de la aplicación")
  assert.equal(spanish.settings.accountCenter.languageSection, "Idioma")
  assert.equal(spanish.settings.language.useWorkspaceLanguage, "Usar el idioma del negocio")
  assert.equal(spanish.common.saveChanges, "Guardar cambios")
})

test("getUIMessages: de/de-CH still fall back to English until German content lands", () => {
  const english = getUIMessages("en")
  assert.equal(getUIMessages("de"), english)
  assert.equal(getUIMessages("de-CH"), english)
})

// ─── namespace registry (P2) ───────────────────────────────────────────────────

test("getUIMessages: exposes exactly the nine canonical namespaces", () => {
  assert.deepEqual(Object.keys(getUIMessages("en")).sort(), [
    "billing",
    "calendar",
    "clients",
    "common",
    "globalNew",
    "globalSearch",
    "nav",
    "settings",
    "today",
  ])
})

test("nav/globalSearch/globalNew/today: real Spanish shell strings (P4.2)", () => {
  const es = getUIMessages("es")
  assert.equal(es.nav.today, "Hoy")
  assert.equal(es.nav.inbox, "Bandeja de entrada")
  assert.equal(es.nav.more, "Más")
  assert.equal(es.nav.new, "Nuevo")
  assert.equal(es.nav.search, "Buscar")
  assert.equal(es.nav.collapseSidebar, "Contraer la navegación")
  assert.equal(es.globalNew.subtitle, "Crea en todo tu workspace")
  assert.equal(es.globalSearch.quickNavigation, "Navegación rápida")
  assert.equal(es.globalSearch.footer.close, "cerrar")
  assert.equal(es.today.title, "Hoy")
  assert.equal(es.today.chrome.openFull, "Abrir Hoy completo")
  // Entity fallbacks stay GENERIC Spanish — never a vertical's noun.
  assert.equal(es.nav.clients, "Clientes")
  assert.equal(es.nav.calendar, "Calendario")
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
  // es resolves from the real Spanish catalog (P4.1); de still falls back to English.
  assert.equal(getNamespace("es", "today"), getUIMessages("es").today)
  assert.equal(getNamespace("es", "settings"), getUIMessages("es").settings)
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
