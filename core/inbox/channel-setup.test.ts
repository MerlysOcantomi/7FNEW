import assert from "node:assert/strict"
import test from "node:test"
import { resolveInboxChannelsConfig } from "./channel-config"
import {
  BUSINESS_CHANNEL_IDS,
  channelSetupGroup,
  countConnectedChannels,
  emailProviderLabel,
  getWebChatActivation,
  isDemoAccountAddress,
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
    webChatActivation: "unset",
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

test("business channels exclude internal records AND the not-yet-real portal", () => {
  assert.ok(!BUSINESS_CHANNEL_IDS.includes("manual"))
  assert.ok(!BUSINESS_CHANNEL_IDS.includes("portal"))
  for (const id of ["email", "whatsapp", "web_chat", "instagram", "messenger", "tiktok"]) {
    assert.ok(BUSINESS_CHANNEL_IDS.includes(id as (typeof BUSINESS_CHANNEL_IDS)[number]))
  }
})

test("portal never appears in resolved views, even when config enables it", () => {
  // Core config enables portal for the Inbox — the Business Profile surface
  // must still hide it until a real client portal flow exists.
  const views = resolveChannelSetupViews(makeInput())
  assert.ok(views.every((v) => v.id !== "portal"))
})

test("every business channel resolves to exactly one view", () => {
  const views = resolveChannelSetupViews(makeInput())
  assert.equal(views.length, BUSINESS_CHANNEL_IDS.length)
  assert.equal(new Set(views.map((v) => v.id)).size, views.length)
})

// ─── Web chat honesty ───────────────────────────────────────────────────────

test("web chat WITHOUT an explicit activation signal is coming_soon with no actions", () => {
  const view = viewFor(makeInput(), "web_chat")
  assert.equal(view.status, "coming_soon")
  assert.deepEqual(view.actions, [])
  assert.equal(view.identity, null)
  assert.equal(view.canReceive, false)
})

test("web chat explicitly enabled is connected with the business identity and a real toggle", () => {
  const view = viewFor(makeInput({ webChatActivation: "enabled" }), "web_chat")
  assert.equal(view.status, "connected")
  assert.deepEqual(view.identity, { name: "Skina Digital", address: null })
  assert.ok(view.actions.some((a) => a.id === "disable_web_chat_reception"))
})

test("web chat explicitly disabled resolves disabled with a real re-enable action", () => {
  const view = viewFor(makeInput({ webChatActivation: "disabled" }), "web_chat")
  assert.equal(view.status, "disabled")
  assert.deepEqual(
    view.actions.map((a) => a.id),
    ["enable_web_chat_reception"],
  )
})

// ─── Email single channel, multiple accounts ────────────────────────────────

test("email with zero accounts is available and lists no accounts", () => {
  const view = viewFor(makeInput(), "email")
  assert.equal(view.status, "available")
  assert.deepEqual(view.emailAccounts, [])
  assert.equal(view.activeConnectionCount, 0)
})

test("email with one account is connected and lists it", () => {
  const view = viewFor(makeInput({ connections: [connection()] }), "email")
  assert.equal(view.status, "connected")
  assert.equal(view.emailAccounts.length, 1)
  assert.equal(view.emailAccounts[0]?.address, "inbox@example.com")
  assert.equal(view.emailAccounts[0]?.providerLabel, "IMAP/SMTP")
  assert.equal(view.emailAccounts[0]?.isDefault, true)
})

test("email with several accounts stays ONE channel listing every account", () => {
  const rows = [
    connection({ name: "Reservas", externalAccountId: "reservas@example.com", isDefault: true }),
    connection({
      name: "Ventas",
      externalAccountId: "ventas@example.com",
      isDefault: false,
      provider: "google",
    }),
    connection({
      name: "Reclamaciones",
      externalAccountId: "reclamaciones@example.com",
      isDefault: false,
      status: "error",
      lastError: "IMAP auth failed",
    }),
  ]
  const views = resolveChannelSetupViews(makeInput({ connections: rows }))
  const emailViews = views.filter((v) => v.id === "email")
  assert.equal(emailViews.length, 1)
  const view = emailViews[0]!
  assert.equal(view.status, "connected") // active accounts win overall
  assert.equal(view.emailAccounts.length, 3)
  assert.equal(view.activeConnectionCount, 2)
  // Identity summarizes the primary account
  assert.equal(view.identity?.address, "reservas@example.com")
  // Per-account error detail is preserved even when the channel is connected
  const broken = view.emailAccounts.find((a) => a.address === "reclamaciones@example.com")
  assert.equal(broken?.status, "error")
  assert.equal(broken?.lastError, "IMAP auth failed")
  // Provider labels resolve per account
  assert.equal(
    view.emailAccounts.find((a) => a.address === "ventas@example.com")?.providerLabel,
    "Google Workspace",
  )
})

test("exactly one primary account is reported when rows are well-formed", () => {
  const rows = [
    connection({ externalAccountId: "a@example.com", isDefault: true }),
    connection({ externalAccountId: "b@example.com", isDefault: false }),
  ]
  const view = viewFor(makeInput({ connections: rows }), "email")
  assert.equal(view.emailAccounts.filter((a) => a.isDefault).length, 1)
})

test("email all-broken accounts resolve the channel to error", () => {
  const view = viewFor(
    makeInput({
      connections: [connection({ status: "error", lastError: "IMAP auth failed" })],
    }),
    "email",
  )
  assert.equal(view.status, "error")
  assert.equal(view.lastError, "IMAP auth failed")
})

test("lastError is only surfaced at channel level in error state", () => {
  const view = viewFor(
    makeInput({ connections: [connection({ lastError: "stale note from a past retry" })] }),
    "email",
  )
  assert.equal(view.status, "connected")
  assert.equal(view.lastError, null)
})

test("pending / setup_required / unknown row statuses resolve honestly", () => {
  const pending = viewFor(makeInput({ connections: [connection({ status: "pending" })] }), "email")
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

test("email provider labels map known providers and fall back to the raw value", () => {
  assert.equal(emailProviderLabel("imap_smtp"), "IMAP/SMTP")
  assert.equal(emailProviderLabel("gmail"), "Gmail")
  assert.equal(emailProviderLabel("google_workspace"), "Google Workspace")
  assert.equal(emailProviderLabel("microsoft"), "Outlook / Microsoft 365")
  assert.equal(emailProviderLabel("resend"), "Resend")
  assert.equal(emailProviderLabel("demo"), "Demo")
  assert.equal(emailProviderLabel("something_else"), "something_else")
})

test("demo accounts are detected by the reserved .invalid TLD only", () => {
  assert.equal(isDemoAccountAddress("hello@finesse-demo.invalid"), true)
  assert.equal(isDemoAccountAddress("finesse.demo@gmail.invalid"), true)
  assert.equal(isDemoAccountAddress("hola@salon-real.com"), false)
  assert.equal(isDemoAccountAddress(null), false)
  const view = viewFor(
    makeInput({
      connections: [connection({ externalAccountId: "hello@finesse-demo.invalid", provider: "demo" })],
    }),
    "email",
  )
  assert.equal(view.emailAccounts[0]?.isDemo, true)
})

// ─── No fabricated states for unintegrated channels ─────────────────────────

test("channels without a real setup flow are coming_soon with no actions", () => {
  const views = resolveChannelSetupViews(makeInput())
  for (const id of ["whatsapp", "instagram", "messenger", "tiktok", "sms"]) {
    const view = views.find((v) => v.id === id)
    assert.equal(view?.status, "coming_soon", `${id} must be coming_soon`)
    assert.deepEqual(view?.actions, [], `${id} must not offer actions`)
  }
})

test("pending appears ONLY when a persisted connection row exists", () => {
  // No row → coming_soon, even for the Finesse-priority channel.
  assert.equal(viewFor(makeInput(), "whatsapp").status, "coming_soon")
  // A real persisted row in a lifecycle state → pending, honestly reflected.
  const view = viewFor(
    makeInput({
      connections: [
        connection({
          channelType: "whatsapp",
          provider: "meta",
          name: "Real onboarding in progress",
          externalAccountId: "+34911111111",
          status: "pending",
        }),
      ],
    }),
    "whatsapp",
  )
  assert.equal(view.status, "pending")
})

// ─── Plan counting ──────────────────────────────────────────────────────────

test("plan counter counts DISTINCT connected channels, not rows", () => {
  assert.equal(countConnectedChannels([]), 0)
  assert.equal(
    countConnectedChannels([
      connection({ externalAccountId: "a@example.com" }),
      connection({ externalAccountId: "b@example.com" }),
      connection({ externalAccountId: "c@example.com" }),
    ]),
    1, // three mailboxes, one email channel
  )
  assert.equal(
    countConnectedChannels([
      connection(),
      connection({ channelType: "whatsapp", externalAccountId: "+34911111111", provider: "meta" }),
    ]),
    2,
  )
  // Non-active rows never count.
  assert.equal(countConnectedChannels([connection({ status: "pending" })]), 0)
  assert.equal(countConnectedChannels([connection({ status: "error" })]), 0)
})

test("plan limit reached turns available into plan_locked, never demotes connected", () => {
  // Email available + a connected whatsapp fills a 1-channel plan.
  const locked = viewFor(
    makeInput({
      planMaxChannels: 1,
      connections: [
        connection({ channelType: "whatsapp", provider: "meta", externalAccountId: "+34911111111" }),
      ],
    }),
    "email",
  )
  assert.equal(locked.status, "plan_locked")
  assert.deepEqual(locked.actions, [])

  // Multiple email accounts = 1 channel: email itself stays connected and
  // its own accounts never lock it.
  const connected = viewFor(
    makeInput({
      planMaxChannels: 1,
      connections: [
        connection({ externalAccountId: "a@example.com" }),
        connection({ externalAccountId: "b@example.com" }),
      ],
    }),
    "email",
  )
  assert.equal(connected.status, "connected")
})

// ─── Actions honesty ────────────────────────────────────────────────────────

test("coming_soon and plan_locked channels expose no actions at all", () => {
  const views = resolveChannelSetupViews(makeInput({ planMaxChannels: 0 }))
  for (const view of views) {
    if (view.status === "coming_soon" || view.status === "plan_locked") {
      assert.deepEqual(view.actions, [], `${view.id} must not offer fake actions`)
    }
  }
})

test("email actions match state, including connect-another when connected", () => {
  assert.deepEqual(
    viewFor(makeInput(), "email").actions.map((a) => a.id),
    ["connect_email"],
  )
  assert.deepEqual(
    viewFor(makeInput({ connections: [connection()] }), "email").actions.map((a) => a.id),
    ["manage_email_connections", "connect_another_email", "open_inbox"],
  )
  assert.deepEqual(
    viewFor(makeInput({ connections: [connection({ status: "error" })] }), "email").actions.map(
      (a) => a.id,
    ),
    ["review_email_connection"],
  )
})

// ─── Vertical order & tiering ───────────────────────────────────────────────

test("Beauty (Finesse) order leads with WhatsApp and recommends whatsapp/instagram", () => {
  const views = resolveChannelSetupViews(
    makeInput({ config: resolveInboxChannelsConfig(BEAUTY_PACK.inbox.channels) }),
  )
  assert.equal(views[0]?.id, "whatsapp")
  assert.equal(views.find((v) => v.id === "whatsapp")?.recommended, true)
  assert.equal(views.find((v) => v.id === "instagram")?.recommended, true)
  assert.equal(views.find((v) => v.id === "email")?.recommended, false)
})

test("untiered core config recommends nothing even though every tier is primary", () => {
  const views = resolveChannelSetupViews(makeInput())
  assert.ok(views.every((v) => v.tier === "primary"))
  assert.ok(views.every((v) => v.recommended === false))
})

test("channels missing from the config order are appended, never dropped", () => {
  const views = resolveChannelSetupViews(makeInput())
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

test("web chat activation is unset for missing/malformed/non-boolean config", () => {
  assert.equal(getWebChatActivation(null), "unset")
  assert.equal(getWebChatActivation(""), "unset")
  assert.equal(getWebChatActivation("not json"), "unset")
  assert.equal(getWebChatActivation("{}"), "unset")
  assert.equal(getWebChatActivation(JSON.stringify({ inbox: {} })), "unset")
  assert.equal(getWebChatActivation(JSON.stringify({ inbox: { webChat: {} } })), "unset")
  assert.equal(
    getWebChatActivation(JSON.stringify({ inbox: { webChat: { enabled: "true" } } })),
    "unset",
  )
})

test("web chat activation reads explicit booleans only", () => {
  assert.equal(
    getWebChatActivation(JSON.stringify({ inbox: { webChat: { enabled: true } } })),
    "enabled",
  )
  assert.equal(
    getWebChatActivation(JSON.stringify({ inbox: { webChat: { enabled: false } } })),
    "disabled",
  )
})

test("public reception gate blocks ONLY on explicit opt-out (documented split)", () => {
  assert.equal(isWebChatReceptionEnabled(null), true)
  assert.equal(isWebChatReceptionEnabled("{}"), true)
  assert.equal(
    isWebChatReceptionEnabled(JSON.stringify({ inbox: { webChat: { enabled: false } } })),
    false,
  )
  assert.equal(
    isWebChatReceptionEnabled(JSON.stringify({ inbox: { webChat: { enabled: true } } })),
    true,
  )
})
