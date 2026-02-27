import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireAdminAccess } from "@/lib/auth/workspace-auth"
import { checkMembership, getWorkspaceWithResolvedConfig, updateWorkspaceConfig } from "@/lib/workspace"
import { parseJsonConfig } from "@/lib/verticals"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { session } = await requireAdminAccess()
    const { id } = await params

    const member = await checkMembership(session.userId, id)
    if (!member) return errorResponse("FORBIDDEN", "No tienes acceso a este workspace", 403)

    const body = await request.json()
    const { moduleKey, enabled } = body as { moduleKey?: string; enabled?: boolean }

    if (!moduleKey || typeof moduleKey !== "string") {
      return errorResponse("VALIDATION_ERROR", "moduleKey es requerido")
    }
    if (typeof enabled !== "boolean") {
      return errorResponse("VALIDATION_ERROR", "enabled debe ser boolean")
    }

    await updateWorkspaceConfig(id, {
      modules: { [moduleKey]: enabled },
      ui: { labels: {} },
    })

    const ws = await getWorkspaceWithResolvedConfig(id)
    if (!ws) return errorResponse("NOT_FOUND", "Workspace no encontrado", 404)

    return successResponse({
      moduleKey,
      enabled,
      resolvedConfig: ws.resolvedConfig,
    })
  } catch (error) {
    return handleError(error, "Workspace")
  }
}
