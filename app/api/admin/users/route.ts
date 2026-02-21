import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { getSessionFromCookies } from "@/lib/auth/session"
import { isAdmin } from "@/lib/auth/permissions"
import { db } from "@/lib/db"

export async function GET() {
  const session = await getSessionFromCookies()
  if (!session || !isAdmin(session.role)) {
    return errorResponse("FORBIDDEN", "Acceso denegado. Solo administradores.", 403)
  }

  const users = await db.user.findMany({
    orderBy: { createdAt: "desc" },
  })

  return successResponse(users)
}

export async function PATCH(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session || !isAdmin(session.role)) {
    return errorResponse("FORBIDDEN", "Acceso denegado. Solo administradores.", 403)
  }

  try {
    const body = await request.json()
    const { userId, role } = body as { userId?: string; role?: string }

    if (!userId || !role) {
      return errorResponse("VALIDATION_ERROR", "userId y role son obligatorios")
    }

    if (!["admin", "editor", "viewer"].includes(role)) {
      return errorResponse("VALIDATION_ERROR", "Role debe ser: admin, editor, viewer")
    }

    const user = await db.user.update({
      where: { id: userId },
      data: { role },
    })

    const allowedEmail = await db.allowedEmail.findUnique({
      where: { email: user.email },
    })
    if (allowedEmail) {
      await db.allowedEmail.update({
        where: { id: allowedEmail.id },
        data: { role },
      })
    }

    return successResponse(user)
  } catch (error) {
    console.error("[7F Admin] Update user error:", error)
    return errorResponse("INTERNAL_ERROR", "Error al actualizar usuario", 500)
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getSessionFromCookies()
  if (!session || !isAdmin(session.role)) {
    return errorResponse("FORBIDDEN", "Acceso denegado. Solo administradores.", 403)
  }

  try {
    const body = await request.json()
    const { userId } = body as { userId?: string }

    if (!userId) {
      return errorResponse("VALIDATION_ERROR", "userId es obligatorio")
    }

    const user = await db.user.findUnique({ where: { id: userId } })
    if (!user) {
      return errorResponse("NOT_FOUND", "Usuario no encontrado", 404)
    }

    if (user.email === session.email) {
      return errorResponse("FORBIDDEN", "No puedes eliminar tu propio acceso", 403)
    }

    await db.allowedEmail.deleteMany({ where: { email: user.email } })
    await db.user.delete({ where: { id: userId } })

    return successResponse({ deleted: true })
  } catch (error) {
    console.error("[7F Admin] Delete user error:", error)
    return errorResponse("INTERNAL_ERROR", "Error al eliminar usuario", 500)
  }
}
