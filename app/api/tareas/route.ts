import { NextRequest } from "next/server"
import { successResponse, handleError, getPaginationParams } from "@/lib/api"
import { createTareaSchema, queryTareaSchema } from "@modules/tareas/validation"
import * as service from "@modules/tareas/service"
import { logActivity } from "@/lib/activity"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess(request)
    const { searchParams } = request.nextUrl
    const query = queryTareaSchema.parse(Object.fromEntries(searchParams))
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const { data, total } = await service.list({ ...query, skip, take: pageSize, workspaceId })
    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    return handleError(error, "Tarea")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireWriteAccess(request)
    const body = await request.json()
    const data = createTareaSchema.parse(body)
    const record = await service.create(data, workspaceId)

    logActivity({ module: "tareas", recordId: (record as any).id, type: "created", data: { label: (record as any).titulo }, workspaceId }).catch(() => {})

    return successResponse(record)
  } catch (error) {
    return handleError(error, "Tarea")
  }
}
