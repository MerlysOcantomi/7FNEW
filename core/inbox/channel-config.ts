/**
 * Effective Inbox channel configuration — pure resolution of WHICH channels a
 * workspace's Inbox surfaces and in WHAT order, layered as:
 *
 *   core defaults → vertical pack (`pack.inbox.channels`) → workspace
 *   overrides (`Workspace.config.inbox.channels`)
 *
 * plus reconciliation with reality (which `ChannelConnection` rows exist).
 *
 * Follows the `core/workspace-taxonomies.ts` precedent:
 *   - Pure and DB-free — safe on client, server and tests. The DB-touching
 *     read path lives in the API route (`app/api/inbox/channels/route.ts`).
 *   - Defensive: never throws; unknown channel ids, duplicates, non-arrays
 *     and malformed JSON are dropped silently, falling back layer by layer.
 *   - The raw config blob never leaves the parser; consumers receive only
 *     the sanitized view.
 *
 * Vocabulary (kept deliberately distinct — see the audit §7 of
 * `docs/product/smart-inbox-multichannel-audit.md`):
 *   - SUPPORTED  — the channel exists in `core/inbox/channel-registry.ts`.
 *   - ENABLED    — the resolved config lists it for this vertical/workspace.
 *   - CONNECTED  — an active `ChannelConnection` row of that type exists.
 *   - COMING SOON— registry availability is "planned" (no data path yet).
 * `WorkspaceExperience.recommendedChannels` stays advisory marketing data;
 * it is NOT part of this resolution.
 */

import {
  INBOX_CHANNELS,
  isChannelSelectableInFilters,
  normalizeInboxChannelId,
  type InboxChannelAvailability,
  type InboxChannelIconToken,
  type InboxChannelId,
  type InboxChannelKind,
} from "./channel-registry"

/** Declarative channel configuration, as written by packs and workspaces. */
export interface InboxChannelsConfig {
  /** Channels surfaced by the Inbox for this workspace. */
  enabled: InboxChannelId[]
  /** Visual order. Always a permutation of `enabled` after normalization. */
  order: InboxChannelId[]
  /** Channels the vertical treats as its main ones (subset of `enabled`). */
  primary: InboxChannelId[]
  /** The remaining enabled channels (disjoint from `primary`). */
  secondary: InboxChannelId[]
  /**
   * Declared default channel for future compose flows. Declarative only:
   * consumers MUST check capabilities/availability before acting on it —
   * declaring a channel default does not make its transport exist.
   */
  defaultChannel: InboxChannelId | null
}

/** A partially-specified layer (pack or workspace). Absent fields inherit. */
export type InboxChannelsConfigInput = Partial<{
  enabled: unknown
  order: unknown
  primary: unknown
  secondary: unknown
  defaultChannel: unknown
}>

/**
 * The strongly-typed shape a vertical pack declares (`pack.inbox.channels`).
 * Structurally a valid `InboxChannelsConfigInput` layer, but typo-proof at
 * the pack definition site.
 */
export type VerticalInboxChannelsDefaults = Partial<InboxChannelsConfig>

/**
 * Core defaults. `enabled`/`order` reproduce the pre-registry hardcoded
 * filter list exactly, so a workspace with no vertical pack and no overrides
 * behaves as before. No primary/secondary tiering in core; email is the
 * declared default because it is the only channel compose supports today.
 */
export const CORE_INBOX_CHANNELS_CONFIG: InboxChannelsConfig = Object.freeze({
  enabled: Object.freeze(["manual", "web_chat", "email", "portal", "whatsapp"]),
  order: Object.freeze(["manual", "web_chat", "email", "portal", "whatsapp"]),
  primary: Object.freeze([]),
  secondary: Object.freeze(["manual", "web_chat", "email", "portal", "whatsapp"]),
  defaultChannel: "email",
}) as unknown as InboxChannelsConfig

/** Generous bound so a runaway config cannot blow up the renderer. */
const MAX_CHANNELS = 32

/** Sanitize one list: known ids only (aliases resolved), deduped, bounded. */
function sanitizeChannelList(input: unknown): InboxChannelId[] | null {
  if (!Array.isArray(input)) return null
  const seen = new Set<InboxChannelId>()
  const out: InboxChannelId[] = []
  for (const raw of input) {
    if (typeof raw !== "string") continue
    const id = normalizeInboxChannelId(raw)
    if (!id || seen.has(id)) continue
    seen.add(id)
    out.push(id)
    if (out.length >= MAX_CHANNELS) break
  }
  return out
}

