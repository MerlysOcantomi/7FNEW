/**
 * Sevenef Presence — core contracts (FOUNDATION).
 *
 * Sevenef Presence is the SHARED engine that produces and publishes business
 * websites. It is NOT a Finesse (Beauty) feature: it is offered inside 7F SaaS
 * plans and their verticals, sold standalone to businesses that do not use 7F
 * SaaS, and produced from Mr Forte Lab. Finesse is only the Beauty vertical of
 * 7F SaaS; Freya is the transversal creative agent (Mr Forte Lab) whose
 * capabilities Presence consumes.
 *
 * This module is a TYPE/CONTRACT foundation only — no Prisma model, no route, no
 * UI, no AI call is wired here (honesty rule from `docs/ways-of-working.md`:
 * foundation work is clearly labeled as foundation). It mirrors the existing
 * declarative patterns (`core/system/plans.ts`, `core/theme.ts`,
 * `core/registry/types.ts`) so a later PR can persist it without redesign.
 *
 * Guardrails honored here:
 *   - No Beauty-only logic in the shared engine.
 *   - No repo/Vercel-project per client: one engine, data isolated by
 *     `workspaceId`, config in DB, files in external storage.
 *   - Photographs are NEVER stored in git — `PresenceMedia` only references an
 *     external `storageKey`/`url` (Vercel Blob today, provider-agnostic).
 *   - Public business data (services, hours, location, …) is NOT duplicated
 *     here — Presence READS it from the Business Profile (see
 *     `content-source.ts`). The site only owns presentation state.
 */

import type { PresenceSectionKind } from "./sections"

// ---------------------------------------------------------------------------
// Commercial model & lifecycle
// ---------------------------------------------------------------------------

/**
 * How a Presence site is commercially produced/owned. Mirrors the product
 * policy: a site can be bundled with an active 7F SaaS plan, sold as a
 * standalone monthly product, or produced from Mr Forte Lab.
 */
export const PRESENCE_OWNERSHIP_MODELS = [
  "included_in_saas",
  "standalone",
  "lab_produced",
] as const
export type PresenceOwnershipModel = (typeof PRESENCE_OWNERSHIP_MODELS)[number]

/**
 * Editorial/lifecycle status of a site (what the operator sees). Independent
 * from `PresencePublicationState`, which is the public visibility fact.
 */
export const PRESENCE_SITE_STATUSES = [
  "draft", // created, no style chosen yet
  "styling", // Freya proposed styles, awaiting client choice
  "ready", // a style is chosen, ready to publish
  "published", // currently public
  "unpublished", // was public, taken down (e.g. SaaS cancelled, no standalone)
  "archived", // retired
] as const
export type PresenceSiteStatus = (typeof PRESENCE_SITE_STATUSES)[number]

/** Public visibility fact, decided by publication + entitlement. */
export const PRESENCE_PUBLICATION_STATES = ["public", "offline"] as const
export type PresencePublicationState = (typeof PRESENCE_PUBLICATION_STATES)[number]

// ---------------------------------------------------------------------------
// PresenceSite — presentation state for a workspace's site (owns NO public data)
// ---------------------------------------------------------------------------

/** A single section placed on a site, referencing a registry section kind. */
export interface PresenceSectionInstance {
  /** Registry section kind (see `sections.ts`). */
  kind: PresenceSectionKind
  /** Whether the section is rendered. */
  enabled: boolean
  /** Order within the page (ascending). */
  order: number
  /**
   * Optional per-instance presentation overrides (layout variant, heading
   * override, …). Never public business data — that stays in the Business
   * Profile and is resolved at render time.
   */
  presentation?: Record<string, unknown>
}

export interface PresenceSite {
  id: string
  /** Multi-tenant key — every read/write is scoped by this. */
  workspaceId: string
  /**
   * Public slug for the default subdomain (e.g. `<slug>.sevenef.site`). Distinct
   * from `Workspace.slug`; a workspace may run more than one site later.
   */
  slug: string
  status: PresenceSiteStatus
  ownershipModel: PresenceOwnershipModel
  /** Chosen template + pinned version (see template versioning in `templates.ts`). */
  templateId: string
  templateVersion: string
  /** Active theme key — reuses the existing 7F theme tokens (`core/theme.ts`). */
  themeKey: string
  /** Which Freya proposal the client picked, if any. */
  selectedProposalId: string | null
  /** Ordered sections; content is resolved from the Business Profile at render. */
  sections: PresenceSectionInstance[]
  createdAt: string
  updatedAt: string
}

