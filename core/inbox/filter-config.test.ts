import assert from "node:assert/strict"
import test from "node:test"
import { resolveInboxChannelsConfig, resolveInboxChannelViews } from "./channel-config"
import {
  CORE_INBOX_FILTERS_CONFIG,
  MANDATORY_INBOX_FILTER_ID,
  parseWorkspaceInboxFilters,
  planInboxFilterCounts,
  resolveActiveUrlFilter,
  resolveInboxFiltersConfig,
  resolveInboxFilterViews,
} from "./filter-config"
import { BEAUTY_PACK } from "../vertical-packs/beauty"
import { resolveWorkspaceExperience } from "../vertical-packs/experience"

/** Effective channel views for a plain core workspace. */
function coreChannelViews() {
  return resolveInboxChannelViews({ config: resolveInboxChannelsConfig() })
}

/** Effective channel views for a Beauty workspace (pack channel layer). */
function beautyChannelViews(connected: string[] = []) {
  return resolveInboxChannelViews({
    config: resolveInboxChannelsConfig(BEAUTY_PACK.inbox.channels),
    connectedChannelIds: connected,
  })
}

function beautyResolved(connected: string[] = [], workspaceLayer?: object) {
  return resolveInboxFiltersConfig({
    channelViews: beautyChannelViews(connected),
    verticalDefinitions: BEAUTY_PACK.inbox.filterDefinitions,
    layers: [BEAUTY_PACK.inbox.filters, workspaceLayer],
  })
}

// ─── Core defaults ──────────────────────────────────────────────────────────

test("core defaults reproduce the pre-registry toolbar chips and sidebar set", () => {
  const { config } = resolveInboxFiltersConfig({ channelViews: coreChannelViews() })
  assert.deepEqual(config.primary, ["all", "needs_action", "waiting", "done"])
  assert.equal(config.defaultFilter, "all")
  for (const id of ["opportunities", "closed", "archived", "trash", "unanswered", "urgent"]) {
    assert.ok(config.enabled.includes(id), id)
  }
  // The semantics-free placeholder is NOT part of the effective set.
  assert.ok(!config.enabled.includes("scheduled"))
})

test("fallback without any vertical pack resolves to core defaults", () => {
  const noLayers = resolveInboxFiltersConfig({ channelViews: coreChannelViews() })
  const nullLayers = resolveInboxFiltersConfig({
    channelViews: coreChannelViews(),
    layers: [null, undefined, {}],
  })
  assert.deepEqual(noLayers.config, nullLayers.config)
  const experience = resolveWorkspaceExperience("creative-agency")
  assert.equal(experience.inboxFilters, null)
  assert.deepEqual(experience.inboxFilterDefinitions, [])
})

// ─── Beauty resolution ──────────────────────────────────────────────────────

test("Beauty primary chips follow the pack order: work state, channels, waiting/done", () => {
  const { config } = beautyResolved()
  assert.deepEqual(config.primary, [
    "all",
    "needs_action",
    "unanswered",
    "urgent",
    "channel:whatsapp",
    "channel:instagram",
    "channel:messenger",
    "channel:tiktok",
    "channel:sms",
    "channel:email",
    "waiting",
    "done",
  ])
  assert.equal(config.defaultFilter, "all")
})

test("Beauty keeps the Email channel filter enabled", () => {
  const { config } = beautyResolved()
  assert.ok(config.enabled.includes("channel:email"))
  const views = resolveInboxFilterViews(beautyResolved())
  const email = views.find((v) => v.id === "channel:email")
  assert.ok(email)
  assert.equal(email.uiAvailability, "ready")
})

test("planned channel filters render coming_soon and never compile", () => {
  const views = resolveInboxFilterViews(beautyResolved())
  for (const id of ["channel:instagram", "channel:messenger", "channel:tiktok", "channel:sms"]) {
    const view = views.find((v) => v.id === id)
    assert.ok(view, id)
    assert.equal(view.uiAvailability, "coming_soon", id)
    assert.equal(view.compiled, null, id)
  }
  // WhatsApp (data_only channel) is selectable.
  assert.equal(views.find((v) => v.id === "channel:whatsapp")?.uiAvailability, "ready")
})

