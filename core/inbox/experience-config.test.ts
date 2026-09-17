import assert from "node:assert/strict"
import test from "node:test"
import { resolveInboxChannelsConfig, resolveInboxChannelViews } from "./channel-config"
import { resolveActiveUrlFilter, resolveInboxFiltersConfig, resolveInboxFilterViews } from "./filter-config"
import {
  getInboxExperienceUiPolicy,
  INBOX_EXPERIENCE_DEFINITIONS,
  INBOX_EXPERIENCE_LEVELS,
  isInboxExperienceLevel,
  parseInboxExperienceLevel,
  resolveEffectiveInboxLayoutMode,
  shapeInboxPrimaryFilterViews,
} from "./experience-config"
import { BEAUTY_PACK } from "../vertical-packs/beauty"
import { resolveWorkspaceExperience } from "../vertical-packs/experience"

/** Effective views for a plain core workspace (no vertical, no overrides). */
function coreViews() {
  const channels = resolveInboxChannelViews({ config: resolveInboxChannelsConfig() })
  return resolveInboxFilterViews(resolveInboxFiltersConfig({ channelViews: channels }))
}

/** Effective views for a Beauty workspace (pack layers, no overrides). */
function beautyViews() {
  const experience = resolveWorkspaceExperience("beauty")
  const channels = resolveInboxChannelViews({
    config: resolveInboxChannelsConfig(BEAUTY_PACK.inbox.channels),
  })
  return resolveInboxFilterViews(
    resolveInboxFiltersConfig({
      channelViews: channels,
      verticalDefinitions: experience.inboxFilterDefinitions,
      layers: [experience.inboxFilters],
    }),
  )
}

const ids = (views: ReadonlyArray<{ id: string }>) => views.map((v) => v.id)

// ─── Level vocabulary and parsing ────────────────────────────────────────────

test("levels: exactly simple / standard / advanced, each with a frozen definition", () => {
  assert.deepEqual([...INBOX_EXPERIENCE_LEVELS], ["simple", "standard", "advanced"])
  for (const level of INBOX_EXPERIENCE_LEVELS) {
    const def = INBOX_EXPERIENCE_DEFINITIONS[level]
    assert.equal(def.level, level)
    assert.ok(Object.isFrozen(def), `${level} definition must be frozen`)
    assert.ok(Object.isFrozen(def.ui), `${level} policy must be frozen`)
    assert.ok(def.ui.maxPrimaryFilters >= 1)
  }
})

test("parseInboxExperienceLevel: accepts the closed union (trimmed, case-insensitive) and nothing else", () => {
  assert.equal(parseInboxExperienceLevel("simple"), "simple")
  assert.equal(parseInboxExperienceLevel("  Standard "), "standard")
  assert.equal(parseInboxExperienceLevel("ADVANCED"), "advanced")
  for (const bad of ["", "pro", "basic", "simplest", "simple,standard", 1, null, undefined, {}, [], true]) {
    assert.equal(parseInboxExperienceLevel(bad as unknown), null, `must reject ${JSON.stringify(bad)}`)
  }
  assert.equal(isInboxExperienceLevel("simple"), true)
  assert.equal(isInboxExperienceLevel("Simple"), false)
})

test("getInboxExperienceUiPolicy: null / unknown → null (no effective experience)", () => {
  assert.equal(getInboxExperienceUiPolicy(null), null)
  assert.equal(getInboxExperienceUiPolicy(undefined), null)
  assert.equal(getInboxExperienceUiPolicy("pro" as never), null)
  assert.equal(getInboxExperienceUiPolicy("simple"), INBOX_EXPERIENCE_DEFINITIONS.simple.ui)
})

// ─── Policy content (documented, not derived) ────────────────────────────────

test("simple policy: few controls, channels via picker, active filters always surfaced", () => {
  const ui = INBOX_EXPERIENCE_DEFINITIONS.simple.ui
  assert.deepEqual([...ui.primaryFilterIds], ["all", "needs_action", "unanswered"])
  assert.ok(ui.maxPrimaryFilters <= 4)
  assert.equal(ui.channelPresentation, "picker")
  assert.equal(ui.showAssignment, false)
  assert.equal(ui.showAdvancedFilters, false)
  assert.equal(ui.showTaxonomies, false)
  assert.equal(ui.showLayoutSwitcher, false)
  assert.equal(ui.showContextOperationalSections, false)
  assert.equal(ui.showActiveFilterTokens, true)
  // No "unread": the registry has no such filter and the level never invents one.
  assert.ok(!ui.primaryFilterIds.includes("unread"))
})

