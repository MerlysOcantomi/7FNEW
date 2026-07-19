/**
 * Channel transport registry (INBOX-TRANSPORT-05A). Deterministic resolution
 * by `channel + provider`, with the failure MODES kept distinct so callers
 * can answer precisely:
 *
 *   unknown_channel          — value not in the channel registry at all;
 *   channel_not_outbound     — the channel's declared capabilities do not
 *                              allow outbound (planned channels, manual);
 *   transport_not_registered — channel could send, but no adapter for this
 *                              provider exists yet (enabled ≠ integrated).
 *
 * Pure module: no React, no DB. Transports self-register at import time via
 * `modules/inbox/transport/index.ts`.
 */

import {
  getInboxChannel,
  normalizeInboxChannelId,
  type InboxChannelId,
} from "@core/inbox/channel-registry"
import type { ChannelTransport } from "./contracts"

const transports = new Map<string, ChannelTransport>()

function key(channel: InboxChannelId, provider: string): string {
  return `${channel}::${provider.trim().toLowerCase()}`
}

/** Register a transport. Duplicate (channel, provider) pairs are a bug → throw. */
export function registerChannelTransport(transport: ChannelTransport): void {
  const k = key(transport.channel, transport.provider)
  if (transports.has(k)) {
    throw new Error(`Channel transport already registered: ${k}`)
  }
  transports.set(k, transport)
}

/** Test-only escape hatch — production code must never unregister. */
export function unregisterChannelTransportForTests(
  channel: InboxChannelId,
  provider: string,
): void {
  transports.delete(key(channel, provider))
}

export type TransportResolution =
  | { ok: true; transport: ChannelTransport }
  | {
      ok: false
      reason: "unknown_channel" | "channel_not_outbound" | "transport_not_registered"
    }

/**
 * Resolve the transport for a raw channel value + provider. Capability check
 * first (the channel registry stays the single truth about what a channel
 * can do), then adapter lookup.
 */
export function resolveChannelTransport(options: {
  channel: string | null | undefined
  provider: string | null | undefined
}): TransportResolution {
  const channelId = normalizeInboxChannelId(options.channel)
  const definition = channelId ? getInboxChannel(channelId) : null
  if (!channelId || !definition) return { ok: false, reason: "unknown_channel" }
  if (!definition.capabilities.outbound) return { ok: false, reason: "channel_not_outbound" }
  const provider = options.provider?.trim().toLowerCase()
  if (!provider) return { ok: false, reason: "transport_not_registered" }
  const transport = transports.get(key(channelId, provider))
  if (!transport) return { ok: false, reason: "transport_not_registered" }
  return { ok: true, transport }
}

/** Registered (channel, provider) pairs — observability/introspection only. */
export function listRegisteredChannelTransports(): Array<{ channel: InboxChannelId; provider: string }> {
  return [...transports.values()].map((t) => ({ channel: t.channel, provider: t.provider }))
}
