import assert from "node:assert/strict"
import test from "node:test"
import {
  CORE_INBOX_CHANNELS_CONFIG,
  extractInboxChannelsSlice,
  parseWorkspaceInboxChannels,
  resolveInboxChannelsConfig,
  resolveInboxChannelViews,
} from "./channel-config"
import { BEAUTY_PACK, buildBeautyDefaultConfig } from "../vertical-packs/beauty"
import { resolveWorkspaceExperience } from "../vertical-packs/experience"

// ─── Core defaults (no vertical pack, no overrides) ─────────────────────────

test("core defaults reproduce the legacy hardcoded filter list and order", () => {
  const config = resolveInboxChannelsConfig()
  assert.deepEqual(config.order, ["manual", "web_chat", "email", "portal", "whatsapp"])
  assert.deepEqual(config.enabled, config.order)
  assert.equal(config.defaultChannel, "email")
})

test("fallback with no vertical pack: null/empty layers resolve to core", () => {
  assert.deepEqual(resolveInboxChannelsConfig(null, undefined, {}), resolveInboxChannelsConfig())
  const experience = resolveWorkspaceExperience("creative-agency")
  assert.equal(experience.inboxChannels, null)
  assert.deepEqual(
    resolveInboxChannelsConfig(experience.inboxChannels),
    resolveInboxChannelsConfig(),
  )
})

test("core untiered config reports every enabled channel as primary in views", () => {
  const views = resolveInboxChannelViews({ config: resolveInboxChannelsConfig() })
  assert.ok(views.every((v) => v.tier === "primary"))
})

// ─── Beauty pack layer ──────────────────────────────────────────────────────

test("Beauty resolves WhatsApp first and the messaging order declared by the pack", () => {
  const config = resolveInboxChannelsConfig(BEAUTY_PACK.inbox.channels)
  assert.equal(config.order[0], "whatsapp")
  const messagingOrder = config.order.filter((id) =>
    ["whatsapp", "instagram", "messenger", "tiktok", "sms", "email"].includes(id),
  )
  assert.deepEqual(messagingOrder, ["whatsapp", "instagram", "messenger", "tiktok", "sms", "email"])
})

test("Beauty keeps Email ENABLED and last in the visual order", () => {
  const config = resolveInboxChannelsConfig(BEAUTY_PACK.inbox.channels)
  assert.ok(config.enabled.includes("email"))
  assert.equal(config.order[config.order.length - 1], "email")
})

test("Beauty declares tiering and a declarative default channel", () => {
  const config = resolveInboxChannelsConfig(BEAUTY_PACK.inbox.channels)
  assert.deepEqual(config.primary, ["whatsapp", "instagram"])
  assert.equal(config.defaultChannel, "whatsapp")
  // primary/secondary partition enabled exactly
  assert.deepEqual(
    [...config.primary, ...config.secondary].sort(),
    [...config.enabled].sort(),
  )
})

test("the Beauty pack inbox block survives defaultConfig serialization", () => {
  const slice = extractInboxChannelsSlice(JSON.parse(buildBeautyDefaultConfig()))
  assert.deepEqual(
    resolveInboxChannelsConfig(slice),
    resolveInboxChannelsConfig(BEAUTY_PACK.inbox.channels),
  )
})

test("the workspace experience surfaces the Beauty inbox channel layer", () => {
  const experience = resolveWorkspaceExperience("beauty")
  assert.deepEqual(experience.inboxChannels, BEAUTY_PACK.inbox.channels)
})

// ─── Workspace overrides ────────────────────────────────────────────────────

test("workspace can override one field and inherit the rest from the pack", () => {
  const config = resolveInboxChannelsConfig(BEAUTY_PACK.inbox.channels, {
    defaultChannel: "email",
  })
  assert.equal(config.defaultChannel, "email")
  // enabled/order inherited from the pack, untouched
  assert.equal(config.order[0], "whatsapp")
  assert.equal(config.order[config.order.length - 1], "email")
})

test("workspace order override applies without losing the pack's enabled list", () => {
  const config = resolveInboxChannelsConfig(BEAUTY_PACK.inbox.channels, {
    order: ["email", "whatsapp"],
  })
  // declared order first, remaining enabled channels appended — none disappear
  assert.equal(config.order[0], "email")
  assert.equal(config.order[1], "whatsapp")
  assert.deepEqual([...config.order].sort(), [...config.enabled].sort())
})

test("workspace can disable channels by narrowing enabled", () => {
  const config = resolveInboxChannelsConfig(BEAUTY_PACK.inbox.channels, {
    enabled: ["whatsapp", "email"],
  })
  assert.deepEqual(config.enabled.sort(), ["email", "whatsapp"])
  // order collapses to the enabled subset, pack sequence preserved
  assert.deepEqual(config.order, ["whatsapp", "email"])
})

test("parseWorkspaceInboxChannels reads the config slice and never throws", () => {
  const raw = JSON.stringify({
    modules: {},
    inbox: { channels: { order: ["email", "manual"] } },
  })
  const config = resolveInboxChannelsConfig(parseWorkspaceInboxChannels(raw))
  assert.equal(config.order[0], "email")
  assert.equal(config.order[1], "manual")

  assert.deepEqual(parseWorkspaceInboxChannels(null), {})
  assert.deepEqual(parseWorkspaceInboxChannels("not json {"), {})
  assert.deepEqual(parseWorkspaceInboxChannels(JSON.stringify({ inbox: "nope" })), {})
  assert.deepEqual(extractInboxChannelsSlice([1, 2, 3]), {})
})

