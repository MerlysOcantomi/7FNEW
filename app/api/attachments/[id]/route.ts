import { NextRequest } from "next/server"
import { unlink } from "fs/promises"
import { join } from "path"
import { db } from "@/lib/db"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { id } = await params

    const attachment = await db.attachment.findFirst({ where: { id, workspaceId } })
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
    const { workspaceId } = await requireWriteAccess()
    const { id } = await params

    const attachment = await db.attachment.findFirst({ where: { id, workspaceId } })
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
