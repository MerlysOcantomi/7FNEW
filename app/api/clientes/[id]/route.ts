import { NextRequest, NextResponse } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { updateClienteSchema } from "@/lib/modules/clientes/validation"
import * as service from "@/lib/modules/clientes/service"
import { logChanges, logActivity } from "@/lib/activity"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"

type Params = { params: Promise<{ id: string }> }

const TRACKED_FIELDS = ["nombre", "email", "telefono", "empresa", "tipo", "estado", "notas"]

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { id } = await params
    const record = await service.getById(id, workspaceId)
    if (!record) return errorResponse("NOT_FOUND", "Cliente no encontrado", 404)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Cliente")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess()
    const { id } = await params
    const body = await request.json()
    const data = updateClienteSchema.parse(body)

    const previous = await service.getById(id, workspaceId)
    if (!previous) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const record = await service.update(id, data, workspaceId)
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (previous) {
      logChanges("clientes", id, previous as any, data as any, TRACKED_FIELDS).catch(() => {})
    }

    return successResponse(record)
  } catch (error) {
    return handleError(error, "Cliente")
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess()
    const { id } = await params
    const record = await service.getById(id, workspaceId)
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })
    logActivity({ module: "clientes", recordId: id, type: "deleted", data: { label: (record as any)?.nombre } }).catch(() => {})
    const result = await service.remove(id, workspaceId)
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "Cliente")
  }
}
