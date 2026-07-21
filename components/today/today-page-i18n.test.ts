import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * Full `/today` page i18n contract (I18N-TODAY-FULL-PAGE-02B).
 *
 * Source-scans the breadcrumb, Start Here hero and briefing so a hardcoded
 * English label can never silently return, and pins that they consume the
 * runtime catalog. The protagonist item title and the AI-generated briefing
 * line are content and are not catalog keys.
 */

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8")
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")

const page = stripComments(read("app/today/page.tsx"))
const startHere = stripComments(read("components/today/today-start-here.tsx"))
const briefing = stripComments(read("components/today/today-briefing.tsx"))

test("breadcrumb + Start Here + briefing consume the i18n runtime", () => {
  assert.ok(page.includes("useI18n") && page.includes("t.nav.today"), "page breadcrumb must localize")
  assert.ok(startHere.includes("useI18n") && startHere.includes("t.today.startHere"), "Start Here must read the catalog")
  assert.ok(briefing.includes("useI18n") && briefing.includes("t.today.briefing"), "briefing must read the catalog")
})

test("no former hardcoded label survives on the /today page shell", () => {
  const forbiddenPage = ['{ label: "Today" }', '"Today" }']
  for (const lit of forbiddenPage) assert.ok(!page.includes(lit), `page still hardcodes: ${lit}`)

  const forbiddenStart = [
    'aria-label="Start here"', ">Start here · now<", "You're all clear", ">Open task<",
    'aria-label="Send to AI"', ">Send to AI<", '"From Inbox · assigned to you"',
    '"From a project"', '"From Calendar"', "clearing it resets your board",
    'label: "Overdue"', 'label: "Due today"',
  ]
  for (const lit of forbiddenStart) assert.ok(!startHere.includes(lit), `Start Here still hardcodes: ${lit}`)

  const forbiddenBriefing = ['aria-label="Daily briefing"', "} briefing", "Good ${"]
  for (const lit of forbiddenBriefing) assert.ok(!briefing.includes(lit), `briefing still hardcodes: ${lit}`)
})

test("Start Here keeps canonical reason logic (labels resolve by reason)", () => {
  assert.ok(startHere.includes("sh.badges[reason]"), "badge label must resolve by canonical reason")
  assert.ok(startHere.includes('reason === "overdue"'), "canonical reason branch preserved")
  // The protagonist title stays rendered verbatim (user content).
  assert.ok(startHere.includes("{item.title}"), "protagonist title must render verbatim")
})

test("Fanny proper name is kept literally in the briefing eyebrow", () => {
  assert.ok(briefing.includes("Fanny · {briefing.eyebrow[partOfDay]}"), "Fanny must stay a literal proper name")
})
