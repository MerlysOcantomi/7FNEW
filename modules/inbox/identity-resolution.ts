/**
 * Pure identity helpers for the multi-channel Inbox (INBOX-DATA-04B).
 * Design: docs/product/smart-inbox-data-model-design.md (rev. 04A.1).
 *
 * Everything here is deterministic and DB-free. The DB-touching companion
 * (`identity-service.ts`) is a thin orchestration layer over these
 * functions — the pure-planner pattern from docs/inbox-pipeline-testing.md.
 */

import { createHash } from "node:crypto"
import type { InboxChannelId } from "@core/inbox/channel-registry"

// ── Normalization ───────────────────────────────────────────────────────────

/** Lowercased/trimmed email, or null when clearly not an email. */
export function normalizeEmail(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null
  const value = raw.trim().toLowerCase()
  if (!value || !value.includes("@") || value.startsWith("@") || value.endsWith("@")) return null
  return value
}

export interface NormalizedPhone {
  value: string
  /** "e164" (confident) | "digits" (no country context — NOT E.164). */
  quality: "e164" | "digits"
}

/**
 * Conservative phone normalization. E.164 ONLY when the raw value already
 * carries an explicit `+`/`00` country prefix or the caller provides a
 * default country calling code from real context (never inferred/guessed —
 * policy from the approved design). Otherwise digits-only, flagged so the
 * caller records `normalization: "partial"`.
 */
export function normalizePhone(
  raw: string | null | undefined,
  options: { defaultCountryCallingCode?: string } = {},
): NormalizedPhone | null {
  if (typeof raw !== "string") return null
  const trimmed = raw.trim()
  if (!trimmed) return null
  const hasPlus = trimmed.startsWith("+")
  const hasIddPrefix = /^00\d/.test(trimmed.replace(/[\s().-]/g, ""))
  const digits = trimmed.replace(/\D/g, "")
  if (digits.length < 6 || digits.length > 15) return null
  if (hasPlus) return { value: `+${digits}`, quality: "e164" }
  if (hasIddPrefix) return { value: `+${digits.slice(2)}`, quality: "e164" }
  const country = options.defaultCountryCallingCode?.replace(/\D/g, "")
  if (country) {
    // Explicit context provided by the caller (workspace/connection config).
    const national = digits.replace(/^0+/, "")
    return { value: `+${country}${national}`, quality: "e164" }
  }
  return { value: digits, quality: "digits" }
}

/** Lowercased handle without a leading "@", or null. */
export function normalizeHandle(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null
  const value = raw.trim().toLowerCase().replace(/^@+/, "")
  return value.length > 0 ? value : null
}

/**
 * Short stable hash for conflict reports and logs — identity VALUES are PII
 * and must never appear raw in logs (policy precedent: fanny_auto_decision
 * telemetry).
 */
export function hashIdentityValue(value: string): string {
  return createHash("sha256").update(value).digest("hex").slice(0, 16)
}

// ── Routing descriptor (channel/provider/scopeKey/externalKey doctrine) ─────

export type IdentityKind = "email" | "phone" | "handle" | "psid" | "external_id" | "visitor"

export interface IdentityDescriptor {
  channel: InboxChannelId
  provider: string
  scopeKey: string
  kind: IdentityKind
  externalKey: string
}

/**
 * Build the routing descriptor for an identity, applying the approved
 * doctrine (§4.5 of the design):
 *   - globally-addressed kinds (email, phone) use provider "unknown" and
 *     scopeKey "" so one address never splits across transports;
 *   - provider-scoped kinds (psid, external_id) use the real provider and
 *     scopeKey = providerAccountId, falling back to connectionId ONLY when
 *     the account id is unavailable (degraded mode);
 *   - handles are channel-scoped (the channel distinguishes platforms) →
 *     provider "unknown", scopeKey "";
 *   - visitor ids are workspace-scoped by the routing key itself →
 *     provider "unknown", scopeKey "".
 * Returns null when the value normalizes to nothing.
 */
