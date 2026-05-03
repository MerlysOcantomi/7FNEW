import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireAnyPlatformRole } from "@/lib/auth/platform-auth"
import { getWorkspaceSystemDetail } from "@core/system/workspaces"

/**
 * Read-only detail endpoint for one workspace from the SevenF System Admin area.
 *
 * Authorisation:
 *   - `requireAnyPlatformRole()` — same level as the listing. Detail data
 *     here is non-sensitive metadata + member emails + channel labels.
 *
 * Path-scoped, NOT workspace-scoped:
 *   - We do NOT call `requireRoleInWorkspace(id)`. Platform admins do not
 *     need to be members of the tenant they inspect — that's the entire
 *     point of the control plane.
 *   - We do NOT touch `wf_workspace`. Visiting this endpoint must NEVER
 *     change the active customer workspace context.
 *
 * 404 vs 403 is intentional: a missing id returns 404 ("workspace not found")
 * regardless of caller role; only the platform-role check distinguishes
 * authorised from unauthorised callers.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAnyPlatformRole()
    const { id } = await context.params
    if (!id) {
      return errorResponse("VALIDATION_ERROR", "workspace id es requerido")
    }
    const detail = await getWorkspaceSystemDetail(id)
    if (!detail) {
      return errorResponse("NOT_FOUND", "Workspace no encontrado", 404)
    }
    return successResponse(detail)
  } catch (error) {
    return handleError(error, "PlatformWorkspace")
  }
}
