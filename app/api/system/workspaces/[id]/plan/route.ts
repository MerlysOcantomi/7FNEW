import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requirePlatformAdmin } from "@/lib/auth/platform-auth"
import { isTenantPlan, resolveWorkspacePlan } from "@core/system/plans"
import { logPlatformAudit } from "@core/system/audit"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

/**
 * Change a workspace's plan.
 *
 * Strict scope: this endpoint touches ONLY `Workspace.plan`. It does NOT
 * update `Workspace.config`, modules, seats, billing state, or anything
 * else. The plan string is a free-form column in the schema, so the
 * `isTenantPlan` guard is what keeps the catalogue consistent — only the
 * four canonical plan keys are accepted.
 *
 * Auth: `requirePlatformAdmin()` (>= ADMIN). SUPPORT/BILLING cannot mutate.
 *
 * No-op behaviour: if the new plan equals the current plan, we do NOT write
 * to the DB and we do NOT emit an audit event. This keeps the audit trail
 * meaningful — `workspace.plan_change` should only show actual transitions.
 *
 * Audit: on success, logs `workspace.plan_change` with sanitised metadata
 * (workspace name/slug + previous/next plan). The audit helper sanitises
 * keys, but we already only pass safe values; nothing here is sensitive.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { session } = await requirePlatformAdmin()
    const { id } = await params

    const body = await request.json().catch(() => null)
    const candidate = (body as { plan?: unknown } | null)?.plan
    if (!isTenantPlan(candidate)) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Plan inválido. Use: free | starter | business | enterprise",
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
      select: { id: true, nombre: true, slug: true, plan: true },
    })
    if (!previous) {
      return errorResponse("NOT_FOUND", "Workspace no encontrado", 404)
    }

    /**
     * No-op fast path. We deliberately don't audit a non-change because the
     * audit log is meant to capture state transitions, not user intent.
     */
    if (previous.plan === candidate) {
      const resolved = resolveWorkspacePlan({ plan: previous.plan })
      return successResponse({
        id: previous.id,
        plan: previous.plan,
        planKey: resolved.planKey,
        planLabel: resolved.label,
        unchanged: true,
      })
    }

    const updated = await db.workspace.update({
      where: { id },
      data: { plan: candidate },
      select: { id: true, nombre: true, slug: true, plan: true },
    })

    await logPlatformAudit({
      actorId: session.userId,
      action: "workspace.plan_change",
      targetType: "workspace",
      targetId: updated.id,
      metadata: {
        workspaceName: updated.nombre,
        workspaceSlug: updated.slug,
        previousPlan: previous.plan,
        nextPlan: updated.plan,
      },
      request,
    })

    const resolved = resolveWorkspacePlan({ plan: updated.plan })
    return successResponse({
      id: updated.id,
      plan: updated.plan,
      planKey: resolved.planKey,
      planLabel: resolved.label,
      unchanged: false,
    })
  } catch (error) {
    return handleError(error, "PlatformWorkspacePlan")
  }
}
