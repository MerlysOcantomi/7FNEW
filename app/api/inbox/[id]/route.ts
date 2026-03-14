import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireReadAccess, requireWriteAccess, requireAdminAccess } from "@/lib/auth/workspace-auth"
import { parseConversationJsonFields, transitionConversation } from "@/lib/modules/inbox/service"
import { normalizeLegacyInboxStatus } from "@/lib/modules/inbox/state"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { id } = await params
    const entry = await db.inboxEntry.findFirst({
      where: { id, workspaceId },
      include: {
        contact: true,
        conversation: {
          include: {
            contact: true,
            classification: true,
            messages: { orderBy: { createdAt: "asc" } },
            actions: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    })
    if (!entry) return errorResponse("NOT_FOUND", "Entrada no encontrada", 404)

    let parsedEntry = { ...entry } as Record<string, unknown>
    for (const field of ["datosCliente", "datosProyecto", "tags", "aiRaw"] as const) {
      if (entry[field] && typeof entry[field] === "string") {
        try {
          parsedEntry[field] = JSON.parse(entry[field] as string)
        } catch { /* keep string */ }
      }
    }

    if (entry.conversation) {
      parsedEntry.conversation = parseConversationJsonFields(entry.conversation as Record<string, unknown>)
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

    const normalizedConversationStatus =
      typeof body.estado === "string" ? normalizeLegacyInboxStatus(body.estado) : null

    if (existing.conversationId && normalizedConversationStatus) {
      await transitionConversation({
        workspaceId,
        conversationId: existing.conversationId,
        requestedStatus: normalizedConversationStatus,
      }).catch(() => null)
    }

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
