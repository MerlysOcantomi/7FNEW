import assert from "node:assert/strict"
import test from "node:test"
import { resolveInboxChannelsConfig } from "./channel-config"
import {
  BUSINESS_CHANNEL_IDS,
  channelSetupGroup,
  isWebChatReceptionEnabled,
  resolveChannelSetupViews,
  type ChannelConnectionSummary,
  type ChannelSetupInput,
} from "./channel-setup"
import { BEAUTY_PACK } from "../vertical-packs/beauty"

function makeInput(overrides: Partial<ChannelSetupInput> = {}): ChannelSetupInput {
  return {
    config: resolveInboxChannelsConfig(),
    connections: [],
    webChatReceptionEnabled: true,
    businessDisplayName: "Skina Digital",
    planMaxChannels: null,
    ...overrides,
  }
}

function connection(overrides: Partial<ChannelConnectionSummary> = {}): ChannelConnectionSummary {
  return {
    channelType: "email",
    status: "active",
    name: "Main inbox",
    externalAccountId: "inbox@example.com",
    isDefault: true,
    lastSyncAt: "2026-07-19T10:00:00.000Z",
    lastError: null,
    provider: "imap_smtp",
    ...overrides,
  }
}

function viewFor(input: ChannelSetupInput, id: string) {
  const view = resolveChannelSetupViews(input).find((v) => v.id === id)
  assert.ok(view, `expected a view for channel ${id}`)
  return view
}

// ─── Channel roster ─────────────────────────────────────────────────────────

test("business channels exclude internal records and include the mission's six", () => {
  assert.ok(!BUSINESS_CHANNEL_IDS.includes("manual"))
  for (const id of ["email", "whatsapp", "web_chat", "instagram", "messenger", "tiktok"]) {
    assert.ok(BUSINESS_CHANNEL_IDS.includes(id as (typeof BUSINESS_CHANNEL_IDS)[number]))
  }
})

test("every business channel resolves to exactly one view", () => {
  const views = resolveChannelSetupViews(makeInput())
  assert.equal(views.length, BUSINESS_CHANNEL_IDS.length)
  assert.equal(new Set(views.map((v) => v.id)).size, views.length)
})

// ─── Status transformation ──────────────────────────────────────────────────

test("email with an active connection is connected and shows its identity", () => {
  const view = viewFor(makeInput({ connections: [connection()] }), "email")
  assert.equal(view.status, "connected")
  assert.deepEqual(view.identity, { name: "Main inbox", address: "inbox@example.com" })
  assert.equal(view.canReceive, true)
  assert.equal(view.canSend, true)
  assert.equal(view.lastSyncAt, "2026-07-19T10:00:00.000Z")
  assert.equal(view.activeConnectionCount, 1)
})

test("email with no connection is available (real setup flow exists)", () => {
  const view = viewFor(makeInput(), "email")
  assert.equal(view.status, "available")
  assert.equal(view.identity, null)
  assert.equal(view.canReceive, false)
  assert.equal(view.canSend, false)
  assert.equal(view.lastSyncAt, null)
})

test("email connection in error resolves error and exposes lastError", () => {
  const view = viewFor(
    makeInput({
      connections: [connection({ status: "error", lastError: "IMAP auth failed" })],
    }),
    "email",
  )
  assert.equal(view.status, "error")
  assert.equal(view.lastError, "IMAP auth failed")
  assert.equal(view.canReceive, false)
})

test("lastError is only surfaced in error state, never for healthy rows", () => {
  const view = viewFor(
    makeInput({ connections: [connection({ lastError: "stale note from a past retry" })] }),
    "email",
  )
  assert.equal(view.status, "connected")
  assert.equal(view.lastError, null)
})

test("an active row wins over a broken sibling; identity prefers the default row", () => {
  const view = viewFor(
    makeInput({
      connections: [
        connection({ status: "error", name: "Old inbox", isDefault: false }),
        connection({ name: "Main inbox", isDefault: true }),
      ],
    }),
    "email",
  )
  assert.equal(view.status, "connected")
  assert.equal(view.identity?.name, "Main inbox")
  assert.equal(view.activeConnectionCount, 1)
})

test("pending / setup_required / unknown row statuses resolve honestly", () => {
  const pending = viewFor(
    makeInput({ connections: [connection({ status: "pending" })] }),
    "email",
  )
  assert.equal(pending.status, "pending")
  const setup = viewFor(
    makeInput({ connections: [connection({ status: "setup_required" })] }),
    "email",
  )
  assert.equal(setup.status, "setup_required")
  const unknown = viewFor(
    makeInput({ connections: [connection({ status: "something_new" })] }),
    "email",
  )
  assert.equal(unknown.status, "pending")
})

test("channels without a real setup flow are coming_soon, even when the registry has data for them", () => {
  const views = resolveChannelSetupViews(makeInput())
  for (const id of ["whatsapp", "instagram", "messenger", "tiktok", "sms"]) {
    const view = views.find((v) => v.id === id)
    assert.equal(view?.status, "coming_soon", `${id} must be coming_soon`)
  }
})

