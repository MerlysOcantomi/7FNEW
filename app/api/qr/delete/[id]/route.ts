import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getSessionFromCookies } from "@/lib/auth/session"
import { successResponse, errorResponse, handleError } from "@/lib/api"

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromCookies()
    if (!session) return errorResponse("UNAUTHORIZED", "No autenticado", 401)
    if (session.role !== "admin" && session.role !== "editor") {
      return errorResponse("FORBIDDEN", "No tienes permisos", 403)
    }

    const { id } = await params

    await db.qRCode.delete({ where: { id } })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "QRCode")
  }
}
