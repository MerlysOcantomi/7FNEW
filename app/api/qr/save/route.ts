import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getSessionFromCookies } from "@/lib/auth/session"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { generateQRDataURL, isValidUrl } from "@/lib/qr"

export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookies()
    if (!session) return errorResponse("UNAUTHORIZED", "No autenticado", 401)
    if (session.role !== "admin" && session.role !== "editor") {
      return errorResponse("FORBIDDEN", "No tienes permisos", 403)
    }

    const body = await request.json()
    const { url, module, recordId, label } = body

    if (!url || !module || !recordId) {
      return errorResponse("VALIDATION_ERROR", "url, module y recordId son requeridos")
    }

    if (!isValidUrl(url)) {
      return errorResponse("VALIDATION_ERROR", "URL no valida")
    }

    const imageData = await generateQRDataURL(url)

    const qrCode = await db.qRCode.create({
      data: {
        url,
        module,
        recordId,
        imageData,
        label: label || null,
        createdBy: session.userId,
      },
    })

    return successResponse(qrCode)
  } catch (error) {
    return handleError(error, "QRCode")
  }
}
