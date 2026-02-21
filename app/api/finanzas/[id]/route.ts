import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { updateTransaccionSchema } from "@/lib/modules/finanzas/validation"
import * as service from "@/lib/modules/finanzas/service"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const record = await service.getById(id)
    if (!record) return errorResponse("NOT_FOUND", "Transacción no encontrada", 404)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Transacción")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = updateTransaccionSchema.parse(body)
    const record = await service.update(id, data)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Transacción")
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    await service.remove(id)
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "Transacción")
  }
}
