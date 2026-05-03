import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import {
  requireAnyPlatformRole,
  requirePlatformAdmin,
} from "@/lib/auth/platform-auth"
import { listAllowedEmails } from "@core/system/allowed-emails"
import { db } from "@/lib/db"

/**
 * Allowed emails are a platform-wide allowlist for invite-only Google login.
 * They are global metadata, not workspace data — managing them belongs to
 * the control plane.
 *
 * Migrated from `/api/admin/allowed-emails` (legacy `requireAdminAccess()`
 * + `session.role === "admin"` combo). Auth is now a strict platform check.
 */

const LEGACY_USER_ROLES = ["admin", "editor", "viewer"] as const
type LegacyUserRole = (typeof LEGACY_USER_ROLES)[number]
function isLegacyUserRole(v: unknown): v is LegacyUserRole {
  return typeof v === "string" && (LEGACY_USER_ROLES as readonly string[]).includes(v)
}

/**
 * Read access: any PlatformAdmin, regardless of role. Allowlist is not
 * sensitive enough to warrant ADMIN level.
 */
export async function GET() {
  try {
    await requireAnyPlatformRole()
    const emails = await listAllowedEmails()
    return successResponse(emails)
  } catch (error) {
    return handleError(error, "AllowedEmail")
  }
}

/**
 * Create a new allowlisted email. Returns 409 if the email already exists.
 * Email is normalised (trim + lowercase) so the unique index isn't bypassed
 * by case-only differences.
 */
export async function POST(request: NextRequest) {
  try {
    await requirePlatformAdmin()

    const body = await request.json()
    const { email, role } = body as { email?: string; role?: string }

    if (!email || typeof email !== "string") {
      return errorResponse("VALIDATION_ERROR", "Email es obligatorio")
    }
    const normalizedEmail = email.trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return errorResponse("VALIDATION_ERROR", "Formato de email invalido")
    }

    const validRole: LegacyUserRole = isLegacyUserRole(role) ? role : "viewer"

    const existing = await db.allowedEmail.findUnique({
      where: { email: normalizedEmail },
    })
    if (existing) {
      return errorResponse("CONFLICT", "Este email ya esta en la lista blanca", 409)
    }

    const record = await db.allowedEmail.create({
      data: { email: normalizedEmail, role: validRole },
    })

    return successResponse(record)
  } catch (error) {
    return handleError(error, "AllowedEmail")
  }
}
