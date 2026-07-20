/**
 * Business Profile → Channels setup model — the pure resolution of WHAT
 * configuration state each business channel is in, and WHICH real actions the
 * owner can take on it.
 *
 * This is the configuration-side complement of `core/inbox/channel-config.ts`
 * (which answers what the INBOX surfaces). Same design rules:
 *   - Pure and DB-free — safe on client, server and tests. The DB-touching
 *     read path lives in `app/api/workspace/channels/route.ts`.
 *   - HONEST states only (no-fake-product rule): a channel reports what the
 *     PRODUCT can really do for the workspace today, not what the registry
 *     or the data model could theoretically carry. Infrastructure existing
 *     (a registry entry, an endpoint, a free-string channel value) is NOT a
 *     visible connection (BUSINESS-PROFILE-CHANNELS-03B).
 *   - Actions are typed tokens resolved to labels/destinations by the UI
 *     layer; a channel with no real action gets an empty list, never a
 *     placeholder button.
 *
 * Channel-specific reality rules (03B):
 *   - PORTAL is excluded from this surface entirely. `portal` remains a
 *     valid registry/data value (historical conversations, future client
 *     portal), but there is no client-facing portal flow the owner could
 *     configure or point customers to, so it must not render as a channel
 *     here. See `BUSINESS_CHANNEL_IDS`.
 *   - WEB CHAT is `coming_soon` unless the workspace carries an EXPLICIT
 *     activation signal (`config.inbox.webChat.enabled === true`). The
 *     public ingest endpoint existing — or the workspace having a slug —
 *     is not an installation signal. Explicit `false` renders `disabled`.
 *   - `pending` is only ever produced by a PERSISTED ChannelConnection row
 *     in a non-active lifecycle state — never synthesized.
 *
 * Status vocabulary (BUSINESS-PROFILE-CHANNELS-03):
 *   connected      — a live data path exists now (active connection, or an
 *                    explicitly activated connection-free channel).
 *   available      — the owner can start a real setup flow right now.
 *   setup_required — setup was started (a connection row exists) but needs
 *                    completion before the channel works.
 *   pending        — a persisted connection is progressing and waiting on
 *                    something (provider verification…), no action yet.
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
  | "connect_another_email" // → /administracion/canales
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
   * so rows created in those states (real provider flows in progress)
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

/**
 * One mailbox/account behind the single Email channel. Email stays ONE
 * channel in the roster; Gmail / Google Workspace / Outlook / IMAP are
 * providers of accounts within it, never separate channel cards.
 */
export interface EmailAccountView {
  name: string
  address: string | null
  /** Raw `ChannelConnection.provider` value ("imap_smtp", "resend"…). */
  provider: string
  /** Human provider label resolved via `emailProviderLabel`. */
  providerLabel: string
  status: "active" | "error" | "setup_required" | "pending" | "disabled"
  isDefault: boolean
  /**
   * Clearly-fictitious demo account (reserved `.invalid` TLD). The UI must
   * badge these so demo data can never read as a real mailbox.
   */
  isDemo: boolean
  lastSyncAt: string | null
  lastError: string | null
}

export interface ChannelSetupView {
  id: InboxChannelId
  labelKey: string
  iconToken: InboxChannelIconToken
  kind: InboxChannelKind
  status: ChannelSetupStatus
  /** Vertical tiering from the resolved inbox config (Finesse: whatsapp/instagram primary). */
  tier: "primary" | "secondary"
  /**
   * True only when the vertical DECLARED this channel primary
   * (`config.primary` non-empty and listing it). Untiered configs mark every
   * channel tier "primary" but recommend none — the UI badge keys off this.
   */
  recommended: boolean
  identity: ChannelIdentity | null
  /** Honest current ability, not platform potential. */
  canReceive: boolean
  canSend: boolean
  /** Present only when the underlying row really carries the data. */
  lastSyncAt: string | null
  lastError: string | null
  /** Number of active connections behind this channel. */
  activeConnectionCount: number
  /** Per-account detail — populated for the email channel only. */
  emailAccounts: EmailAccountView[]
  actions: ChannelSetupAction[]
}

/** Section grouping for the Business Profile Channels layout. */
export type ChannelSetupGroup = "connected" | "actionable" | "future"

/**
 * Web chat activation signal, parsed from `Workspace.config`:
 *   "enabled"  — the owner explicitly switched web chat on.
 *   "disabled" — the owner explicitly switched it off.
 *   "unset"    — no explicit signal; the product must NOT present web chat
 *                as installed/connected (03B: an existing public endpoint is
 *                not an installation).
 */
