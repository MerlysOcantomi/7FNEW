import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { generateQRDataURL, isValidUrl } from "@/lib/qr"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { url } = body

    if (!url || typeof url !== "string") {
      return errorResponse("VALIDATION_ERROR", "URL es requerida")
    }

    if (!isValidUrl(url)) {
      return errorResponse("VALIDATION_ERROR", "URL no valida")
    }

    const imageData = await generateQRDataURL(url)

    return successResponse({ url, imageData })
  } catch (error) {
    console.error("[7F QR] Error generando QR:", error)
    return errorResponse("INTERNAL_ERROR", "Error al generar QR", 500)
  }
}