test("standard policy: organisation controls back, still no channel chips or layout modes", () => {
  const ui = INBOX_EXPERIENCE_DEFINITIONS.standard.ui
  assert.equal(ui.primaryFilterIds.length, 0)
  assert.equal(ui.channelPresentation, "picker")
  assert.equal(ui.showAssignment, true)
  assert.equal(ui.showAdvancedFilters, true)
  assert.equal(ui.showTaxonomies, true)
  assert.equal(ui.showLayoutSwitcher, false)
  assert.equal(ui.showActiveFilterTokens, true)
})

test("advanced policy: every surface, channel chips allowed, no chip cap", () => {
  const ui = INBOX_EXPERIENCE_DEFINITIONS.advanced.ui
  assert.equal(ui.channelPresentation, "chips")
  assert.equal(ui.showLayoutSwitcher, true)
  assert.equal(ui.showAdvancedFilters, true)
  assert.equal(ui.showTaxonomies, true)
  assert.equal(Number.isFinite(ui.maxPrimaryFilters), false)
})

// ─── Shaping: compatibility (no experience) ──────────────────────────────────

test("shaping with no policy is the identity on the primary tier (core and Beauty)", () => {
  for (const views of [coreViews(), beautyViews()]) {
    const expected = views.filter((v) => v.tier === "primary")
    assert.deepEqual(shapeInboxPrimaryFilterViews(views, null), expected)
    assert.deepEqual(shapeInboxPrimaryFilterViews(views, undefined), expected)
  }
  assert.deepEqual(ids(shapeInboxPrimaryFilterViews(coreViews(), null)), ["all", "needs_action", "waiting", "done"])
})

test("advanced shaping keeps the Beauty 12-chip primary row (channel chips included, coming soon included)", () => {
  const views = beautyViews()
  const advanced = shapeInboxPrimaryFilterViews(views, INBOX_EXPERIENCE_DEFINITIONS.advanced.ui)
  const primary = views.filter((v) => v.tier === "primary")
  assert.deepEqual(ids(advanced), ids(primary))
  assert.ok(ids(advanced).some((id) => id.startsWith("channel:")), "advanced keeps channel chips")
  assert.ok(advanced.some((v) => v.uiAvailability === "coming_soon"), "advanced keeps coming-soon affordances")
})

// ─── Shaping: simple ─────────────────────────────────────────────────────────

test("simple shaping on a core workspace: All / Needs attention / No reply — promoted from the secondary tier", () => {
  const views = coreViews()
  const unanswered = views.find((v) => v.id === "unanswered")
  assert.equal(unanswered?.tier, "secondary", "precondition: core keeps unanswered secondary")
  const simple = shapeInboxPrimaryFilterViews(views, INBOX_EXPERIENCE_DEFINITIONS.simple.ui)
  assert.deepEqual(ids(simple), ["all", "needs_action", "unanswered"])
  assert.ok(simple.every((v) => v.uiAvailability === "ready"))
})

test("simple shaping on Beauty: no channel chips, no coming-soon chips, ≤ 4 chips, `all` first", () => {
  const views = beautyViews()
  const simple = shapeInboxPrimaryFilterViews(views, INBOX_EXPERIENCE_DEFINITIONS.simple.ui)
  assert.deepEqual(ids(simple), ["all", "needs_action", "unanswered"])
  assert.ok(simple.length <= 4)
  assert.equal(simple[0]?.id, "all")
  assert.ok(!ids(simple).some((id) => id.startsWith("channel:")))
  assert.ok(simple.every((v) => v.uiAvailability === "ready"))
})

