import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { updateEventoSchema } from "@/lib/modules/calendario/validation"
import * as service from "@/lib/modules/calendario/service"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const record = await service.getById(id)
    if (!record) return errorResponse("NOT_FOUND", "Evento no encontrado", 404)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Evento")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = updateEventoSchema.parse(body)
    const record = await service.update(id, data)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Evento")
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    await service.remove(id)
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "Evento")
  }
}
