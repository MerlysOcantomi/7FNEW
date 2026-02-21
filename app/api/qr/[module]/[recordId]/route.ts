import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getSessionFromCookies } from "@/lib/auth/session"
import { successResponse, errorResponse, handleError } from "@/lib/api"

type Params = { params: Promise<{ module: string; recordId: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromCookies()
    if (!session) return errorResponse("UNAUTHORIZED", "No autenticado", 401)

    const { module, recordId } = await params

    const qrCodes = await db.qRCode.findMany({
      where: { module, recordId },
      orderBy: { createdAt: "desc" },
    })

    return successResponse(qrCodes)
  } catch (error) {
    return handleError(error, "QRCode")
  }
}
