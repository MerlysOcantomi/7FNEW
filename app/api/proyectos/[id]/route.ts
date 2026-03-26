import { NextRequest, NextResponse } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { updateProyectoSchema } from "@modules/proyectos/validation"
import * as service from "@modules/proyectos/service"
import { notifyAdminsAndEditors } from "@/lib/notifications"
import { logChanges, logActivity } from "@/lib/activity"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"

type Params = { params: Promise<{ id: string }> }

const TRACKED_FIELDS = ["nombre", "descripcion", "estado", "prioridad", "progreso", "presupuesto", "fechaInicio", "fechaFin", "clienteId"]

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { id } = await params
    const record = await service.getById(id, workspaceId)
    if (!record) return errorResponse("NOT_FOUND", "Proyecto no encontrado", 404)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Proyecto")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, session } = await requireWriteAccess()
    const { id } = await params
    const body = await request.json()
    const data = updateProyectoSchema.parse(body)

    const previous = await service.getById(id, workspaceId)
    if (!previous) return NextResponse.json({ error: "Not found" }, { status: 404 })
    const record = await service.update(id, data, workspaceId)
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (previous && record) {
      logChanges("proyectos", id, previous as any, data as any, TRACKED_FIELDS, workspaceId).catch(() => {})

      if (data.estado && data.estado !== previous.estado) {
        const nombre = (record as any).nombre ?? "Proyecto"
        notifyAdminsAndEditors(
          "proyecto_estado",
          `Proyecto actualizado: ${nombre}`,
          `Estado cambiado a "${data.estado}"`,
          `/proyectos/${id}`,
          session?.userId,
          workspaceId
        ).catch(() => {})
      }
    }

    return successResponse(record)
  } catch (error) {
    return handleError(error, "Proyecto")
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess()
    const { id } = await params
    const record = await service.getById(id, workspaceId)
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })
    logActivity({ module: "proyectos", recordId: id, type: "deleted", data: { label: (record as any)?.nombre }, workspaceId }).catch(() => {})
    const result = await service.remove(id, workspaceId)
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "Proyecto")
  }
}