export function buildIdentityDescriptor(input: {
  channel: InboxChannelId
  kind: IdentityKind
  rawValue: string
  provider?: string | null
  providerAccountId?: string | null
  connectionId?: string | null
  defaultCountryCallingCode?: string
}): IdentityDescriptor | null {
  const { channel, kind } = input
  if (kind === "email") {
    const value = normalizeEmail(input.rawValue)
    return value ? { channel, provider: "unknown", scopeKey: "", kind, externalKey: value } : null
  }
  if (kind === "phone") {
    const phone = normalizePhone(input.rawValue, {
      defaultCountryCallingCode: input.defaultCountryCallingCode,
    })
    return phone
      ? { channel, provider: "unknown", scopeKey: "", kind, externalKey: phone.value }
      : null
  }
  if (kind === "handle") {
    const value = normalizeHandle(input.rawValue)
    return value ? { channel, provider: "unknown", scopeKey: "", kind, externalKey: value } : null
  }
  if (kind === "visitor") {
    const value = input.rawValue.trim()
    return value ? { channel, provider: "unknown", scopeKey: "", kind, externalKey: value } : null
  }
  // psid / external_id — provider-scoped.
  const value = input.rawValue.trim()
  if (!value) return null
  const provider = input.provider?.trim() || "unknown"
  const scopeKey = input.providerAccountId?.trim() || input.connectionId?.trim() || ""
  return { channel, provider, scopeKey, kind, externalKey: value }
}

// ── Resolution projection (the ONLY source of primaryContactId) ─────────────

export type IdentityLinkStatus = "confirmed" | "suggested" | "rejected"

export interface IdentityLinkLike {
  contactId: string
  status: IdentityLinkStatus
  source?: string
}

export interface IdentityResolutionProjection {
  resolutionStatus: "resolved" | "ambiguous" | "unresolved"
  primaryContactId: string | null
}

/**
 * Project an identity's resolution from its links. THE canonical rule set
 * (no other code may derive `resolutionStatus`/`primaryContactId`):
 *   - exactly one CONFIRMED link → resolved, that contact;
 *   - more than one confirmed → ambiguous, null (operator must fix);
 *   - zero confirmed → unresolved, null. Suggested/declared/rejected links
 *     NEVER select a contact.
 * Pure and idempotent: same links → same projection.
 */
export function projectIdentityResolution(
  links: readonly IdentityLinkLike[],
): IdentityResolutionProjection {
  const confirmed = links.filter((link) => link.status === "confirmed")
  const distinctContacts = [...new Set(confirmed.map((link) => link.contactId))]
  if (distinctContacts.length === 1) {
    return { resolutionStatus: "resolved", primaryContactId: distinctContacts[0] }
  }
  if (distinctContacts.length > 1) {
    return { resolutionStatus: "ambiguous", primaryContactId: null }
  }
  return { resolutionStatus: "unresolved", primaryContactId: null }
}

// ── Provisional contact strategy ────────────────────────────────────────────

/**
 * Marker used on link/contact metadata for provisional contacts created to
 * host conversations of an unresolved identity. Explicit on purpose: the
 * provisional state must not be conflated with the commercial contact
 * `tipo` ("visitante"), which existing flows also use for real visitors.
 */
export const PROVISIONAL_LINK_SOURCE = "ingestion"

export type InboundContactPlan =
  | { action: "use_primary"; contactId: string }
  | { action: "reuse_provisional"; contactId: string }
  | { action: "create_provisional" }

/**
 * Decide which contact hosts an inbound message for this identity:
 *   - resolved identity → its primary contact;
 *   - otherwise REUSE the identity's provisional anchor: the contact of its
 *     existing non-rejected `suggested` link with source "ingestion" (one
 *     provisional contact per identity — never one per message);
 *   - otherwise create a provisional contact (caller marks it explicitly
 *     via `metadata: {"provisionalForIdentity": <id>}` and links it back
 *     with a suggested/ingestion link).
 * NEVER selects among ambiguous declared/confirmed candidates — that is the
 * operator's decision (§4.4 of the design).
 */
export function planContactForInbound(
  identity: { resolutionStatus: string; primaryContactId: string | null },
  links: readonly IdentityLinkLike[],
): InboundContactPlan {
  if (identity.resolutionStatus === "resolved" && identity.primaryContactId) {
    return { action: "use_primary", contactId: identity.primaryContactId }
  }
  const provisional = links.find(
    (link) => link.status === "suggested" && link.source === PROVISIONAL_LINK_SOURCE,
  )
  if (provisional) {
    return { action: "reuse_provisional", contactId: provisional.contactId }
  }
  return { action: "create_provisional" }
}
