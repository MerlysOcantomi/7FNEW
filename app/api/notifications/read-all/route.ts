import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { successResponse, handleError } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"

export async function PATCH(request: NextRequest) {
  try {
    const { session, workspaceId } = await requireReadAccess(request)

    const result = await db.notification.updateMany({
      where: { userId: session.userId, workspaceId, read: false },
      data: { read: true },
    })

    return successResponse({ marked: result.count })
  } catch (error) {
    return handleError(error, "Notification")
  }
}
