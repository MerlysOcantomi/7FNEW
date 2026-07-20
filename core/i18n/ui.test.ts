import assert from "node:assert/strict"
import test from "node:test"

import { getUIMessages, getNamespace, UI_NAMESPACE_COVERAGE, localeHasPendingCoverage } from "./ui"
import { LOCALE_REGISTRY, SUPPORTED_LOCALES as REGISTRY_LOCALES, FALLBACK_LOCALE, type SupportedLocale } from "./types"
import { LOCALE_DISPLAY_NAMES } from "./locale"
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

test("getUIMessages: unknown locale (xyz/pt) → English", () => {
  assert.equal(getUIMessages("xyz"), getUIMessages("en"))
  assert.equal(getUIMessages("pt"), getUIMessages("en"))
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
  assert.equal(spanish.settings.language.useDeviceLanguage, "Usar el idioma de mi dispositivo")
  assert.equal(spanish.common.saveChanges, "Guardar cambios")
})

test("getUIMessages: de/fr/it are official with FULL per-namespace English fallback", () => {
  const english = getUIMessages("en")
  for (const code of ["de", "fr", "it"] as const) {
    const catalog = getUIMessages(code)
    // Composed object (not the same reference) whose every namespace is the
    // ENGLISH object — an explicit fallback, never an English copy.
    for (const ns of Object.keys(english) as Array<keyof typeof english>) {
      assert.equal(catalog[ns], english[ns], `${code}.${ns} must reference the English namespace`)
    }
  }
  assert.equal(getUIMessages("de-CH").nav, english.nav)
  assert.equal(getUIMessages("fr-CH").nav, english.nav)
  assert.equal(getUIMessages("it-CH").nav, english.nav)
})

// ─── locale registry (§5/§16, P4.CORE-5L) ──────────────────────────────────────

test("registry: exactly the five official locales with complete metadata", () => {
  assert.deepEqual(REGISTRY_LOCALES, ["es", "en", "de", "fr", "it"])
  const expectedNames: Record<SupportedLocale, string> = {
    es: "Español", en: "English", de: "Deutsch", fr: "Français", it: "Italiano",
  }
  const expectedIntl: Record<SupportedLocale, string> = {
    es: "es-ES", en: "en-GB", de: "de-DE", fr: "fr-FR", it: "it-IT",
  }
  for (const code of REGISTRY_LOCALES) {
    const def = LOCALE_REGISTRY[code]
    assert.equal(def.code, code)
    assert.equal(def.nativeName, expectedNames[code])
    assert.equal(LOCALE_DISPLAY_NAMES[code], expectedNames[code])
    assert.equal(def.direction, "ltr")
    assert.equal(def.intlLocale, expectedIntl[code])
  }
})

test("registry: fallbacks are valid, acyclic and terminate at English", () => {
  for (const code of REGISTRY_LOCALES) {
    const def = LOCALE_REGISTRY[code]
    // No locale falls back to itself.
    assert.notEqual(def.fallback, code)
    // Walk the chain — must terminate (no cycles) at the terminal fallback.
    const seen = new Set<SupportedLocale>([code])
    let cursor = def.fallback
    while (cursor !== null) {
      assert.ok(!seen.has(cursor), `fallback cycle at ${cursor}`)
      seen.add(cursor)
      cursor = LOCALE_REGISTRY[cursor].fallback
    }
  }
  assert.equal(LOCALE_REGISTRY[FALLBACK_LOCALE].fallback, null)
})

test("normalization: regional and malformed tags (§6 matrix)", () => {
  assert.equal(parseLocale("es"), "es")
  assert.equal(parseLocale("es-ES"), "es")
  assert.equal(parseLocale("es_MX"), "es")
  assert.equal(parseLocale("EN-gb"), "en")
  assert.equal(parseLocale("de-CH"), "de")
  assert.equal(parseLocale("fr-CH"), "fr")
  assert.equal(parseLocale("it-IT"), "it")
  assert.equal(parseLocale("it-CH"), "it")
  assert.equal(parseLocale("zz-ZZ"), "en")
  assert.equal(parseLocale(""), "en")
  assert.equal(parseLocale(null), "en")
  assert.equal(parseLocale(undefined), "en")
})

// ─── coverage matrix (§9/§16) ──────────────────────────────────────────────────

