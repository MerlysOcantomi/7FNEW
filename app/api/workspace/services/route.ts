import { NextRequest, NextResponse } from "next/server"
import { requireReadAccess, requireAdminAccess } from "@/lib/auth/workspace-auth"
import { db } from "@core/db"
import { getVerticalByKey, parseJsonConfig, mergeConfigs } from "@core/verticals"
import { updateWorkspaceConfig } from "@core/workspace"
import type { WorkspaceBusinessProfile } from "@core/verticals"
import {
  resolveServiceCatalog,
  normalizeServiceCatalog,
  activeServiceNames,
} from "@core/services/catalog"

/**
 * GET — the resolved service catalog for the active workspace.
 *
 * Resolution merges the vertical DEFAULTS (the seed a vertical like Beauty ships)
 * with the workspace OVERRIDE, so a fresh Beauty workspace already sees its seed
 * catalog and any workspace that saved sees its own. `serviceCatalog` is the
 * canonical source for the /services page.
 */
export async function GET() {
  try {
    const { workspaceId } = await requireReadAccess()

    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { verticalKey: true, config: true },
    })
    if (!ws) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const vertical = await getVerticalByKey(ws.verticalKey)
    const defaults = parseJsonConfig(vertical?.defaultConfig)
    const overrides = parseJsonConfig(ws.config)
    const resolved = mergeConfigs(defaults, overrides)

    return NextResponse.json({
      serviceCatalog: resolveServiceCatalog(resolved.serviceCatalog),
    })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}

/**
 * PUT — persist the workspace's own service catalog (admin only).
 *
 * The incoming array is normalized (never trusts the client shape) and stored in
 * `Workspace.config.serviceCatalog`, which becomes the workspace's override.
 *
 * One-way bridge: `businessProfile.services` is synced with the names of the
 * ACTIVE services so Fanny and the other agents keep seeing truthful services
 * without a second manual edit. `businessProfile` is otherwise preserved intact
 * (name, description, tone, rules… are never touched here).
 */
export async function PUT(request: NextRequest) {
  try {
    const { workspaceId } = await requireAdminAccess()

    const body = await request.json()
    const catalog = normalizeServiceCatalog((body as { serviceCatalog?: unknown }).serviceCatalog)

    const ws = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { config: true },
    })
    if (!ws) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 })
    }

    const current = parseJsonConfig(ws.config)
    const existingProfile: WorkspaceBusinessProfile = current.businessProfile ?? {}

    // One-way bridge → keep the agent context truthful. Inactive services are
    // excluded; `businessProfile.services` is never dropped, only re-derived.
    const mergedProfile: WorkspaceBusinessProfile = {
      ...existingProfile,
      services: activeServiceNames(catalog),
    }

    await updateWorkspaceConfig(workspaceId, {
      ...current,
      serviceCatalog: catalog,
      businessProfile: mergedProfile,
    })

    return NextResponse.json({ ok: true, serviceCatalog: catalog })
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
}
