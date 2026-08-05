import { NextRequest } from "next/server"
import { successResponse, handleError, getPaginationParams } from "@/lib/api"
import { createUsuarioSchema, queryUsuarioSchema } from "@modules/usuarios/validation"
import * as service from "@modules/usuarios/service"
import { requireAdminAccess, requireReadAccess } from "@/lib/auth/workspace-auth"

/**
 * Usuario collection endpoints (CORE-01).
 *
 * The tenant comes EXCLUSIVELY from the guard's return value. Nothing here
 * reads a workspace hint from the body, the query string or a route param:
 * `Usuario` has no `workspaceId` column, so ownership is derived server-side
 * by `modules/usuarios/scope.ts` and can never be asserted by the caller.
 */

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess(request)
    const { searchParams } = request.nextUrl
    const query = queryUsuarioSchema.parse(Object.fromEntries(searchParams))
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const { data, total } = await service.list({
      ...query,
      skip,
      take: pageSize,
      workspaceId,
    })
    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    return handleError(error, "Usuario")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireAdminAccess(request)
    const body = await request.json()
    const data = createUsuarioSchema.parse(body)
    const record = await service.create(data, workspaceId)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Usuario")
  }
}
