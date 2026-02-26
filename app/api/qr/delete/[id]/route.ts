import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { successResponse, handleError } from "@/lib/api"

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    await requireWriteAccess()
    const { id } = await params

    await db.qRCode.delete({ where: { id } })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "QRCode")
  }
}
