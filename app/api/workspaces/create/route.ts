import { NextRequest } from "next/server"
import { getSessionFromCookies } from "@/lib/auth/session"
import { successResponse, errorResponse } from "@/lib/api"
import { WORKSPACE_COOKIE } from "@/lib/workspace-context"
import { cookies } from "next/headers"
import { db } from "@/lib/db"

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookies()
    if (!session) return errorResponse("UNAUTHORIZED", "No autenticado", 401)

    const body = await request.json()
    const { nombre, slug, verticalKey = "creative-agency" } = body

    if (!nombre || !slug) {
      return errorResponse("VALIDATION_ERROR", "nombre y slug son requeridos")
    }

    const slugClean = slug.toLowerCase().replace(/[^a-z0-9-]/g, "-")
    const existing = await db.workspace.findUnique({ where: { slug: slugClean } })
    if (existing) return errorResponse("CONFLICT", "Ya existe un workspace con ese slug", 409)

    const workspace = await db.workspace.create({
      data: { nombre, slug: slugClean, vertical: verticalKey, verticalKey },
    })

    await db.workspaceMember.create({
      data: {
        userId: session.userId,
        workspaceId: workspace.id,
        role: "OWNER",
      },
    })

    const cookieStore = await cookies()
    cookieStore.set(WORKSPACE_COOKIE, workspace.id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })

    return successResponse({ id: workspace.id, nombre: workspace.nombre, slug: workspace.slug, verticalKey: workspace.verticalKey, plan: workspace.plan, role: "OWNER" })
  } catch (e: any) {
    return errorResponse("INTERNAL_ERROR", e.message, 500)
  }
}
