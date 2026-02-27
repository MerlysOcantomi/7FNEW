import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { updateNotaSchema } from "@/lib/modules/notas/validation"
import * as service from "@/lib/modules/notas/service"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { id } = await params
    const record = await service.getById(id, workspaceId)
    if (!record) return errorResponse("NOT_FOUND", "Nota no encontrada", 404)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Nota")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess()
    const { id } = await params
    const body = await request.json()
    const data = updateNotaSchema.parse(body)
    const record = await service.update(id, data, workspaceId)
    if (!record) return errorResponse("NOT_FOUND", "Nota no encontrada", 404)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Nota")
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess()
    const { id } = await params
    const record = await service.remove(id, workspaceId)
    if (!record) return errorResponse("NOT_FOUND", "Nota no encontrada", 404)
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "Nota")
  }
}
