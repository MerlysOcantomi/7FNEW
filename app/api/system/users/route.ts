import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireAnyPlatformRole, requirePlatformAdmin } from "@/lib/auth/platform-auth"
import { listUsersForSystem } from "@core/system/users"
import { logPlatformAudit } from "@core/system/audit"
import { db } from "@/lib/db"

/**
 * Legacy `User.role` values supported by this PR. Kept here as a private
 * constant — the platform deliberately does NOT expose this surface in the
 * `/system/users` listing because it conflates with platform-level RBAC
 * (see `core/system/users.ts` JSDoc). We accept these values in PATCH so the
 * existing workspace `RoleGate` keeps working until we finish the legacy
 * cleanup.
 */
const LEGACY_USER_ROLES = ["admin", "editor", "viewer"] as const
type LegacyUserRole = (typeof LEGACY_USER_ROLES)[number]
function isLegacyUserRole(v: unknown): v is LegacyUserRole {
  return typeof v === "string" && (LEGACY_USER_ROLES as readonly string[]).includes(v)
}

/**
 * Read-only listing of every user in the platform, for the SevenF System
 * Admin dashboard.
 *
 * Authorisation:
 *   - `requireAnyPlatformRole()`. Reading the user directory does not require
 *     ADMIN; the data here is non-sensitive identity + workspace memberships.
 *
 * Response is intentionally narrow (`SystemUserSummary`):
 *   - id, nombre, email, avatar, createdAt
 *   - platformRole (if any)
 *   - workspaceMemberships[] = { workspaceId, workspaceName, workspaceSlug, role }
 *
 * Explicitly NOT returned:
 *   - User.role legacy (admin/editor/viewer)
 *   - User.lastLogin (privacy)
 *   - User.isPrivate / visibleProjects (per-tenant visibility flags)
 *   - PlatformAdmin row metadata (createdBy / createdAt)
 *   - Any tenant content (messages, conversations, drafts).
 *
 * NEVER reads or writes `wf_workspace`. Workspace-less by design.
 */
export async function GET() {
  try {
    await requireAnyPlatformRole()
    const users = await listUsersForSystem()
    return successResponse({ users, total: users.length })
  } catch (error) {
    return handleError(error, "PlatformUsers")
  }
}

/**
 * Update a user's legacy `User.role` (admin/editor/viewer).
 *
 * MIGRATED FROM `/api/admin/users` (PATCH). The auth gate moved from the
 * ambiguous "workspace admin AND session.role === 'admin'" combo to a strict
 * `requirePlatformAdmin()` — only PlatformAdmins (ADMIN level or higher)
 * may change global user roles.
 *
 * Body: `{ userId: string, role: "admin" | "editor" | "viewer" }`.
 *
 * Side effect: keeps the matching `AllowedEmail.role` in sync (same behaviour
 * as the legacy endpoint) so allowlist + user are not desynchronised after
 * a role change.
 */
export async function PATCH(request: NextRequest) {
  try {
    const { session } = await requirePlatformAdmin()

    const body = await request.json()
    const { userId, role } = body as { userId?: string; role?: string }

    if (!userId) {
      return errorResponse("VALIDATION_ERROR", "userId es obligatorio")
    }
    if (!isLegacyUserRole(role)) {
      return errorResponse(
        "VALIDATION_ERROR",
        `Role debe ser uno de: ${LEGACY_USER_ROLES.join(", ")}`,
      )
    }

    /**
     * Capture previous role BEFORE the write so the audit row can record the
     * actual transition. No-op if user is missing — `update` below will throw
     * P2025 and the catch logs the error normally.
     */
    const previous = await db.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    })

    const user = await db.user.update({
      where: { id: userId },
      data: { role },
    })

    let allowedEmailSynced = false
    const allowedEmail = await db.allowedEmail.findUnique({
      where: { email: user.email },
    })
    if (allowedEmail) {
      await db.allowedEmail.update({
        where: { id: allowedEmail.id },
        data: { role },
      })
      allowedEmailSynced = true
    }

    await logPlatformAudit({
      actorId: session.userId,
      action: "user.update",
      targetType: "user",
      targetId: user.id,
      metadata: {
        email: user.email,
        changedFields: ["role"],
        previousRole: previous?.role ?? null,
        nextRole: user.role,
        allowedEmailSynced,
      },
      request,
    })

    return successResponse(user)
  } catch (error) {
    return handleError(error, "PlatformUser")
  }
}

/**
 * Delete a user globally and revoke their access.
 *
 * MIGRATED FROM `/api/admin/users` (DELETE). Same migration pattern as PATCH:
 * gate is now `requirePlatformAdmin()` (no more ambiguous workspace+role
 * combo), and `User.role` legacy is no longer consulted for authorisation.
 *
 * Self-deletion guard: a PlatformAdmin cannot delete the user record bound
 * to their own session email — would lock themselves out and leave the
 * platform without a fallback admin in the worst case.
 *
 * Cascade: the matching `AllowedEmail` rows are removed in the same call so
 * the user cannot silently re-create themselves on the next Google login.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { session } = await requirePlatformAdmin()

    const body = await request.json()
    const { userId } = body as { userId?: string }
    if (!userId) {
      return errorResponse("VALIDATION_ERROR", "userId es obligatorio")
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return errorResponse("NOT_FOUND", "Usuario no encontrado", 404)
    }
    if (user.email === session.email) {
      return errorResponse("FORBIDDEN", "No puedes eliminar tu propio acceso", 403)
    }

    const allowedEmailDelete = await db.allowedEmail.deleteMany({
      where: { email: user.email },
    })
    await db.user.delete({ where: { id: userId } })

    await logPlatformAudit({
      actorId: session.userId,
      action: "user.delete",
      targetType: "user",
      targetId: user.id,
      metadata: {
        email: user.email,
        removedAllowedEmail: allowedEmailDelete.count > 0,
      },
      request,
    })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "PlatformUser")
  }
}
