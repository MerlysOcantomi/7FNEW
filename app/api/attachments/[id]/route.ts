import { NextRequest } from "next/server"
import { unlink } from "fs/promises"
import { join } from "path"
import { db } from "@/lib/db"
import { getSessionFromCookies } from "@/lib/auth/session"
import { successResponse, errorResponse, handleError } from "@/lib/api"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params

    const attachment = await db.attachment.findUnique({ where: { id } })
    if (!attachment) return errorResponse("NOT_FOUND", "Archivo no encontrado", 404)

    let parsedScanResult = null
    if (attachment.scanResult) {
      try {
        parsedScanResult = JSON.parse(attachment.scanResult)
      } catch { /* keep null */ }
    }

    return successResponse({
      ...attachment,
      scanResult: parsedScanResult,
    })
  } catch (error) {
    return handleError(error, "Attachment")
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromCookies()
    if (!session) return errorResponse("UNAUTHORIZED", "No autenticado", 401)

    if (session.role !== "admin" && session.role !== "editor") {
      return errorResponse("FORBIDDEN", "No tienes permisos para eliminar archivos", 403)
    }

    const { id } = await params

    const attachment = await db.attachment.findUnique({ where: { id } })
    if (!attachment) return errorResponse("NOT_FOUND", "Archivo no encontrado", 404)

    try {
      const filePath = join(process.cwd(), "public", attachment.url)
      await unlink(filePath)
    } catch {
      /* file may not exist on disk */
    }

    await db.attachment.delete({ where: { id } })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "Attachment")
  }
}
