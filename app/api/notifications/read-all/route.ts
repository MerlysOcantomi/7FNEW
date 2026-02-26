import { db } from "@/lib/db"
import { successResponse, handleError } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"

export async function PATCH() {
  try {
    const { session } = await requireReadAccess()

    const result = await db.notification.updateMany({
      where: { userId: session.userId, read: false },
      data: { read: true },
    })

    return successResponse({ marked: result.count })
  } catch (error) {
    return handleError(error, "Notification")
  }
}
