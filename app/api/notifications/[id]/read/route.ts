import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(_request: NextRequest, { params }: Params) {
  try {
    const { session } = await requireReadAccess()

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
