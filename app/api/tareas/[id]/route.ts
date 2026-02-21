import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { updateTareaSchema } from "@/lib/modules/tareas/validation"
import * as service from "@/lib/modules/tareas/service"
import { notifyAdminsAndEditors, createNotification } from "@/lib/notifications"
import { getSessionFromCookies } from "@/lib/auth/session"
import { logChanges, logActivity } from "@/lib/activity"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string }> }

const TRACKED_FIELDS = ["titulo", "descripcion", "estado", "prioridad", "fechaLimite", "proyectoId", "clienteId", "usuarioId"]

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const record = await service.getById(id)
    if (!record) return errorResponse("NOT_FOUND", "Tarea no encontrada", 404)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Tarea")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = updateTareaSchema.parse(body)

    const previous = await service.getById(id)
    const record = await service.update(id, data)
    const session = await getSessionFromCookies()

    if (previous && record) {
      const title = (record as any).titulo ?? "Tarea"

      logChanges("tareas", id, previous as any, data as any, TRACKED_FIELDS).catch(() => {})

      if (data.usuarioId && data.usuarioId !== previous.usuarioId) {
        const usuario = await db.usuario.findUnique({ where: { id: data.usuarioId as string }, select: { email: true, nombre: true } })
        if (usuario?.email) {
          const authUser = await db.user.findUnique({ where: { email: usuario.email }, select: { id: true } })
          if (authUser) {
            createNotification({
              userId: authUser.id,
              type: "tarea_asignada",
              title: `Tarea asignada: ${title}`,
              message: `Se te ha asignado la tarea "${title}"`,
              link: `/tareas/${id}`,
            }).catch(() => {})
          }
        }
      }

      if (data.estado && data.estado !== previous.estado) {
        notifyAdminsAndEditors(
          "tarea_estado",
          `Tarea actualizada: ${title}`,
          `Estado cambiado a "${data.estado}"`,
          `/tareas/${id}`,
          session?.userId
        ).catch(() => {})
      }
    }

    return successResponse(record)
  } catch (error) {
    return handleError(error, "Tarea")
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const record = await service.getById(id)
    logActivity({ module: "tareas", recordId: id, type: "deleted", data: { label: (record as any)?.titulo } }).catch(() => {})
    await service.remove(id)
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "Tarea")
  }
}
