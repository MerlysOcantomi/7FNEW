import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { updateClienteSchema } from "@/lib/modules/clientes/validation"
import * as service from "@/lib/modules/clientes/service"
import { logChanges, logActivity } from "@/lib/activity"

type Params = { params: Promise<{ id: string }> }

const TRACKED_FIELDS = ["nombre", "email", "telefono", "empresa", "tipo", "estado", "notas"]

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const record = await service.getById(id)
    if (!record) return errorResponse("NOT_FOUND", "Cliente no encontrado", 404)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Cliente")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = updateClienteSchema.parse(body)

    const previous = await service.getById(id)
    const record = await service.update(id, data)

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
    const { id } = await params
    const record = await service.getById(id)
    logActivity({ module: "clientes", recordId: id, type: "deleted", data: { label: (record as any)?.nombre } }).catch(() => {})
    await service.remove(id)
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "Cliente")
  }
}
