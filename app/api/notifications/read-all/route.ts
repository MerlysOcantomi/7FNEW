import { db } from "@/lib/db"
import { getSessionFromCookies } from "@/lib/auth/session"
import { successResponse, errorResponse, handleError } from "@/lib/api"

export async function PATCH() {
  try {
    const session = await getSessionFromCookies()
    if (!session) return errorResponse("UNAUTHORIZED", "No autenticado", 401)

    const result = await db.notification.updateMany({
      where: { userId: session.userId, read: false },
      data: { read: true },
    })

    return successResponse({ marked: result.count })
  } catch (error) {
    return handleError(error, "Notification")
  }
}
