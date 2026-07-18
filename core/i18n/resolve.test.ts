import assert from "node:assert/strict"
import test from "node:test"

import {
  parseAcceptLanguage,
  readWorkspaceLocaleRaw,
  resolveAuthenticatedLocale,
  resolveAnonymousLocale,
  resolveRequestLocale,
} from "./resolve"
import {
  LOCALE_COOKIE,
  readLocaleCookieValue,
  buildLocaleCookieOptions,
  planLocaleCookieAfterUserUpdate,
} from "./cookie"

// ─── parseAcceptLanguage ───────────────────────────────────────────────────────

test("accept-language: weighted list picks best supported by q", () => {
  assert.equal(parseAcceptLanguage("de-CH,de;q=0.9,en;q=0.8,es;q=0.7"), "de")
  // fr is an official locale since P4.CORE-5L — it wins by weight now.
  assert.equal(parseAcceptLanguage("fr-FR,fr;q=0.9,es;q=0.5,en;q=0.4"), "fr")
})

test("accept-language: regional variants resolve to their prefix", () => {
  assert.equal(parseAcceptLanguage("es-MX,es;q=0.9"), "es")
  assert.equal(parseAcceptLanguage("de-CH"), "de")
  assert.equal(parseAcceptLanguage("en-GB"), "en")
})

test("accept-language: casing and whitespace are tolerated", () => {
  assert.equal(parseAcceptLanguage("  ES-es , EN ; q=0.5 "), "es")
  assert.equal(parseAcceptLanguage("DE"), "de")
})

test("accept-language: q ordering wins over header position", () => {
  assert.equal(parseAcceptLanguage("en;q=0.1,es;q=0.9"), "es")
  // Tie on q keeps header order.
  assert.equal(parseAcceptLanguage("de;q=0.8,es;q=0.8"), "de")
})

test("accept-language: unsupported, wildcard, broken and empty → null", () => {
  assert.equal(parseAcceptLanguage("pt-BR,nl;q=0.9,pt"), null)
  assert.equal(parseAcceptLanguage("*"), null)
  assert.equal(parseAcceptLanguage("es;q=banana"), null)
  assert.equal(parseAcceptLanguage("es;q=0"), null)
  assert.equal(parseAcceptLanguage(""), null)
  assert.equal(parseAcceptLanguage(null), null)
  assert.equal(parseAcceptLanguage(undefined), null)
  assert.equal(parseAcceptLanguage(",,,;;q=,"), null)
})

test("accept-language: broken entries are skipped, valid ones still resolve", () => {
  assert.equal(parseAcceptLanguage("xx;q=oops,de;q=0.5"), "de")
})

// ─── readWorkspaceLocaleRaw (customer-facing config read — NOT the UI chain) ──

test("workspace raw locale: present, absent, malformed", () => {
  assert.equal(readWorkspaceLocaleRaw(JSON.stringify({ locale: "es" })), "es")
  // Raw read does NOT validate — attribution happens in the resolver.
  assert.equal(readWorkspaceLocaleRaw(JSON.stringify({ locale: "fr" })), "fr")
  assert.equal(readWorkspaceLocaleRaw(JSON.stringify({ modules: {} })), null)
  assert.equal(readWorkspaceLocaleRaw(JSON.stringify({ locale: "" })), null)
  assert.equal(readWorkspaceLocaleRaw("{not json"), null)
  assert.equal(readWorkspaceLocaleRaw(null), null)
  assert.equal(readWorkspaceLocaleRaw(undefined), null)
})

// ─── authenticated chain (User.locale → Accept-Language → en) ─────────────────

test("case A: User.locale wins over cookie and browser header", () => {
  const r = resolveRequestLocale({
    authenticated: true,
    userLocale: "es",
    cookieLocale: "en",
    acceptLanguage: "de-CH",
  })
  assert.equal(r.locale, "es")
  assert.equal(r.source, "user")
  assert.equal(r.userLocale, "es")
  // Cookie says "en" but effective is "es" → needs sync.
  assert.equal(r.shouldSyncCookie, true)
})

test("case B: Spanish browser without a preference → Spanish", () => {
  const r = resolveRequestLocale({
    authenticated: true,
    userLocale: null,
    cookieLocale: null,
    acceptLanguage: "es-ES,es;q=0.9,en;q=0.5",
  })
  assert.equal(r.locale, "es")
  assert.equal(r.source, "accept-language")
  assert.equal(r.userLocale, null)
})

test("case B2: English browser without a preference → English", () => {
  const r = resolveRequestLocale({
    authenticated: true,
    userLocale: null,
    cookieLocale: null,
    acceptLanguage: "en-GB,en;q=0.9",
  })
  assert.equal(r.locale, "en")
  assert.equal(r.source, "accept-language")
})

test("case C: User.locale beats a browser that asks the other language", () => {
  // Spanish preference + English browser → Spanish.
  const es = resolveAuthenticatedLocale({ userLocale: "es", acceptLanguage: "en-US,en;q=0.9" })
  assert.deepEqual(es, { locale: "es", source: "user" })
  // English preference + Spanish browser → English.
  const en = resolveAuthenticatedLocale({ userLocale: "en", acceptLanguage: "es-ES,es;q=0.9" })
  assert.deepEqual(en, { locale: "en", source: "user" })
})

