import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { updateContentIdeaSchema } from "@/lib/modules/contenido/validation"
import * as service from "@/lib/modules/contenido/service"

type Params = { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = updateContentIdeaSchema.parse(body)
    const record = await service.updateIdea(id, data)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "ContentIdea")
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    await service.removeIdea(id)
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "ContentIdea")
  }
}
