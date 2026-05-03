import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requirePlatformAdmin } from "@/lib/auth/platform-auth"
import { logPlatformAudit } from "@core/system/audit"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

/**
 * Mutation endpoints for a single AllowedEmail row.
 *
 * Migrated from `/api/admin/allowed-emails/[id]` (legacy combined gate). All
 * mutations require `requirePlatformAdmin()` — the role on the allowlist
 * affects who can sign in across the entire SaaS, so it's a platform-level
 * decision, never a workspace one.
 */

const LEGACY_USER_ROLES = ["admin", "editor", "viewer"] as const
type LegacyUserRole = (typeof LEGACY_USER_ROLES)[number]
function isLegacyUserRole(v: unknown): v is LegacyUserRole {
  return typeof v === "string" && (LEGACY_USER_ROLES as readonly string[]).includes(v)
}

/**
 * Change the role on an allowlist row. Side-effect: keep the matching
 * `User.role` in sync (same behaviour as the legacy endpoint) so the next
 * login picks up the change.
 */
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { session } = await requirePlatformAdmin()

    const { id } = await params
    const body = await request.json()
    const { role } = body as { role?: string }

    if (!isLegacyUserRole(role)) {
      return errorResponse(
        "VALIDATION_ERROR",
        `Role debe ser uno de: ${LEGACY_USER_ROLES.join(", ")}`,
      )
    }

    /**
     * Capture the previous role BEFORE the update so the audit row reflects
     * the actual state transition. If the row vanished between the read and
     * the update (race), `previous` is null and we still log the change.
     */
    const previous = await db.allowedEmail.findUnique({
      where: { id },
      select: { role: true, email: true },
    })

    const record = await db.allowedEmail.update({
      where: { id },
      data: { role },
    })

    let userSynced = false
    const user = await db.user.findUnique({ where: { email: record.email } })
    if (user) {
      await db.user.update({ where: { id: user.id }, data: { role } })
      userSynced = true
    }

    await logPlatformAudit({
      actorId: session.userId,
      action: "allowed_email.update",
      targetType: "allowed_email",
      targetId: record.id,
      metadata: {
        email: record.email,
        changedFields: ["role"],
        previousRole: previous?.role ?? null,
        nextRole: record.role,
        userRoleSynced: userSynced,
      },
      request,
    })

    return successResponse(record)
  } catch (error) {
    return handleError(error, "AllowedEmail")
  }
}

/**
 * Delete an allowlist row. Self-deletion guard: PlatformAdmins cannot remove
 * their own email entry — same logic as legacy. Note this only protects
 * against accidental lockout of the admin's invite-only entry; their
 * `PlatformAdmin` row + `User` are untouched.
 */
export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { session } = await requirePlatformAdmin()

    const { id } = await params
    const record = await db.allowedEmail.findUnique({ where: { id } })

    if (!record) {
      return errorResponse("NOT_FOUND", "Email no encontrado", 404)
    }
    if (record.email === session.email) {
      return errorResponse("FORBIDDEN", "No puedes eliminar tu propio acceso", 403)
    }

    await db.allowedEmail.delete({ where: { id } })

    await logPlatformAudit({
      actorId: session.userId,
      action: "allowed_email.delete",
      targetType: "allowed_email",
      targetId: record.id,
      metadata: {
        email: record.email,
        role: record.role,
      },
      request,
    })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "AllowedEmail")
  }
}
