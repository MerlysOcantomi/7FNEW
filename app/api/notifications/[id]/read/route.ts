import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getSessionFromCookies } from "@/lib/auth/session"
import { successResponse, errorResponse, handleError } from "@/lib/api"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(_request: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromCookies()
    if (!session) return errorResponse("UNAUTHORIZED", "No autenticado", 401)

    const { id } = await params

    const notification = await db.notification.findFirst({
      where: { id, userId: session.userId },
    })
    if (!notification) return errorResponse("NOT_FOUND", "Notificacion no encontrada", 404)

    const updated = await db.notification.update({
      where: { id },
      data: { read: true },
    })

    return successResponse(updated)
  } catch (error) {
    return handleError(error, "Notification")
  }
}
