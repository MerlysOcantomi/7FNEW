import assert from "node:assert/strict"
import test from "node:test"

import { composeEntityLabel, hasVocabularyOverride } from "./compose"
import { resolveVocabulary, mapVerticalKeyToBusinessType, DEFAULT_VOCABULARY } from "./index"

const beautyVocab = resolveVocabulary(mapVerticalKeyToBusinessType("salon"))
const defaultVocab = resolveVocabulary()

test("override detection: beauty defines Clienta/Clientas, default defines nothing", () => {
  assert.ok(hasVocabularyOverride(beautyVocab, "client", "plural"))
  assert.ok(hasVocabularyOverride(beautyVocab, "calendar", "singular"))
  assert.ok(!hasVocabularyOverride(defaultVocab, "client", "plural"))
  assert.ok(!hasVocabularyOverride(defaultVocab, "calendar", "singular"))
})

test("compose: Finesse shows Clientas/Agenda regardless of locale fallback", () => {
  assert.equal(
    composeEntityLabel({ vocabulary: beautyVocab, entity: "client", form: "plural", fallback: "Clientes" }),
    "Clientas",
  )
  assert.equal(
    composeEntityLabel({ vocabulary: beautyVocab, entity: "client", form: "plural", fallback: "Clients" }),
    "Clientas",
  )
  assert.equal(
    composeEntityLabel({ vocabulary: beautyVocab, entity: "calendar", form: "singular", fallback: "Calendario" }),
    "Agenda",
  )
  assert.equal(
    composeEntityLabel({ vocabulary: beautyVocab, entity: "billing", form: "plural", fallback: "Facturación" }),
    "Cobros",
  )
})

test("compose: default vocabulary falls back to the locale catalog translation", () => {
  assert.equal(
    composeEntityLabel({ vocabulary: defaultVocab, entity: "client", form: "plural", fallback: "Clientes" }),
    "Clientes",
  )
  assert.equal(
    composeEntityLabel({ vocabulary: defaultVocab, entity: "client", form: "plural", fallback: "Clients" }),
    "Clients",
  )
})

test("compose: lowercase supports mid-sentence grammar positions", () => {
  assert.equal(
    composeEntityLabel({
      vocabulary: beautyVocab,
      entity: "client",
      form: "plural",
      fallback: "Clientes",
      lowercase: true,
    }),
    "clientas",
  )
})

test("compose: workspace overrides win over presets through the existing resolver", () => {
  const custom = resolveVocabulary("beauty", { "client.plural": "Socias" })
  assert.equal(
    composeEntityLabel({ vocabulary: custom, entity: "client", form: "plural", fallback: "Clientes" }),
    "Socias",
  )
})

test("guard: DEFAULT_VOCABULARY itself never reports overrides", () => {
  for (const entity of Object.keys(DEFAULT_VOCABULARY) as Array<keyof typeof DEFAULT_VOCABULARY>) {
    assert.ok(!hasVocabularyOverride(DEFAULT_VOCABULARY, entity, "singular"))
    assert.ok(!hasVocabularyOverride(DEFAULT_VOCABULARY, entity, "plural"))
  }
})