test("coverage: derived matrix matches the real composed catalogs", () => {
  const english = getUIMessages("en")
  for (const code of REGISTRY_LOCALES) {
    const catalog = getUIMessages(code)
    for (const ns of Object.keys(english) as Array<keyof typeof english>) {
      const declared = UI_NAMESPACE_COVERAGE[code][ns]
      const actuallyEnglish = catalog[ns] === english[ns]
      if (code === "en") assert.equal(declared, "native")
      else if (declared === "native") assert.ok(!actuallyEnglish, `${code}.${ns} declared native but serves English`)
      else assert.ok(actuallyEnglish, `${code}.${ns} declared fallback but is not the English object`)
    }
  }
})

test("coverage: expected snapshot — es complete, de/fr/it pending", () => {
  assert.equal(UI_NAMESPACE_COVERAGE.es.clients, "native")
  assert.equal(UI_NAMESPACE_COVERAGE.es.nav, "native")
  assert.equal(UI_NAMESPACE_COVERAGE.es.calendar, "native")
  assert.equal(UI_NAMESPACE_COVERAGE.es.inbox, "native")
  assert.equal(UI_NAMESPACE_COVERAGE.es.billing, "native")
  assert.equal(UI_NAMESPACE_COVERAGE.es.services, "native")
  assert.equal(UI_NAMESPACE_COVERAGE.es.team, "native")
  // Every registered namespace has a real Spanish contribution now.
  assert.ok(!localeHasPendingCoverage("es"))
  assert.ok(!localeHasPendingCoverage("en"))
  for (const code of ["de", "fr", "it"] as const) {
    assert.ok(localeHasPendingCoverage(code))
    for (const status of Object.values(UI_NAMESPACE_COVERAGE[code])) {
      assert.equal(status, "fallback-en")
    }
  }
})