/**
 * Parse the `inbox.channels` slice out of an already-parsed config object
 * (e.g. a pack's serialized defaultConfig or a merged resolvedConfig).
 * Returns an input layer — sanitation happens during resolution.
 */
export function extractInboxChannelsSlice(config: unknown): InboxChannelsConfigInput {
  if (!config || typeof config !== "object" || Array.isArray(config)) return {}
  const inbox = (config as Record<string, unknown>)["inbox"]
  if (!inbox || typeof inbox !== "object" || Array.isArray(inbox)) return {}
  const channels = (inbox as Record<string, unknown>)["channels"]
  if (!channels || typeof channels !== "object" || Array.isArray(channels)) return {}
  return channels as InboxChannelsConfigInput
}

/**
 * Parse the workspace override slice from the raw `Workspace.config` string.
 * Never throws; malformed JSON yields an empty layer (inherit everything).
 */
export function parseWorkspaceInboxChannels(
  config: string | null | undefined,
): InboxChannelsConfigInput {
  if (!config) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(config)
  } catch {
    return {}
  }
  return extractInboxChannelsSlice(parsed)
}

/**
 * Resolve the effective config: start from core defaults and apply each
 * layer left → right (vertical pack first, workspace overrides last).
 *
 * Per-field precedence, not wholesale replacement: a workspace that only
 * overrides `order` inherits the pack's `enabled`. A field is applied only
 * when it sanitizes to something usable (`enabled`/`order` must be
 * non-empty; an invalid `defaultChannel` string is ignored; an explicit
 * `defaultChannel: null` clears it).
 *
 * Coherence pass (always, after layering):
 *   - `order` is filtered to `enabled`; enabled channels missing from
 *     `order` are appended in `enabled` order — nothing silently disappears.
 *   - `primary` is filtered to `enabled`; `secondary` = the remaining
 *     enabled channels (declared secondary order first, then leftovers).
 *   - `defaultChannel` must be enabled, else it falls back to the first
 *     enabled channel that is selectable today, else null.
 */
export function resolveInboxChannelsConfig(
  ...layers: Array<InboxChannelsConfigInput | null | undefined>
): InboxChannelsConfig {
  let enabled: InboxChannelId[] = [...CORE_INBOX_CHANNELS_CONFIG.enabled]
  let order: InboxChannelId[] = [...CORE_INBOX_CHANNELS_CONFIG.order]
  let primary: InboxChannelId[] = [...CORE_INBOX_CHANNELS_CONFIG.primary]
  let secondary: InboxChannelId[] = [...CORE_INBOX_CHANNELS_CONFIG.secondary]
  let defaultChannel: InboxChannelId | null = CORE_INBOX_CHANNELS_CONFIG.defaultChannel
  let secondaryDeclared = false

  for (const layer of layers) {
    if (!layer || typeof layer !== "object") continue
    const nextEnabled = sanitizeChannelList(layer.enabled)
    if (nextEnabled && nextEnabled.length > 0) enabled = nextEnabled
    const nextOrder = sanitizeChannelList(layer.order)
    if (nextOrder && nextOrder.length > 0) order = nextOrder
    const nextPrimary = sanitizeChannelList(layer.primary)
    if (nextPrimary) primary = nextPrimary
    const nextSecondary = sanitizeChannelList(layer.secondary)
    if (nextSecondary) {
      secondary = nextSecondary
      secondaryDeclared = true
    }
    if ("defaultChannel" in layer) {
      if (layer.defaultChannel === null) {
        defaultChannel = null
      } else if (typeof layer.defaultChannel === "string") {
        const id = normalizeInboxChannelId(layer.defaultChannel)
        if (id) defaultChannel = id
      }
    }
  }

  // Coherence: order ⊇ enabled exactly (permutation).
  const enabledSet = new Set(enabled)
  const coherentOrder = order.filter((id) => enabledSet.has(id))
  for (const id of enabled) {
    if (!coherentOrder.includes(id)) coherentOrder.push(id)
  }

  // Coherence: primary ⊆ enabled; secondary = enabled \ primary.
  const coherentPrimary = primary.filter((id) => enabledSet.has(id))
  const primarySet = new Set(coherentPrimary)
  const declaredSecondary = secondaryDeclared ? secondary : []
  const coherentSecondary = declaredSecondary.filter(
    (id) => enabledSet.has(id) && !primarySet.has(id),
  )
  for (const id of coherentOrder) {
    if (!primarySet.has(id) && !coherentSecondary.includes(id)) {
      coherentSecondary.push(id)
    }
  }

  // Coherence: defaultChannel must be enabled.
  let coherentDefault = defaultChannel && enabledSet.has(defaultChannel) ? defaultChannel : null
  if (!coherentDefault) {
    coherentDefault =
      coherentOrder.find((id) => isChannelSelectableInFilters(INBOX_CHANNELS[id])) ?? null
  }

  return {
    enabled: coherentOrder.slice(), // enabled reported in visual order
    order: coherentOrder,
    primary: coherentPrimary,
    secondary: coherentSecondary,
    defaultChannel: coherentDefault,
  }
}

