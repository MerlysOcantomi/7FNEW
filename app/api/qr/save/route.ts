import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { generateQRDataURL, isValidUrl } from "@/lib/qr"

export async function POST(request: NextRequest) {
  try {
    const { session, workspaceId } = await requireWriteAccess(request)
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
        workspaceId,
      },
    })

    return successResponse(qrCode)
  } catch (error) {
    return handleError(error, "QRCode")
  }
}
