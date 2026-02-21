import { NextRequest } from "next/server"
import { successResponse, handleError, getPaginationParams } from "@/lib/api"
import { createClienteSchema, queryClienteSchema } from "@/lib/modules/clientes/validation"
import * as service from "@/lib/modules/clientes/service"

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const query = queryClienteSchema.parse(Object.fromEntries(searchParams))
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const { data, total } = await service.list({ ...query, skip, take: pageSize })
    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    return handleError(error, "Cliente")
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = createClienteSchema.parse(body)
    const record = await service.create(data)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Cliente")
  }
}
