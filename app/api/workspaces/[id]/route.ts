import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireReadAccess, requireAdminAccess } from "@/lib/auth/workspace-auth"
import { checkMembership, getWorkspaceWithResolvedConfig, setWorkspaceVertical, updateWorkspaceConfig } from "@/lib/workspace"
import { getVerticalByKey, parseJsonConfig, type VerticalConfig } from "@/lib/verticals"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { session } = await requireReadAccess()
    const { id } = await params

    const member = await checkMembership(session.userId, id)
    if (!member) return errorResponse("FORBIDDEN", "No tienes acceso a este workspace", 403)

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
      role: member.role,
    })
  } catch (error) {
    return handleError(error, "Workspace")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { session } = await requireAdminAccess()
    const { id } = await params

    const member = await checkMembership(session.userId, id)
    if (!member) return errorResponse("FORBIDDEN", "No tienes acceso a este workspace", 403)

    const body = await request.json()
    const { nombre, slug, verticalKey, config } = body as {
      nombre?: string
      slug?: string
      verticalKey?: string
      config?: Partial<VerticalConfig>
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

    if (verticalKey) {
      const vertical = await getVerticalByKey(verticalKey)
      if (!vertical || !vertical.isActive) {
        return errorResponse("VALIDATION_ERROR", `Vertical "${verticalKey}" no existe o no está activa`)
      }
      const result = await setWorkspaceVertical(id, verticalKey)
      if (!result) return errorResponse("NOT_FOUND", "Workspace no encontrado", 404)
    }

    if (config) {
      await updateWorkspaceConfig(id, config)
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
