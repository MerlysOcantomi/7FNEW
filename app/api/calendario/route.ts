import { NextRequest } from "next/server"
import { successResponse, handleError, getPaginationParams } from "@/lib/api"
import { createEventoSchema, queryEventoSchema } from "@/lib/modules/calendario/validation"
import * as service from "@/lib/modules/calendario/service"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const query = queryEventoSchema.parse(Object.fromEntries(searchParams))
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const { data, total } = await service.list({ ...query, skip, take: pageSize })
    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    return handleError(error, "Evento")
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = createEventoSchema.parse(body)
    const record = await service.create(data)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Evento")
  }
}