// ---------------------------------------------------------------------------
// PresencePublication — an immutable record of a publish/unpublish transition
// ---------------------------------------------------------------------------

export interface PresencePublication {
  id: string
  siteId: string
  workspaceId: string
  state: PresencePublicationState
  /** The template + theme frozen at publish time (for reproducibility). */
  templateId: string
  templateVersion: string
  themeKey: string
  /** Why the transition happened (e.g. "client_published", "saas_cancelled"). */
  reason: string
  publishedAt: string | null
  offlineAt: string | null
}

// ---------------------------------------------------------------------------
// PresenceDomain — how a site is reached (subdomain or custom domain)
// ---------------------------------------------------------------------------

export const PRESENCE_DOMAIN_KINDS = ["subdomain", "custom"] as const
export type PresenceDomainKind = (typeof PRESENCE_DOMAIN_KINDS)[number]

export const PRESENCE_DOMAIN_VERIFICATION = [
  "pending",
  "verified",
  "failed",
] as const
export type PresenceDomainVerification = (typeof PRESENCE_DOMAIN_VERIFICATION)[number]

/**
 * Who owns the domain, per the product policy: "the domain belongs to the
 * client or can be transferred according to the applicable policy".
 */
export const PRESENCE_DOMAIN_OWNERSHIP = [
  "client_owned",
  "managed",
  "transferable",
] as const
export type PresenceDomainOwnership = (typeof PRESENCE_DOMAIN_OWNERSHIP)[number]

export interface PresenceDomain {
  id: string
  workspaceId: string
  siteId: string
  /** Fully-qualified hostname, lowercased (e.g. `mystudio.com`). */
  hostname: string
  kind: PresenceDomainKind
  verification: PresenceDomainVerification
  ownership: PresenceDomainOwnership
  /** The canonical hostname for the site (only one primary). */
  isPrimary: boolean
  createdAt: string
}

// ---------------------------------------------------------------------------
// PresenceMedia — external reference to a photo/asset (NEVER stored in git)
// ---------------------------------------------------------------------------

export const PRESENCE_MEDIA_KINDS = ["photo", "logo", "video", "variant"] as const
export type PresenceMediaKind = (typeof PRESENCE_MEDIA_KINDS)[number]

/** Editorial role a media plays on the site. */
export const PRESENCE_MEDIA_ROLES = [
  "work_sample", // a real result/work photo — integrity must be preserved
  "gallery",
  "hero",
  "team",
  "brand",
] as const
export type PresenceMediaRole = (typeof PRESENCE_MEDIA_ROLES)[number]

export interface PresenceMedia {
  id: string
  workspaceId: string
  kind: PresenceMediaKind
  role: PresenceMediaRole
  /** External storage key (Vercel Blob today) — the file is never in git. */
  storageKey: string
  /** Public URL of the asset. */
  url: string
  /** For `kind: "variant"`, the source media this was derived from. */
  sourceMediaId: string | null
  mimeType: string
  width: number | null
  height: number | null
  /**
   * True when the photo shows a REAL professional result. Freya must generate
   * technical variants (crop/resize/format) WITHOUT any edit that falsifies the
   * professional outcome. Enforced by `FreyaMediaAssessment.preserveIntegrity`.
   */
  isRealWorkSample: boolean
  /** The Freya assessment that classified this media, if any. */
  assessmentId: string | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// Resolution result — how a public request maps to a renderable site
// ---------------------------------------------------------------------------

export interface PresenceSiteResolution {
  site: PresenceSite
  /** The domain the request came through, when resolved by hostname. */
  domain: PresenceDomain | null
  /** Latest publication record, if any. */
  publication: PresencePublication | null
  /** Whether the site should actually be served publicly right now. */
  isPubliclyVisible: boolean
}
