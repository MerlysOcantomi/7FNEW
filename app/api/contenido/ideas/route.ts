import { NextRequest } from "next/server"
import { successResponse, handleError, getPaginationParams } from "@/lib/api"
import { createContentIdeaSchema } from "@/lib/modules/contenido/validation"
import * as service from "@/lib/modules/contenido/service"
import { z } from "zod"

const querySchema = z.object({
  estado: z.string().optional(),
  categoria: z.string().optional(),
  search: z.string().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl
    const query = querySchema.parse(Object.fromEntries(searchParams))
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const { data, total } = await service.listIdeas({ ...query, skip, take: pageSize })
    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    return handleError(error, "ContentIdea")
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const data = createContentIdeaSchema.parse(body)
    const record = await service.createIdea(data)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "ContentIdea")
  }
}
