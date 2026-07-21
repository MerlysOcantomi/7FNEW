/**
 * Sevenef Presence — data-access layer (PRESENCE-02).
 *
 * Thin Prisma orchestration over the pure planners (`planning.ts`), slug/host
 * normalization (`slug.ts`), resolution + entitlement (`resolve.ts`). Every
 * function is multi-tenant: reads/writes that mutate a workspace's site require
 * a matching `workspaceId`, so a caller from workspace A can never touch
 * workspace B's records even if it guesses an id. Public resolution
 * (`findSiteBySlug` / `findSiteByHostname`) is cross-workspace by design (the
 * public serving layer has no workspace context) but only ever exposes the
 * resolved tenant's own data.
 *
 * NOT wired to any UI. Business content is never stored/read here — it comes
 * from the Business Profile via `content-source.ts`.
 */

import { db } from "@core/db"
import type { PresenceSite as PresenceSiteRow, PresenceDomain as PresenceDomainRow, PresenceMedia as PresenceMediaRow } from "@/generated/prisma/client"
import type { FreyaSiteProposal } from "./freya"
import {
  planProposalSelection,
  planPublish,
  planUnpublish,
  sanitizeVisualConfig,
} from "./planning"
import {
  normalizeSlug,
  isValidSlug,
  normalizeHostname,
  isValidHostname,
} from "./slug"
import {
  resolvePresenceEntitlement,
  isPresencePubliclyVisible,
  type PresenceEntitlement,
} from "./resolve"
import type {
  PresenceSite,
  PresencePublication,
  PresenceOwnershipModel,
} from "./types"

function nowIso(): string {
  return new Date().toISOString()
}

function toDate(iso: string | null): Date | null {
  return iso ? new Date(iso) : null
}

// ---------------------------------------------------------------------------
// Site create / read
// ---------------------------------------------------------------------------

export interface CreateSiteInput {
  slug?: string
  ownershipModel?: PresenceOwnershipModel
}

/**
 * Get the workspace's site, creating it (status `draft`) on first call. One
 * canonical site per workspace (enforced by `PresenceSite.workspaceId @unique`).
 * The initial slug defaults to a normalized form of the provided slug or the
 * workspace slug, with a short disambiguating suffix if taken.
 */
export async function getOrCreateSiteForWorkspace(
  workspaceId: string,
  input: CreateSiteInput = {},
): Promise<PresenceSiteRow> {
  const existing = await db.presenceSite.findUnique({ where: { workspaceId } })
  if (existing) return existing

  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true },
  })
  const base = normalizeSlug(input.slug ?? ws?.slug ?? "") || `site-${workspaceId.slice(0, 8)}`
  const slug = await ensureUniqueSlug(isValidSlug(base) ? base : `site-${workspaceId.slice(0, 8)}`)

  return db.presenceSite.create({
    data: {
      workspaceId,
      slug,
      ownershipModel: input.ownershipModel ?? "included_in_saas",
      status: "draft",
    },
  })
}

/** Find a globally-unique candidate slug, suffixing on collision. */
async function ensureUniqueSlug(base: string): Promise<string> {
  let candidate = base
  for (let i = 0; i < 50; i++) {
    const taken = await db.presenceSite.findUnique({ where: { slug: candidate } })
    if (!taken) return candidate
    candidate = normalizeSlug(`${base}-${i + 2}`)
  }
  // Extremely unlikely fallback.
  return normalizeSlug(`${base}-${Date.now().toString(36)}`)
}

/** Public resolution by slug (Sevenef-managed subdomain). Cross-workspace. */
export async function findSiteBySlug(slug: string): Promise<PresenceSiteRow | null> {
  const normalized = normalizeSlug(slug)
  if (!normalized) return null
  return db.presenceSite.findUnique({ where: { slug: normalized } })
}

/**
 * Public resolution by hostname — ONLY through a VERIFIED custom domain. An
 * unverified/failed/pending domain never resolves publicly.
 */
export async function findSiteByHostname(hostname: string): Promise<{ site: PresenceSiteRow; domain: PresenceDomainRow } | null> {
  const normalized = normalizeHostname(hostname)
  if (!normalized) return null
  const domain = await db.presenceDomain.findUnique({ where: { hostname: normalized } })
  if (!domain || domain.verification !== "verified") return null
  const site = await db.presenceSite.findUnique({ where: { id: domain.siteId } })
  if (!site) return null
  return { site, domain }
}

// ---------------------------------------------------------------------------
// Visual config & Freya proposal selection
// ---------------------------------------------------------------------------

/** Update the site's strictly-visual config (business data is stripped). */
export async function updateVisualConfig(
  workspaceId: string,
  siteId: string,
  config: Record<string, unknown>,
): Promise<PresenceSiteRow> {
  await assertOwnership(workspaceId, siteId)
  const safe = sanitizeVisualConfig(config)
  return db.presenceSite.update({
    where: { id: siteId },
    data: { visualConfig: JSON.stringify(safe) },
  })
}

