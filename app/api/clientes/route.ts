import { NextRequest } from "next/server"
import { successResponse, handleError, getPaginationParams } from "@/lib/api"
import { createClienteSchema, queryClienteSchema } from "@/lib/modules/clientes/validation"
import * as service from "@/lib/modules/clientes/service"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { searchParams } = request.nextUrl
    const query = queryClienteSchema.parse(Object.fromEntries(searchParams))
    const { page, pageSize, skip } = getPaginationParams(searchParams)
    const { data, total } = await service.list({ ...query, skip, take: pageSize, workspaceId })
    return successResponse(data, { total, page, pageSize })
  } catch (error) {
    return handleError(error, "Cliente")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireWriteAccess()
    const body = await request.json()
    const data = createClienteSchema.parse(body)
    const record = await service.create(data, workspaceId)
    const { logActivity } = await import("@/lib/activity")
    logActivity({ module: "clientes", recordId: (record as any).id, type: "created", data: { label: (record as any).nombre }, workspaceId }).catch(() => {})
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Cliente")
  }
}
