import { NextRequest, NextResponse } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { updateDocumentoSchema } from "@modules/documentos/validation"
import * as service from "@modules/documentos/service"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { id } = await params
    const record = await service.getById(id, workspaceId)
    if (!record) return errorResponse("NOT_FOUND", "Documento no encontrado", 404)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Documento")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess()
    const { id } = await params
    const body = await request.json()
    const data = updateDocumentoSchema.parse(body)
    const record = await service.update(id, data, workspaceId)
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Documento")
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess()
    const { id } = await params
    const result = await service.remove(id, workspaceId)
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "Documento")
  }
}
