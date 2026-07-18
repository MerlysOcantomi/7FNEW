import assert from "node:assert/strict"
import test from "node:test"

import { composeEntityLabel, hasVocabularyOverride } from "./compose"
import { resolveVocabulary, mapVerticalKeyToBusinessType, DEFAULT_VOCABULARY } from "./index"

const beautyType = mapVerticalKeyToBusinessType("salon")
const beautyEs = resolveVocabulary(beautyType, undefined, "es")
const beautyEn = resolveVocabulary(beautyType, undefined, "en")
const beautyDe = resolveVocabulary(beautyType, undefined, "de")
const defaultEs = resolveVocabulary("default", undefined, "es")

// ─── localized preset (vertical defaults follow the effective locale) ─────────

test("Finesse es: neutral Cliente/Clientes plus Agenda/Mensajes/Cobros", () => {
  assert.equal(beautyEs.client.singular, "Cliente")
  assert.equal(beautyEs.client.plural, "Clientes")
  assert.equal(beautyEs.calendar.singular, "Agenda")
  assert.equal(beautyEs.inbox.singular, "Mensajes")
  assert.equal(beautyEs.billing.plural, "Cobros")
  assert.equal(beautyEs.project.plural, "Servicios")
  assert.equal(beautyEs.member.singular, "Equipo")
})

test("Finesse en: English nouns — no Spanish leaks into an English UI", () => {
  assert.equal(beautyEn.client.plural, "Clients")
  assert.equal(beautyEn.calendar.singular, "Calendar")
  assert.equal(beautyEn.inbox.singular, "Messages")
  assert.equal(beautyEn.billing.singular, "Billing")
  assert.equal(beautyEn.project.plural, "Services")
  assert.equal(beautyEn.member.singular, "Team")
  const spanish = ["Clienta", "Clientas", "Agenda", "Mensajes", "Cobros", "Servicio "]
  for (const label of Object.values(beautyEn).flatMap((l) => [l.singular, l.plural])) {
    for (const word of spanish) assert.ok(!label.includes(word), `Spanish leak: ${label}`)
  }
})

test("Finesse de: full English fallback until P5 (base preset, no es variant)", () => {
  assert.deepEqual(beautyDe, beautyEn)
})

test("regional locale variants normalize to the preset locale (es-MX → es)", () => {
  assert.deepEqual(resolveVocabulary(beautyType, undefined, "es-MX"), beautyEs)
})

test("standard Finesse NEVER produces Clienta/Clientas", () => {
  for (const vocab of [beautyEs, beautyEn, beautyDe]) {
    for (const label of Object.values(vocab).flatMap((l) => [l.singular, l.plural])) {
      assert.ok(!/Clienta/.test(label), `unexpected Clienta form: ${label}`)
    }
  }
})

// ─── shared-catalog fallback (no vertical noun chosen) ────────────────────────

test("compose: es-localized Finesse noun wins over the locale catalog fallback", () => {
  assert.equal(
    composeEntityLabel({ vocabulary: beautyEs, entity: "calendar", form: "singular", fallback: "Calendario" }),
    "Agenda",
  )
  assert.equal(
    composeEntityLabel({ vocabulary: beautyEs, entity: "billing", form: "plural", fallback: "Facturación" }),
    "Cobros",
  )
})

test("compose: without a vertical noun the locale catalog fallback renders", () => {
  // Finesse es client = Cliente/Clientes → generic; catalog decides the text.
  assert.equal(
    composeEntityLabel({ vocabulary: beautyEs, entity: "client", form: "plural", fallback: "Clientes" }),
    "Clientes",
  )
  // Finesse en client is the plain default → English catalog fallback renders.
  assert.equal(
    composeEntityLabel({ vocabulary: beautyEn, entity: "client", form: "plural", fallback: "Clients" }),
    "Clients",
  )
  // Non-Finesse workspace inherits nothing from Beauty.
  assert.equal(defaultEs.calendar.singular, "Calendar")
  assert.equal(
    composeEntityLabel({ vocabulary: defaultEs, entity: "calendar", form: "singular", fallback: "Calendario" }),
    "Calendario",
  )
})

// ─── explicit workspace override (real personalization) ───────────────────────

test("workspace override wins over the localized preset, under any locale", () => {
  const es = resolveVocabulary(beautyType, { "client.plural": "Socias" }, "es")
  const en = resolveVocabulary(beautyType, { "client.plural": "Socias" }, "en")
  assert.equal(es.client.plural, "Socias")
  assert.equal(en.client.plural, "Socias")
  assert.equal(
    composeEntityLabel({ vocabulary: es, entity: "client", form: "plural", fallback: "Clientes" }),
    "Socias",
  )
  // Un-overridden entities keep their localized preset values.
  assert.equal(es.calendar.singular, "Agenda")
  assert.equal(en.calendar.singular, "Calendar")
})

// ─── misc invariants ──────────────────────────────────────────────────────────

test("compose: lowercase supports mid-sentence grammar positions", () => {
  assert.equal(
    composeEntityLabel({
      vocabulary: beautyEs,
      entity: "inbox",
      form: "singular",
      fallback: "Bandeja de entrada",
      lowercase: true,
    }),
    "mensajes",
  )
})

test("guard: DEFAULT_VOCABULARY itself never reports overrides", () => {
  for (const entity of Object.keys(DEFAULT_VOCABULARY) as Array<keyof typeof DEFAULT_VOCABULARY>) {
    assert.ok(!hasVocabularyOverride(DEFAULT_VOCABULARY, entity, "singular"))
    assert.ok(!hasVocabularyOverride(DEFAULT_VOCABULARY, entity, "plural"))
  }
})
