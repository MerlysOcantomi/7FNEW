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

    /**
     * Workspace + OWNER membership commit together or not at all (NEON-03):
     * a workspace whose owner row failed to persist would be unreachable and
     * would still hold the unique slug. The slug pre-check above is a
     * courtesy; the unique index is the real guard, so a concurrent create is
     * reported as a conflict instead of a generic failure.
     */
    let workspace
    try {
      workspace = await db.$transaction(async (tx) => {
        const created = await tx.workspace.create({
          data: { nombre, slug: slugClean, vertical: verticalKey, verticalKey },
        })
        await tx.workspaceMember.create({
          data: {
            userId: session.userId,
            workspaceId: created.id,
            role: "OWNER",
          },
        })
        return created
      })
    } catch (e: unknown) {
      if (typeof e === "object" && e !== null && (e as { code?: unknown }).code === "P2002") {
        return errorResponse("CONFLICT", "Ya existe un workspace con ese slug", 409)
      }
      throw e
    }

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
