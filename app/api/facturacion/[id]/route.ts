import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { updateFacturaSchema } from "@/lib/modules/facturacion/validation"
import * as service from "@/lib/modules/facturacion/service"
import { notifyAdminsAndEditors } from "@/lib/notifications"
import { getSessionFromCookies } from "@/lib/auth/session"
import { logChanges, logActivity } from "@/lib/activity"

type Params = { params: Promise<{ id: string }> }

const TRACKED_FIELDS = ["numero", "estado", "subtotal", "impuesto", "total", "fechaEmision", "fechaVencimiento", "clienteId", "proyectoId"]

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const record = await service.getById(id)
    if (!record) return errorResponse("NOT_FOUND", "Factura no encontrada", 404)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Factura")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const body = await request.json()
    const data = updateFacturaSchema.parse(body)

    const previous = await service.getById(id)
    const record = await service.update(id, data)
    const session = await getSessionFromCookies()

    if (previous && record) {
      logChanges("facturacion", id, previous as any, data as any, TRACKED_FIELDS).catch(() => {})

      if (data.estado && data.estado !== previous.estado) {
        const numero = (record as any).numero ?? id
        notifyAdminsAndEditors(
          data.estado === "pagada" ? "factura_creada" : "factura_vencida",
          `Factura ${numero}: ${data.estado}`,
          `Estado cambiado a "${data.estado}"`,
          `/facturacion/${id}`,
          session?.userId
        ).catch(() => {})
      }
    }

    return successResponse(record)
  } catch (error) {
    return handleError(error, "Factura")
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const record = await service.getById(id)
    logActivity({ module: "facturacion", recordId: id, type: "deleted", data: { label: (record as any)?.numero } }).catch(() => {})
    await service.remove(id)
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "Factura")
  }
}
