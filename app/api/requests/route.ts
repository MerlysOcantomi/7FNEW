import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { successResponse, handleError } from "@/lib/api"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"

export async function GET() {
  try {
    const { workspaceId } = await requireReadAccess()

    const requests = await db.clientRequest.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      include: {
        cliente: { select: { id: true, nombre: true, empresa: true } },
        proyecto: { select: { id: true, nombre: true } },
        assets: true,
      },
    })

    return successResponse(requests)
  } catch (error) {
    return handleError(error, "ClientRequest")
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { workspaceId } = await requireWriteAccess()
    const body = await request.json()
    const { id, status } = body as { id?: string; status?: string }

    if (!id || !status) {
      return successResponse(null)
    }

    const validStatuses = ["OPEN", "IN_PROGRESS", "DONE"]
    if (!validStatuses.includes(status)) {
      return successResponse(null)
    }

    const existing = await db.clientRequest.findFirst({
      where: { id, workspaceId },
    })

    if (!existing) {
      return successResponse(null)
    }

    const updated = await db.clientRequest.update({
      where: { id },
      data: { status },
      include: {
        cliente: { select: { id: true, nombre: true, empresa: true } },
        proyecto: { select: { id: true, nombre: true } },
        assets: true,
      },
    })

    return successResponse(updated)
  } catch (error) {
    return handleError(error, "ClientRequest")
  }
}