/** Persist the client's chosen Freya proposal (theme + template pinned). */
export async function selectFreyaProposal(
  workspaceId: string,
  siteId: string,
  proposal: FreyaSiteProposal,
): Promise<PresenceSiteRow> {
  await assertOwnership(workspaceId, siteId)
  const plan = planProposalSelection(proposal)
  return db.presenceSite.update({
    where: { id: siteId },
    data: {
      selectedProposalId: plan.selectedProposalId,
      templateId: plan.templateId,
      templateVersion: plan.templateVersion,
      themeKey: plan.themeKey,
      status: plan.status,
    },
  })
}

// ---------------------------------------------------------------------------
// Publish / unpublish
// ---------------------------------------------------------------------------

/** Publish a site: record intent + an immutable publication row. */
export async function publishSite(
  workspaceId: string,
  siteId: string,
  reason = "client_published",
): Promise<PresenceSiteRow> {
  const site = await assertOwnership(workspaceId, siteId)
  const plan = planPublish(site, nowIso(), reason)
  const [updated] = await db.$transaction([
    db.presenceSite.update({ where: { id: siteId }, data: { status: plan.siteStatus } }),
    db.presencePublication.create({
      data: {
        workspaceId,
        siteId,
        state: plan.publication.state,
        templateId: plan.publication.templateId,
        templateVersion: plan.publication.templateVersion,
        themeKey: plan.publication.themeKey,
        reason: plan.publication.reason,
        publishedAt: toDate(plan.publication.publishedAt),
        offlineAt: toDate(plan.publication.offlineAt),
      },
    }),
  ])
  return updated
}

/** Take a site offline: record intent + an immutable publication row. */
export async function unpublishSite(
  workspaceId: string,
  siteId: string,
  reason = "client_unpublished",
): Promise<PresenceSiteRow> {
  const site = await assertOwnership(workspaceId, siteId)
  const plan = planUnpublish(site, nowIso(), reason)
  const [updated] = await db.$transaction([
    db.presenceSite.update({ where: { id: siteId }, data: { status: plan.siteStatus } }),
    db.presencePublication.create({
      data: {
        workspaceId,
        siteId,
        state: plan.publication.state,
        templateId: plan.publication.templateId,
        templateVersion: plan.publication.templateVersion,
        themeKey: plan.publication.themeKey,
        reason: plan.publication.reason,
        publishedAt: toDate(plan.publication.publishedAt),
        offlineAt: toDate(plan.publication.offlineAt),
      },
    }),
  ])
  return updated
}

async function latestPublication(siteId: string): Promise<PresencePublication | null> {
  const row = await db.presencePublication.findFirst({
    where: { siteId },
    orderBy: { createdAt: "desc" },
  })
  if (!row) return null
  return {
    id: row.id,
    siteId: row.siteId,
    workspaceId: row.workspaceId,
    state: row.state as PresencePublication["state"],
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    themeKey: row.themeKey,
    reason: row.reason,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    offlineAt: row.offlineAt ? row.offlineAt.toISOString() : null,
  }
}

// ---------------------------------------------------------------------------
// Entitlement & effective public visibility
// ---------------------------------------------------------------------------

/**
 * Resolve the workspace's Presence entitlement from PERSISTED data
 * (`Workspace.plan` + `PresenceSubscription`). The entitlement itself is
 * COMPUTED — never stored — so "included in plan" and "standalone active" stay
 * a single source of truth.
 */
export async function getPresenceEntitlement(workspaceId: string): Promise<PresenceEntitlement> {
  const [ws, sub] = await Promise.all([
    db.workspace.findUnique({ where: { id: workspaceId }, select: { plan: true } }),
    db.presenceSubscription.findUnique({ where: { workspaceId } }),
  ])
  return resolvePresenceEntitlement({
    plan: ws?.plan,
    standalone: sub ? { active: sub.status === "active" } : null,
  })
}

/**
 * Full public resolution for a slug or hostname: resolve the site, compute the
 * entitlement, and derive EFFECTIVE visibility (published + public + entitled).
 * Returns null when nothing resolves. This is what a public serving route would
 * call; it is not wired to any route yet.
 */
export async function resolvePublicSite(
  slugOrHost: string,
): Promise<{ site: PresenceSiteRow; entitlement: PresenceEntitlement; isPubliclyVisible: boolean } | null> {
  const byHost = slugOrHost.includes(".") ? await findSiteByHostname(slugOrHost) : null
  const site = byHost?.site ?? (await findSiteBySlug(slugOrHost))
  if (!site) return null

  const entitlement = await getPresenceEntitlement(site.workspaceId)
  const publication = await latestPublication(site.id)
  const domainSite: PresenceSite = mapSiteRow(site)
  const isPubliclyVisible = isPresencePubliclyVisible(domainSite, publication, entitlement)
  return { site, entitlement, isPubliclyVisible }
}

// ---------------------------------------------------------------------------
// Domains
// ---------------------------------------------------------------------------

