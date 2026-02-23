import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { updateCampaignSchema } from "@/lib/modules/campanas/validation"
import * as service from "@/lib/modules/campanas/service"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const record = await service.getById(id)
    if (!record) return errorResponse("NOT_FOUND", "Campana no encontrada", 404)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Campaign")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = updateCampaignSchema.parse(body)
    const record = await service.update(id, data)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Campaign")
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    await service.remove(id)
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "Campaign")
  }
}
