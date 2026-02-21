import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getSessionFromCookies } from "@/lib/auth/session"
import { successResponse, errorResponse, handleError } from "@/lib/api"

export async function GET(request: NextRequest) {
  try {
    const session = await getSessionFromCookies()
    if (!session) return errorResponse("UNAUTHORIZED", "No autenticado", 401)

    const { searchParams } = request.nextUrl
    const type = searchParams.get("type")
    const unreadOnly = searchParams.get("unread") === "true"
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "30")))

    const where: Record<string, unknown> = { userId: session.userId }
    if (type) where.type = type
    if (unreadOnly) where.read = false

    const [notifications, unreadCount] = await Promise.all([
      db.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      db.notification.count({
        where: { userId: session.userId, read: false },
      }),
    ])

    return successResponse(notifications, { unreadCount })
  } catch (error) {
    return handleError(error, "Notification")
  }
}
