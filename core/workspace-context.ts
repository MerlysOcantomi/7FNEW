import { cookies } from "next/headers"
import { getSessionFromCookies } from "@core/auth/session"
import { db } from "@core/db"

export const WORKSPACE_COOKIE = "wf_workspace"

export class WorkspaceError extends Error {
  status: number
  code: string
  constructor(code: string, message: string, status: number) {
    super(message)
    this.code = code
    this.status = status
    this.name = "WorkspaceError"
  }
}

/**
 * Resolves the active workspaceId for the current request.
 * Resolution order:
 *   1. x-workspace-id header (internal API/agents) — validated via membership
 *   2. wf_workspace cookie — validated via membership
 *   3. First workspace the user belongs to — auto-sets cookie
 * Throws WorkspaceError if no valid workspace can be resolved.
 */
export async function getRequiredWorkspaceId(req?: Request): Promise<string> {
  const session = await getSessionFromCookies()

  if (req) {
    const headerWs = req.headers.get("x-workspace-id")
    if (headerWs) {
      if (!session) throw new WorkspaceError("UNAUTHORIZED", "No autenticado", 401)
      const member = await db.workspaceMember.findUnique({
        where: { userId_workspaceId: { userId: session.userId, workspaceId: headerWs } },
      })
      if (!member) throw new WorkspaceError("FORBIDDEN", "Sin acceso a este workspace", 403)
      return headerWs
    }
  }

  if (!session) {
    throw new WorkspaceError("UNAUTHORIZED", "No autenticado", 401)
  }

  const cookieStore = await cookies()
  const cookieWs = cookieStore.get(WORKSPACE_COOKIE)?.value

  if (cookieWs) {
    const member = await db.workspaceMember.findUnique({
      where: { userId_workspaceId: { userId: session.userId, workspaceId: cookieWs } },
    })
    if (member) return cookieWs
  }

  const firstMembership = await db.workspaceMember.findFirst({
    where: { userId: session.userId },
    orderBy: { createdAt: "asc" },
    select: { workspaceId: true },
  })

  if (firstMembership) {
    try {
      cookieStore.set(WORKSPACE_COOKIE, firstMembership.workspaceId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      })
    } catch { /* cookie setting may fail in certain render contexts */ }
    return firstMembership.workspaceId
  }

  throw new WorkspaceError("NO_WORKSPACE", "No tienes workspace asignado", 404)
}

export async function getOptionalWorkspaceId(req?: Request): Promise<string | null> {
  try {
    return await getRequiredWorkspaceId(req)
  } catch {
    return null
  }
}
