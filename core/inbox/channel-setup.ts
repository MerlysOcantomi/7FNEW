/**
 * Business Profile → Channels setup model — the pure resolution of WHAT
 * configuration state each business channel is in, and WHICH real actions the
 * owner can take on it.
 *
 * This is the configuration-side complement of `core/inbox/channel-config.ts`
 * (which answers what the INBOX surfaces). Same design rules:
 *   - Pure and DB-free — safe on client, server and tests. The DB-touching
 *     read path lives in `app/api/workspace/channels/route.ts`.
 *   - HONEST states only (no-fake-product rule): a channel reports
 *     `coming_soon` unless a real setup flow exists in this repository
 *     today. Nothing here may render a working-looking integration for a
 *     provider we have not integrated.
 *   - Actions are typed tokens resolved to labels/destinations by the UI
 *     layer; a channel with no real action gets an empty list, never a
 *     placeholder button.
 *
 * Status vocabulary (BUSINESS-PROFILE-CHANNELS-03):
 *   connected      — a live data path exists now (active connection, or a
 *                    connection-free channel that is switched on).
 *   available      — the owner can start a real setup flow right now.
 *   setup_required — setup was started (a connection row exists) but needs
 *                    completion before the channel works.
 *   pending        — setup is progressing and waiting on something
 *                    (provider verification, sync…), no action needed yet.
 *   error          — the connection exists but is failing.
 *   plan_locked    — a real setup flow exists but the workspace plan's
 *                    channel limit is already reached (observational — the
 *                    plan layer does not enforce yet, see core/system/plans.ts).
 *   coming_soon    — no real setup flow exists in the product today.
 *   disabled       — supported and configurable, but switched off for this
 *                    workspace (config toggle / not in the enabled set).
 */

import {
  INBOX_CHANNELS,
  INBOX_CHANNEL_IDS,
  type InboxChannelIconToken,
  type InboxChannelId,
  type InboxChannelKind,
} from "./channel-registry"
import type { InboxChannelsConfig } from "./channel-config"

export type ChannelSetupStatus =
  | "connected"
  | "available"
  | "setup_required"
  | "pending"
  | "error"
  | "plan_locked"
  | "coming_soon"
  | "disabled"

/**
 * Real actions only. Every id here MUST correspond to a destination or
 * mutation that exists in the product today; the UI resolves ids to labels
 * and hrefs/handlers. Adding an id without its real counterpart is a
 * no-fake-product violation.
 */
export type ChannelSetupActionId =
  | "connect_email" // → /administracion/canales (EmailConnectionsManager)
  | "manage_email_connections" // → /administracion/canales
  | "review_email_connection" // → /administracion/canales (error/pending row)
  | "enable_web_chat_reception" // PUT /api/workspace/channels/web-chat
  | "disable_web_chat_reception" // PUT /api/workspace/channels/web-chat
  | "open_inbox" // → /inbox (see conversations for a live channel)

export interface ChannelSetupAction {
  id: ChannelSetupActionId
  /** Primary renders prominently; secondary only when genuinely needed. */
  emphasis: "primary" | "secondary"
}

/**
 * The SAFE projection of a `ChannelConnection` row this model accepts.
 * Deliberately excludes `credentials`, `config` and `syncState` — the raw
 * row must never travel past the API layer.
 */
export interface ChannelConnectionSummary {
  channelType: string
  /**
   * `ChannelConnection.status` free string. Values written by the product
   * today: "active" (default) and "error" (imap-sync failures). The
   * lifecycle values "pending" / "setup_required" / "disabled" are accepted
   * so rows created in those states (e.g. future provider flows, demo data)
   * resolve honestly; unknown values degrade to "pending".
   */
  status: string
  name: string
  externalAccountId: string | null
  isDefault: boolean
  /** ISO timestamp or null — pass through only when the DB really has it. */
  lastSyncAt: string | null
  lastError: string | null
  provider: string
}

/** Identity the channel presents to the outside world, when one exists. */
export interface ChannelIdentity {
  /** Human label of the connected account ("Reservas", "Demo inbox"…). */
  name: string | null
  /** Routable address: email address, phone number… `null` when none. */
  address: string | null
}

export interface ChannelSetupView {
  id: InboxChannelId
  labelKey: string
  iconToken: InboxChannelIconToken
  kind: InboxChannelKind
  status: ChannelSetupStatus
  /** Vertical tiering from the resolved inbox config (Finesse: whatsapp/instagram primary). */
  tier: "primary" | "secondary"
  identity: ChannelIdentity | null
  /** Honest current ability, not platform potential. */
  canReceive: boolean
  canSend: boolean
  /** Present only when the underlying row really carries the data. */
  lastSyncAt: string | null
  lastError: string | null
  /** Number of active connections behind this channel (email can have several). */
  activeConnectionCount: number
  actions: ChannelSetupAction[]
}