test("a whatsapp connection row created out-of-band still resolves truthfully", () => {
  const view = viewFor(
    makeInput({
      connections: [
        connection({
          channelType: "whatsapp",
          provider: "meta",
          name: "Demo WhatsApp",
          externalAccountId: "+34600000001",
          status: "pending",
        }),
      ],
    }),
    "whatsapp",
  )
  assert.equal(view.status, "pending")
  assert.equal(view.identity?.address, "+34600000001")
})

test("web chat is connected by default with the business identity", () => {
  const view = viewFor(makeInput(), "web_chat")
  assert.equal(view.status, "connected")
  assert.deepEqual(view.identity, { name: "Skina Digital", address: null })
  assert.equal(view.canReceive, true)
})

test("web chat reception toggle off resolves disabled with a real re-enable action", () => {
  const view = viewFor(makeInput({ webChatReceptionEnabled: false }), "web_chat")
  assert.equal(view.status, "disabled")
  assert.equal(view.identity, null)
  assert.equal(view.canReceive, false)
  assert.deepEqual(
    view.actions.map((a) => a.id),
    ["enable_web_chat_reception"],
  )
})

test("plan limit reached turns available into plan_locked (observational)", () => {
  const view = viewFor(
    makeInput({
      planMaxChannels: 1,
      connections: [
        connection({ channelType: "whatsapp", provider: "meta", externalAccountId: "+34600000002" }),
      ],
    }),
    "email",
  )
  assert.equal(view.status, "plan_locked")
  assert.deepEqual(view.actions, [])
})

test("plan limit never demotes an already-connected channel", () => {
  const view = viewFor(
    makeInput({ planMaxChannels: 1, connections: [connection()] }),
    "email",
  )
  assert.equal(view.status, "connected")
})

// ─── Actions honesty ────────────────────────────────────────────────────────

test("coming_soon and plan_locked channels expose no actions at all", () => {
  const views = resolveChannelSetupViews(
    makeInput({ planMaxChannels: 0 }),
  )
  for (const view of views) {
    if (view.status === "coming_soon" || view.status === "plan_locked") {
      assert.deepEqual(view.actions, [], `${view.id} must not offer fake actions`)
    }
  }
})

test("email actions match state: connect when available, manage when connected, review on error", () => {
  assert.deepEqual(
    viewFor(makeInput(), "email").actions.map((a) => a.id),
    ["connect_email"],
  )
  assert.deepEqual(
    viewFor(makeInput({ connections: [connection()] }), "email").actions.map((a) => a.id),
    ["manage_email_connections", "open_inbox"],
  )
  assert.deepEqual(
    viewFor(makeInput({ connections: [connection({ status: "error" })] }), "email").actions.map(
      (a) => a.id,
    ),
    ["review_email_connection"],
  )
})

// ─── Vertical order & tiering ───────────────────────────────────────────────

test("Beauty (Finesse) order leads with WhatsApp and tiers whatsapp/instagram primary", () => {
  const views = resolveChannelSetupViews(
    makeInput({ config: resolveInboxChannelsConfig(BEAUTY_PACK.inbox.channels) }),
  )
  assert.equal(views[0]?.id, "whatsapp")
  assert.equal(views.find((v) => v.id === "whatsapp")?.tier, "primary")
  assert.equal(views.find((v) => v.id === "instagram")?.tier, "primary")
  assert.equal(views.find((v) => v.id === "email")?.tier, "secondary")
})

test("channels missing from the config order are appended, never dropped", () => {
  const views = resolveChannelSetupViews(makeInput())
  // Core config only orders manual/web_chat/email/portal/whatsapp: the rest
  // must still appear (registry order) so the roster is complete.
  for (const id of ["instagram", "messenger", "tiktok", "sms"]) {
    assert.ok(views.some((v) => v.id === id))
  }
})

// ─── Grouping ───────────────────────────────────────────────────────────────

test("grouping: connected / actionable / future cover every status", () => {
  assert.equal(channelSetupGroup("connected"), "connected")
  for (const status of ["available", "setup_required", "pending", "error", "disabled"] as const) {
    assert.equal(channelSetupGroup(status), "actionable")
  }
  assert.equal(channelSetupGroup("plan_locked"), "future")
  assert.equal(channelSetupGroup("coming_soon"), "future")
})

// ─── Web chat config slice parsing ──────────────────────────────────────────

test("web chat reception defaults to enabled for missing/malformed config", () => {
  assert.equal(isWebChatReceptionEnabled(null), true)
  assert.equal(isWebChatReceptionEnabled(""), true)
  assert.equal(isWebChatReceptionEnabled("not json"), true)
  assert.equal(isWebChatReceptionEnabled("{}"), true)
  assert.equal(isWebChatReceptionEnabled(JSON.stringify({ inbox: {} })), true)
  assert.equal(isWebChatReceptionEnabled(JSON.stringify({ inbox: { webChat: {} } })), true)
})

test("web chat reception disables only on explicit enabled:false", () => {
  assert.equal(
    isWebChatReceptionEnabled(JSON.stringify({ inbox: { webChat: { enabled: false } } })),
    false,
  )
  assert.equal(
    isWebChatReceptionEnabled(JSON.stringify({ inbox: { webChat: { enabled: true } } })),
    true,
  )
  assert.equal(
    isWebChatReceptionEnabled(JSON.stringify({ inbox: { webChat: { enabled: "false" } } })),
    true,
  )
})
