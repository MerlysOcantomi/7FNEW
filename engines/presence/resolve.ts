/**
 * Sevenef Presence — resolution & entitlement (FOUNDATION).
 *
 * Pure logic for the two questions the public serving layer must answer later:
 *   1. How does an incoming request map to a site? (by slug or by hostname)
 *   2. Should that site be served publicly right now? (publication + entitlement)
 *
 * The entitlement rule encodes the commercial policy WITHOUT enforcing anything
 * today (observational, matching `core/system/plans.ts`): a site is entitled to
 * be public when Presence is included in an ACTIVE 7F SaaS plan, OR when the
 * workspace pays for Presence as a STANDALONE product. This is exactly what
 * lets a site keep running after 7F SaaS is cancelled — as long as the
 * standalone subscription is active.
 *
 * Pure and DB-free: the caller supplies the already-loaded records.
 */

import { resolveWorkspacePlan } from "@core/system/plans"
import type {
  PresenceSite,
  PresenceDomain,
  PresencePublication,
  PresenceSiteResolution,
} from "./types"

/** The module key a plan uses to include Presence in its bundle. */
export const PRESENCE_MODULE_KEY = "presence"

// ---------------------------------------------------------------------------
// Entitlement
// ---------------------------------------------------------------------------

export interface PresenceStandaloneSubscription {
  /** Whether the standalone Presence product is currently paid/active. */
  active: boolean
}

export interface PresenceEntitlementInput {
  /** `Workspace.plan` free-form string (resolved via `core/system/plans.ts`). */
  plan: string | null | undefined
  /** Standalone Presence subscription, when the workspace has one. */
  standalone?: PresenceStandaloneSubscription | null
}

export interface PresenceEntitlement {
  /** Whether the workspace is entitled to a PUBLIC Presence site. */
  entitled: boolean
  /** Why it is (or isn't) entitled. */
  source: "plan_included" | "standalone" | "none"
}

/** Whether a plan bundles Presence (explicit module or the enterprise `all`). */
function planIncludesPresence(enabledModules: readonly string[]): boolean {
  return enabledModules.includes("all") || enabledModules.includes(PRESENCE_MODULE_KEY)
}

/**
 * Resolve whether a workspace may keep a public Presence site. Plan inclusion
 * wins; otherwise an active standalone subscription grants it. Total, pure.
 */
export function resolvePresenceEntitlement(
  input: PresenceEntitlementInput,
): PresenceEntitlement {
  const plan = resolveWorkspacePlan({ plan: input.plan })
  if (planIncludesPresence(plan.enabledModules)) {
    return { entitled: true, source: "plan_included" }
  }
  if (input.standalone?.active) {
    return { entitled: true, source: "standalone" }
  }
  return { entitled: false, source: "none" }
}

// ---------------------------------------------------------------------------
// Public visibility
// ---------------------------------------------------------------------------

/**
 * A site is publicly visible when it is in the `published` status, its latest
 * publication is `public`, and the workspace is entitled. Any missing condition
 * → offline (fails safe).
 */
export function isPresencePubliclyVisible(
  site: PresenceSite,
  publication: PresencePublication | null,
  entitlement: PresenceEntitlement,
): boolean {
  if (!entitlement.entitled) return false
  if (site.status !== "published") return false
  if (!publication || publication.state !== "public") return false
  return true
}

// ---------------------------------------------------------------------------
// Request → site resolution (pure lookups over supplied records)
// ---------------------------------------------------------------------------

/** Resolve a site by its public slug (default subdomain). */
export function resolveSiteBySlug(
  slug: string,
  sites: readonly PresenceSite[],
): PresenceSite | null {
  const normalized = slug.trim().toLowerCase()
  return sites.find((s) => s.slug.toLowerCase() === normalized) ?? null
}

/** Resolve a `(domain, site)` pair by hostname (custom or subdomain host). */
export function resolveSiteByHostname(
  hostname: string,
  domains: readonly PresenceDomain[],
  sites: readonly PresenceSite[],
): { site: PresenceSite; domain: PresenceDomain } | null {
  const normalized = hostname.trim().toLowerCase()
  const domain = domains.find(
    (d) => d.hostname.toLowerCase() === normalized && d.verification === "verified",
  )
  if (!domain) return null
  const site = sites.find((s) => s.id === domain.siteId)
  if (!site) return null
  return { site, domain }
}

/**
 * Build a full resolution result for a site, including public-visibility.
 * `latestPublication` is the most recent publication record for the site.
 */
export function buildSiteResolution(args: {
  site: PresenceSite
  domain?: PresenceDomain | null
  latestPublication: PresencePublication | null
  entitlement: PresenceEntitlement
}): PresenceSiteResolution {
  const { site, domain = null, latestPublication, entitlement } = args
  return {
    site,
    domain,
    publication: latestPublication,
    isPubliclyVisible: isPresencePubliclyVisible(site, latestPublication, entitlement),
  }
}