// ─── Sanitation: unknown ids, duplicates, malformed fields ──────────────────

test("unknown channels are dropped from every list", () => {
  const config = resolveInboxChannelsConfig({
    enabled: ["whatsapp", "telegram", "email", "carrier-pigeon"],
    order: ["telegram", "email", "whatsapp"],
    primary: ["telegram", "whatsapp"],
    defaultChannel: "telegram",
  })
  assert.deepEqual(config.enabled.sort(), ["email", "whatsapp"])
  assert.deepEqual(config.primary, ["whatsapp"])
  // invalid defaultChannel string is ignored → core default (email) survives
  assert.equal(config.defaultChannel, "email")
})

test("duplicates are removed keeping the first occurrence", () => {
  const config = resolveInboxChannelsConfig({
    enabled: ["email", "whatsapp", "email", "whatsapp", "manual"],
    order: ["whatsapp", "whatsapp", "email", "manual", "email"],
  })
  assert.deepEqual(config.enabled.sort(), ["email", "manual", "whatsapp"])
  assert.deepEqual(config.order, ["whatsapp", "email", "manual"])
})

test("malformed field shapes are ignored, inheriting the previous layer", () => {
  const config = resolveInboxChannelsConfig({
    enabled: "everything",
    order: 42,
    primary: { nope: true },
    defaultChannel: 7,
  } as never)
  assert.deepEqual(config.order, [...CORE_INBOX_CHANNELS_CONFIG.order])
  assert.equal(config.defaultChannel, "email")
})

test("an empty enabled override cannot hide every channel", () => {
  const config = resolveInboxChannelsConfig({ enabled: [] })
  assert.deepEqual(config.enabled, [...CORE_INBOX_CHANNELS_CONFIG.enabled])
})

// ─── Coherence between enabled / order / primary / secondary / default ──────

test("coherence: order is a permutation of enabled; primary/secondary partition it", () => {
  const config = resolveInboxChannelsConfig({
    enabled: ["email", "whatsapp", "manual"],
    order: ["whatsapp"], // missing channels appended
    primary: ["email", "sms"], // sms not enabled → dropped
    secondary: ["email", "manual"], // email is primary → dropped from secondary
    defaultChannel: "sms", // not enabled → falls back
  })
  assert.deepEqual(config.order, ["whatsapp", "email", "manual"])
  assert.deepEqual(config.primary, ["email"])
  assert.deepEqual(config.secondary.sort(), ["manual", "whatsapp"])
  // fallback default: first selectable channel in visual order
  assert.equal(config.defaultChannel, "whatsapp")
})

// ─── Views: enabled vs connected vs coming soon ─────────────────────────────

test("planned channels surface as coming_soon and are never selectable", () => {
  const config = resolveInboxChannelsConfig(BEAUTY_PACK.inbox.channels)
  const views = resolveInboxChannelViews({ config, connectedChannelIds: [] })
  const instagram = views.find((v) => v.id === "instagram")
  assert.ok(instagram)
  assert.equal(instagram.uiAvailability, "coming_soon")
  const whatsapp = views.find((v) => v.id === "whatsapp")
  assert.ok(whatsapp)
  assert.equal(whatsapp.uiAvailability, "ready")
})

test("enabled but not connected: still selectable, connection state reported", () => {
  const config = resolveInboxChannelsConfig() // includes email, requiresConnection
  const views = resolveInboxChannelViews({ config, connectedChannelIds: [] })
  const email = views.find((v) => v.id === "email")
  assert.ok(email)
  assert.equal(email.connectionState, "not_connected")
  assert.equal(email.uiAvailability, "ready")
  const manual = views.find((v) => v.id === "manual")
  assert.ok(manual)
  assert.equal(manual.connectionState, "not_required")
})

test("a connected channel missing from the enabled list is appended, not hidden", () => {
  const config = resolveInboxChannelsConfig({ enabled: ["manual", "whatsapp"] })
  const views = resolveInboxChannelViews({ config, connectedChannelIds: ["email"] })
  const email = views.find((v) => v.id === "email")
  assert.ok(email, "connected channel must stay reachable")
  assert.equal(email.enabledBySetting, false)
  assert.equal(email.connectionState, "connected")
  assert.equal(email.tier, "secondary")
  // appended after the configured channels
  assert.equal(views[views.length - 1].id, "email")
})

test("views mark the declared default channel and honor configured order", () => {
  const config = resolveInboxChannelsConfig(BEAUTY_PACK.inbox.channels)
  const views = resolveInboxChannelViews({ config, connectedChannelIds: ["email"] })
  assert.equal(views[0].id, "whatsapp")
  assert.equal(views[0].isDefault, true)
  assert.equal(views[views.length - 1].id, "email")
  assert.equal(views[views.length - 1].connectionState, "connected")
  // no duplicates even when a connected channel is also enabled
  assert.equal(new Set(views.map((v) => v.id)).size, views.length)
})
