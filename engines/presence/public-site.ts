/**
 * Sevenef Presence — public site composition (PRESENCE-03).
 *
 * The single, testable entry the public routes call. It resolves a site (by
 * slug or verified hostname), enforces EFFECTIVE visibility (published + public
 * + entitled), loads content + approved media, builds the render plan, and
 * computes SEO metadata (title/description/canonical/robots). The route file is
 * a thin wrapper over this — so all the branching is unit/integration testable
 * without React.
 *
 * Failure reasons are coarse on purpose: public errors NEVER leak workspace
 * internals (no ids, no reason strings beyond a neutral status).
 */

import { db } from "@core/db"
import {
  resolvePublicSite,
  findSiteByHostname,
  getPresenceEntitlement,
} from "./repository"
import { isPresencePubliclyVisible } from "./resolve"
import { loadPresenceContent, loadSiteMedia } from "./content-loader"
import {
  buildRenderPlan,
  PresenceTemplateNotFoundError,
  type PresenceRenderPlan,
} from "./render-plan"

export interface PresenceSeoMeta {
  title: string
  description: string
  canonical: string | null
  robots: "index,follow" | "noindex,nofollow"
  ogTitle: string
  ogDescription: string
}

export type PublicSiteResult =
  | { ok: true; plan: PresenceRenderPlan; seo: PresenceSeoMeta }
  | { ok: false; reason: "not_found" | "offline" | "invalid_template" }

export interface PublicSiteContext {
  /** Canonical app base URL (e.g. https://app.sevenef.com) for slug canonicals. */
  appBaseUrl?: string | null
  /** When resolved via a hostname, the host the request came through. */
  requestHost?: string | null
}

function appBase(ctx: PublicSiteContext): string {
  return (ctx.appBaseUrl ?? "").replace(/\/$/, "")
}

/** Resolve the site's canonical URL: verified primary domain wins over slug. */
async function resolveCanonical(
  siteId: string,
  slug: string,
  ctx: PublicSiteContext,
): Promise<string | null> {
  const primary = await db.presenceDomain.findFirst({
    where: { siteId, isPrimary: true, verification: "verified" },
    select: { hostname: true },
  })
  if (primary) return `https://${primary.hostname}/`
  const base = appBase(ctx)
  return base ? `${base}/sites/${slug}` : null
}

async function buildResult(
  site: { id: string; workspaceId: string; slug: string; templateId: string; templateVersion: string; themeKey: string; visualConfig: string | null },
  ctx: PublicSiteContext,
): Promise<PublicSiteResult> {
  const content = await loadPresenceContent(site.workspaceId)
  if (!content) return { ok: false, reason: "not_found" }

  const media = await loadSiteMedia(site.workspaceId, site.id)

  let plan: PresenceRenderPlan
  try {
    plan = buildRenderPlan({ site, content, media })
  } catch (e) {
    if (e instanceof PresenceTemplateNotFoundError) {
      return { ok: false, reason: "invalid_template" }
    }
    throw e
  }

  const canonical = await resolveCanonical(site.id, site.slug, ctx)
  const seo: PresenceSeoMeta = {
    title: plan.siteName,
    description: plan.tagline ?? plan.siteName,
    canonical,
    robots: "index,follow",
    ogTitle: plan.siteName,
    ogDescription: plan.tagline ?? plan.siteName,
  }
  return { ok: true, plan, seo }
}

/** Public resolution by Sevenef-managed slug. */
export async function loadPublicSiteBySlug(
  slug: string,
  ctx: PublicSiteContext = {},
): Promise<PublicSiteResult> {
  const resolved = await resolvePublicSite(slug)
  if (!resolved) return { ok: false, reason: "not_found" }
  if (!resolved.isPubliclyVisible) return { ok: false, reason: "offline" }
  return buildResult(resolved.site, ctx)
}

/** Public resolution by a VERIFIED custom hostname (pending/unknown → 404). */
export async function loadPublicSiteByHostname(
  hostname: string,
  ctx: PublicSiteContext = {},
): Promise<PublicSiteResult> {
  const match = await findSiteByHostname(hostname)
  if (!match) return { ok: false, reason: "not_found" }

  const entitlement = await getPresenceEntitlement(match.site.workspaceId)
  const latest = await db.presencePublication.findFirst({
    where: { siteId: match.site.id },
    orderBy: { createdAt: "desc" },
  })
  const publication = latest
    ? {
        id: latest.id,
        siteId: latest.siteId,
        workspaceId: latest.workspaceId,
        state: latest.state as "public" | "offline",
        templateId: latest.templateId,
        templateVersion: latest.templateVersion,
        themeKey: latest.themeKey,
        reason: latest.reason,
        publishedAt: latest.publishedAt ? latest.publishedAt.toISOString() : null,
        offlineAt: latest.offlineAt ? latest.offlineAt.toISOString() : null,
      }
    : null

  const domainSite = {
    ...match.site,
    status: match.site.status as never,
    ownershipModel: match.site.ownershipModel as never,
    sections: [],
    createdAt: match.site.createdAt.toISOString(),
    updatedAt: match.site.updatedAt.toISOString(),
  }
  if (!isPresencePubliclyVisible(domainSite, publication, entitlement)) {
    return { ok: false, reason: "offline" }
  }
  return buildResult(match.site, { ...ctx, requestHost: hostname })
}