/** Section grouping for the Business Profile Channels layout. */
export type ChannelSetupGroup = "connected" | "actionable" | "future"

export interface ChannelSetupInput {
  /** Resolved inbox channel config (core → vertical → workspace layers). */
  config: InboxChannelsConfig
  connections: ChannelConnectionSummary[]
  /** Workspace toggle `config.inbox.webChat.enabled` (default true). */
  webChatReceptionEnabled: boolean
  /** Visitor-facing identity for connection-free channels (business name). */
  businessDisplayName: string | null
  /**
   * Observational plan limit (`core/system/plans.ts`). `null` limit means
   * unlimited/unknown; the model only reports `plan_locked`, it never blocks.
   */
  planMaxChannels: number | null
}

/**
 * Channels with a REAL setup flow in the product today. Email is the only
 * one: `/administracion/canales` (EmailConnectionsManager + the
 * workspaces/[id]/connections API). WhatsApp/Instagram/Messenger/TikTok/SMS
 * have webhook routing skeletons but no way to create a connection, so they
 * must resolve `coming_soon` until their flows land.
 */
const CHANNELS_WITH_SETUP_FLOW: ReadonlySet<InboxChannelId> = new Set(["email"])

/** Channel ids the Business Profile Channels section manages. Everything in
 * the registry except operator-internal records (`manual`). */
export const BUSINESS_CHANNEL_IDS: readonly InboxChannelId[] = INBOX_CHANNEL_IDS.filter(
  (id) => INBOX_CHANNELS[id].kind !== "internal",
)

function normalizeConnectionStatus(
  raw: string,
): "active" | "error" | "setup_required" | "pending" | "disabled" {
  const value = raw.trim().toLowerCase()
  if (value === "active") return "active"
  if (value === "error") return "error"
  if (value === "setup_required" || value === "incomplete") return "setup_required"
  if (value === "disabled" || value === "paused") return "disabled"
  // "pending", "pending_setup" and anything unknown: waiting, never working.
  return "pending"
}

/** Severity order when a channel has several rows: a live connection wins,
 * then the most actionable problem. */
const ROW_STATUS_PRIORITY = ["active", "error", "setup_required", "pending", "disabled"] as const

function summarizeRows(rows: ChannelConnectionSummary[]): {
  effective: (typeof ROW_STATUS_PRIORITY)[number] | null
  representative: ChannelConnectionSummary | null
  activeCount: number
} {
  if (rows.length === 0) return { effective: null, representative: null, activeCount: 0 }
  let best: { rank: number; row: ChannelConnectionSummary } | null = null
  let activeCount = 0
  for (const row of rows) {
    const status = normalizeConnectionStatus(row.status)
    if (status === "active") activeCount += 1
    const rank = ROW_STATUS_PRIORITY.indexOf(status)
    // Prefer the default row among equals so identity shows the main account.
    if (!best || rank < best.rank || (rank === best.rank && row.isDefault && !best.row.isDefault)) {
      best = { rank, row }
    }
  }
  return {
    effective: best ? ROW_STATUS_PRIORITY[best.rank] : null,
    representative: best?.row ?? null,
    activeCount,
  }
}

function actionsFor(
  id: InboxChannelId,
  status: ChannelSetupStatus,
): ChannelSetupAction[] {
  if (id === "email") {
    switch (status) {
      case "connected":
        return [
          { id: "manage_email_connections", emphasis: "primary" },
          { id: "open_inbox", emphasis: "secondary" },
        ]
      case "available":
        return [{ id: "connect_email", emphasis: "primary" }]
      case "error":
      case "setup_required":
      case "pending":
        return [{ id: "review_email_connection", emphasis: "primary" }]
      default:
        return []
    }
  }
  if (id === "web_chat") {
    switch (status) {
      case "connected":
        return [
          { id: "disable_web_chat_reception", emphasis: "secondary" },
          { id: "open_inbox", emphasis: "primary" },
        ]
      case "disabled":
        return [{ id: "enable_web_chat_reception", emphasis: "primary" }]
      default:
        return []
    }
  }
  if (id === "portal" && status === "connected") {
    return [{ id: "open_inbox", emphasis: "secondary" }]
  }
  // No real flow exists for the remaining channels — no actions, ever,
  // until their integrations land (no fake OAuth buttons).
  return []
}

