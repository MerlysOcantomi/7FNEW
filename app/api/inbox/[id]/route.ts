import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { getSessionFromCookies } from "@/lib/auth/session"
import { successResponse, errorResponse, handleError } from "@/lib/api"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const session = await getSessionFromCookies()
    if (!session) return errorResponse("UNAUTHORIZED", "No autenticado", 401)

    const { id } = await params
    const entry = await db.inboxEntry.findUnique({ where: { id } })
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
    const session = await getSessionFromCookies()
    if (!session) return errorResponse("UNAUTHORIZED", "No autenticado", 401)
    if (session.role !== "admin" && session.role !== "editor") {
      return errorResponse("FORBIDDEN", "No tienes permisos", 403)
    }

    const { id } = await params
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
    const session = await getSessionFromCookies()
    if (!session) return errorResponse("UNAUTHORIZED", "No autenticado", 401)
    if (session.role !== "admin") {
      return errorResponse("FORBIDDEN", "Solo admin puede eliminar", 403)
    }

    const { id } = await params
    await db.inboxEntry.delete({ where: { id } })

    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "InboxEntry")
  }
}
