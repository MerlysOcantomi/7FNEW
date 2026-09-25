import { NextRequest } from "next/server"
import type { Prisma } from "@/generated/prisma/client"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { updateEventoSchema } from "@modules/calendario/validation"
import * as service from "@modules/calendario/service"
import { resolveAppointmentWrite } from "@modules/calendario/appointment-v2"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { id } = await params
    const record = await service.getById(id, workspaceId)
    if (!record) return errorResponse("NOT_FOUND", "Evento no encontrado", 404)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Evento")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess()
    const { id } = await params
    const body = await request.json()
    const data = updateEventoSchema.parse(body)
    const existing = await service.getById(id, workspaceId)
    if (!existing) return errorResponse("NOT_FOUND", "Evento no encontrado", 404)
    const enriched = await resolveAppointmentWrite(data, workspaceId, existing)
    const record = await service.update(id, enriched, workspaceId)
    if (!record) return errorResponse("NOT_FOUND", "Evento no encontrado", 404)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Evento")
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess()
    const { id } = await params
    const record = await service.remove(id, workspaceId)
    if (!record) return errorResponse("NOT_FOUND", "Evento no encontrado", 404)
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "Evento")
  }
}
