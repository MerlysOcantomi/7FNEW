import { NextRequest } from "next/server"
import { handleError, successResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { aggregateAgentsActivity } from "@modules/agents/activity-aggregator"

/**
 * GET /api/agents/activity
 *
 * Read-only aggregator for the Global Agents surface. Projects existing
 * workspace-scoped records (`WorkspaceTask`, `ConversationAction`) into
 * the four Agents lanes. No new persistence, no Fanny pipeline change,
 * no write side effects.
 *
 * Authentication: any authenticated workspace member with VIEWER or
 * higher (`requireReadAccess`). Anonymous traffic → 401, non-member
 * sessions → 403, cross-tenant header attempts → 403.
 *
 * The workspace is resolved server-side from the authenticated session —
 * it is NEVER read from the query string — so a caller cannot request
 * another tenant's activity.
 */
export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess(request)
    const payload = await aggregateAgentsActivity({ workspaceId })
    return successResponse(payload)
  } catch (error) {
    return handleError(error, "AgentsActivity")
  }
}
