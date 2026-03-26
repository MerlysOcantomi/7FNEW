import { NextRequest } from "next/server"
import { successResponse, handleError, getPaginationParams } from "@/lib/api"
import { createTransaccionSchema, queryTransaccionSchema } from "@modules/finanzas/validation"
import * as service from "@modules/finanzas/service"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { searchParams } = request.nextUrl
    const query = queryTransaccionSchema.parse(Object.fromEntries(searchParams))
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const { data, total } = await service.list({ ...query, skip, take: pageSize, workspaceId })
    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    return handleError(error, "Transacción")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireWriteAccess()
    const body = await request.json()
    const data = createTransaccionSchema.parse(body)
    const record = await service.create(data, workspaceId)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Transacción")
  }
}
