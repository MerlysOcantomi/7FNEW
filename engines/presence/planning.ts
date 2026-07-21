/**
 * Sevenef Presence — pure write planners (PRESENCE-02).
 *
 * Following the repo's "pure planner" convention
 * (`docs/inbox-pipeline-testing.md`): all state-transition decisions live in
 * pure, deterministic functions here; the repository (`repository.ts`) is a thin
 * Prisma orchestration that applies these plans. Nothing here touches the DB or
 * the clock — `now` is injected — so every rule is unit-testable.
 */

import type { FreyaSiteProposal } from "./freya"
import { presenceTemplateRegistry } from "./templates"
import type {
  PresenceSite,
  PresenceSiteStatus,
  PresencePublicationState,
} from "./types"

// ---------------------------------------------------------------------------
// Proposal selection
// ---------------------------------------------------------------------------

/** The site fields to write when a client selects a Freya style proposal. */
export interface ProposalSelectionPlan {
  selectedProposalId: string
  templateId: string
  templateVersion: string
  themeKey: string
  status: PresenceSiteStatus
}

/**
 * Plan the site update for a chosen proposal. Resolves the template's current
 * version from the registry (pinned onto the site). Moves the site to `ready`.
 */
export function planProposalSelection(proposal: FreyaSiteProposal): ProposalSelectionPlan {
  const template = presenceTemplateRegistry.get(proposal.templateId)
  return {
    selectedProposalId: proposal.id,
    templateId: proposal.templateId,
    templateVersion: template?.version ?? "0.1.0",
    themeKey: proposal.themeKey,
    status: "ready",
  }
}

// ---------------------------------------------------------------------------
// Publish / unpublish
// ---------------------------------------------------------------------------

/** The site update + publication record to create for a transition. */
export interface PublicationPlan {
  siteStatus: PresenceSiteStatus
  publication: {
    state: PresencePublicationState
    templateId: string
    templateVersion: string
    themeKey: string
    reason: string
    publishedAt: string | null
    offlineAt: string | null
  }
}

/**
 * Plan publishing a site. Records intent (status `published`, publication
 * `public`) and freezes the current template/theme. Effective PUBLIC visibility
 * is decided separately by `isPresencePubliclyVisible` (entitlement-aware) — a
 * published site with no entitlement is recorded but stays offline to visitors.
 */
export function planPublish(
  site: Pick<PresenceSite, "templateId" | "templateVersion" | "themeKey">,
  nowIso: string,
  reason = "client_published",
): PublicationPlan {
  return {
    siteStatus: "published",
    publication: {
      state: "public",
      templateId: site.templateId,
      templateVersion: site.templateVersion,
      themeKey: site.themeKey,
      reason,
      publishedAt: nowIso,
      offlineAt: null,
    },
  }
}

/**
 * Plan taking a site offline (client unpublish, SaaS cancellation with no
 * standalone, admin suspension, …). Status → `unpublished`, publication
 * `offline`.
 */
export function planUnpublish(
  site: Pick<PresenceSite, "templateId" | "templateVersion" | "themeKey">,
  nowIso: string,
  reason = "client_unpublished",
): PublicationPlan {
  return {
    siteStatus: "unpublished",
    publication: {
      state: "offline",
      templateId: site.templateId,
      templateVersion: site.templateVersion,
      themeKey: site.themeKey,
      reason,
      publishedAt: null,
      offlineAt: nowIso,
    },
  }
}

// ---------------------------------------------------------------------------
// Visual config guard (no business data may leak into presentation state)
// ---------------------------------------------------------------------------

/**
 * Keys that must NEVER appear in a site's visual config — they belong to the
 * Business Profile, not to Presence. `sanitizeVisualConfig` strips them so a
 * caller can't accidentally duplicate public business data into the site row.
 */
export const FORBIDDEN_VISUAL_CONFIG_KEYS = [
  "businessName",
  "description",
  "services",
  "prices",
  "hours",
  "workingHours",
  "address",
  "location",
  "phone",
  "whatsapp",
  "team",
  "promotions",
  "social",
  "socials",
  "reviews",
] as const

export interface VisualConfig {
  /** Ordered section instances (kind/enabled/order) and visual overrides only. */
  sections?: unknown[]
  presentation?: Record<string, unknown>
}

/**
 * Strip forbidden business-data keys from a visual config object at any depth of
 * the top level. Returns a safe object containing only presentation state.
 */
export function sanitizeVisualConfig(input: Record<string, unknown>): VisualConfig {
  const out: Record<string, unknown> = {}
  const forbidden = new Set<string>(FORBIDDEN_VISUAL_CONFIG_KEYS)
  for (const [key, value] of Object.entries(input ?? {})) {
    if (forbidden.has(key)) continue
    out[key] = value
  }
  return out as VisualConfig
}
