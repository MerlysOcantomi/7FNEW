import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireReadAccess, requireWriteAccess, requireAdminAccess } from "@/lib/auth/workspace-auth"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { id } = await params
    const entry = await db.inboxEntry.findFirst({ where: { id, workspaceId } })
    if (!entry) return errorResponse("NOT_FOUND", "Entrada no encontrada", 404)

    let parsedEntry = { ...entry } as Record<string, unknown>
    for (const field of ["datosCliente", "datosProyecto", "tags", "aiRaw"] as const) {
      if (entry[field] && typeof entry[field] === "string") {
        try {
          parsedEntry[field] = JSON.parse(entry[field] as string)
        } catch { /* keep string */ }
      }
    }

    return successResponse(parsedEntry)
  } catch (error) {
    return handleError(error, "InboxEntry")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess()
    const { id } = await params
    const existing = await db.inboxEntry.findFirst({ where: { id, workspaceId } })
    if (!existing) return errorResponse("NOT_FOUND", "Entrada no encontrada", 404)

    const body = await request.json()

    const allowedFields = [
      "nombre", "email", "telefono", "tipo", "categoria",
      "urgencia", "intencion", "resumen", "notas", "estado", "tags",
    ]
    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        if (field === "tags" && Array.isArray(body[field])) {
          data[field] = JSON.stringify(body[field])
        } else {
          data[field] = body[field]
        }
      }
    }

    if (body.estado === "archivado") {
      data.archivedAt = new Date()
    }

    const updated = await db.inboxEntry.update({
      where: { id },
      data,
    })

    return successResponse(updated)
  } catch (error) {
    return handleError(error, "InboxEntry")
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireAdminAccess()
    const { id } = await params
    const existing = await db.inboxEntry.findFirst({ where: { id, workspaceId } })
    if (!existing) return errorResponse("NOT_FOUND", "Entrada no encontrada", 404)

    await db.inboxEntry.delete({ where: { id } })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "InboxEntry")
  }
}
