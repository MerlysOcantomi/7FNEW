import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import {
  convertConversationToRecords,
  createConversationFromInboxEntry,
} from "@modules/inbox/service"
import { logActivity } from "@/lib/activity"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, session } = await requireWriteAccess(request)
    const { id } = await params
    const body = await request.json()
    const { action } = body

    const entry = await db.inboxEntry.findFirst({ where: { id, workspaceId } })
    if (!entry) return errorResponse("NOT_FOUND", "Entrada no encontrada", 404)
    let conversationId = entry.conversationId

    if (!conversationId) {
      const created = await createConversationFromInboxEntry({
        inboxEntryId: entry.id,
        workspaceId,
        nombre: entry.nombre,
        email: entry.email,
        telefono: entry.telefono,
        mensaje: entry.mensaje,
        fuente: entry.fuente,
      })
      conversationId = created.conversation.id
    }

    const results = await convertConversationToRecords({
      workspaceId,
      conversationId,
      action,
      reviewedBy: {
        userId: session.userId,
        userName: session.nombre ?? session.email,
        userEmail: session.email,
      },
    })

    if (results.created.cliente && results.ids.clienteId) {
      await logActivity({
        module: "clientes",
        recordId: results.ids.clienteId as string,
        type: "created",
        data: { label: (results.cliente as { nombre?: string } | undefined)?.nombre ?? "Cliente desde Inbox" },
        workspaceId,
        userId: session.userId,
        userName: session.nombre ?? session.email,
        userEmail: session.email,
      }).catch(() => {})
    }

    if (results.created.proyecto && results.ids.proyectoId) {
      await logActivity({
        module: "proyectos",
        recordId: results.ids.proyectoId as string,
        type: "created",
        data: { label: (results.proyecto as { nombre?: string } | undefined)?.nombre ?? "Proyecto desde Inbox" },
        workspaceId,
        userId: session.userId,
        userName: session.nombre ?? session.email,
        userEmail: session.email,
      }).catch(() => {})
    }

    if (results.created.tarea && results.ids.tareaId) {
      await logActivity({
        module: "tareas",
        recordId: results.ids.tareaId as string,
        type: "created",
        data: { label: (results.tarea as { titulo?: string } | undefined)?.titulo ?? "Tarea desde Inbox" },
        workspaceId,
        userId: session.userId,
        userName: session.nombre ?? session.email,
        userEmail: session.email,
      }).catch(() => {})
    }

    return successResponse({
      cliente: results.cliente ?? null,
      proyecto: results.proyecto ?? null,
      tarea: results.tarea ?? null,
      conversationId,
    })
  } catch (error) {
    return handleError(error, "InboxEntry")
  }
}
