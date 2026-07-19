/**
 * Central Inbox channel registry — the single source of truth for every
 * channel the Smart Inbox can represent, and for what each channel can
 * actually do.
 *
 * Design rules (mirroring `core/vertical-packs/*`):
 *   - Pure declarative data + pure lookups. No `@core/db`, no React, no icon
 *     library imports — icons are referenced by TOKEN and resolved by the UI
 *     layer (`components/inbox/conversation-channel-badge.tsx`).
 *   - Channel *values* stored in the DB (`Conversation.channel`) stay free
 *     strings; this registry is the validation/lookup layer on top, exactly
 *     like service-layer validation elsewhere in the schema.
 *   - Capabilities are HONEST. Channels whose external APIs are not
 *     integrated yet carry `capabilitiesConfidence: "provisional"` — their
 *     capability set documents expected platform behaviour for planning and
 *     MUST be re-verified when the real integration lands. Nothing in the
 *     product may treat a provisional capability as a working feature.
 *   - Availability separates "supported by Sevenef today" from "planned":
 *       available  — a real data/transport path exists today (email in/out,
 *                    web chat ingest, portal threads, manual capture).
 *       data_only  — the channel value exists in the data model and UI
 *                    (conversations can carry it, filters can select it),
 *                    but no external integration exists yet (whatsapp).
 *       planned    — declared for the roadmap; no data path at all yet.
 *                    Planned channels must never render as working
 *                    integrations (no fake product).
 */

export type InboxChannelId =
  | "manual"
  | "web_chat"
  | "whatsapp"
  | "instagram"
  | "messenger"
  | "tiktok"
  | "sms"
  | "email"
  | "portal"

/**
 * Composer/behaviour family of a channel:
 *   email    — subject/recipients composer, email reading view.
 *   chat     — plain conversational composer (session or number based).
 *   social   — conversational composer bound to a social platform account.
 *   internal — operator-facing record, nothing is delivered anywhere.
 * The composer keys off this instead of `channel === "email"` conditionals.
 */
export type InboxChannelKind = "email" | "chat" | "social" | "internal"

export type InboxChannelAvailability = "available" | "data_only" | "planned"

/**
 * Icon token → concrete icon mapping lives in the UI layer. Tokens keep this
 * module dependency-free and let the UI stay deliberately generic (no brand
 * marks for channels we merely plan).
 */
export type InboxChannelIconToken =
  | "mail"
  | "smartphone"
  | "chat-bubble"
  | "globe"
  | "pen-square"
  | "instagram"
  | "messenger"
  | "music-note"
  | "message-sms"
  | "generic"

export interface InboxChannelCapabilities {
  /** Messages can arrive FROM the outside world through this channel. */
  inbound: boolean
  /** Replies can be delivered TO the outside world through this channel. */
  outbound: boolean
  /** An operator can START a brand-new conversation on this channel. */
  initiateConversation: boolean
  subject: boolean
  cc: boolean
  bcc: boolean
  /** Email-style forward of an existing message to a third party. */
  forward: boolean
  text: boolean
  images: boolean
  video: boolean
  audio: boolean
  files: boolean
  reactions: boolean
  /** Pre-approved message templates (e.g. WhatsApp template messages). */
  templates: boolean
  deliveryReceipts: boolean
  /**
   * Read/open signals. For email this is the (heuristic) open-tracking pixel
   * already implemented in `core/inbox-tracking.ts`, not a protocol receipt.
   */
  readReceipts: boolean
  typingIndicators: boolean
  /** Hard platform text-length limit, `null` when effectively unlimited. */
  maxTextLength: number | null
  /**
   * Platform reply-window restriction in hours (e.g. Meta's 24h customer
   * service window), `null` when the channel has no such window.
   */
  replyWindowHours: number | null
}

export interface InboxChannelDefinition {
  id: InboxChannelId
  /**
   * Label lookup key. Resolved through the shared channel label maps in
   * `lib/inbox-labels.ts#channelLabel` (localized where the name is a common
   * noun, brand-stable where it is a proper noun).
   */
  labelKey: string
  iconToken: InboxChannelIconToken
  kind: InboxChannelKind
  availability: InboxChannelAvailability
  /** Whether using the channel requires a configured `ChannelConnection` row. */
  requiresConnection: boolean
  capabilities: InboxChannelCapabilities
  /**
   * "confirmed"   — capabilities describe behaviour implemented/verified in
   *                 this repository today.
   * "provisional" — capabilities describe the external platform's publicly
   *                 documented behaviour; they are planning data and must be
   *                 re-verified when the integration is actually built.
   */
  capabilitiesConfidence: "confirmed" | "provisional"
}

