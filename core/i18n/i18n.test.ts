import assert from "node:assert/strict"
import test from "node:test"
import { parseLocale, getTranslations, resolveLocaleFromConfig, isValidLocale, SUPPORTED_LOCALES } from "./index"
import { enNamespaces } from "./index"
import { resolveAckEmailConfig, escapeHtml, wrapEmailHtml } from "../email-templates"

// ─── parseLocale() ───────────────────────────────────────────────────────────

test("parseLocale: null/undefined → en", () => {
  assert.equal(parseLocale(null), "en")
  assert.equal(parseLocale(undefined), "en")
  assert.equal(parseLocale(""), "en")
})

test("parseLocale: exact match", () => {
  assert.equal(parseLocale("en"), "en")
  assert.equal(parseLocale("es"), "es")
  assert.equal(parseLocale("de"), "de")
})

test("parseLocale: case insensitive", () => {
  assert.equal(parseLocale("ES"), "es")
  assert.equal(parseLocale("De"), "de")
  assert.equal(parseLocale("EN"), "en")
})

test("parseLocale: regional variants strip to prefix", () => {
  assert.equal(parseLocale("es-MX"), "es")
  assert.equal(parseLocale("es_AR"), "es")
  assert.equal(parseLocale("de-CH"), "de")
  assert.equal(parseLocale("en-US"), "en")
  assert.equal(parseLocale("en-GB"), "en")
})

test("parseLocale: unsupported locale → en", () => {
  assert.equal(parseLocale("pt"), "en")
  assert.equal(parseLocale("xyz"), "en")
  assert.equal(parseLocale("ja"), "en")
  assert.equal(parseLocale("pt-BR"), "en")
})

// ─── getTranslations() ──────────────────────────────────────────────────────

test("getTranslations: returns correct locale object", () => {
  const en = getTranslations("en")
  assert.equal(en.locale, "en")
  assert.equal(en.label, "English")

  const es = getTranslations("es")
  assert.equal(es.locale, "es")
  assert.equal(es.label, "Español")

  const de = getTranslations("de")
  assert.equal(de.locale, "de")
  assert.equal(de.label, "Deutsch")
})

test("getTranslations: null → en translations", () => {
  const t = getTranslations(null)
  assert.equal(t.locale, "en")
})

test("getTranslations: each locale has all required email.ack fields", () => {
  for (const locale of SUPPORTED_LOCALES) {
    const t = getTranslations(locale)
    assert.ok(t.email.ack.heading.length > 0, `${locale}: heading empty`)
    assert.ok(t.email.ack.body.length > 0, `${locale}: body empty`)
    assert.ok(t.email.ack.subjectLabel.length > 0, `${locale}: subjectLabel empty`)
    assert.equal(typeof t.email.ack.greeting, "function", `${locale}: greeting not function`)
    assert.ok(t.email.ack.greeting("Ana").length > 0, `${locale}: greeting(name) empty`)
    assert.ok(t.email.ack.greeting(null).length > 0, `${locale}: greeting(null) empty`)
  }
})

// ─── isValidLocale() ─────────────────────────────────────────────────────────

test("isValidLocale: valid", () => {
  assert.ok(isValidLocale("en"))
  assert.ok(isValidLocale("es"))
  assert.ok(isValidLocale("de"))
})

test("isValidLocale: invalid", () => {
  assert.ok(!isValidLocale("pt"))
  assert.ok(!isValidLocale("xyz"))
  assert.ok(!isValidLocale(""))
})

// ─── resolveLocaleFromConfig() ───────────────────────────────────────────────

test("resolveLocaleFromConfig: null config → en", () => {
  assert.equal(resolveLocaleFromConfig(null), "en")
  assert.equal(resolveLocaleFromConfig(undefined), "en")
})

test("resolveLocaleFromConfig: config without locale → en", () => {
  assert.equal(resolveLocaleFromConfig(JSON.stringify({ modules: {} })), "en")
})

test("resolveLocaleFromConfig: config with locale", () => {
  assert.equal(resolveLocaleFromConfig(JSON.stringify({ locale: "es" })), "es")
  assert.equal(resolveLocaleFromConfig(JSON.stringify({ locale: "de" })), "de")
})

