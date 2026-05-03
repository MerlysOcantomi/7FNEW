import { successResponse, handleError } from "@/lib/api"
import { requireAnyPlatformRole } from "@/lib/auth/platform-auth"

/**
 * Identity endpoint for the SevenF System Admin area.
 *
 * Returns the platform-side identity of the caller. Used by `/system` UI to
 * confirm role / show the right chrome. NEVER returns workspace-scoped data.
 *
 * Gated with `requireAnyPlatformRole()` (alias for the lowest level, BILLING)
 * because being signed in to `/system` at all is the only requirement here;
 * specific feature endpoints should still demand higher roles where needed.
 */
export async function GET() {
  try {
    const { session, platformRole } = await requireAnyPlatformRole()
    return successResponse({
      userId: session.userId,
      email: session.email,
      nombre: session.nombre,
      avatar: session.avatar,
      platformRole,
    })
  } catch (error) {
    return handleError(error, "Platform")
  }
}
