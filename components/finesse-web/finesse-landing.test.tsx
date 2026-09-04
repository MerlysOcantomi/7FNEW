import { test } from "node:test"
import assert from "node:assert/strict"
import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { FinesseLanding, FINESSE_LOGIN_HREF } from "./finesse-landing"
import { getFinesseLandingMessages } from "@modules/finesse-web/i18n"

const html = renderToStaticMarkup(React.createElement(FinesseLanding, { t: getFinesseLandingMessages("es") }))

test("landing: structure — header, hero h1, sections with anchors, final CTA, footer", () => {
  assert.equal((html.match(/<h1/g) ?? []).length, 1)
  assert.match(html, /Tu negocio de belleza, organizado en un solo lugar\./)
  for (const id of ["funciones", "agenda", "mensajes", "presencia", "para-quien", "contenido"]) {
    assert.match(html, new RegExp(`id="${id}"`), `section #${id}`)
  }
  assert.match(html, /data-finesse-footer/)
  assert.match(html, /Powered by SevenF/)
})

test("landing: every CTA points at the existing login; no invented routes or forms", () => {
  assert.equal(FINESSE_LOGIN_HREF, "/login")
  const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map((m) => m[1])
  const external = hrefs.filter((h) => !h.startsWith("#"))
  for (const h of external) assert.ok(["/login", "/finesse"].includes(h), `unexpected href ${h}`)
  assert.equal(hrefs.filter((h) => h === "/login").length, 4, "header CTA + hero CTA + final CTA + footer Entrar")
  assert.doesNotMatch(html, /<form/)
  assert.doesNotMatch(html, /<input/)
})

test("landing: honest CTA — 'Entrar en Finesse' (no trial/signup wording), discovery CTA to #funciones", () => {
  assert.equal((html.match(/Entrar en Finesse/g) ?? []).length, 3, "header, hero and final")
  assert.doesNotMatch(html, /Probar Finesse|Prueba gratis|Empieza gratis|Regístrate|Crear cuenta/)
  assert.match(html, /href="#funciones"[^>]*>[^<]*Ver cómo funciona/)
  assert.doesNotMatch(html, /Acceso con cuenta autorizada/)
})

test("landing: forced Petrol Pearl identity via data-theme, tokens only, no hardcoded colors", () => {
  assert.match(html, /data-theme="petrol-pearl"/)
  assert.doesNotMatch(html, /#[0-9a-fA-F]{6}\b/)
  assert.doesNotMatch(html, /rgba?\(/)
  assert.doesNotMatch(html, /text-white|bg-white|text-black|bg-black/)
})

test("landing: SevenF only in the footer; product previews mirror the real Hoy", () => {
  const footerStart = html.indexOf("data-finesse-footer")
  const beforeFooter = html.slice(0, footerStart)
  assert.doesNotMatch(beforeFooter, /SevenF|Sevenef|7F/)
  for (const s of ["Ahora mismo", "Lo que necesita atención", "Mi inspiración", "Ver toda la agenda", "Mi salón", "Mensajes"]) {
    assert.match(html, new RegExp(s), s)
  }
  assert.match(html, /Vista previa/)
})
