import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { successResponse, handleError } from "@/lib/api"

type Params = { params: Promise<{ module: string; recordId: string }> }

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireReadAccess(request)
    const { module, recordId } = await params

    const qrCodes = await db.qRCode.findMany({
      where: { module, recordId, workspaceId },
      orderBy: { createdAt: "desc" },
    })

    return successResponse(qrCodes)
  } catch (error) {
    return handleError(error, "QRCode")
  }
}
