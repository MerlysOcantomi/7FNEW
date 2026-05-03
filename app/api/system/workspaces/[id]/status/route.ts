import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requirePlatformAdmin } from "@/lib/auth/platform-auth"
import {
  isWorkspaceStatus,
  resolveWorkspaceStatus,
} from "@core/system/workspace-status"
import { logPlatformAudit } from "@core/system/audit"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

/**
 * Change a workspace's lifecycle status (active | trial | suspended | archived).
 *
 * Strict scope: this endpoint touches ONLY `Workspace.status`. It does
 * NOT update `Workspace.config`, plan, modules, billing state, or
 * anything else. The status is a free-form column in the schema, so the
 * `isWorkspaceStatus` guard is what keeps the catalogue consistent —
 * only the four canonical status keys are accepted.
 *
 * NO ENFORCEMENT: nothing in the runtime reads this column to gate
 * access. `suspended` and `archived` are observational metadata only —
 * login, workspace access, channel sync and AI usage all continue to
 * work for the tenant after a status change. A future PR will read this
 * column to actually halt activity for suspended/archived workspaces;
 * until then the column is purely administrative.
 *
 * Auth: `requirePlatformAdmin()` (>= ADMIN). SUPPORT/BILLING cannot mutate.
 *
 * No-op behaviour: if the new status equals the current status, we do
 * NOT write to the DB and we do NOT emit an audit event. This keeps the
 * audit trail meaningful — `workspace.status_change` should only show
 * actual transitions.
 *
 * Audit: on success, logs `workspace.status_change` with sanitised
 * metadata (workspace name/slug + previous/next status). The audit
 * helper sanitises keys, but we already only pass safe values; nothing
 * here is sensitive.
 *
 * Mirrors the structure of `app/api/system/workspaces/[id]/plan/route.ts`
 * — same gate, same audit shape, same no-op semantics. Keep them
 * consistent: a future enforcement layer will likely treat them
 * symmetrically.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { session } = await requirePlatformAdmin()
    const { id } = await params

    const body = await request.json().catch(() => null)
    const candidate = (body as { status?: unknown } | null)?.status
    if (!isWorkspaceStatus(candidate)) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Status inválido. Use: active | trial | suspended | archived",
      )
    }

    /**
     * Read previous state BEFORE the update so the audit row records the
     * actual transition. Using a separate `findUnique` (instead of relying
     * on `update`'s return value alone) lets us also distinguish 404 from
     * "nothing changed" cleanly.
     */
    const previous = await db.workspace.findUnique({
      where: { id },
      select: { id: true, nombre: true, slug: true, status: true },
    })
    if (!previous) {
      return errorResponse("NOT_FOUND", "Workspace no encontrado", 404)
    }

    /**
     * No-op fast path. We deliberately don't audit a non-change because
     * the audit log is meant to capture state transitions, not user
     * intent. Resolving the (unchanged) status here keeps the response
     * shape identical to the success path so the client doesn't need a
     * separate branch.
     */
    if (previous.status === candidate) {
      const resolved = resolveWorkspaceStatus({ status: previous.status })
      return successResponse({
        id: previous.id,
        status: previous.status,
        statusKey: resolved.statusKey,
        statusLabel: resolved.label,
        unchanged: true,
      })
    }

    const updated = await db.workspace.update({
      where: { id },
      data: { status: candidate },
      select: { id: true, nombre: true, slug: true, status: true },
    })

    await logPlatformAudit({
      actorId: session.userId,
      action: "workspace.status_change",
      targetType: "workspace",
      targetId: updated.id,
      metadata: {
        workspaceName: updated.nombre,
        workspaceSlug: updated.slug,
        previousStatus: previous.status,
        nextStatus: updated.status,
      },
      request,
    })

    const resolved = resolveWorkspaceStatus({ status: updated.status })
    return successResponse({
      id: updated.id,
      status: updated.status,
      statusKey: resolved.statusKey,
      statusLabel: resolved.label,
      unchanged: false,
    })
  } catch (error) {
    return handleError(error, "PlatformWorkspaceStatus")
  }
}
