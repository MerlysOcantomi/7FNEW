import { successResponse, handleError } from "@/lib/api"
import { requireAnyPlatformRole } from "@/lib/auth/platform-auth"
import { listWorkspacesForSystem } from "@core/system/workspaces"

/**
 * Read-only listing of every tenant in the platform, for the SevenF System
 * Admin dashboard.
 *
 * Authorisation:
 *   - `requireAnyPlatformRole()` (lowest level, BILLING). Reading the tenant
 *     directory does not require ADMIN; the data here is non-sensitive
 *     metadata only. Specific destructive endpoints will demand higher.
 *
 * Response is intentionally narrow (`SystemWorkspaceSummary`):
 *   - id, nombre, slug, vertical, plan, createdAt, updatedAt
 *   - memberCount, conversationCount, channelCount
 *
 * Explicitly NOT returned:
 *   - Message content, inbox bodies, drafts.
 *   - Channel OAuth tokens / refresh tokens / credentials.
 *   - User-level data (per-member email, role inside workspace).
 *   - Workspace `config` blob (may contain provider keys, prompts, etc.).
 *
 * NEVER reads or writes `wf_workspace`. The control plane is workspace-less.
 */
export async function GET() {
  try {
    await requireAnyPlatformRole()
    const workspaces = await listWorkspacesForSystem()
    return successResponse({ workspaces, total: workspaces.length })
  } catch (error) {
    return handleError(error, "PlatformWorkspaces")
  }
}
