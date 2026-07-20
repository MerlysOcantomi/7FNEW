import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import path from "node:path"

import { getUIMessages } from "../../core/i18n/ui"

/**
 * Full `/agents` page i18n contract (I18N-AGENTS-FULL-PAGE-02).
 *
 * Source-scans the board + drawer so a hardcoded English label can never
 * silently return, and pins that both consume the runtime catalog. Agent
 * proper names and API-provided activity titles are content and are allowed
 * to stay in the source (they are not catalog keys).
 */

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8")
/** Strip comments so doc mentions of old labels don't false-positive. */
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")

const board = stripComments(read("components/agents/agents-activity-board.tsx"))
const drawer = stripComments(read("components/agents/agent-detail-drawer.tsx"))

test("board + drawer consume the i18n runtime", () => {
  for (const [name, src] of [["board", board], ["drawer", drawer]] as const) {
    assert.ok(src.includes("useI18n"), `${name} must read the i18n runtime`)
    assert.ok(src.includes("t.agents"), `${name} must render from the agents namespace`)
  }
})

test("no former hardcoded label survives in the board", () => {
  const forbidden = [
    ">Agents<", ">Live<", "working now", "awaiting you",
    '"Working now"', '"Needs review"', '"Automated today"',
    "Your agents · live", "6 specialists + Francis", ">Live activity<",
    "No actions have run yet today", ">From Inbox<", "Needs your review",
    "No proposals waiting for you", "Nothing needs your attention",
    ">proposes<", ">Approve<", ">Dismiss<", "View context",
    "Adjust autonomy", "No proposals to review", "Runs low-risk work",
    "Up to date — watching", "Ready in your registry — coming online",
  ]
  for (const lit of forbidden) {
    assert.ok(!board.includes(lit), `board still hardcodes: ${lit}`)
  }
})

test("no former hardcoded label survives in the drawer", () => {
  const forbidden = [
    ">Doing now<", ">Today<", "Works with the team", ">Watching<",
    "Recently handled", "No activity yet today", "Open in {",
    "Section coming online", 'aria-label="Close', 'aria-label="Close agent details"',
    "This agent's section is coming online",
  ]
  for (const lit of forbidden) {
    assert.ok(!drawer.includes(lit), `drawer still hardcodes: ${lit}`)
  }
})

test("technical status/autonomy values are untouched (labels resolve by canonical value)", () => {
  // The board/drawer must key off the canonical value, never a translated label.
  assert.ok(board.includes("agentStatusLabel(live.status"), "board must resolve status by canonical value")
  assert.ok(board.includes('live.status === "working"'), "board keeps canonical status logic")
  assert.ok(drawer.includes("agentStatusLabel(live.status"), "drawer must resolve status by canonical value")
})

test("Forte section label stays a brand name; others reuse nav", () => {
  assert.ok(drawer.includes('case "/inbox": return t.nav.inbox'))
  assert.ok(drawer.includes('case "/forte": return "Forte"'))
  // Sanity: nav has the reused concepts in en + es.
  for (const code of ["en", "es"] as const) {
    const nav = getUIMessages(code).nav
    assert.ok(nav.inbox.length > 0 && nav.finance.length > 0 && nav.clients.length > 0)
  }
})
