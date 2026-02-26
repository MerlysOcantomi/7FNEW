import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { extractText, isScannable } from "@/lib/ocr"
import { analyzeDocument } from "@/lib/scan"

type Params = { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    await requireWriteAccess()

    const { id } = await params

    const attachment = await db.attachment.findUnique({ where: { id } })
    if (!attachment) return errorResponse("NOT_FOUND", "Archivo no encontrado", 404)

    if (!isScannable(attachment.tipo)) {
      return errorResponse(
        "VALIDATION_ERROR",
        "Este tipo de archivo no se puede escanear",
      )
    }

    await db.attachment.update({
      where: { id },
      data: { scanStatus: "processing" },
    })

    try {
      const ocrText = await extractText(attachment.url, attachment.tipo)

      const scanResult = await analyzeDocument(ocrText, attachment.nombre)

      const updated = await db.attachment.update({
        where: { id },
        data: {
          ocrText,
          scanStatus: "completed",
          scanResult: JSON.stringify(scanResult),
        },
      })

      return successResponse({
        ...updated,
        scanResult,
      })
    } catch (scanError) {
      console.error("[7F Scan] Error:", scanError)

      await db.attachment.update({
        where: { id },
        data: {
          scanStatus: "error",
          scanResult: JSON.stringify({
            error:
              scanError instanceof Error
                ? scanError.message
                : "Error desconocido",
          }),
        },
      })

      return errorResponse("SCAN_ERROR", "Error al escanear el archivo", 500)
    }
  } catch (error) {
    return handleError(error, "Attachment")
  }
}
