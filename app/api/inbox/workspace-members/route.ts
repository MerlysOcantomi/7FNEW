import { NextRequest } from "next/server"
import { handleError, successResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess(request)

    const members = await db.workspaceMember.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
      include: {
        user: {
          select: {
            id: true,
            nombre: true,
            email: true,
            avatar: true,
          },
        },
      },
    })

    const data = members.map((m) => ({
      userId: m.user.id,
      nombre: m.user.nombre,
      email: m.user.email,
      avatar: m.user.avatar,
      role: m.role,
    }))

    return successResponse(data)
  } catch (error) {
    return handleError(error, "WorkspaceMembers")
  }
}