test("simple shaping never introduces a filter the workspace did not enable", () => {
  const channels = resolveInboxChannelViews({ config: resolveInboxChannelsConfig() })
  // Workspace override disables `unanswered` (and needs_action) entirely.
  const views = resolveInboxFilterViews(
    resolveInboxFiltersConfig({
      channelViews: channels,
      layers: [{ enabled: ["all", "waiting", "done"] }],
    }),
  )
  const simple = shapeInboxPrimaryFilterViews(views, INBOX_EXPERIENCE_DEFINITIONS.simple.ui)
  assert.deepEqual(ids(simple), ["all"])
})

test("simple shaping ignores an allow-listed id that is hidden by config (hidden = not rendered)", () => {
  const channels = resolveInboxChannelViews({ config: resolveInboxChannelsConfig() })
  const views = resolveInboxFilterViews(
    resolveInboxFiltersConfig({ channelViews: channels, layers: [{ hidden: ["unanswered"] }] }),
  )
  const simple = shapeInboxPrimaryFilterViews(views, INBOX_EXPERIENCE_DEFINITIONS.simple.ui)
  assert.deepEqual(ids(simple), ["all", "needs_action"])
})

// ─── Shaping: standard ───────────────────────────────────────────────────────

test("standard shaping on Beauty: primary tier minus channel chips, capped at 6, `all` first", () => {
  const views = beautyViews()
  const standard = shapeInboxPrimaryFilterViews(views, INBOX_EXPERIENCE_DEFINITIONS.standard.ui)
  assert.ok(standard.length <= 6)
  assert.equal(standard[0]?.id, "all")
  assert.ok(!ids(standard).some((id) => id.startsWith("channel:")))
  // Order preserved from the effective primary row.
  assert.deepEqual(ids(standard), ["all", "needs_action", "unanswered", "urgent", "waiting", "done"])
})

test("standard shaping on a core workspace equals today's core row", () => {
  const standard = shapeInboxPrimaryFilterViews(coreViews(), INBOX_EXPERIENCE_DEFINITIONS.standard.ui)
  assert.deepEqual(ids(standard), ["all", "needs_action", "waiting", "done"])
})

// ─── Shaping: robustness ─────────────────────────────────────────────────────

test("shaping with an empty view list never throws and returns an empty row", () => {
  for (const level of INBOX_EXPERIENCE_LEVELS) {
    assert.deepEqual(shapeInboxPrimaryFilterViews([], INBOX_EXPERIENCE_DEFINITIONS[level].ui), [])
  }
  assert.deepEqual(shapeInboxPrimaryFilterViews([], null), [])
})

test("shaping guarantees `all` is first even when a policy allow-list omits it", () => {
  const views = coreViews()
  const policy = { ...INBOX_EXPERIENCE_DEFINITIONS.simple.ui, primaryFilterIds: ["needs_action", "done"] }
  assert.deepEqual(ids(shapeInboxPrimaryFilterViews(views, policy)), ["all", "needs_action", "done"])
})

test("shaping honours maxPrimaryFilters (floored, at least 1)", () => {
  const views = coreViews()
  const capped = { ...INBOX_EXPERIENCE_DEFINITIONS.standard.ui, maxPrimaryFilters: 2.9 }
  assert.deepEqual(ids(shapeInboxPrimaryFilterViews(views, capped)), ["all", "needs_action"])
  const zero = { ...INBOX_EXPERIENCE_DEFINITIONS.standard.ui, maxPrimaryFilters: 0 }
  assert.deepEqual(ids(shapeInboxPrimaryFilterViews(views, zero)), ["all"])
})

test("shaping dedupes a repeated allow-list id (never two chips with the same key)", () => {
  const views = coreViews()
  const policy = {
    ...INBOX_EXPERIENCE_DEFINITIONS.simple.ui,
    primaryFilterIds: ["all", "needs_action", "needs_action", "all", "unanswered"],
  }
  assert.deepEqual(ids(shapeInboxPrimaryFilterViews(views, policy)), ["all", "needs_action", "unanswered"])
})

test("shaping does not mutate its input", () => {
  const views = beautyViews()
  const snapshot = JSON.stringify(views)
  shapeInboxPrimaryFilterViews(views, INBOX_EXPERIENCE_DEFINITIONS.simple.ui)
  shapeInboxPrimaryFilterViews(views, INBOX_EXPERIENCE_DEFINITIONS.standard.ui)
  assert.equal(JSON.stringify(views), snapshot)
})

