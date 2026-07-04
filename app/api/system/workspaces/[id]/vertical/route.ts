import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requirePlatformAdmin } from "@/lib/auth/platform-auth"
import { logPlatformAudit } from "@core/system/audit"
import { db } from "@/lib/db"
import { setWorkspaceVertical } from "@core/workspace"
import { getVerticalByKey } from "@core/verticals"

type Params = { params: Promise<{ id: string }> }

/**
 * Change a workspace's vertical (verticalKey) from the platform console.
 *
 * Strict scope + reuse: this endpoint validates the target vertical exists and
 * is active, then delegates to `setWorkspaceVertical` (core/workspace.ts), which
 * writes both `vertical` and `verticalKey` and re-merges the vertical's
 * defaultConfig UNDER existing workspace overrides (non-destructive). It does
 * NOT edit modules directly — per-workspace module toggles live in
 * `/administracion` (`PATCH /api/workspaces/[id]/modules`).
 *
 * Auth: `requirePlatformAdmin()` (>= ADMIN), mirroring the plan/status editors.
 *
 * No-op behaviour: if the new vertical equals the current one, we don't write
 * and we don't emit an audit event — the trail records real transitions only.
 *
 * Audit: on success, logs `workspace.vertical_change` with the workspace
 * name/slug and previous/next verticalKey.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { session } = await requirePlatformAdmin()
    const { id } = await params

    const body = await request.json().catch(() => null)
    const candidate = (body as { verticalKey?: unknown } | null)?.verticalKey
    if (typeof candidate !== "string" || !candidate.trim()) {
      return errorResponse("VALIDATION_ERROR", "verticalKey inválido.")
    }

    const vertical = await getVerticalByKey(candidate)
    if (!vertical || !vertical.isActive) {
      return errorResponse(
        "VALIDATION_ERROR",
        `Vertical desconocida o inactiva: ${candidate}`,
      )
    }

    const previous = await db.workspace.findUnique({
      where: { id },
      select: { id: true, nombre: true, slug: true, verticalKey: true },
    })
    if (!previous) {
      return errorResponse("NOT_FOUND", "Workspace no encontrado", 404)
    }

    if (previous.verticalKey === candidate) {
      return successResponse({ id: previous.id, verticalKey: previous.verticalKey, unchanged: true })
    }

    const updated = await setWorkspaceVertical(id, candidate)
    if (!updated) {
      return errorResponse("VALIDATION_ERROR", "No se pudo cambiar la vertical del workspace.")
    }

    await logPlatformAudit({
      actorId: session.userId,
      action: "workspace.vertical_change",
      targetType: "workspace",
      targetId: id,
      metadata: {
        workspaceName: previous.nombre,
        workspaceSlug: previous.slug,
        previousVertical: previous.verticalKey,
        nextVertical: candidate,
      },
      request,
    })

    return successResponse({ id, verticalKey: candidate, unchanged: false })
  } catch (error) {
    return handleError(error, "PlatformWorkspaceVertical")
  }
}
