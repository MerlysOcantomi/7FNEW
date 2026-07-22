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

test("common: shared action labels are natively translated in all five locales (I18N-SHARED-PRIMITIVES-05)", () => {
  // These back the shared modal/sheet/toast primitives (confirm-modal,
  // smart-modal, ui/sheet, ui/dialog, toast-provider). They must resolve
  // natively — never the English fallback — in every official locale.
  const expected = {
    en: { close: "Close", confirm: "Confirm", cancel: "Cancel" },
    es: { close: "Cerrar", confirm: "Confirmar", cancel: "Cancelar" },
    de: { close: "Schließen", confirm: "Bestätigen", cancel: "Abbrechen" },
    fr: { close: "Fermer", confirm: "Confirmer", cancel: "Annuler" },
    it: { close: "Chiudi", confirm: "Conferma", cancel: "Annulla" },
  } as const
  for (const [code, vals] of Object.entries(expected)) {
    const common = getNamespace(code, "common")
    assert.equal(common.close, vals.close, `${code}.common.close`)
    assert.equal(common.confirm, vals.confirm, `${code}.common.confirm`)
    assert.equal(common.cancel, vals.cancel, `${code}.common.cancel`)
  }
  // de/fr/it serve a genuine native contribution, not the English object.
  for (const code of ["de", "fr", "it"] as const) {
    assert.equal(UI_NAMESPACE_COVERAGE[code].common, "native", `${code}.common must be native`)
    assert.notEqual(
      getNamespace(code, "common").confirm,
      getNamespace("en", "common").confirm,
      `${code}.common.confirm must differ from English`,
    )
  }
})

