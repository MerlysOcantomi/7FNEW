import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { successResponse, errorResponse, handleError } from "@/lib/api"

type Params = { params: Promise<{ id: string }> }

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess(request)
    const { id } = await params

    const result = await db.qRCode.deleteMany({
      where: { id, workspaceId },
    })

    if (result.count === 0) {
      return errorResponse("NOT_FOUND", "QRCode no encontrado", 404)
    }

    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "QRCode")
  }
}
