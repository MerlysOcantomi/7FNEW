import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requirePlatformAdmin } from "@/lib/auth/platform-auth"
import { getWorkspaceWithResolvedConfig, updateWorkspaceConfig } from "@/lib/workspace"
import { parseJsonConfig } from "@/lib/verticals"

type Params = { params: Promise<{ id: string }> }

/**
 * Enable/disable a workspace module.
 *
 * Governance: module enablement is a PLATFORM-ADMIN control (plan/billing-gated
 * structural config), never a tenant self-service switch. A workspace admin
 * consumes what their plan enables; they cannot flip modules here. Guarded by
 * `requirePlatformAdmin()`.
 */
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    await requirePlatformAdmin()

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