test("resolveLocaleFromConfig: regional variant in config", () => {
  assert.equal(resolveLocaleFromConfig(JSON.stringify({ locale: "es-MX" })), "es")
})

test("resolveLocaleFromConfig: invalid locale in config → en", () => {
  assert.equal(resolveLocaleFromConfig(JSON.stringify({ locale: "fr" })), "fr")
  assert.equal(resolveLocaleFromConfig(JSON.stringify({ locale: "xyz" })), "en")
})

test("resolveLocaleFromConfig: malformed JSON → en", () => {
  assert.equal(resolveLocaleFromConfig("{broken"), "en")
})

// ─── resolveAckEmailConfig() ─────────────────────────────────────────────────

test("ack config: no config → en defaults", () => {
  const cfg = resolveAckEmailConfig(null)
  assert.equal(cfg.locale, "en")
  assert.equal(cfg.enabled, true)
  assert.equal(cfg.heading, getTranslations("en").email.ack.heading)
  assert.equal(cfg.body, getTranslations("en").email.ack.body)
  assert.equal(cfg.subject, "")
  assert.equal(cfg.footer, "")
  assert.equal(cfg.senderName, "")
})

test("ack config: locale es → spanish defaults", () => {
  const cfg = resolveAckEmailConfig(JSON.stringify({ locale: "es" }))
  assert.equal(cfg.locale, "es")
  assert.equal(cfg.heading, getTranslations("es").email.ack.heading)
  assert.equal(cfg.body, getTranslations("es").email.ack.body)
})

test("ack config: locale de → german defaults", () => {
  const cfg = resolveAckEmailConfig(JSON.stringify({ locale: "de" }))
  assert.equal(cfg.locale, "de")
  assert.equal(cfg.heading, getTranslations("de").email.ack.heading)
  assert.equal(cfg.body, getTranslations("de").email.ack.body)
})

test("ack config: locale es-MX → spanish defaults (prefix match)", () => {
  const cfg = resolveAckEmailConfig(JSON.stringify({ locale: "es-MX" }))
  assert.equal(cfg.locale, "es")
  assert.equal(cfg.heading, getTranslations("es").email.ack.heading)
})

test("ack config: invalid locale fr → en fallback", () => {
  const cfg = resolveAckEmailConfig(JSON.stringify({ locale: "fr" }))
  assert.equal(cfg.locale, "en")
  assert.equal(cfg.heading, getTranslations("en").email.ack.heading)
})

test("ack config: invalid locale xyz → en fallback", () => {
  const cfg = resolveAckEmailConfig(JSON.stringify({ locale: "xyz" }))
  assert.equal(cfg.locale, "en")
  assert.equal(cfg.heading, getTranslations("en").email.ack.heading)
})

test("ack config: override heading only, rest from locale default", () => {
  const config = {
    locale: "es",
    email: { ack: { heading: "Gracias por escribirnos!" } },
  }
  const cfg = resolveAckEmailConfig(JSON.stringify(config))
  assert.equal(cfg.locale, "es")
  assert.equal(cfg.heading, "Gracias por escribirnos!")
  assert.equal(cfg.body, getTranslations("es").email.ack.body)
})

test("ack config: override all fields ignores locale defaults", () => {
  const config = {
    locale: "de",
    email: {
      ack: {
        heading: "Custom heading",
        body: "Custom body",
        subject: "Custom subject",
        footer: "Custom footer",
        senderName: "Custom sender",
        enabled: false,
      },
    },
  }
  const cfg = resolveAckEmailConfig(JSON.stringify(config))
  assert.equal(cfg.locale, "de")
  assert.equal(cfg.heading, "Custom heading")
  assert.equal(cfg.body, "Custom body")
  assert.equal(cfg.subject, "Custom subject")
  assert.equal(cfg.footer, "Custom footer")
  assert.equal(cfg.senderName, "Custom sender")
  assert.equal(cfg.enabled, false)
})

test("ack config: config with email but no ack → locale defaults", () => {
  const config = { locale: "de", email: { other: true } }
  const cfg = resolveAckEmailConfig(JSON.stringify(config))
  assert.equal(cfg.locale, "de")
  assert.equal(cfg.heading, getTranslations("de").email.ack.heading)
})

// ─── wrapEmailHtml() locale in <html> tag ────────────────────────────────────

