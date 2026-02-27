import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { successResponse, handleError } from "@/lib/api"

type Params = { params: Promise<{ module: string; recordId: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    await requireReadAccess()
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