export type WebChatActivation = "enabled" | "disabled" | "unset"

export interface ChannelSetupInput {
  /** Resolved inbox channel config (core → vertical → workspace layers). */
  config: InboxChannelsConfig
  connections: ChannelConnectionSummary[]
  webChatActivation: WebChatActivation
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

/**
 * Channel ids the Business Profile Channels section manages. Excludes:
 *   - operator-internal records (`manual`) — nothing to configure;
 *   - `portal` — the value exists in the registry and in historical
 *     `Conversation.channel` data, but no client-facing portal flow (client
 *     auth + client-side thread UI) exists today, so presenting it as a
 *     configurable business channel would be fake product. Re-add it here
 *     the day the portal ships.
 */
export const BUSINESS_CHANNEL_IDS: readonly InboxChannelId[] = INBOX_CHANNEL_IDS.filter(
  (id) => INBOX_CHANNELS[id].kind !== "internal" && id !== "portal",
)

type NormalizedRowStatus = "active" | "error" | "setup_required" | "pending" | "disabled"

function normalizeConnectionStatus(raw: string): NormalizedRowStatus {
  const value = raw.trim().toLowerCase()
  if (value === "active") return "active"
  if (value === "error") return "error"
  if (value === "setup_required" || value === "incomplete") return "setup_required"
  if (value === "disabled" || value === "paused") return "disabled"
  // "pending", "pending_setup" and anything unknown: waiting, never working.
  return "pending"
}

/**
 * Human labels for email account providers. Brand names are locale-stable
 * (same convention as channel labels in `lib/inbox-labels.ts`), so this map
 * lives in the model, not the i18n catalogs. Unknown providers fall back to
 * the raw value rather than pretending to know it.
 */
const EMAIL_PROVIDER_LABELS: Record<string, string> = {
  imap_smtp: "IMAP/SMTP",
  resend: "Resend",
  gmail: "Gmail",
  google: "Google Workspace",
  google_workspace: "Google Workspace",
  microsoft: "Outlook / Microsoft 365",
  outlook: "Outlook / Microsoft 365",
  demo: "Demo",
}

export function emailProviderLabel(provider: string): string {
  return EMAIL_PROVIDER_LABELS[provider.trim().toLowerCase()] ?? provider
}

/**
 * Demo-data detector: the seed writes addresses on the reserved `.invalid`
 * TLD only (guaranteed unroutable, see RFC 2606). The UI badges these as
 * demo accounts so fictitious data can never read as a real mailbox.
 */
export function isDemoAccountAddress(address: string | null | undefined): boolean {
  return typeof address === "string" && address.trim().toLowerCase().endsWith(".invalid")
}

/** Severity order when a channel has several rows: a live connection wins,
 * then the most actionable problem. */
const ROW_STATUS_PRIORITY: readonly NormalizedRowStatus[] = [
  "active",
  "error",
  "setup_required",
  "pending",
  "disabled",
]

function summarizeRows(rows: ChannelConnectionSummary[]): {
  effective: NormalizedRowStatus | null
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

function toEmailAccountView(row: ChannelConnectionSummary): EmailAccountView {
  return {
    name: row.name,
    address: row.externalAccountId,
    provider: row.provider,
    providerLabel: emailProviderLabel(row.provider),
    status: normalizeConnectionStatus(row.status),
    isDefault: row.isDefault,
    isDemo: isDemoAccountAddress(row.externalAccountId),
    lastSyncAt: row.lastSyncAt,
    lastError: row.lastError,
  }
}

function actionsFor(id: InboxChannelId, status: ChannelSetupStatus): ChannelSetupAction[] {
  if (id === "email") {
    switch (status) {
      case "connected":
        return [
          { id: "manage_email_connections", emphasis: "primary" },
          { id: "connect_another_email", emphasis: "secondary" },
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
    // Actions exist only once the workspace has an explicit activation
    // signal — a "coming soon" web chat must not offer a toggle.
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
  // No real flow exists for the remaining channels — no actions, ever,
  // until their integrations land (no fake OAuth buttons).
  return []
}

function resolveOne(
  id: InboxChannelId,
  input: ChannelSetupInput,
  connectedChannelTotal: number,
): ChannelSetupView {
  const def = INBOX_CHANNELS[id]
  const rows = input.connections.filter((row) => row.channelType.trim().toLowerCase() === id)
  const { effective, representative, activeCount } = summarizeRows(rows)
  const enabled = input.config.enabled.includes(id)

  let status: ChannelSetupStatus
  if (id === "web_chat") {
    // Connection-free, but NOT automatically live: only an explicit
    // per-workspace activation signal may present it as connected (03B).
    status =
      input.webChatActivation === "enabled" && enabled
        ? "connected"
        : input.webChatActivation === "disabled"
          ? "disabled"
          : "coming_soon"
  } else if (!def.requiresConnection) {
    // Any future connection-free channel: never auto-connected; it must
    // bring its own activation signal before rendering as live.
    status = "coming_soon"
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
  } else if (input.planMaxChannels !== null && connectedChannelTotal >= input.planMaxChannels) {
    status = "plan_locked"
  } else {
    status = "available"
  }

  const identity: ChannelIdentity | null = representative
    ? { name: representative.name || null, address: representative.externalAccountId }
    : id === "web_chat" && status === "connected"
      ? { name: input.businessDisplayName, address: null }
      : null

  const live = status === "connected"
  const declaredPrimary = input.config.primary.includes(id)
  const tier =
    input.config.primary.length === 0 || declaredPrimary ? "primary" : "secondary"

  return {
    id,
    labelKey: def.labelKey,
    iconToken: def.iconToken,
    kind: def.kind,
    status,
    tier,
    recommended: declaredPrimary,
    identity,
    canReceive: live && def.capabilities.inbound,
    canSend: live && def.capabilities.outbound,
    lastSyncAt: representative?.lastSyncAt ?? null,
    lastError: status === "error" ? (representative?.lastError ?? null) : null,
    activeConnectionCount: activeCount,
    emailAccounts: id === "email" ? rows.map(toEmailAccountView) : [],
    actions: actionsFor(id, status),
  }
}

/**
 * Count of DISTINCT channels with at least one active connection — the unit
 * `TenantPlanLimits.maxChannels` describes. Several email mailboxes are one
 * email channel; `coming_soon` channels and channels without persisted
 * connections never count.
 */
export function countConnectedChannels(connections: ChannelConnectionSummary[]): number {
  const channels = new Set<string>()
  for (const row of connections) {
    if (normalizeConnectionStatus(row.status) === "active") {
      channels.add(row.channelType.trim().toLowerCase())
    }
  }
  return channels.size
}

/**
 * Resolve the full Business Profile channel setup view, in the workspace's
 * configured order (vertical order first — Finesse leads with WhatsApp),
 * with channels the config does not order appended in registry order.
 */
export function resolveChannelSetupViews(input: ChannelSetupInput): ChannelSetupView[] {
  const connectedChannelTotal = countConnectedChannels(input.connections)

  const ordered: InboxChannelId[] = []
  for (const id of input.config.order) {
    if (BUSINESS_CHANNEL_IDS.includes(id)) ordered.push(id)
  }
  for (const id of BUSINESS_CHANNEL_IDS) {
    if (!ordered.includes(id)) ordered.push(id)
  }

  return ordered.map((id) => resolveOne(id, input, connectedChannelTotal))
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

// ── Web chat activation (workspace config slice) ────────────────────────────

/**
 * Parse the EXPLICIT web chat activation signal out of the raw
 * `Workspace.config` string. Only a boolean `inbox.webChat.enabled` counts;
 * anything else — missing key, malformed JSON, non-boolean — is "unset",
 * which the setup model renders as `coming_soon` (never as connected).
 */
export function getWebChatActivation(rawConfig: string | null | undefined): WebChatActivation {
  if (!rawConfig) return "unset"
  let parsed: unknown
  try {
    parsed = JSON.parse(rawConfig)
  } catch {
    return "unset"
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return "unset"
  const inbox = (parsed as Record<string, unknown>)["inbox"]
  if (!inbox || typeof inbox !== "object" || Array.isArray(inbox)) return "unset"
  const webChat = (inbox as Record<string, unknown>)["webChat"]
  if (!webChat || typeof webChat !== "object" || Array.isArray(webChat)) return "unset"
  const enabled = (webChat as Record<string, unknown>)["enabled"]
  if (enabled === true) return "enabled"
  if (enabled === false) return "disabled"
  return "unset"
}

/**
 * Reception gate for the PUBLIC web chat ingest endpoint
 * (`/api/inbox/public/send`). Deliberately DIFFERENT from the Business
 * Profile activation signal above: ingestion stays open unless the owner
 * explicitly switched it off, because the endpoint predates the activation
 * concept and historical widget installs must keep delivering. Only the
 * SETUP VIEW requires the explicit opt-in; the pipe requires an explicit
 * opt-out. Documented in BUSINESS-PROFILE-CHANNELS-03B §3.
 */
export function isWebChatReceptionEnabled(rawConfig: string | null | undefined): boolean {
  return getWebChatActivation(rawConfig) !== "disabled"
}