export interface UpsertDomainInput {
  hostname: string
  kind?: "subdomain" | "custom"
  ownership?: "client_owned" | "managed" | "transferable"
  isPrimary?: boolean
}

/**
 * Register or update a domain for a site (starts `pending`). Rejects invalid or
 * already-claimed hostnames — the DB `@unique` on `hostname` is the hard guard
 * against two workspaces claiming the same domain.
 */
export async function upsertDomain(
  workspaceId: string,
  siteId: string,
  input: UpsertDomainInput,
): Promise<PresenceDomainRow> {
  await assertOwnership(workspaceId, siteId)
  const hostname = normalizeHostname(input.hostname)
  if (!isValidHostname(hostname)) {
    throw new Error(`Invalid hostname: ${input.hostname}`)
  }
  const existing = await db.presenceDomain.findUnique({ where: { hostname } })
  if (existing && existing.workspaceId !== workspaceId) {
    throw new Error(`Hostname already claimed by another workspace: ${hostname}`)
  }
  if (existing) {
    return db.presenceDomain.update({
      where: { hostname },
      data: {
        siteId,
        kind: input.kind ?? existing.kind,
        ownership: input.ownership ?? existing.ownership,
        isPrimary: input.isPrimary ?? existing.isPrimary,
      },
    })
  }
  return db.presenceDomain.create({
    data: {
      workspaceId,
      siteId,
      hostname,
      kind: input.kind ?? "custom",
      ownership: input.ownership ?? "client_owned",
      isPrimary: input.isPrimary ?? false,
      verification: "pending",
    },
  })
}

/** Mark a domain verified (verification transport is out of scope for now). */
export async function markDomainVerified(
  workspaceId: string,
  domainId: string,
): Promise<PresenceDomainRow> {
  const domain = await db.presenceDomain.findUnique({ where: { id: domainId } })
  if (!domain || domain.workspaceId !== workspaceId) {
    throw new Error("Domain not found for workspace")
  }
  return db.presenceDomain.update({
    where: { id: domainId },
    data: { verification: "verified", verifiedAt: new Date() },
  })
}

// ---------------------------------------------------------------------------
// Media
// ---------------------------------------------------------------------------

export interface RecordMediaInput {
  siteId?: string | null
  kind?: string
  purpose?: string
  storageKey: string
  url: string
  mimeType?: string | null
  width?: number | null
  height?: number | null
  sizeBytes?: number | null
  isRealWorkSample?: boolean
  preserveIntegrity?: boolean
  reviewStatus?: string
  freyaAssessedBy?: string | null
  checksum?: string | null
  /** For variants — the source original this was derived from. */
  sourceMediaId?: string | null
}

/** Record metadata for an asset already uploaded to external storage. */
export async function recordMedia(
  workspaceId: string,
  input: RecordMediaInput,
): Promise<PresenceMediaRow> {
  if (input.siteId) await assertOwnership(workspaceId, input.siteId)
  return db.presenceMedia.create({
    data: {
      workspaceId,
      siteId: input.siteId ?? null,
      kind: input.kind ?? "photo",
      purpose: input.purpose ?? "gallery",
      storageKey: input.storageKey,
      url: input.url,
      mimeType: input.mimeType ?? null,
      width: input.width ?? null,
      height: input.height ?? null,
      sizeBytes: input.sizeBytes ?? null,
      isRealWorkSample: input.isRealWorkSample ?? false,
      preserveIntegrity: input.preserveIntegrity ?? (input.isRealWorkSample ?? false),
      reviewStatus: input.reviewStatus ?? "pending",
      freyaAssessedBy: input.freyaAssessedBy ?? null,
      checksum: input.checksum ?? null,
      sourceMediaId: input.sourceMediaId ?? null,
    },
  })
}

/** List a workspace's media (optionally scoped to a site). Tenant-isolated. */
export async function listMedia(
  workspaceId: string,
  siteId?: string,
): Promise<PresenceMediaRow[]> {
  return db.presenceMedia.findMany({
    where: { workspaceId, ...(siteId ? { siteId } : {}) },
    orderBy: { createdAt: "asc" },
  })
}

// ---------------------------------------------------------------------------
// Isolation helper
// ---------------------------------------------------------------------------

/** Throw unless the site exists AND belongs to the workspace. */
async function assertOwnership(workspaceId: string, siteId: string): Promise<PresenceSiteRow> {
  const site = await db.presenceSite.findUnique({ where: { id: siteId } })
  if (!site || site.workspaceId !== workspaceId) {
    throw new Error("Presence site not found for workspace")
  }
  return site
}

function mapSiteRow(row: PresenceSiteRow): PresenceSite {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    slug: row.slug,
    status: row.status as PresenceSite["status"],
    ownershipModel: row.ownershipModel as PresenceOwnershipModel,
    templateId: row.templateId,
    templateVersion: row.templateVersion,
    themeKey: row.themeKey,
    selectedProposalId: row.selectedProposalId,
    sections: [],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
