/**
 * Sevenef Presence — content loader (PRESENCE-03).
 *
 * The DB-backed adapter that reads a workspace's PUBLIC business content from
 * its single source of truth — the Business Profile (`Workspace.config`),
 * service catalog and channels — and projects it into the read-only
 * `PresenceContentSource` the renderer consumes. Presence stores NO copy of this
 * content (no business name/services/hours/phone columns).
 *
 * Also loads a site's APPROVED media (Freya verdict "use") for the renderer.
 */

import { db } from "@core/db"
import { getWorkspaceWithResolvedConfig } from "@core/workspace"
import { resolveServiceCatalog } from "@core/services/catalog"
import {
  buildPresenceContentSource,
  type PresenceContentSource,
  type PresenceChannelSource,
} from "./content-source"
import type { RenderMedia } from "./render-plan"

/** Derive the public contact channels from ChannelConnection rows. */
async function loadChannels(workspaceId: string): Promise<PresenceChannelSource> {
  const rows = await db.channelConnection.findMany({
    where: { workspaceId },
    select: { channelType: true, externalAccountId: true, status: true },
  })
  // WhatsApp: the routable number lives in `externalAccountId` (E.164).
  const whatsapp =
    rows.find(
      (r) => r.channelType === "whatsapp" && r.status !== "disabled" && !!r.externalAccountId,
    )?.externalAccountId ?? null
  return { whatsapp, phone: null, social: {} }
}

/**
 * Load the read-only content projection for a workspace. Returns null only when
 * the workspace does not exist. Missing profile fields degrade to empty slots.
 */
export async function loadPresenceContent(
  workspaceId: string,
): Promise<PresenceContentSource | null> {
  const ws = await getWorkspaceWithResolvedConfig(workspaceId)
  if (!ws) return null

  const profile = ws.resolvedConfig.businessProfile ?? {}
  const serviceCatalog = resolveServiceCatalog(ws.resolvedConfig.serviceCatalog)
  const channels = await loadChannels(workspaceId)

  return buildPresenceContentSource({
    workspaceId,
    businessName: ws.nombre,
    profile,
    serviceCatalog,
    channels,
  })
}

/**
 * Load a site's media for the renderer, workspace-scoped. Approval filtering is
 * applied in the render plan (`isApprovedMedia`), so this returns all of the
 * site's media rows; the plan decides what is publicly shown.
 */
export async function loadSiteMedia(
  workspaceId: string,
  siteId: string,
): Promise<RenderMedia[]> {
  const rows = await db.presenceMedia.findMany({
    where: { workspaceId, siteId },
    orderBy: { createdAt: "asc" },
  })
  return rows.map((m) => ({
    id: m.id,
    kind: m.kind,
    purpose: m.purpose,
    url: m.url,
    width: m.width,
    height: m.height,
    reviewStatus: m.reviewStatus,
    isRealWorkSample: m.isRealWorkSample,
    preserveIntegrity: m.preserveIntegrity,
    sourceMediaId: m.sourceMediaId,
  }))
}
