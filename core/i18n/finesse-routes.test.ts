/**
 * P4.FINESSE-ENES §14 — route smoke matrix at the catalog level.
 *
 * For each main Finesse route this asserts the ANCHOR texts of its surface in
 * English and Spanish: both exist, are non-empty, and genuinely differ (or are
 * documented brands). This is the pure-runtime mirror of the manual journey
 * "open in English → switch to Spanish → every surface changes": components
 * resolve these same catalogs from the effective `useI18n()` locale, so anchor
 * parity here means the switch has real content to render on every route.
 */

import assert from "node:assert/strict"
import test from "node:test"

import { getNamespace } from "./ui"
import { composeEntityLabel, mapVerticalKeyToBusinessType, resolveVocabulary } from "@core/personalization"
import { getBeautyOverviewMessages } from "@modules/overview/i18n"
import { getBeautyTodayMessages } from "@modules/today/i18n"
import { getBeautyMarketingMessages } from "@modules/marketing/i18n"
import { getFinesseAssistantCopy } from "@modules/assistant/finesse-assistant"
import { statusLabel } from "@/lib/inbox-labels"

const beautyType = mapVerticalKeyToBusinessType("beauty")
const vocabEn = resolveVocabulary(beautyType, undefined, "en")
const vocabEs = resolveVocabulary(beautyType, undefined, "es")

function anchorsDiffer(name: string, en: string, es: string) {
  assert.ok(en.trim().length > 0, `${name}: empty EN anchor`)
  assert.ok(es.trim().length > 0, `${name}: empty ES anchor`)
  assert.notEqual(en, es, `${name}: EN and ES anchors are identical ("${en}")`)
}

test("route / — Mi salón anchors switch EN↔ES", () => {
  const en = getBeautyOverviewMessages("en")
  const es = getBeautyOverviewMessages("es")
  anchorsDiffer("overview title", en.header.title, es.header.title)
  assert.equal(en.header.title, "My salon")
  assert.equal(es.header.title, "Mi salón")
  anchorsDiffer("overview description", en.header.description, es.header.description)
  anchorsDiffer("overview export", en.exportCsv.columns.revenue, es.exportCsv.columns.revenue)
})

test("route /today — Today anchors switch EN↔ES (workboard + studio)", () => {
  const en = getNamespace("en", "today")
  const es = getNamespace("es", "today")
  anchorsDiffer("today title", en.title, es.title)
  anchorsDiffer("lane my work", en.workboard.lanes.myWork.title, es.workboard.lanes.myWork.title)
  anchorsDiffer("section overdue", en.workboard.sections.overdue, es.workboard.sections.overdue)
  const studioEn = getBeautyTodayMessages("en")
  const studioEs = getBeautyTodayMessages("es")
  anchorsDiffer("studio agenda", studioEn.studio.agendaTitle, studioEs.studio.agendaTitle)
  anchorsDiffer("status pending", studioEn.statusLabels.pending, studioEs.statusLabels.pending)
})

test("route /calendario — Agenda anchors switch EN↔ES", () => {
  const en = getNamespace("en", "calendar")
  const es = getNamespace("es", "calendar")
  anchorsDiffer("calendar title", en.title, es.title)
  assert.equal(en.title, "Calendar")
  assert.equal(es.title, "Agenda")
  anchorsDiffer("view day", en.views.day, es.views.day)
})

test("route /inbox — Mensajes anchors switch EN↔ES", () => {
  const inboxNounEn = composeEntityLabel({
    vocabulary: vocabEn,
    entity: "inbox",
    form: "singular",
    fallback: getNamespace("en", "nav").inbox,
  })
  const inboxNounEs = composeEntityLabel({
    vocabulary: vocabEs,
    entity: "inbox",
    form: "singular",
    fallback: getNamespace("es", "nav").inbox,
  })
  anchorsDiffer("inbox noun", inboxNounEn, inboxNounEs)
  assert.equal(inboxNounEn, "Messages")
  assert.equal(inboxNounEs, "Mensajes")
  anchorsDiffer("status new", statusLabel("new", "en"), statusLabel("new", "es"))
})

test("route /clientes — Clientes anchors switch EN↔ES", () => {
  const en = getNamespace("en", "clients")
  const es = getNamespace("es", "clients")
  anchorsDiffer(
    "clients search",
    en.list.searchPlaceholder({ clients: "clients" }),
    es.list.searchPlaceholder({ clients: "clientes" }),
  )
  anchorsDiffer("status labels", getNamespace("en", "statuses").estado.pagada, getNamespace("es", "statuses").estado.pagada)
})

test("route /contenido — Marketing anchors switch EN↔ES", () => {
  const en = getBeautyMarketingMessages("en")
  const es = getBeautyMarketingMessages("es")
  anchorsDiffer("marketing description", en.header.description, es.header.description)
  anchorsDiffer("preview chip", en.preview.chip, es.preview.chip)
})

test("routes /services, /facturacion, /usuarios — nav anchors switch EN↔ES", () => {
  const pairs: Array<["project" | "billing" | "member", "plural" | "singular", string, string]> = [
    ["project", "plural", "Services", "Servicios"],
    ["billing", "plural", "Billing", "Cobros"],
    ["member", "singular", "Team", "Equipo"],
  ]
  for (const [entity, form, expectedEn, expectedEs] of pairs) {
    const en = composeEntityLabel({ vocabulary: vocabEn, entity, form, fallback: expectedEn })
    const es = composeEntityLabel({ vocabulary: vocabEs, entity, form, fallback: expectedEs })
    assert.equal(en, expectedEn)
    assert.equal(es, expectedEs)
  }
})

test("assistant — Ask Finesse anchors switch EN↔ES on every page", () => {
  const en = getFinesseAssistantCopy("en")
  const es = getFinesseAssistantCopy("es")
  anchorsDiffer("launcher", en.launcherLabel, es.launcherLabel)
  anchorsDiffer("composer", en.composerPlaceholder, es.composerPlaceholder)
  for (const key of Object.keys(en.pageLabels) as Array<keyof typeof en.pageLabels>) {
    assert.ok(en.pageLabels[key].length > 0 && es.pageLabels[key].length > 0)
  }
})

test("no main surface mixes languages: es catalogs never equal en wholesale", () => {
  const surfaces: Array<[string, unknown, unknown]> = [
    ["overview", getBeautyOverviewMessages("en"), getBeautyOverviewMessages("es")],
    ["today", getNamespace("en", "today"), getNamespace("es", "today")],
    ["calendar", getNamespace("en", "calendar"), getNamespace("es", "calendar")],
    ["clients", getNamespace("en", "clients"), getNamespace("es", "clients")],
    ["marketing", getBeautyMarketingMessages("en"), getBeautyMarketingMessages("es")],
    ["statuses", getNamespace("en", "statuses"), getNamespace("es", "statuses")],
  ]
  for (const [name, en, es] of surfaces) {
    assert.notDeepEqual(es, en, `${name}: the Spanish catalog is an English copy`)
  }
})