const NO_CAPABILITIES: InboxChannelCapabilities = {
  inbound: false,
  outbound: false,
  initiateConversation: false,
  subject: false,
  cc: false,
  bcc: false,
  forward: false,
  text: false,
  images: false,
  video: false,
  audio: false,
  files: false,
  reactions: false,
  templates: false,
  deliveryReceipts: false,
  readReceipts: false,
  typingIndicators: false,
  maxTextLength: null,
  replyWindowHours: null,
}

/**
 * Conservative capability set for channel values the registry does not know
 * (legacy/free-string data). Text-only so unknown channels degrade to the
 * plain composer without pretending to support anything else.
 */
export const UNKNOWN_CHANNEL_CAPABILITIES: InboxChannelCapabilities = Object.freeze({
  ...NO_CAPABILITIES,
  text: true,
})

/**
 * Canonical registry order. The first five ids intentionally reproduce the
 * pre-registry hardcoded filter order (`manual, web_chat, email, portal,
 * whatsapp`) so the core experience is unchanged; planned channels follow.
 */
export const INBOX_CHANNEL_IDS: readonly InboxChannelId[] = [
  "manual",
  "web_chat",
  "email",
  "portal",
  "whatsapp",
  "instagram",
  "messenger",
  "tiktok",
  "sms",
]

export const INBOX_CHANNELS: Record<InboxChannelId, InboxChannelDefinition> = {
  email: {
    id: "email",
    labelKey: "email",
    iconToken: "mail",
    kind: "email",
    availability: "available",
    requiresConnection: true,
    capabilities: {
      ...NO_CAPABILITIES,
      inbound: true,
      outbound: true,
      initiateConversation: true,
      subject: true,
      cc: true,
      bcc: true,
      forward: true,
      text: true,
      images: true,
      video: true,
      audio: true,
      files: true,
      // Heuristic open-pixel + manual "confirm received", not a protocol receipt.
      readReceipts: true,
    },
    capabilitiesConfidence: "confirmed",
  },
  web_chat: {
    id: "web_chat",
    labelKey: "web_chat",
    iconToken: "chat-bubble",
    kind: "chat",
    availability: "available",
    // The public widget is keyed on the workspace slug, not a ChannelConnection.
    requiresConnection: false,
    capabilities: {
      ...NO_CAPABILITIES,
      inbound: true,
      // Replies are stored and readable by the visitor via the public
      // conversation endpoint; there is no push transport.
      outbound: true,
      text: true,
    },
    capabilitiesConfidence: "confirmed",
  },
  portal: {
    id: "portal",
    labelKey: "portal",
    iconToken: "globe",
    kind: "chat",
    availability: "available",
    requiresConnection: false,
    capabilities: {
      ...NO_CAPABILITIES,
      inbound: true,
      outbound: true,
      text: true,
    },
    capabilitiesConfidence: "confirmed",
  },
  manual: {
    id: "manual",
    labelKey: "manual",
    iconToken: "pen-square",
    kind: "internal",
    availability: "available",
    requiresConnection: false,
    capabilities: {
      ...NO_CAPABILITIES,
      // Operator-captured record: nothing arrives or is delivered externally.
      initiateConversation: true,
      text: true,
    },
    capabilitiesConfidence: "confirmed",
  },
  whatsapp: {
    id: "whatsapp",
    labelKey: "whatsapp",
    iconToken: "smartphone",
    kind: "social",
    // Conversations can already carry `channel: "whatsapp"` (data/filters),
    // but no WhatsApp integration exists in the repository yet.
    availability: "data_only",
    requiresConnection: true,
    capabilities: {
      ...NO_CAPABILITIES,
      inbound: true,
      outbound: true,
      // Business-initiated conversations require pre-approved templates.
      initiateConversation: true,
      text: true,
      images: true,
      video: true,
      audio: true,
      files: true,
      reactions: true,
      templates: true,
      deliveryReceipts: true,
      readReceipts: true,
      typingIndicators: true,
      maxTextLength: 4096,
      replyWindowHours: 24,
    },
    capabilitiesConfidence: "provisional",
  },
  instagram: {
    id: "instagram",
    labelKey: "instagram",
    iconToken: "instagram",
    kind: "social",
    availability: "planned",
    requiresConnection: true,
    capabilities: {
      ...NO_CAPABILITIES,
      inbound: true,
      outbound: true,
      text: true,
      images: true,
      video: true,
      audio: true,
      reactions: true,
      deliveryReceipts: true,
      readReceipts: true,
      typingIndicators: true,
      maxTextLength: 1000,
      replyWindowHours: 24,
    },
    capabilitiesConfidence: "provisional",
  },
  messenger: {
    id: "messenger",
    labelKey: "messenger",
    iconToken: "messenger",
    kind: "social",
    availability: "planned",
    requiresConnection: true,
    capabilities: {
      ...NO_CAPABILITIES,
      inbound: true,
      outbound: true,
      text: true,
      images: true,
      video: true,
      audio: true,
      files: true,
      reactions: true,
      deliveryReceipts: true,
      readReceipts: true,
      typingIndicators: true,
      maxTextLength: 2000,
      replyWindowHours: 24,
    },
    capabilitiesConfidence: "provisional",
  },
  tiktok: {
    id: "tiktok",
    labelKey: "tiktok",
    iconToken: "music-note",
    kind: "social",
    availability: "planned",
    requiresConnection: true,
    // TikTok's DM API surface is the least documented of the planned set —
    // keep the provisional set minimal instead of inventing parity.
    capabilities: {
      ...NO_CAPABILITIES,
      inbound: true,
      outbound: true,
      text: true,
      images: true,
    },
    capabilitiesConfidence: "provisional",
  },
  sms: {
    id: "sms",
    labelKey: "sms",
    iconToken: "message-sms",
    kind: "chat",
    availability: "planned",
    requiresConnection: true,
    capabilities: {
      ...NO_CAPABILITIES,
      inbound: true,
      outbound: true,
      initiateConversation: true,
      text: true,
      deliveryReceipts: true,
      // Concatenated-segment practical limit, not a protocol constant.
      maxTextLength: 1600,
    },
    capabilitiesConfidence: "provisional",
  },
}