function resolveOne(
  id: InboxChannelId,
  input: ChannelSetupInput,
  activeConnectionTotal: number,
): ChannelSetupView {
  const def = INBOX_CHANNELS[id]
  const rows = input.connections.filter(
    (row) => row.channelType.trim().toLowerCase() === id,
  )
  const { effective, representative, activeCount } = summarizeRows(rows)
  const enabled = input.config.enabled.includes(id)

  let status: ChannelSetupStatus
  if (!def.requiresConnection) {
    // Connection-free channels (web_chat, portal): live unless switched off.
    const receptionOn = id === "web_chat" ? input.webChatReceptionEnabled : true
    status = enabled && receptionOn ? "connected" : "disabled"
  } else if (effective === "active") {
    status = "connected"
  } else if (effective === "error") {
    status = "error"
  } else if (effective === "setup_required") {
    status = "setup_required"
  } else if (effective === "pending") {
    status = "pending"
  } else if (effective === "disabled") {
    status = "disabled"
  } else if (!CHANNELS_WITH_SETUP_FLOW.has(id)) {
    status = "coming_soon"
  } else if (!enabled) {
    status = "disabled"
  } else if (
    input.planMaxChannels !== null &&
    activeConnectionTotal >= input.planMaxChannels
  ) {
    status = "plan_locked"
  } else {
    status = "available"
  }

  const identity: ChannelIdentity | null = representative
    ? { name: representative.name || null, address: representative.externalAccountId }
    : !def.requiresConnection && status === "connected"
      ? { name: input.businessDisplayName, address: null }
      : null

  const live = status === "connected"
  const tier =
    input.config.primary.length === 0 || input.config.primary.includes(id)
      ? "primary"
      : "secondary"

  return {
    id,
    labelKey: def.labelKey,
    iconToken: def.iconToken,
    kind: def.kind,
    status,
    tier,
    identity,
    canReceive: live && def.capabilities.inbound,
    canSend: live && def.capabilities.outbound,
    lastSyncAt: representative?.lastSyncAt ?? null,
    lastError: status === "error" ? (representative?.lastError ?? null) : null,
    activeConnectionCount: activeCount,
    actions: actionsFor(id, status),
  }
}

/**
 * Resolve the full Business Profile channel setup view, in the workspace's
 * configured order (vertical order first — Finesse leads with WhatsApp),
 * with channels the config does not order appended in registry order.
 */
export function resolveChannelSetupViews(input: ChannelSetupInput): ChannelSetupView[] {
  const activeConnectionTotal = input.connections.filter(
    (row) => normalizeConnectionStatus(row.status) === "active",
  ).length

  const ordered: InboxChannelId[] = []
  for (const id of input.config.order) {
    if (BUSINESS_CHANNEL_IDS.includes(id)) ordered.push(id)
  }
  for (const id of BUSINESS_CHANNEL_IDS) {
    if (!ordered.includes(id)) ordered.push(id)
  }

  return ordered.map((id) => resolveOne(id, input, activeConnectionTotal))
}

/**
 * Section grouping for the layout:
 *   connected  — live now.
 *   actionable — the owner can (or must) do something: connect, finish
 *                setup, fix an error, re-enable.
 *   future     — plan-locked or not integrated yet.
 */
export function channelSetupGroup(status: ChannelSetupStatus): ChannelSetupGroup {
  switch (status) {
    case "connected":
      return "connected"
    case "available":
    case "setup_required":
    case "pending":
    case "error":
    case "disabled":
      return "actionable"
    case "plan_locked":
    case "coming_soon":
      return "future"
  }
}

// ── Web chat reception toggle (workspace config slice) ──────────────────────

/**
 * Parse the web chat reception toggle out of the raw `Workspace.config`
 * string. Default is ENABLED (`true`) — the public web chat data path
 * predates this toggle and must not turn off for existing workspaces.
 * Only an explicit `inbox.webChat.enabled === false` disables it.
 */
export function isWebChatReceptionEnabled(rawConfig: string | null | undefined): boolean {
  if (!rawConfig) return true
  let parsed: unknown
  try {
    parsed = JSON.parse(rawConfig)
  } catch {
    return true
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return true
  const inbox = (parsed as Record<string, unknown>)["inbox"]
  if (!inbox || typeof inbox !== "object" || Array.isArray(inbox)) return true
  const webChat = (inbox as Record<string, unknown>)["webChat"]
  if (!webChat || typeof webChat !== "object" || Array.isArray(webChat)) return true
  return (webChat as Record<string, unknown>)["enabled"] !== false
}