test("case D: unsupported browser language and no preference → English default", () => {
  const r = resolveRequestLocale({
    authenticated: true,
    userLocale: null,
    cookieLocale: null,
    acceptLanguage: "pt-BR,nl;q=0.8",
  })
  assert.equal(r.locale, "en")
  assert.equal(r.source, "default")
})

test("authenticated: invalid persisted preference falls through to the browser", () => {
  const r = resolveAuthenticatedLocale({
    userLocale: "es-MX", // regional codes are not persistable canon
    acceptLanguage: "de-CH,de;q=0.9",
  })
  assert.equal(r.locale, "de")
  assert.equal(r.source, "accept-language")
})

test("workspace locale never participates in the personal chain", () => {
  // The resolver has no workspace input at all — the personal interface is
  // User.locale → Accept-Language → en, regardless of the business language.
  const r = resolveAuthenticatedLocale({ userLocale: null, acceptLanguage: null })
  assert.deepEqual(r, { locale: "en", source: "default" })
  assert.ok(!("workspaceLocale" in r))
})

// ─── anonymous chain (matrix cases E–G) ────────────────────────────────────────

test("case E: valid cookie wins for anonymous", () => {
  const r = resolveRequestLocale({
    authenticated: false,
    userLocale: null,
    cookieLocale: "de",
    acceptLanguage: "es",
  })
  assert.equal(r.locale, "de")
  assert.equal(r.source, "cookie")
  assert.equal(r.shouldSyncCookie, false)
})

test("case F: invalid cookie is ignored → Accept-Language", () => {
  const r = resolveRequestLocale({
    authenticated: false,
    userLocale: null,
    cookieLocale: "klingon",
    acceptLanguage: "es-MX,es;q=0.9",
  })
  assert.equal(r.locale, "es")
  assert.equal(r.source, "accept-language")
  // A present-but-wrong cookie should be cleaned up.
  assert.equal(r.shouldSyncCookie, true)
})

test("case G: no cookie, unsupported header → English default, no cookie churn", () => {
  const r = resolveRequestLocale({
    authenticated: false,
    userLocale: null,
    cookieLocale: null,
    acceptLanguage: "pt-BR,nl;q=0.8",
  })
  assert.equal(r.locale, "en")
  assert.equal(r.source, "default")
  // No cookie exists — an anonymous default paint does not write one.
  assert.equal(r.shouldSyncCookie, false)
})

test("anonymous: resolveAnonymousLocale matches the combined result", () => {
  assert.deepEqual(resolveAnonymousLocale({ cookieLocale: "es", acceptLanguage: "de" }), {
    locale: "es",
    source: "cookie",
  })
})

// ─── cookie sync flag details ──────────────────────────────────────────────────

test("authenticated: missing cookie also requests sync (first-paint parity)", () => {
  const r = resolveRequestLocale({
    authenticated: true,
    userLocale: "de",
    cookieLocale: null,
    acceptLanguage: null,
  })
  assert.equal(r.locale, "de")
  assert.equal(r.shouldSyncCookie, true)
})

test("authenticated: cookie already in sync → no sync requested", () => {
  const r = resolveRequestLocale({
    authenticated: true,
    userLocale: "es",
    cookieLocale: "es",
    acceptLanguage: null,
  })
  assert.equal(r.shouldSyncCookie, false)
})

// ─── cookie policy ─────────────────────────────────────────────────────────────

test("cookie: name and exact-match read", () => {
  assert.equal(LOCALE_COOKIE, "7f-locale")
  assert.equal(readLocaleCookieValue("es"), "es")
  assert.equal(readLocaleCookieValue("ES"), null)
  assert.equal(readLocaleCookieValue("es-MX"), null)
  assert.equal(readLocaleCookieValue(""), null)
  assert.equal(readLocaleCookieValue(null), null)
  assert.equal(readLocaleCookieValue(undefined), null)
})

test("cookie: options are HttpOnly, lax, path=/ with a real lifetime", () => {
  const dev = buildLocaleCookieOptions(false)
  assert.equal(dev.httpOnly, true)
  assert.equal(dev.sameSite, "lax")
  assert.equal(dev.path, "/")
  assert.equal(dev.secure, false)
  assert.ok(dev.maxAge > 0)

  const prod = buildLocaleCookieOptions(true)
  assert.equal(prod.secure, true)
  assert.equal(prod.httpOnly, true)
})

test("cookie: write plan after personal update — set on locale, delete on clear", () => {
  assert.deepEqual(planLocaleCookieAfterUserUpdate("es"), { kind: "set", value: "es" })
  assert.deepEqual(planLocaleCookieAfterUserUpdate("de"), { kind: "set", value: "de" })
  assert.deepEqual(planLocaleCookieAfterUserUpdate(null), { kind: "delete" })
})