// ── Effective per-channel view (config ∩ reality) ───────────────────────────

export type ChannelConnectionState = "connected" | "not_connected" | "not_required"

/**
 * What the UI may do with the channel right now:
 *   ready       — selectable (filters, pickers). Includes enabled channels
 *                 that are not connected yet: historical/manual conversations
 *                 may exist, so filtering must keep working.
 *   coming_soon — visible as a disabled affordance only; never selectable
 *                 and never rendered as a working integration.
 */
export type ChannelUiAvailability = "ready" | "coming_soon"

export interface ResolvedInboxChannelView {
  id: InboxChannelId
  labelKey: string
  iconToken: InboxChannelIconToken
  kind: InboxChannelKind
  availability: InboxChannelAvailability
  requiresConnection: boolean
  tier: "primary" | "secondary"
  isDefault: boolean
  /** False only for channels surfaced by reality (connection exists) despite config. */
  enabledBySetting: boolean
  connectionState: ChannelConnectionState
  uiAvailability: ChannelUiAvailability
}

/**
 * Combine the resolved config with the workspace's real connections into the
 * ordered per-channel view the UI consumes.
 *
 * Reconciliation rules (the applied answer to "enabled vs connected"):
 *   - Enabled channels render in configured order whether connected or not;
 *     `connectionState` tells the UI which ones still need setup.
 *   - A CONNECTED channel missing from the enabled list is APPENDED at the
 *     end (tier "secondary", `enabledBySetting: false`): a live connected
 *     account can never be made invisible by config, or its conversations
 *     would become unreachable from the filter UI.
 *   - When `primary` is empty (no tiering declared), every enabled channel
 *     reports tier "primary" so untiered UIs treat all equally.
 */
export function resolveInboxChannelViews(options: {
  config: InboxChannelsConfig
  connectedChannelIds?: Iterable<string>
}): ResolvedInboxChannelView[] {
  const { config } = options
  const connected = new Set<InboxChannelId>()
  for (const raw of options.connectedChannelIds ?? []) {
    const id = normalizeInboxChannelId(raw)
    if (id) connected.add(id)
  }

  const untiered = config.primary.length === 0
  const primarySet = new Set(config.primary)
  const views: ResolvedInboxChannelView[] = []
  const listed = new Set<InboxChannelId>()

  const buildView = (id: InboxChannelId, enabledBySetting: boolean): ResolvedInboxChannelView => {
    const def = INBOX_CHANNELS[id]
    const connectionState: ChannelConnectionState = !def.requiresConnection
      ? "not_required"
      : connected.has(id)
        ? "connected"
        : "not_connected"
    return {
      id,
      labelKey: def.labelKey,
      iconToken: def.iconToken,
      kind: def.kind,
      availability: def.availability,
      requiresConnection: def.requiresConnection,
      tier: enabledBySetting && (untiered || primarySet.has(id)) ? "primary" : "secondary",
      isDefault: config.defaultChannel === id,
      enabledBySetting,
      connectionState,
      uiAvailability: isChannelSelectableInFilters(def) ? "ready" : "coming_soon",
    }
  }

  for (const id of config.order) {
    views.push(buildView(id, true))
    listed.add(id)
  }
  for (const id of connected) {
    if (!listed.has(id)) views.push(buildView(id, false))
  }
  return views
}
