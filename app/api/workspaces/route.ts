import { getSessionFromCookies } from "@/lib/auth/session"
import { listWorkspacesForUser } from "@/lib/workspace"
import { successResponse, errorResponse } from "@/lib/api"
import { WORKSPACE_COOKIE } from "@/lib/workspace-context"
import { cookies } from "next/headers"

export async function GET() {
  try {
    const session = await getSessionFromCookies()
    if (!session) return errorResponse("UNAUTHORIZED", "No autenticado", 401)

    const workspaces = await listWorkspacesForUser(session.userId)
    const cookieStore = await cookies()
    const activeId = cookieStore.get(WORKSPACE_COOKIE)?.value ?? null

    return successResponse({ workspaces, activeWorkspaceId: activeId })
  } catch (e: any) {
    return errorResponse("INTERNAL_ERROR", e.message, 500)
  }
}
