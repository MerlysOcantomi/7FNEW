import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"
import {
  getConversationById,
  parseConversationJsonFields,
  transitionConversation,
} from "@modules/inbox/service"
import { notifyConversationAssigned } from "@core/notifications/inbox"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireReadAccess(_request)
    const { id } = await params
    const conversation = await getConversationById(id, workspaceId)
    if (!conversation) return errorResponse("NOT_FOUND", "Conversación no encontrada", 404)
    return successResponse(parseConversationJsonFields(conversation))
  } catch (error) {
    return handleError(error, "Conversation")
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess(request)
    const { id } = await params
    const existing = await db.conversation.findFirst({ where: { id, workspaceId } })
    if (!existing) return errorResponse("NOT_FOUND", "Conversación no encontrada", 404)

    // Delete related records in order
    await db.message.deleteMany({ where: { conversationId: id } })
    await db.conversationClassification.deleteMany({ where: { conversationId: id } })
    await db.conversationHandoff.deleteMany({ where: { conversationId: id } })
    await db.conversationDraft.deleteMany({ where: { conversationId: id } })
    await db.conversationAction.deleteMany({ where: { conversationId: id } })
    await db.conversation.delete({ where: { id } })

    return successResponse({ deleted: true, id })
  } catch (error) {
    return handleError(error, "Conversation")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess(request)
    const { id } = await params
    const existing = await db.conversation.findFirst({ where: { id, workspaceId } })
    if (!existing) return errorResponse("NOT_FOUND", "Conversación no encontrada", 404)

    const body = await request.json()
    const allowedFields = [
      "status",
      "subject",
      "summary",
      "intent",
      "sector",
      "leadScore",
      "urgency",
      "sentiment",
      "assignedTo",
      "clienteId",
      "proyectoId",
      "closedAt",
    ] as const

    const data: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        data[field] = body[field]
      }
    }

    const requestedStatus = typeof body.status === "string" ? body.status : null
    let updated
    try {
      updated = await transitionConversation({
        workspaceId,
        conversationId: id,
        requestedStatus,
        data,
      })
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Transición inválida")) {
        return errorResponse("VALIDATION_ERROR", error.message)
      }
      throw error
    }

    if (!updated) return errorResponse("NOT_FOUND", "Conversación no encontrada", 404)

    const newAssignedTo = typeof body.assignedTo === "string" ? body.assignedTo.trim() : null
    if (newAssignedTo && newAssignedTo !== existing.assignedTo) {
      void notifyConversationAssigned({
        workspaceId,
        conversationId: id,
        subject: updated.subject,
        assignedTo: newAssignedTo,
      }).catch(() => null)
    }

    return successResponse(parseConversationJsonFields(updated))
  } catch (error) {
    return handleError(error, "Conversation")
  }
}
