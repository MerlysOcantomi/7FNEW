import { NextRequest } from "next/server"
import { successResponse, handleError, getPaginationParams } from "@/lib/api"
import { createContentPieceSchema, queryContentPieceSchema } from "@modules/contenido/validation"
import * as service from "@modules/contenido/service"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { searchParams } = request.nextUrl
    const query = queryContentPieceSchema.parse(Object.fromEntries(searchParams))
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const { data, total } = await service.list({ ...query, skip, take: pageSize, workspaceId })
    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    return handleError(error, "ContentPiece")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireWriteAccess()
    const body = await request.json()
    const data = createContentPieceSchema.parse(body)
    const record = await service.create(data, workspaceId)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "ContentPiece")
  }
}