test("Beauty business filters are registered but planned — never ready, never default", () => {
  const resolved = beautyResolved([], {
    // Even a hostile workspace config cannot activate them or make one default.
    enabled: ["all", "beauty.booking_requests"],
    defaultFilter: "beauty.booking_requests",
  })
  const views = resolveInboxFilterViews(resolved)
  const booking = views.find((v) => v.id === "beauty.booking_requests")
  assert.ok(booking, "vertical definition joins the universe")
  assert.equal(booking.uiAvailability, "coming_soon")
  assert.equal(booking.compiled, null)
  assert.equal(resolved.config.defaultFilter, "all")
  // All seven business filters exist as vertical-scope definitions.
  const verticalIds = resolved.definitions.filter((d) => d.scope === "vertical").map((d) => d.id)
  assert.deepEqual(
    verticalIds.sort(),
    [
      "beauty.booking_requests",
      "beauty.cancellations",
      "beauty.new_inquiries",
      "beauty.no_show",
      "beauty.pending_confirmations",
      "beauty.rebooking",
      "beauty.reschedules",
    ],
  )
})

test("the workspace experience surfaces the Beauty filter layer and definitions", () => {
  const experience = resolveWorkspaceExperience("beauty")
  assert.deepEqual(experience.inboxFilters, BEAUTY_PACK.inbox.filters)
  assert.equal(experience.inboxFilterDefinitions.length, 7)
})

// ─── Workspace overrides ────────────────────────────────────────────────────

test("workspace overrides merge per-field on top of the pack", () => {
  const { config } = beautyResolved([], { primary: ["all", "needs_action", "unanswered"] })
  assert.deepEqual(config.primary, ["all", "needs_action", "unanswered"])
  // enabled/order inherited from the pack
  assert.ok(config.enabled.includes("channel:whatsapp"))
  assert.equal(config.defaultFilter, "all")
})

test("workspace can hide a non-mandatory core filter", () => {
  const resolved = resolveInboxFiltersConfig({
    channelViews: coreChannelViews(),
    layers: [{ hidden: ["opportunities"] }],
  })
  assert.deepEqual(resolved.config.hidden, ["opportunities"])
  const views = resolveInboxFilterViews(resolved)
  assert.ok(!views.some((v) => v.id === "opportunities"))
  // Hidden ≠ broken: the URL still resolves to the real query.
  const urlResolution = resolveActiveUrlFilter("opportunities", views)
  assert.equal(urlResolution.isFallback, false)
  assert.deepEqual(urlResolution.compiled, { status: ["lead_detected"] })
})

test("the mandatory 'all' filter cannot be disabled or hidden", () => {
  const resolved = resolveInboxFiltersConfig({
    channelViews: coreChannelViews(),
    layers: [{ enabled: ["waiting", "done"], hidden: ["all", "waiting"] }],
  })
  assert.ok(resolved.config.enabled.includes(MANDATORY_INBOX_FILTER_ID))
  assert.ok(!resolved.config.hidden.includes(MANDATORY_INBOX_FILTER_ID))
  const views = resolveInboxFilterViews(resolved)
  assert.ok(views.some((v) => v.id === "all"))
})

test("parseWorkspaceInboxFilters reads the config slice defensively", () => {
  const raw = JSON.stringify({ inbox: { filters: { primary: ["all", "urgent"] } } })
  assert.deepEqual(parseWorkspaceInboxFilters(raw), { primary: ["all", "urgent"] })
  assert.deepEqual(parseWorkspaceInboxFilters(null), {})
  assert.deepEqual(parseWorkspaceInboxFilters("{broken"), {})
  assert.deepEqual(parseWorkspaceInboxFilters(JSON.stringify({ inbox: { filters: 3 } })), {})
})

// ─── Sanitation & coherence ─────────────────────────────────────────────────

test("unknown ids are dropped and duplicates removed", () => {
  const { config } = resolveInboxFiltersConfig({
    channelViews: coreChannelViews(),
    layers: [
      {
        enabled: ["all", "ghost_filter", "waiting", "waiting", "channel:telegram", "done"],
        order: ["done", "done", "nope", "waiting", "all"],
      },
    ],
  })
  assert.deepEqual(config.enabled.sort(), ["all", "done", "waiting"])
  assert.deepEqual(config.order, ["done", "waiting", "all"])
})

test("an empty enabled override cannot leave the UI without filters", () => {
  const { config } = resolveInboxFiltersConfig({
    channelViews: coreChannelViews(),
    layers: [{ enabled: [] }],
  })
  assert.deepEqual(config.enabled, [...CORE_INBOX_FILTERS_CONFIG.enabled])
})