test("getUIMessages: complete catalogs with no empty strings for ALL five locales", () => {
  const walk = (value: unknown, path: string) => {
    if (typeof value === "string") {
      assert.ok(value.length > 0, `empty string at ${path}`)
      return
    }
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`)
    }
  }
  for (const code of REGISTRY_LOCALES) walk(getUIMessages(code), code)
})

// ─── namespace registry (P2) ───────────────────────────────────────────────────

test("getUIMessages: exposes exactly the canonical namespaces", () => {
  assert.deepEqual(Object.keys(getUIMessages("en")).sort(), [
    "agents",
    "billing",
    "calendar",
    "clients",
    "common",
    "globalNew",
    "globalSearch",
    "inbox",
    "nav",
    "services",
    "settings",
    "statuses",
    "team",
    "today",
    "voice",
  ])
})

test("inbox: representative English shell strings with typed count functions", () => {
  const en = getNamespace("en", "inbox")
  assert.equal(en.toolbar.workFilters.needsAttention, "Needs attention")
  assert.equal(en.toolbar.priorities.any, "Any priority")
  assert.equal(en.toolbar.filterPlaceholder, "Filter inbox...")
  assert.equal(en.list.empty.noResultsTitle, "No results")
  assert.equal(en.list.loadMore, "Load more conversations")
  assert.equal(en.list.item.messageCount(1), "1 message")
  assert.equal(en.list.item.messageCount(3), "3 messages")
  assert.equal(en.thread.emailPosition(2, 5), "Email 2 of 5")
  assert.equal(en.dialogs.assign.title, "Assign owner")
  assert.equal(en.channelTitle("WhatsApp"), "Channel: WhatsApp")
})

test("inbox es: real Spanish shell strings (tú form, neutral) with typed count functions", () => {
  const es = getNamespace("es", "inbox")
  const en = getNamespace("en", "inbox")
  assert.notEqual(es, en)
  assert.equal(es.toolbar.workFilters.needsAttention, "Requiere atención")
  assert.equal(es.toolbar.priorities.any, "Cualquier prioridad")
  assert.equal(es.toolbar.allChannels, "Todos los canales")
  assert.equal(es.list.empty.mineTitle, "Nada asignado a ti")
  assert.equal(es.list.empty.mineBody, "Ahora mismo no tienes conversaciones asignadas.")
  assert.equal(es.list.meta.pendingDecisions(1), "1 decisión pendiente")
  assert.equal(es.list.meta.pendingDecisions(2), "2 decisiones pendientes")
  assert.equal(es.thread.emptyTitle, "Selecciona una conversación")
  assert.equal(es.banners.sync.andMore(2), "… y 2 más.")
  assert.equal(es.dialogs.assign.title, "Asignar responsable")
  // Brand/product names stay identical across locales but come from the catalog.
  assert.equal(es.thread.email, en.thread.email)
  assert.equal(es.channelTitle("WhatsApp"), "Canal: WhatsApp")
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
  assert.equal(t.clients.list.newButton({ client: "client" }), "New client")
  assert.equal(t.calendar.dayView.emptyTitle, "No events this day")
  assert.equal(t.calendar.views.day, "Day")
  assert.equal(t.calendar.eventTypes.reunion, "Meeting")
  assert.equal(t.billing.newInvoice, "New invoice")
})

test("billing: representative English strings with typed count/interpolation functions", () => {
  const en = getNamespace("en", "billing")
  assert.equal(en.eyebrow, "Revenue")
  assert.equal(en.invoices, "Invoices")
  assert.equal(en.list.stats.totalBilled, "Total billed")
  assert.equal(en.list.stats.pendingCount(1), "1 pending invoice")
  assert.equal(en.list.stats.pendingCount(3), "3 pending invoices")
  assert.equal(en.list.count(1), "1 invoice")
  assert.equal(
    en.list.overdueBanner.body({ numero: "F-01", client: "Acme", amount: "CHF 12", date: "1 Mar 2026" }),
    "F-01 for Acme (CHF 12) became overdue on 1 Mar 2026.",
  )
  assert.equal(en.detail.invoiceTitle("F-01"), "Invoice F-01")
  assert.equal(en.detail.summary.collectedPct(40), "40% collected")
  assert.equal(en.form.taxWithPct(16), "Tax (16%)")
})

test("billing es: real Spanish strings (tú form) with typed count functions", () => {
  const es = getNamespace("es", "billing")
  const en = getNamespace("en", "billing")
  assert.notEqual(es, en)
  assert.equal(es.eyebrow, "Ingresos")
  assert.equal(es.invoices, "Facturas")
  assert.equal(es.newInvoice, "Nueva factura")
  assert.equal(es.list.stats.paidCount(1), "1 factura pagada")
  assert.equal(es.list.stats.paidCount(2), "2 facturas pagadas")
  assert.equal(es.list.empty.default, "Crea tu primera factura para empezar.")
  assert.equal(
    es.list.overdueBanner.body({ numero: "F-01", client: "Acme", amount: "CHF 12", date: "1 mar 2026" }),
    "F-01 de Acme (CHF 12) venció el 1 mar 2026.",
  )
  assert.equal(es.detail.markAsPaid, "Marcar como pagada")
  assert.equal(es.detail.summary.collectedPct(40), "40% cobrado")
  assert.equal(es.form.errors.numberRequired, "El número de factura es obligatorio")
  // Sample document ids stay identical across locales.
  assert.equal(es.form.numberPlaceholder, en.form.numberPlaceholder)
})

test("services: representative English and Spanish strings with typed counts", () => {
  const en = getNamespace("en", "services")
  const es = getNamespace("es", "services")
  assert.notEqual(es, en)
  assert.equal(en.title, "Services")
  assert.equal(en.list.counts(1, 1), "1 service · 1 active")
  assert.equal(en.list.counts(3, 2), "3 services · 2 active")
  assert.equal(en.list.removeAria("Cut"), "Remove Cut")
  assert.equal(es.title, "Servicios")
  assert.equal(es.add.heading, "Añadir servicio")
  assert.equal(es.list.counts(1, 1), "1 servicio · 1 activo")
  assert.equal(es.list.counts(3, 2), "3 servicios · 2 activos")
  assert.equal(es.errors.load, "No se pudo cargar el catálogo de servicios")
})

test("team: role labels keyed by persisted values, en and es", () => {
  const en = getNamespace("en", "team")
  const es = getNamespace("es", "team")
  assert.notEqual(es, en)
  assert.equal(en.title, "Team")
  assert.equal(en.roles.admin, "Admin")
  assert.equal(en.roles.gerente, "Manager")
  assert.equal(en.roles.miembro, "Member")
  assert.equal(en.deleteDialog.title, "Delete user")
  assert.equal(es.title, "Equipo")
  assert.equal(es.roles.gerente, "Gerente")
  assert.equal(es.roles.miembro, "Miembro")
  assert.equal(
    es.deleteDialog.description("Ana"),
    '¿Seguro que quieres eliminar a "Ana"? Esta acción no se puede deshacer.',
  )
  assert.equal(es.toasts.deleted, "Usuario eliminado")
})

test("calendar es: real Spanish surface strings (Agenda) with typed count functions", () => {
  const es = getNamespace("es", "calendar")
  const en = getNamespace("en", "calendar")
  assert.notEqual(es, en)
  assert.equal(es.title, "Agenda")
  assert.equal(es.today, "Hoy")
  assert.equal(es.views.day, "Día")
  assert.equal(es.eventTypes.reunion, "Reunión")
  assert.equal(es.ledger.timeRisks(1), "Riesgo de tiempo")
  assert.equal(es.ledger.timeRisks(3), "Riesgos de tiempo")
  assert.equal(es.dna.risks.daysPastDue(1), "1 día de retraso")
  assert.equal(es.monthView.plusMore(2), "+2 más")
  assert.equal(es.invoiceTitle("F-001"), "Factura F-001")
})

test("new namespaces: nested semantic objects (empty, language)", () => {
  const t = getUIMessages("en")
  assert.equal(typeof t.settings.language, "object")
  assert.equal(typeof t.today.empty, "object")
  assert.equal(t.today.empty.title, "Nothing for today yet")
  assert.equal(
    t.clients.list.empty.bodyDefault({ client: "client" }),
    "Create your first client to get started.",
  )
})

test("clients: typed functions interpolate vertical vocabulary and counts", () => {
  const en = getNamespace("en", "clients")
  // The noun comes from the vocabulary resolver as data — never from a key.
  assert.equal(
    en.list.searchPlaceholder({ clients: "clientas" }),
    "Search clientas, company, or email...",
  )
  // Basic pluralization: the noun forms come from the vocabulary.
  assert.equal(en.list.count(1, { client: "client", clients: "clients" }), "1 client")
  assert.equal(en.list.count(3, { client: "client", clients: "clients" }), "3 clients")
})

test("clients es: full-phrase grammar with lowercase nouns (P4.3)", () => {
  const es = getNamespace("es", "clients")
  // Standard Finesse masculine agreement — "Nuevo cliente", never "Nueva".
  assert.equal(es.list.newButton({ client: "cliente" }), "Nuevo cliente")
  assert.equal(es.form.titleEdit({ client: "cliente" }), "Editar cliente")
  assert.equal(es.form.toastCreated({ client: "cliente" }), "Cliente creado")
  assert.equal(
    es.list.searchPlaceholder({ clients: "clientes" }),
    "Buscar clientes, empresa o email...",
  )
  assert.equal(es.list.empty.title({ clients: "clientes" }), "No hay clientes todavía")
  assert.equal(es.list.count(1, { client: "cliente", clients: "clientes" }), "1 cliente")
  // Word order flips vs English — full phrases, not glued fragments.
  assert.equal(
    es.detail.projectsSection({ client: "cliente", projects: "servicios" }),
    "Servicios del cliente",
  )
  assert.equal(
    es.detail.snapshot.outstandingInvoices({ invoices: "cobros" }),
    "Cobros pendientes",
  )
  assert.equal(es.detail.errors.notFound({ client: "cliente" }), "Cliente no encontrado")
  assert.equal(es.status.prospect, "Prospecto")
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
  assert.deepEqual(SUPPORTED_LOCALES, ["es", "en", "de", "fr", "it"])
  assert.equal(DEFAULT_LOCALE, "en")
  assert.equal(parseLocale("es-MX"), "es")
  assert.ok(isValidLocale("en"))
  assert.ok(isValidLocale("fr"))
  assert.ok(isValidLocale("it"))
  assert.ok(!isValidLocale("pt"))
  assert.equal(getTranslations("de").locale, "de")
  // fr/it legacy sets pending → honest English content (locale states it).
  assert.equal(getTranslations("fr").locale, "en")
  assert.equal(getTranslations("it").locale, "en")
  assert.equal(resolveLocaleFromConfig(JSON.stringify({ locale: "es" })), "es")
})

test("legacy TranslationSet did not absorb the UI namespaces", () => {
  const legacy = getTranslations("en") as unknown as Record<string, unknown>
  for (const ns of ["settings", "today", "clients", "calendar", "billing", "services", "team"]) {
    assert.ok(!(ns in legacy), `legacy TranslationSet must not gain "${ns}"`)
  }
})
