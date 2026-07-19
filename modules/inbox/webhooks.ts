/**
 * Provider webhook routing skeletons (INBOX-TRANSPORT-05D) — NEUTRAL
 * infrastructure only. No external API calls, no credentials, no payload
 * processing: these helpers resolve WHICH connection a webhook belongs to
 * (`provider + providerAccountId`, the index added in 04B) and say so
 * honestly. Actual payload → InboundEnvelope conversion lands with each
 * provider's real integration mission (WhatsApp first) — until then the
 * route answers "accepted: false, integration not implemented" instead of
 * pretending to work.
 */

export const KNOWN_WEBHOOK_PROVIDERS = ["meta", "twilio", "tiktok"] as const
export type KnownWebhookProvider = (typeof KNOWN_WEBHOOK_PROVIDERS)[number]

export function isKnownWebhookProvider(value: string): value is KnownWebhookProvider {
  return (KNOWN_WEBHOOK_PROVIDERS as readonly string[]).includes(value)
}

export type WebhookRouting =
  | { ok: true; providerAccountId: string }
  | { ok: false; reason: "unknown_provider" | "unroutable_payload" }

/**
 * Extract the provider-side account id from the MINIMAL routing contract of
 * each provider's webhook envelope (just enough to test routing — not the
 * full payload schema):
 *   - meta:   `entry[0].id` (page/IG-account/WABA id) — the stable outer
 *             envelope shared by Messenger/Instagram/WhatsApp webhooks;
 *   - twilio: `AccountSid` (JSON-normalized; the real integration will also
 *             accept form-encoded bodies);
 *   - tiktok: `client_key`;
 *   - any:    explicit `providerAccountId` (test/manual probes).
 */
export function resolveWebhookRouting(provider: string, body: unknown): WebhookRouting {
  if (!isKnownWebhookProvider(provider)) return { ok: false, reason: "unknown_provider" }
  if (!body || typeof body !== "object") return { ok: false, reason: "unroutable_payload" }
  const payload = body as Record<string, unknown>

  const explicit = payload.providerAccountId
  if (typeof explicit === "string" && explicit.trim()) {
    return { ok: true, providerAccountId: explicit.trim() }
  }

  if (provider === "meta") {
    const entry = Array.isArray(payload.entry) ? payload.entry[0] : null
    const id = entry && typeof entry === "object" ? (entry as Record<string, unknown>).id : null
    if (typeof id === "string" && id.trim()) return { ok: true, providerAccountId: id.trim() }
    // WhatsApp Cloud API nests the phone number id one level deeper.
    const changes =
      entry && typeof entry === "object" ? (entry as Record<string, unknown>).changes : null
    const change = Array.isArray(changes) ? changes[0] : null
    const value =
      change && typeof change === "object" ? (change as Record<string, unknown>).value : null
    const metadata =
      value && typeof value === "object"
        ? (value as Record<string, unknown>).metadata
        : null
    const phoneNumberId =
      metadata && typeof metadata === "object"
        ? (metadata as Record<string, unknown>).phone_number_id
        : null
    if (typeof phoneNumberId === "string" && phoneNumberId.trim()) {
      return { ok: true, providerAccountId: phoneNumberId.trim() }
    }
  }

  if (provider === "twilio") {
    const sid = payload.AccountSid
    if (typeof sid === "string" && sid.trim()) return { ok: true, providerAccountId: sid.trim() }
  }

  if (provider === "tiktok") {
    const key = payload.client_key
    if (typeof key === "string" && key.trim()) return { ok: true, providerAccountId: key.trim() }
  }

  return { ok: false, reason: "unroutable_payload" }
}
