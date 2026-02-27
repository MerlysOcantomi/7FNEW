import { NextRequest } from "next/server"
import { successResponse, handleError, getPaginationParams } from "@/lib/api"
import { createProyectoSchema, queryProyectoSchema } from "@/lib/modules/proyectos/validation"
import * as service from "@/lib/modules/proyectos/service"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { searchParams } = request.nextUrl
    const query = queryProyectoSchema.parse(Object.fromEntries(searchParams))
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const { data, total } = await service.list({ ...query, skip, take: pageSize, workspaceId })
    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    return handleError(error, "Proyecto")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireWriteAccess()
    const body = await request.json()
    const data = createProyectoSchema.parse(body)
    const record = await service.create(data, workspaceId)

    const { logActivity } = await import("@/lib/activity")
    logActivity({ module: "proyectos", recordId: (record as any).id, type: "created", data: { label: (record as any).nombre } }).catch(() => {})

    return successResponse(record)
  } catch (error) {
    return handleError(error, "Proyecto")
  }
}
