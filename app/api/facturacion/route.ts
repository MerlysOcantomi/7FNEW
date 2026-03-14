import { NextRequest } from "next/server"
import { successResponse, handleError, getPaginationParams } from "@/lib/api"
import { createFacturaSchema, queryFacturaSchema } from "@/lib/modules/facturacion/validation"
import * as service from "@/lib/modules/facturacion/service"
import { notifyAdminsAndEditors } from "@/lib/notifications"
import { logActivity } from "@/lib/activity"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { searchParams } = request.nextUrl
    const query = queryFacturaSchema.parse(Object.fromEntries(searchParams))
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const { data, total } = await service.list({ ...query, skip, take: pageSize, workspaceId })
    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    return handleError(error, "Factura")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, session } = await requireWriteAccess()
    const body = await request.json()
    const data = createFacturaSchema.parse(body)
    const record = await service.create(data, workspaceId)

    logActivity({ module: "facturacion", recordId: (record as any).id, type: "created", data: { label: (record as any).numero }, workspaceId }).catch(() => {})

    notifyAdminsAndEditors(
      "factura_creada",
      `Nueva factura: ${(record as any).numero}`,
      `Factura creada por ${(record as any).total ? `$${(record as any).total}` : "—"}`,
      `/facturacion/${(record as any).id}`,
      session?.userId,
      workspaceId
    ).catch(() => {})

    return successResponse(record)
  } catch (error) {
    return handleError(error, "Factura")
  }
}