test("wrapEmailHtml: default lang=en", () => {
  const html = wrapEmailHtml({ body: "<p>test</p>" })
  assert.ok(html.includes('lang="en"'))
})

test("wrapEmailHtml: lang=es when locale passed", () => {
  const html = wrapEmailHtml({ body: "<p>test</p>", locale: "es" })
  assert.ok(html.includes('lang="es"'))
})

test("wrapEmailHtml: lang=de when locale passed", () => {
  const html = wrapEmailHtml({ body: "<p>test</p>", locale: "de" })
  assert.ok(html.includes('lang="de"'))
})

// ─── Full ack email simulation ───────────────────────────────────────────────

interface SimResult {
  locale: string
  greeting: string
  heading: string
  body: string
  footer: string
  subjectLabel: string
  subject: string
  htmlLang: string
}

function simulateAckEmail(
  workspaceConfig: string | null,
  workspaceName: string,
  contactName: string | null,
  conversationSubject: string,
): SimResult {
  const cfg = resolveAckEmailConfig(workspaceConfig)
  const t = getTranslations(cfg.locale)

  const displayName = cfg.senderName || workspaceName
  const greeting = t.email.ack.greeting(contactName)
  const convSubject = conversationSubject || t.common.message
  const subject = cfg.subject || `Re: ${convSubject}`
  const heading = cfg.heading
  const body = cfg.body
  const footer = cfg.footer || `${displayName} — ${t.email.poweredBy}`
  const subjectLabel = t.email.ack.subjectLabel

  const html = wrapEmailHtml({
    body: `<p>${escapeHtml(heading)}</p>`,
    footer,
    locale: cfg.locale,
  })
  const langMatch = html.match(/lang="([^"]+)"/)

  return {
    locale: cfg.locale,
    greeting,
    heading,
    body,
    footer,
    subjectLabel,
    subject,
    htmlLang: langMatch?.[1] ?? "??",
  }
}

test("full sim: no config (existing workspace)", () => {
  const r = simulateAckEmail(null, "Acme Studio", "Carlos", "Website redesign")
  assert.equal(r.locale, "en")
  assert.equal(r.greeting, "Hi Carlos,")
  assert.equal(r.heading, "We received your message and our team will get back to you shortly.")
  assert.equal(r.body, "No need to reply to this email. We'll follow up directly.")
  assert.equal(r.footer, "Acme Studio — Powered by 7F")
  assert.equal(r.subjectLabel, "Subject")
  assert.equal(r.subject, "Re: Website redesign")
  assert.equal(r.htmlLang, "en")
})

test("full sim: locale es", () => {
  const r = simulateAckEmail(JSON.stringify({ locale: "es" }), "Estudio Acme", "María", "Rediseño web")
  assert.equal(r.locale, "es")
  assert.equal(r.greeting, "Hola María,")
  assert.ok(r.heading.includes("Recibimos tu mensaje"))
  assert.ok(r.body.includes("No es necesario responder"))
  assert.equal(r.footer, "Estudio Acme — Desarrollado por 7F")
  assert.equal(r.subjectLabel, "Asunto")
  assert.equal(r.subject, "Re: Rediseño web")
  assert.equal(r.htmlLang, "es")
})

test("full sim: locale de", () => {
  const r = simulateAckEmail(JSON.stringify({ locale: "de" }), "Agentur Acme", "Hans", "Website Neugestaltung")
  assert.equal(r.locale, "de")
  assert.equal(r.greeting, "Hallo Hans,")
  assert.ok(r.heading.includes("Wir haben Ihre Nachricht erhalten"))
  assert.ok(r.body.includes("Sie müssen auf diese E-Mail nicht antworten"))
  assert.equal(r.footer, "Agentur Acme — Bereitgestellt von 7F")
  assert.equal(r.subjectLabel, "Betreff")
  assert.equal(r.subject, "Re: Website Neugestaltung")
  assert.equal(r.htmlLang, "de")
})

test("full sim: locale es-MX → es", () => {
  const r = simulateAckEmail(JSON.stringify({ locale: "es-MX" }), "Acme MX", "Pedro", "Consulta")
  assert.equal(r.locale, "es")
  assert.equal(r.greeting, "Hola Pedro,")
  assert.equal(r.subjectLabel, "Asunto")
  assert.equal(r.htmlLang, "es")
})

