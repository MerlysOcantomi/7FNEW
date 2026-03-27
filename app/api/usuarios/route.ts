import { NextRequest } from "next/server"
import { successResponse, handleError, getPaginationParams } from "@/lib/api"
import { createUsuarioSchema, queryUsuarioSchema } from "@modules/usuarios/validation"
import * as service from "@modules/usuarios/service"
import { requireAdminAccess, requireReadAccess } from "@/lib/auth/workspace-auth"

export async function GET(request: NextRequest) {
  try {
    await requireReadAccess(request)
    const { searchParams } = request.nextUrl
    const query = queryUsuarioSchema.parse(Object.fromEntries(searchParams))
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const { data, total } = await service.list({ ...query, skip, take: pageSize })
    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    return handleError(error, "Usuario")
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdminAccess(request)
    const body = await request.json()
    const data = createUsuarioSchema.parse(body)
    const record = await service.create(data)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Usuario")
  }
}
