import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { updateProyectoSchema } from "@/lib/modules/proyectos/validation"
import * as service from "@/lib/modules/proyectos/service"
import { notifyAdminsAndEditors } from "@/lib/notifications"
import { getSessionFromCookies } from "@/lib/auth/session"
import { logChanges, logActivity } from "@/lib/activity"

type Params = { params: Promise<{ id: string }> }

const TRACKED_FIELDS = ["nombre", "descripcion", "estado", "prioridad", "progreso", "presupuesto", "fechaInicio", "fechaFin", "clienteId"]

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const record = await service.getById(id)
    if (!record) return errorResponse("NOT_FOUND", "Proyecto no encontrado", 404)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Proyecto")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = updateProyectoSchema.parse(body)

    const previous = await service.getById(id)
    const record = await service.update(id, data)
    const session = await getSessionFromCookies()

    if (previous && record) {
      logChanges("proyectos", id, previous as any, data as any, TRACKED_FIELDS).catch(() => {})

      if (data.estado && data.estado !== previous.estado) {
        const nombre = (record as any).nombre ?? "Proyecto"
        notifyAdminsAndEditors(
          "proyecto_estado",
          `Proyecto actualizado: ${nombre}`,
          `Estado cambiado a "${data.estado}"`,
          `/proyectos/${id}`,
          session?.userId
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
    const { id } = await params
    const record = await service.getById(id)
    logActivity({ module: "proyectos", recordId: id, type: "deleted", data: { label: (record as any)?.nombre } }).catch(() => {})
    await service.remove(id)
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "Proyecto")
  }
}
