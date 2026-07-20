/**
 * Sevenef Presence — content source adapter (FOUNDATION).
 *
 * Presence owns NO public business data. This adapter is the READ-ONLY
 * projection that maps the existing Business Profile
 * (`Workspace.config.businessProfile` + `serviceCatalog`, typed in
 * `core/verticals.ts`) into the normalized shape a site renders from.
 *
 * This is how the guardrail "do not duplicate services, hours or public data if
 * they already exist in the Business Profile" is enforced structurally: the site
 * references sources; the profile stays the single source of truth. Subsequent
 * changes are made by updating the Business Profile, never by editing the site.
 *
 * Pure and DB-free. Fields the current profile does not yet model (prices,
 * structured hours, location, team, socials, reviews) are represented as empty
 * slots — they are FUTURE Business Profile extensions, owned by the profile, not
 * by Presence.
 */

import type {
  WorkspaceBusinessProfile,
  WorkspaceServiceCatalogItem,
} from "@core/verticals"
import { PRESENCE_PROFILE_SOURCES, type PresenceProfileSource } from "./sections"

/** Minimal channel view Presence needs (from `ChannelConnection`), read-only. */
export interface PresenceChannelSource {
  whatsapp: string | null
  phone: string | null
  /** platform → handle/url (e.g. `instagram` → `@studio`). */
  social: Record<string, string>
}

export interface PresenceContentSourceInput {
  workspaceId: string
  businessName: string
  profile: WorkspaceBusinessProfile
  serviceCatalog?: WorkspaceServiceCatalogItem[]
  channels?: PresenceChannelSource
}

/**
 * The normalized, read-only content a site can render. Every field points back
 * to the Business Profile as its owner; Presence never persists a copy.
 */
export interface PresenceContentSource {
  workspaceId: string
  identity: {
    name: string
    description: string | null
  }
  services: Array<{ name: string; category: string | null; active: boolean }>
  hours: string | null
  region: string | null
  channels: PresenceChannelSource
  /** Which profile sources actually carry data right now. */
  availableSources: PresenceProfileSource[]
}

const EMPTY_CHANNELS: PresenceChannelSource = { whatsapp: null, phone: null, social: {} }

/**
 * Build the read-only content projection from the Business Profile. Total and
 * pure: missing/partial profiles degrade to empty slots, never throw.
 */
export function buildPresenceContentSource(
  input: PresenceContentSourceInput,
): PresenceContentSource {
  const profile = input.profile ?? {}
  const channels = input.channels ?? EMPTY_CHANNELS

  // Prefer the structured service catalog; fall back to the flat `services[]`.
  const services =
    input.serviceCatalog && input.serviceCatalog.length > 0
      ? input.serviceCatalog.map((s) => ({
          name: s.name,
          category: s.category ?? null,
          active: s.active,
        }))
      : (profile.services ?? []).map((name) => ({ name, category: null, active: true }))

  const source: PresenceContentSource = {
    workspaceId: input.workspaceId,
    identity: {
      name: profile.businessName?.trim() || input.businessName,
      description: profile.businessDescription?.trim() || null,
    },
    services,
    hours: profile.workingHours?.trim() || null,
    region: profile.region?.trim() || null,
    channels,
    availableSources: [],
  }

  source.availableSources = computeAvailableSources(source)
  return source
}

/** Determine which section data-sources currently have real data to render. */
export function computeAvailableSources(
  source: PresenceContentSource,
): PresenceProfileSource[] {
  const present = new Set<PresenceProfileSource>()

  if (source.identity.name || source.identity.description) present.add("identity")
  if (source.services.some((s) => s.active)) present.add("services")
  if (source.hours) present.add("hours")
  if (source.region) present.add("location")
  if (source.channels.whatsapp) present.add("whatsapp")
  if (source.channels.phone) present.add("phone")
  if (Object.keys(source.channels.social).length > 0) present.add("social")

  // Keep declaration order stable for deterministic output.
  return PRESENCE_PROFILE_SOURCES.filter((s) => present.has(s))
}
