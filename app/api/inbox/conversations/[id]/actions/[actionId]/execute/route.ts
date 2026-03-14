import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { logActivity } from "@/lib/activity"
import { executeConversationAction, parseConversationJsonFields } from "@/lib/modules/inbox/service"

type Params = { params: Promise<{ id: string; actionId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId, session } = await requireWriteAccess()
    const { id, actionId } = await params
    const body = await request.json().catch(() => ({}))

    const result = await executeConversationAction({
      workspaceId,
      conversationId: id,
      actionId,
      executedBy: {
        userId: session.userId,
        userName: session.nombre ?? session.email,
        userEmail: session.email,
      },
      payload: body,
    })

    if (!result) return errorResponse("NOT_FOUND", "Acción no encontrada", 404)

    const action = result.action
    if (!action) return errorResponse("NOT_FOUND", "Acción no encontrada", 404)

    const conversionResults = result.results as {
      created?: { cliente?: boolean; proyecto?: boolean; tarea?: boolean }
      ids?: { clienteId?: string | null; proyectoId?: string | null; tareaId?: string | null }
      cliente?: { nombre?: string } | null
      proyecto?: { nombre?: string } | null
      tarea?: { titulo?: string } | null
    }

    if (conversionResults.created?.cliente && conversionResults.ids?.clienteId) {
      await logActivity({
        module: "clientes",
        recordId: conversionResults.ids.clienteId,
        type: "created",
        data: { label: conversionResults.cliente?.nombre ?? "Cliente desde Inbox" },
        workspaceId,
        userId: session.userId,
        userName: session.nombre ?? session.email,
        userEmail: session.email,
      }).catch(() => {})
    }

    if (conversionResults.created?.proyecto && conversionResults.ids?.proyectoId) {
      await logActivity({
        module: "proyectos",
        recordId: conversionResults.ids.proyectoId,
        type: "created",
        data: { label: conversionResults.proyecto?.nombre ?? "Proyecto desde Inbox" },
        workspaceId,
        userId: session.userId,
        userName: session.nombre ?? session.email,
        userEmail: session.email,
      }).catch(() => {})
    }

    if (conversionResults.created?.tarea && conversionResults.ids?.tareaId) {
      await logActivity({
        module: "tareas",
        recordId: conversionResults.ids.tareaId,
        type: "created",
        data: { label: conversionResults.tarea?.titulo ?? "Tarea desde Inbox" },
        workspaceId,
        userId: session.userId,
        userName: session.nombre ?? session.email,
        userEmail: session.email,
      }).catch(() => {})
    }

    return successResponse({
      action: parseConversationJsonFields({ actions: [action] }).actions?.[0] ?? action,
      results: result.results,
    })
  } catch (error) {
    if (error instanceof Error) {
      return errorResponse("VALIDATION_ERROR", error.message)
    }
    return handleError(error, "ConversationAction")
  }
}
