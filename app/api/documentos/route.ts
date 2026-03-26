import { NextRequest } from "next/server"
import { successResponse, handleError, getPaginationParams } from "@/lib/api"
import { createDocumentoSchema, queryDocumentoSchema } from "@modules/documentos/validation"
import * as service from "@modules/documentos/service"
import { notifyAdminsAndEditors } from "@/lib/notifications"
import { logActivity } from "@/lib/activity"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { searchParams } = request.nextUrl
    const query = queryDocumentoSchema.parse(Object.fromEntries(searchParams))
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const { data, total } = await service.list({ ...query, skip, take: pageSize, workspaceId })
    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    return handleError(error, "Documento")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId, session } = await requireWriteAccess()
    const body = await request.json()
    const data = createDocumentoSchema.parse(body)
    const record = await service.create(data, workspaceId)

    logActivity({ module: "documentos", recordId: (record as any).id, type: "created", data: { label: (record as any).nombre }, workspaceId }).catch(() => {})

    notifyAdminsAndEditors(
      "documento_subido",
      `Documento subido: ${(record as any).nombre}`,
      `Tipo: ${(record as any).tipo}`,
      undefined,
      session?.userId,
      workspaceId
    ).catch(() => {})

    return successResponse(record)
  } catch (error) {
    return handleError(error, "Documento")
  }
}
