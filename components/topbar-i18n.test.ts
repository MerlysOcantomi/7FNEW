import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import path from "node:path"

import { getUIMessages } from "../core/i18n/ui"

/**
 * Global top toolbar i18n contract (7F-FIX01).
 *
 * The toolbar family (Today | Ask Fanny | Agents | New | Search) must render
 * entirely from the active locale's catalog. These tests pin the catalog
 * values per locale AND source-scan the trigger components so a hardcoded
 * English label can never silently come back.
 */

// ─── Catalog values per locale ────────────────────────────────────────────────

test("es: toolbar actions render in Spanish", () => {
  const t = getUIMessages("es")
  assert.equal(t.nav.today, "Hoy")
  assert.equal(t.nav.agents, "Agentes")
  assert.equal(t.nav.agentsOpen, "Abrir Agentes")
  assert.equal(t.globalNew.trigger, "Nuevo")
  assert.equal(t.nav.search, "Buscar")
  // "Fanny" is a proper name — kept as-is inside the Spanish label.
  assert.equal(t.nav.askFanny, "Preguntar a Fanny")
})

test("en: toolbar actions keep their English labels", () => {
  const t = getUIMessages("en")
  assert.equal(t.nav.today, "Today")
  assert.equal(t.nav.agents, "Agents")
  assert.equal(t.nav.agentsOpen, "Open Agents")
  assert.equal(t.globalNew.trigger, "New")
  assert.equal(t.nav.search, "Search")
  assert.equal(t.nav.askFanny, "Ask Fanny")
})

// ─── Source contract: triggers consume the catalog, desktop AND mobile ────────

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8")

/** Strip block + line comments so doc mentions of labels don't false-positive. */
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")

const TRIGGERS: Record<string, { file: string; keys: string[]; forbidden: RegExp[] }> = {
  today: {
    file: "components/today/global-today-trigger.tsx",
    keys: ["t.nav.today"],
    forbidden: [/>Today</, /aria-label="Today"/],
  },
  new: {
    file: "components/global-new/global-new-trigger.tsx",
    keys: ["t.globalNew.trigger"],
    forbidden: [/>New</, /aria-label="New"/],
  },
  agents: {
    file: "components/agents/global-agents-trigger.tsx",
    keys: ["t.nav.agents", "t.nav.agentsOpen"],
    forbidden: [/>Agents</, /aria-label="Agents"/, /aria-label="Open Agents"/],
  },
  askFanny: {
    file: "components/assistant/global-ask-fanny-trigger.tsx",
    keys: ["t.nav.askFanny"],
    forbidden: [/>Ask Fanny</, /aria-label="Ask Fanny"/],
  },
}

for (const [name, { file, keys, forbidden }] of Object.entries(TRIGGERS)) {
  test(`${name} trigger consumes the i18n catalog with no hardcoded labels`, () => {
    const src = stripComments(read(file))
    assert.ok(src.includes("useI18n"), `${file} must read the i18n runtime`)
    for (const key of keys) {
      assert.ok(src.includes(key), `${file} must render ${key}`)
    }
    for (const pattern of forbidden) {
      assert.ok(!pattern.test(src), `${file} still hardcodes ${pattern}`)
    }
    // Desktop and mobile live in the same module: BOTH exports must exist and
    // the catalog keys above are the only label source for either variant.
    assert.ok(/export function \w+Desktop/.test(src), `${file} missing desktop export`)
    assert.ok(/export function \w+Mobile/.test(src), `${file} missing mobile export`)
  })
}

test("app shell search affordance renders from t.nav.search", () => {
  const src = stripComments(read("components/app-shell.tsx"))
  assert.ok(src.includes("t.nav.search"))
  assert.ok(!/>Search\.\.\.</.test(src), "search placeholder must not be hardcoded")
})
