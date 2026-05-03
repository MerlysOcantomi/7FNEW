import { successResponse, handleError } from "@/lib/api"
import { requireAnyPlatformRole } from "@/lib/auth/platform-auth"
import { listUsersForSystem } from "@core/system/users"

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
