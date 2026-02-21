import { NextRequest } from "next/server"
import { successResponse, handleError, getPaginationParams } from "@/lib/api"
import { createDocumentoSchema, queryDocumentoSchema } from "@/lib/modules/documentos/validation"
import * as service from "@/lib/modules/documentos/service"
import { notifyAdminsAndEditors } from "@/lib/notifications"
import { getSessionFromCookies } from "@/lib/auth/session"
import { logActivity } from "@/lib/activity"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const query = queryDocumentoSchema.parse(Object.fromEntries(searchParams))
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const { data, total } = await service.list({ ...query, skip, take: pageSize })
    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    return handleError(error, "Documento")
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = createDocumentoSchema.parse(body)
    const record = await service.create(data)
    const session = await getSessionFromCookies()

    logActivity({ module: "documentos", recordId: (record as any).id, type: "created", data: { label: (record as any).nombre } }).catch(() => {})

    notifyAdminsAndEditors(
      "documento_subido",
      `Documento subido: ${(record as any).nombre}`,
      `Tipo: ${(record as any).tipo}`,
      undefined,
      session?.userId
    ).catch(() => {})

    return successResponse(record)
  } catch (error) {
    return handleError(error, "Documento")
  }
}
