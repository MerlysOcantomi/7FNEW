import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireViewerInWorkspace, requireAdminInWorkspace } from "@/lib/auth/workspace-auth"
import { getWorkspaceWithResolvedConfig, updateWorkspaceConfig } from "@/lib/workspace"
import { parseJsonConfig, type VerticalConfig } from "@/lib/verticals"
import { sanitizeTenantConfig } from "@core/auth/workspace-governance"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const { wsRole } = await requireViewerInWorkspace(id)

    const ws = await getWorkspaceWithResolvedConfig(id)
    if (!ws) return errorResponse("NOT_FOUND", "Workspace no encontrado", 404)

    return successResponse({
      id: ws.id,
      nombre: ws.nombre,
      slug: ws.slug,
      verticalKey: ws.verticalKey,
      plan: ws.plan,
      locale: ws.locale,
      config: parseJsonConfig(ws.config),
      resolvedConfig: ws.resolvedConfig,
      role: wsRole,
    })
  } catch (error) {
    return handleError(error, "Workspace")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    await requireAdminInWorkspace(id)

    const body = await request.json()
    const { nombre, slug, verticalKey, config } = body as {
      nombre?: string
      slug?: string
      verticalKey?: string
      config?: Partial<VerticalConfig>
    }

    // Governance: a workspace admin cannot change the vertical — that is a
    // platform-admin control via `/system` (setWorkspaceVertical there).
    if (verticalKey !== undefined) {
      return errorResponse(
        "FORBIDDEN",
        "La vertical del workspace se cambia solo desde la administración de 7F (/system).",
        403,
      )
    }

    const updateData: Record<string, unknown> = {}

    if (nombre) updateData.nombre = nombre
    if (slug) {
      const slugClean = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-")
      const existing = await db.workspace.findFirst({
        where: { slug: slugClean, id: { not: id } },
      })
      if (existing) return errorResponse("CONFLICT", "Ya existe un workspace con ese slug", 409)
      updateData.slug = slugClean
    }

    if (config) {
      // Governance: strip privileged keys (e.g. `modules`) — module enablement
      // is platform-admin / plan-gated, never set via this tenant endpoint.
      const { config: safeConfig } = sanitizeTenantConfig(config)
      if (Object.keys(safeConfig).length > 0) {
        await updateWorkspaceConfig(id, safeConfig)
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db.workspace.update({ where: { id }, data: updateData })
    }

    const ws = await getWorkspaceWithResolvedConfig(id)
    if (!ws) return errorResponse("NOT_FOUND", "Workspace no encontrado", 404)

    return successResponse({
      id: ws.id,
      nombre: ws.nombre,
      slug: ws.slug,
      verticalKey: ws.verticalKey,
      plan: ws.plan,
      locale: ws.locale,
      config: parseJsonConfig(ws.config),
      resolvedConfig: ws.resolvedConfig,
    })
  } catch (error) {
    return handleError(error, "Workspace")
  }
}
