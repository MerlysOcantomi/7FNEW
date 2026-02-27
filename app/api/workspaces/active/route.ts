import { NextRequest } from "next/server"
import { getSessionFromCookies } from "@/lib/auth/session"
import { checkMembership } from "@/lib/workspace"
import { successResponse, errorResponse } from "@/lib/api"
import { WORKSPACE_COOKIE } from "@/lib/workspace-context"
import { cookies } from "next/headers"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookies()
    if (!session) return errorResponse("UNAUTHORIZED", "No autenticado", 401)

    const body = await request.json()
    const { workspaceId } = body
    if (!workspaceId) return errorResponse("VALIDATION_ERROR", "workspaceId es requerido")

    const member = await checkMembership(session.userId, workspaceId)
    if (!member) return errorResponse("FORBIDDEN", "No tienes acceso a este workspace", 403)

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { id: true, nombre: true, slug: true, vertical: true, plan: true },
    })
    if (!workspace) return errorResponse("NOT_FOUND", "Workspace no encontrado", 404)

    const cookieStore = await cookies()
    cookieStore.set(WORKSPACE_COOKIE, workspaceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })

    return successResponse({ ...workspace, role: member.role })
  } catch (e: any) {
    return errorResponse("INTERNAL_ERROR", e.message, 500)
  }
}
