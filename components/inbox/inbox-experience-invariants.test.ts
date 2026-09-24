import assert from "node:assert/strict"
import test from "node:test"
import { readFileSync } from "node:fs"
import path from "node:path"

/**
 * INBOX-UX-SAFE-01 — page/component-layer pins for the HARD INVARIANT
 * "no `?experience=` → the Inbox renders exactly as before".
 *
 * The pure helpers are unit-tested in `core/inbox/experience-config.test.ts`;
 * this file source-scans the wiring (the page and the two components) so a
 * future edit that flips a default or drops a null-policy guard cannot pass
 * the suite unnoticed. Same technique as `components/today/today-page-i18n.test.ts`
 * (the page is a client component with fetch hooks, so a render test is not
 * practical here).
 */

const read = (rel: string) => readFileSync(path.join(process.cwd(), rel), "utf8")
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "")

const page = stripComments(read("app/inbox/page.tsx"))
const toolbar = stripComments(read("components/inbox/inbox-toolbar.tsx"))
const activeFilters = stripComments(read("components/inbox/inbox-active-filters.tsx"))

test("toolbar: the advanced-filters surface defaults to today's behaviour (shown) when the page passes nothing", () => {
  assert.ok(toolbar.includes("showAdvancedFilters = true,"), "InboxToolbar must default showAdvancedFilters to true")
  assert.ok(toolbar.includes("{!isTodoMode && showAdvancedFilters ? ("), "More-filters trigger must be gated by the prop")
  assert.ok(toolbar.includes("{!isTodoMode && showAdvancedFilters && moreOpen ? ("), "More-filters panel must be gated by the prop")
  assert.ok(
    page.includes("showAdvancedFilters={experiencePolicy ? experiencePolicy.showAdvancedFilters : undefined}"),
    "page must pass undefined (→ default true) when there is no effective experience",
  )
})

test("page: taxonomy chips and the layout switcher render whenever there is no effective experience", () => {
  assert.ok(
    page.includes("{experiencePolicy && !experiencePolicy.showTaxonomies ? null : ("),
    "taxonomy chips guard must only hide with a policy that says so",
  )
  assert.ok(
    page.includes("{experiencePolicy && !experiencePolicy.showLayoutSwitcher ? null : ("),
    "layout switcher guard must only hide with a policy that says so",
  )
})

test("page: the preview badge exists only with a valid level and the tokens row is empty without a policy", () => {
  assert.ok(page.includes("{experienceLevel ? ("), "preview badge must be gated on a parsed level")
  assert.ok(
    page.includes("if (!experiencePolicy?.showActiveFilterTokens) return []"),
    "active-filter tokens must be empty without an effective experience",
  )
  assert.ok(activeFilters.includes("if (tokens.length === 0) return null"), "InboxActiveFilters must render nothing when empty")
  assert.ok(activeFilters.includes("{tokens.length > 1 ? ("), "clear-all must only appear with more than one token")
})

test("page: the level comes ONLY from the URL preview and is never persisted", () => {
  assert.ok(
    page.includes('parseInboxExperienceLevel(searchParams.get("experience"))'),
    "level must be parsed from the ?experience= search param",
  )
  // No persistence of the level anywhere in the page (localStorage keys stay the two pre-existing ones:
  // the layout mode and the email view mode).
  const storageKeys = [...page.matchAll(/localStorage\.(?:setItem|getItem)\(\s*([A-Z_]+|"[^"]+")/g)].map((m) => m[1])
  assert.ok(storageKeys.length > 0, "precondition: the page persists its pre-existing preferences")
  for (const key of storageKeys) {
    assert.ok(
      key === "LAYOUT_MODE_STORAGE_KEY" || key === "EMAIL_VIEW_MODE_STORAGE_KEY",
      `unexpected localStorage key in the inbox page: ${key}`,
    )
  }
  assert.ok(!/experience[^\n]*localStorage|localStorage[^\n]*experience/i.test(page), "experience must never touch localStorage")
  assert.ok(!/fetch\([^)]*experience/i.test(page), "experience must never be sent to or fetched from an API")
})

test("page: every layout-mode comparison in the render tree uses the effective (policy-aware) mode", () => {
  assert.ok(
    page.includes('resolveEffectiveInboxLayoutMode(layoutMode, experiencePolicy, "reading")'),
    "effectiveLayoutMode must derive from the persisted mode + policy",
  )
  const rawComparisons = page.match(/(?<!effective)layoutMode === /g) ?? []
  assert.equal(rawComparisons.length, 0, "no JSX branch may compare the raw persisted layoutMode")
  const effectiveComparisons = page.match(/effectiveLayoutMode === /g) ?? []
  assert.ok(effectiveComparisons.length >= 6, `expected ≥6 effectiveLayoutMode comparisons, found ${effectiveComparisons.length}`)
  // Persistence + switcher keep reading/writing the raw mode.
  assert.ok(page.includes("<InboxLayoutSwitcher value={layoutMode} onChange={handleLayoutModeChange} />"))
})