// ─── Layout mode ─────────────────────────────────────────────────────────────

test("effective layout mode: no policy honours the persisted mode; levels without the switcher pin the fallback", () => {
  assert.equal(resolveEffectiveInboxLayoutMode("triage", null, "reading"), "triage")
  assert.equal(resolveEffectiveInboxLayoutMode("focus", undefined, "reading"), "focus")
  assert.equal(resolveEffectiveInboxLayoutMode("triage", INBOX_EXPERIENCE_DEFINITIONS.simple.ui, "reading"), "reading")
  assert.equal(resolveEffectiveInboxLayoutMode("focus", INBOX_EXPERIENCE_DEFINITIONS.standard.ui, "reading"), "reading")
  assert.equal(resolveEffectiveInboxLayoutMode("focus", INBOX_EXPERIENCE_DEFINITIONS.advanced.ui, "reading"), "focus")
})

// ─── Mission-required guarantees ─────────────────────────────────────────────

test("a chip hidden by a level stays resolvable through ?filter= (shaping never touches URL resolution)", () => {
  const views = beautyViews()
  const simpleRow = new Set(ids(shapeInboxPrimaryFilterViews(views, INBOX_EXPERIENCE_DEFINITIONS.simple.ui)))
  const hiddenReady = views.filter((v) => !simpleRow.has(v.id) && v.uiAvailability === "ready")
  assert.ok(hiddenReady.length > 0, "precondition: Simple hides at least one ready filter on Beauty")
  for (const view of hiddenReady) {
    const resolved = resolveActiveUrlFilter(view.id, views)
    assert.equal(resolved.isFallback, false, `${view.id} must still resolve from the URL`)
    assert.equal(resolved.id, view.id)
  }
  // Legacy aliases keep resolving regardless of any level.
  for (const legacy of ["needs_reply", "new", "in_progress", "leads", "urgent"]) {
    assert.equal(resolveActiveUrlFilter(legacy, views).isFallback, false, `legacy alias ${legacy} must resolve`)
  }
})

test("primaryFilterGroups is enforced: dropping the priority group removes `urgent` from the Beauty row", () => {
  const views = beautyViews()
  const withPriority = shapeInboxPrimaryFilterViews(views, INBOX_EXPERIENCE_DEFINITIONS.standard.ui)
  assert.ok(ids(withPriority).includes("urgent"), "precondition: standard keeps urgent")
  const noPriority = {
    ...INBOX_EXPERIENCE_DEFINITIONS.standard.ui,
    primaryFilterGroups: INBOX_EXPERIENCE_DEFINITIONS.standard.ui.primaryFilterGroups.filter((g) => g !== "priority"),
  }
  const shaped = shapeInboxPrimaryFilterViews(views, noPriority)
  assert.ok(!ids(shaped).includes("urgent"))
  assert.deepEqual(ids(shaped), ids(withPriority).filter((id) => id !== "urgent"))
})

test("showComingSoonFilters is enforced on non-channel planned filters (`scheduled` promoted by config)", () => {
  const channels = resolveInboxChannelViews({ config: resolveInboxChannelsConfig() })
  const views = resolveInboxFilterViews(
    resolveInboxFiltersConfig({
      channelViews: channels,
      layers: [{ enabled: ["all", "needs_action", "scheduled"], primary: ["all", "needs_action", "scheduled"] }],
    }),
  )
  const scheduled = views.find((v) => v.id === "scheduled")
  assert.equal(scheduled?.uiAvailability, "coming_soon", "precondition: scheduled is planned")
  assert.equal(scheduled?.tier, "primary")
  const shown = shapeInboxPrimaryFilterViews(views, { ...INBOX_EXPERIENCE_DEFINITIONS.standard.ui, showComingSoonFilters: true })
  assert.ok(ids(shown).includes("scheduled"))
  const hidden = shapeInboxPrimaryFilterViews(views, { ...INBOX_EXPERIENCE_DEFINITIONS.standard.ui, showComingSoonFilters: false })
  assert.ok(!ids(hidden).includes("scheduled"))
})
