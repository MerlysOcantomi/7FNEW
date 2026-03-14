import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { convertConversationToRecords } from "@/lib/modules/inbox/service"
import { logActivity } from "@/lib/activity"

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, session } = await requireWriteAccess()
    const { id } = await params
    const body = await request.json()
    const { action } = body

    if (!["cliente", "proyecto", "tarea", "todo"].includes(action)) {
      return errorResponse("VALIDATION_ERROR", "Acción inválida")
    }

    const results = await convertConversationToRecords({
      workspaceId,
      conversationId: id,
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
        recordId: results.ids.clienteId,
        type: "created",
        data: { label: (results.cliente as { nombre?: string } | null)?.nombre ?? "Cliente desde Inbox" },
        workspaceId,
        userId: session.userId,
        userName: session.nombre ?? session.email,
        userEmail: session.email,
      }).catch(() => {})
    }

    if (results.created.proyecto && results.ids.proyectoId) {
      await logActivity({
        module: "proyectos",
        recordId: results.ids.proyectoId,
        type: "created",
        data: { label: (results.proyecto as { nombre?: string } | null)?.nombre ?? "Proyecto desde Inbox" },
        workspaceId,
        userId: session.userId,
        userName: session.nombre ?? session.email,
        userEmail: session.email,
      }).catch(() => {})
    }

    if (results.created.tarea && results.ids.tareaId) {
      await logActivity({
        module: "tareas",
        recordId: results.ids.tareaId,
        type: "created",
        data: { label: (results.tarea as { titulo?: string } | null)?.titulo ?? "Tarea desde Inbox" },
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
      conversationId: id,
    })
  } catch (error) {
    return handleError(error, "Conversation")
  }
}