test("coherence: order permutes enabled; primary/secondary partition the visible set", () => {
  const { config } = resolveInboxFiltersConfig({
    channelViews: coreChannelViews(),
    layers: [
      {
        enabled: ["all", "waiting", "done", "urgent"],
        order: ["urgent"],
        primary: ["waiting", "ghost"],
        secondary: ["waiting", "done"],
        hidden: ["done"],
      },
    ],
  })
  assert.deepEqual([...config.order].sort(), [...config.enabled].sort())
  assert.deepEqual(config.primary, ["waiting"])
  // done is hidden → excluded; the rest of the visible set lands in secondary.
  assert.ok(!config.secondary.includes("done"))
  assert.ok(!config.secondary.includes("waiting"))
  for (const id of config.secondary) assert.ok(config.enabled.includes(id))
})

test("an invalid or planned defaultFilter falls back to 'all'", () => {
  const unknown = resolveInboxFiltersConfig({
    channelViews: coreChannelViews(),
    layers: [{ defaultFilter: "ghost" }],
  })
  assert.equal(unknown.config.defaultFilter, "all")
  const hiddenDefault = resolveInboxFiltersConfig({
    channelViews: coreChannelViews(),
    layers: [{ defaultFilter: "waiting", hidden: ["waiting"] }],
  })
  assert.equal(hiddenDefault.config.defaultFilter, "all")
})

// ─── Connected-channel reconciliation ───────────────────────────────────────

test("a connected channel outside the pack's enabled list still yields a filter", () => {
  // Channel layer hides email, but a live email connection exists → the
  // channel view is appended by reality, and its filter joins the universe.
  const channelViews = resolveInboxChannelViews({
    config: resolveInboxChannelsConfig({ enabled: ["manual", "whatsapp"] }),
    connectedChannelIds: ["email"],
  })
  const resolved = resolveInboxFiltersConfig({
    channelViews,
    layers: [{ enabled: ["all", "channel:whatsapp", "channel:email"] }],
  })
  const views = resolveInboxFilterViews(resolved)
  const email = views.find((v) => v.id === "channel:email")
  assert.ok(email, "connected channel's filter must be resolvable")
  assert.equal(email.uiAvailability, "ready")
})

// ─── URL resolution with effective views ────────────────────────────────────

test("URL with an old alias or unknown filter falls back safely", () => {
  const views = resolveInboxFilterViews(
    resolveInboxFiltersConfig({ channelViews: coreChannelViews() }),
  )
  // Legacy alias keeps its historical query and highlights its canonical chip.
  const needsReply = resolveActiveUrlFilter("needs_reply", views)
  assert.equal(needsReply.id, "waiting")
  assert.deepEqual(needsReply.compiled, { status: ["awaiting_response"] })
  // Retired placeholders resolve to the default view without fallback noise.
  assert.deepEqual(resolveActiveUrlFilter("todo", views).compiled, {})
  // Unknown → safe fallback to the unfiltered view.
  const unknown = resolveActiveUrlFilter("definitely-not-a-filter", views)
  assert.equal(unknown.isFallback, true)
  assert.deepEqual(unknown.compiled, {})
  // Planned channel filter never runs a query.
  const planned = resolveActiveUrlFilter("channel:instagram", views)
  assert.equal(planned.isFallback, true)
  assert.deepEqual(planned.compiled, {})
})

test("URL resolution keeps deep links working for ready channel filters", () => {
  const views = resolveInboxFilterViews(beautyResolved())
  const whatsapp = resolveActiveUrlFilter("channel:whatsapp", views)
  assert.equal(whatsapp.isFallback, false)
  assert.deepEqual(whatsapp.compiled, { channel: ["whatsapp"] })
  const unansweredFilter = resolveActiveUrlFilter("unanswered", views)
  assert.deepEqual(unansweredFilter.compiled, { unanswered: {} })
})

// ─── Counter planning (no N+1) ──────────────────────────────────────────────

test("count planning groups filters into one aggregate per strategy", () => {
  const views = resolveInboxFilterViews(beautyResolved())
  const plan = planInboxFilterCounts(views)
  // Status-countable filters share ONE status aggregation bucket.
  assert.ok(plan.status_aggregate.length >= 3)
  // Channel filters share ONE channel aggregation bucket — and only ready ones.
  assert.ok(plan.channel_aggregate.includes("channel:whatsapp"))
  assert.ok(!plan.channel_aggregate.includes("channel:instagram"))
  // The plan's shape is strategy → ids: exactly 4 aggregate buckets exist,
  // regardless of how many filters there are (this IS the no-N+1 guarantee).
  assert.deepEqual(
    Object.keys(plan).sort(),
    ["channel_aggregate", "dedicated", "status_aggregate", "urgency_aggregate"],
  )
})