test("getUIMessages: de/fr/it translate the toolbar family, English fallback for the rest", () => {
  const english = getUIMessages("en")
  // Toolbar family really translated since I18N-TOP-ACTIONS-01, plus the
  // shared status/priority labels (I18N-STATUSES-CENTRAL-04) and the shared
  // common action labels (I18N-SHARED-PRIMITIVES-05).
  const TRANSLATED = ["nav", "globalSearch", "globalNew", "agents", "today", "statuses", "common"] as const
  for (const code of ["de", "fr", "it"] as const) {
    const catalog = getUIMessages(code)
    for (const ns of Object.keys(english) as Array<keyof typeof english>) {
      if ((TRANSLATED as readonly string[]).includes(ns)) {
        // A real contribution — never the English object served as-is.
        assert.notEqual(catalog[ns], english[ns], `${code}.${ns} must be a native contribution`)
      } else {
        // Everything else stays an explicit English-reference fallback.
        assert.equal(catalog[ns], english[ns], `${code}.${ns} must reference the English namespace`)
      }
    }
  }
  // Regional variants resolve to their base locale's composed catalog.
  assert.equal(getUIMessages("de-CH").nav, getUIMessages("de").nav)
  assert.equal(getUIMessages("fr-CH").nav, getUIMessages("fr").nav)
  assert.equal(getUIMessages("it-CH").nav, getUIMessages("it").nav)
  assert.equal(getUIMessages("de-CH").settings, english.settings)
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

test("coverage: expected snapshot — es complete, de/fr/it cover the toolbar family", () => {
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
  /**
   * de/fr/it really translate the global toolbar family (I18N-TOP-ACTIONS-01)
   * — nav + the four surfaces the toolbar opens — plus the shared
   * status/priority labels (I18N-STATUSES-CENTRAL-04, a small closed enum
   * vocabulary) and the shared common action labels
   * (I18N-SHARED-PRIMITIVES-05), and still serve English for everything else
   * (explicit, honest fallback).
   */
  const NATIVE_NS = ["nav", "globalSearch", "globalNew", "agents", "today", "statuses", "common"] as const
  for (const code of ["de", "fr", "it"] as const) {
    assert.ok(localeHasPendingCoverage(code))
    for (const [ns, status] of Object.entries(UI_NAMESPACE_COVERAGE[code])) {
      if ((NATIVE_NS as readonly string[]).includes(ns)) {
        assert.equal(status, "native", `${code}.${ns} must be native`)
      } else {
        assert.equal(status, "fallback-en", `${code}.${ns} must still be fallback`)
      }
    }
  }
})

test("toolbar family renders in all five locales with agent names preserved", () => {
  const expected = {
    en: { today: "Today", search: "Search", agents: "Agents", newTrigger: "New" },
    es: { today: "Hoy", search: "Buscar", agents: "Agentes", newTrigger: "Nuevo" },
    de: { today: "Heute", search: "Suchen", agents: "Agenten", newTrigger: "Neu" },
    fr: { today: "Aujourd'hui", search: "Rechercher", agents: "Agents", newTrigger: "Nouveau" },
    it: { today: "Oggi", search: "Cerca", agents: "Agenti", newTrigger: "Nuovo" },
  } as const
  for (const [code, labels] of Object.entries(expected)) {
    const t = getUIMessages(code)
    assert.equal(t.nav.today, labels.today, `${code} today`)
    assert.equal(t.nav.search, labels.search, `${code} search`)
    assert.equal(t.nav.agents, labels.agents, `${code} agents`)
    assert.equal(t.globalNew.trigger, labels.newTrigger, `${code} new`)
    // "Fanny" is a proper name — it must survive every locale's askFanny label
    // and the agents empty-state body.
    assert.ok(t.nav.askFanny.includes("Fanny"), `${code} askFanny keeps the proper name`)
    assert.ok(t.agents.empty.body.includes("Fanny"), `${code} agents empty keeps the proper name`)
    // Counted phrases stay typed functions everywhere.
    assert.equal(typeof t.agents.moreOnFullPage, "function")
    assert.equal(typeof t.today.quick.needsCount, "function")
    assert.equal(typeof t.globalSearch.counts.results, "function")
  }
  // The five locales must differ from each other where the language differs —
  // no English copies pretending to be translations.
  const subtitles = new Set(
    (["en", "es", "de", "fr", "it"] as const).map((c) => getUIMessages(c).agents.subtitle),
  )
  assert.equal(subtitles.size, 5, "agents.subtitle must be distinct per locale")
})

// ─── Agents full page (I18N-AGENTS-FULL-PAGE-02) ────────────────────────────────

const AGENT_IDS = ["francis", "forte", "fanny", "freya", "fiona", "felix", "fathom", "finesse"] as const
const ALL_LOCALES = ["en", "es", "de", "fr", "it"] as const

test("agents page: contract is complete and non-empty in all five locales", () => {
  for (const code of ALL_LOCALES) {
    const a = getUIMessages(code).agents
    // Scalar page strings.
    for (const s of [
      a.page.live, a.page.loadingAria, a.page.loadError,
      a.page.kpis.workingNow, a.page.kpis.needsReview, a.page.kpis.automatedToday, a.page.kpis.attention,
      a.page.hero.leadsTeam, a.page.hero.briefingWorking, a.page.hero.briefingCalm, a.page.hero.needsJoiner,
      a.page.hero.noProposals, a.page.hero.adjustAutonomy, a.page.hero.adjustAutonomyTitle,
      a.page.roster.heading, a.page.roster.defaultTagline, a.page.roster.review, a.page.roster.watching,
      a.page.roster.comingOnline, a.page.roster.upToDate, a.page.roster.readyInRegistry, a.page.roster.openDetailsSuffix,
      a.page.liveActivity.title, a.page.liveActivity.empty,
      a.page.rail.needsReview, a.page.rail.attention, a.page.rail.needsReviewEmpty, a.page.rail.attentionEmpty,
      a.page.rail.proposes, a.page.rail.approve, a.page.rail.dismiss, a.page.rail.viewContext, a.page.rail.view,
      a.page.autonomy.title, a.page.autonomy.auto, a.page.autonomy.suggests, a.page.autonomy.approval,
      a.page.autonomy.autoText, a.page.autonomy.suggestsText, a.page.autonomy.approvalText,
      a.detail.doingNow, a.detail.today, a.detail.todayEmpty, a.detail.worksWithTeam, a.detail.watching,
      a.detail.recentlyHandled, a.detail.openInPrefix, a.detail.sectionComingOnline, a.detail.close,
      a.states.working, a.states.waiting, a.states.idle, a.states.comingOnline,
      a.autonomyLabels.auto, a.autonomyLabels.suggests, a.time.now,
    ]) {
      assert.equal(typeof s, "string")
      assert.ok(s.length > 0, `${code}: empty agents page string`)
    }
    // Typed functions produce non-empty, interpolated output.
    assert.ok(a.page.summary.agentsCount(7).includes("7"))
    assert.ok(a.page.summary.workingNow(3).includes("3"))
    assert.ok(a.page.summary.awaitingYou(2).includes("2"))
    assert.ok(a.page.hero.needsProposals(2).includes("2"))
    assert.ok(a.page.hero.needsAttention(1).length > 0)
    assert.ok(a.page.hero.reviewProposals(4).includes("4"))
    assert.ok(a.page.roster.handledToday(5).includes("5"))
    assert.ok(a.page.liveActivity.executedToday(6).includes("6"))
    assert.ok(a.time.minutesAgo(9).includes("9"))
    assert.ok(a.time.hoursAgo(2).includes("2"))
    assert.ok(a.detail.detailsAria("Fanny").includes("Fanny"))
    // Hero briefing composes without leaving dangling separators.
    const withNeeds = a.page.hero.briefingWithNeeds(a.page.hero.briefingWorking, a.page.hero.needsProposals(2))
    assert.ok(withNeeds.includes(a.page.hero.briefingWorking) && withNeeds.length > 20)
    assert.ok(a.page.hero.briefingNoNeeds(a.page.hero.briefingCalm).includes(a.page.hero.briefingCalm))
  }
})

test("agents roster: every agent has role/watching/collaborationNote in all locales", () => {
  for (const code of ALL_LOCALES) {
    const roster = getUIMessages(code).agents.roster
    for (const id of AGENT_IDS) {
      const entry = roster[id]
      assert.ok(entry, `${code}: roster missing ${id}`)
      assert.ok(entry.role.length > 0, `${code}.${id}.role empty`)
      assert.ok(entry.collaborationNote.length > 0, `${code}.${id}.collaborationNote empty`)
      assert.ok(Array.isArray(entry.watching) && entry.watching.length > 0, `${code}.${id}.watching empty`)
      for (const w of entry.watching) assert.ok(w.length > 0, `${code}.${id} empty watching entry`)
    }
  }
})

test("agents: proper names survive translation (never localized)", () => {
  for (const code of ALL_LOCALES) {
    const a = getUIMessages(code).agents
    // Agent proper names embedded in collaboration notes stay verbatim.
    assert.ok(a.roster.forte.collaborationNote.includes("Mr. Forte"), `${code}: Mr. Forte name lost`)
    assert.ok(a.roster.fanny.collaborationNote.includes("Fanny") && a.roster.fanny.collaborationNote.includes("Felix"))
    assert.ok(a.roster.finesse.collaborationNote.includes("Fanny"), `${code}: core agent names lost in Finesse note`)
    // The hero "Fanny is on your inbox" opening keeps the proper name.
    assert.ok(a.page.hero.briefingWorking.includes("Fanny"), `${code}: hero lost Fanny`)
  }
})

test("agents: de/fr/it are real translations of the page, not English copies", () => {
  const en = getUIMessages("en").agents
  for (const code of ["de", "fr", "it"] as const) {
    const a = getUIMessages(code).agents
    assert.notEqual(a.page.roster.heading, en.page.roster.heading, `${code} heading not translated`)
    assert.notEqual(a.states.working, en.states.working, `${code} working state not translated`)
    assert.notEqual(a.roster.fanny.role, en.roster.fanny.role, `${code} fanny role not translated`)
  }
})

// ─── Today full page (I18N-TODAY-FULL-PAGE-02B) ─────────────────────────────────

test("today.startHere + today.briefing: complete and non-empty in all five locales", () => {
  const PARTS = ["morning", "afternoon", "evening"] as const
  for (const code of ALL_LOCALES) {
    const today = getUIMessages(code).today
    const sh = today.startHere
    for (const s of [
      sh.eyebrow, sh.ariaLabel, sh.allClearTitle, sh.allClearBody, sh.openTask, sh.sendToAI,
      sh.badges.overdue, sh.badges.today, sh.badges.waiting, sh.badges.undated,
      sh.source.inbox, sh.source.projectFallback, sh.source.manual, sh.source.calendar,
      sh.why.waiting, sh.why.undated,
    ]) {
      assert.equal(typeof s, "string")
      assert.ok(s.length > 0, `${code}: empty startHere string`)
    }
    assert.ok(sh.source.fromProject("Aurora").includes("Aurora"), `${code}: project name not preserved`)
    assert.ok(sh.why.overdue(" X").length > 0 && sh.why.today(" X").length > 0)
    assert.ok(sh.sinceDate("5 Jun").includes("5 Jun"))
    assert.ok(sh.atTime("4:00").includes("4:00"))

    const b = today.briefing
    assert.ok(b.ariaLabel.length > 0 && b.noMeetings.length > 0 && b.bodyAllClear.length > 0)
    for (const part of PARTS) {
      assert.ok(b.eyebrow[part].length > 0, `${code}.briefing.eyebrow.${part} empty`)
      assert.ok(b.greeting[part].length > 0, `${code}.briefing.greeting.${part} empty`)
    }
    assert.ok(b.meetings(3).includes("3"))
    assert.ok(b.bodyOverdue(2, "X").includes("2") && b.bodyOverdue(2, "X").includes("X"))
    assert.ok(b.bodyDueToday(1, "X").includes("1"))
    assert.ok(b.bodyWaiting(4, "X").includes("4"))
    assert.ok(b.bodySchedule("X").includes("X"))
    assert.ok(b.aiTail(2).includes("2"))
  }
})

test("today full page: de/fr/it are real translations, not English copies", () => {
  const en = getUIMessages("en").today
  for (const code of ["de", "fr", "it"] as const) {
    const t = getUIMessages(code).today
    assert.notEqual(t.startHere.allClearTitle, en.startHere.allClearTitle, `${code} allClear not translated`)
    assert.notEqual(t.startHere.openTask, en.startHere.openTask, `${code} openTask not translated`)
    assert.notEqual(t.briefing.greeting.morning, en.briefing.greeting.morning, `${code} greeting not translated`)
    assert.notEqual(t.briefing.bodyAllClear, en.briefing.bodyAllClear, `${code} briefing body not translated`)
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
