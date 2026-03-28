import { NextRequest, NextResponse } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { updateFacturaSchema } from "@modules/facturacion/validation"
import * as service from "@modules/facturacion/service"
import { notifyAdminsAndEditors } from "@/lib/notifications"
import { logChanges, logActivity } from "@/lib/activity"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"

type Params = { params: Promise<{ id: string }> }

const TRACKED_FIELDS = ["numero", "estado", "subtotal", "impuesto", "total", "fechaEmision", "fechaVencimiento", "clienteId", "proyectoId"]

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireReadAccess(_request)
    const { id } = await params
    const record = await service.getById(id, workspaceId)
    if (!record) return errorResponse("NOT_FOUND", "Factura no encontrada", 404)
    return successResponse(record)
  } catch (error) {
    return handleError(error, "Factura")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, session } = await requireWriteAccess(request)
    const { id } = await params
    const body = await request.json()
    const data = updateFacturaSchema.parse(body)

    const previous = await service.getById(id, workspaceId)
    const record = await service.update(id, data, workspaceId)
    if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 })

    if (previous && record) {
      logChanges("facturacion", id, previous as any, data as any, TRACKED_FIELDS, workspaceId).catch(() => {})

      if (data.estado && data.estado !== previous.estado) {
        const numero = (record as any).numero ?? id
        notifyAdminsAndEditors(
          data.estado === "pagada" ? "factura_creada" : "factura_vencida",
          `Factura ${numero}: ${data.estado}`,
          `Estado cambiado a "${data.estado}"`,
          `/facturacion/${id}`,
          session?.userId,
          workspaceId
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
    const { workspaceId } = await requireWriteAccess(_request)
    const { id } = await params
    const record = await service.getById(id, workspaceId)
    logActivity({ module: "facturacion", recordId: id, type: "deleted", data: { label: (record as any)?.numero }, workspaceId }).catch(() => {})
    const result = await service.remove(id, workspaceId)
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "Factura")
  }
}