/**
 * Alias map for raw channel values seen in stored data that predate the
 * registry ("web" / "webchat" rows from early web-chat ingestion).
 */
const CHANNEL_ALIASES: Record<string, InboxChannelId> = {
  web: "web_chat",
  webchat: "web_chat",
}

export function isInboxChannelId(value: string): value is InboxChannelId {
  return Object.prototype.hasOwnProperty.call(INBOX_CHANNELS, value)
}

/**
 * Normalize a raw channel value (DB free string, URL param, config entry)
 * to a canonical registry id, or `null` when unknown. Trims, lowercases and
 * resolves legacy aliases.
 */
export function normalizeInboxChannelId(raw: string | null | undefined): InboxChannelId | null {
  if (typeof raw !== "string") return null
  const value = raw.trim().toLowerCase()
  if (!value) return null
  if (isInboxChannelId(value)) return value
  return CHANNEL_ALIASES[value] ?? null
}

/** Registry lookup that tolerates raw/legacy values. `null` when unknown. */
export function getInboxChannel(raw: string | null | undefined): InboxChannelDefinition | null {
  const id = normalizeInboxChannelId(raw)
  return id ? INBOX_CHANNELS[id] : null
}

/**
 * Capability lookup with a conservative fallback for unknown channel values,
 * so consumers never need `channel === "email"` conditionals or null checks.
 */
export function getInboxChannelCapabilities(
  raw: string | null | undefined,
): InboxChannelCapabilities {
  return getInboxChannel(raw)?.capabilities ?? UNKNOWN_CHANNEL_CAPABILITIES
}

/**
 * Composer/behaviour family with an "internal"-safe fallback: unknown
 * channels behave like plain records (default composer), never like email.
 */
export function getInboxChannelKind(raw: string | null | undefined): InboxChannelKind {
  return getInboxChannel(raw)?.kind ?? "internal"
}

/**
 * Whether the channel may appear as a SELECTABLE filter option. Planned
 * channels are visible only as "coming soon" affordances — selecting them
 * would imply an integration that does not exist.
 */
export function isChannelSelectableInFilters(def: InboxChannelDefinition): boolean {
  return def.availability !== "planned"
}