test("full sim: invalid locale fr → en", () => {
  const r = simulateAckEmail(JSON.stringify({ locale: "fr" }), "Acme FR", "Jean", "Question")
  assert.equal(r.locale, "en")
  assert.equal(r.greeting, "Hi Jean,")
  assert.equal(r.subjectLabel, "Subject")
  assert.equal(r.htmlLang, "en")
})

test("full sim: invalid locale xyz → en", () => {
  const r = simulateAckEmail(JSON.stringify({ locale: "xyz" }), "Acme", null, "Test")
  assert.equal(r.locale, "en")
  assert.equal(r.greeting, "Hi,")
  assert.equal(r.htmlLang, "en")
})

test("full sim: locale es + override heading only", () => {
  const config = {
    locale: "es",
    email: { ack: { heading: "¡Gracias por tu mensaje!" } },
  }
  const r = simulateAckEmail(JSON.stringify(config), "Mi Empresa", "Ana", "Presupuesto")
  assert.equal(r.locale, "es")
  assert.equal(r.heading, "¡Gracias por tu mensaje!")
  assert.ok(r.body.includes("No es necesario responder"))
  assert.equal(r.greeting, "Hola Ana,")
  assert.equal(r.subjectLabel, "Asunto")
  assert.equal(r.footer, "Mi Empresa — Desarrollado por 7F")
  assert.equal(r.htmlLang, "es")
})

test("full sim: no contact name → greeting without name", () => {
  const r = simulateAckEmail(JSON.stringify({ locale: "de" }), "Firma", null, "Anfrage")
  assert.equal(r.greeting, "Hallo,")
})

// ─── English namespace scaffolding (PR-I18N-2) ───────────────────────────────
// These verify the additive per-namespace English scaffolding exists and stays
// English-only. They must NOT affect the existing monolithic dictionary above.

test("enNamespaces: exposes the scaffolded namespaces", () => {
  assert.deepEqual(
    Object.keys(enNamespaces).sort(),
    ["billing", "calendar", "clients", "common", "nav", "settings", "today"],
  )
})

test("enNamespaces: static English strings present", () => {
  assert.equal(enNamespaces.nav.today, "Today")
  assert.equal(enNamespaces.nav.inbox.title, "Smart Inbox")
  assert.equal(enNamespaces.clients.title, "Clients")
  assert.equal(enNamespaces.settings.language.appLabel, "App language")
  assert.equal(enNamespaces.common.save, "Save")
})

test("enNamespaces: interpolation functions compose vocabulary and counts", () => {
  assert.equal(
    enNamespaces.clients.searchPlaceholder({ clientPlural: "clients" }),
    "Search clients, company, or email…",
  )
  assert.equal(enNamespaces.clients.count(3, "clients"), "3 clients")
  assert.equal(enNamespaces.common.itemCount(1, "item", "items"), "1 item")
  assert.equal(enNamespaces.common.itemCount(2, "item", "items"), "2 items")
})

test("enNamespaces: scaffolding does not touch the monolithic TranslationSet", () => {
  // The existing email dictionary is unchanged and still resolves en/es/de.
  assert.equal(getTranslations("en").email.ack.subjectLabel, "Subject")
  assert.equal(getTranslations("es").email.ack.subjectLabel, "Asunto")
  assert.equal(getTranslations("de").email.ack.subjectLabel, "Betreff")
})

// ─── Priority verification ──────────────────────────────────────────────────

test("priority: override > locale default > en fallback", () => {
  const enDefault = resolveAckEmailConfig(null)
  assert.equal(enDefault.heading, getTranslations("en").email.ack.heading, "fallback to en")

  const esDefault = resolveAckEmailConfig(JSON.stringify({ locale: "es" }))
  assert.equal(esDefault.heading, getTranslations("es").email.ack.heading, "locale default es")
  assert.notEqual(esDefault.heading, enDefault.heading, "es differs from en")

  const esOverride = resolveAckEmailConfig(
    JSON.stringify({ locale: "es", email: { ack: { heading: "CUSTOM" } } }),
  )
  assert.equal(esOverride.heading, "CUSTOM", "override wins over locale")
  assert.notEqual(esOverride.heading, esDefault.heading, "override differs from default")
})
