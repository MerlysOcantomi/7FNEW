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
import { getWorkspaceWithResolvedConfig } from "@core/workspace"

type Params = { params: Promise<{ id: string }> }

const INBOX_DETAIL_DEBUG =
  process.env.NODE_ENV === "development" || process.env.INBOX_DEBUG_INBOX_LIST === "1"

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params
  try {
    const { workspaceId, session, workspaceResolveSource } = await requireReadAccess(_request)
    const conversation = await getConversationById(id, workspaceId)
    if (!conversation) {
      if (INBOX_DETAIL_DEBUG) {
        console.warn("[inbox:debug:detail]", {
          conversationId: id,
          userId: session.userId,
          workspaceId,
          workspaceResolveSource,
          result: "NOT_FOUND",
        })
      }
      return errorResponse("NOT_FOUND", "Conversación no encontrada", 404)
    }
    const parsed = parseConversationJsonFields(conversation)
    if (INBOX_DETAIL_DEBUG) {
      const messages = parsed.messages as unknown[] | undefined
      console.log("[inbox:debug:detail]", {
        conversationId: id,
        userId: session.userId,
        workspaceId,
        workspaceResolveSource,
        status: (parsed as { status?: string }).status,
        messageCount: Array.isArray(messages) ? messages.length : 0,
        result: "ok",
      })
    }
    return successResponse(parsed)
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[inbox:audit:detail]", {
        conversationId: id,
        phase: "catch",
        message: error instanceof Error ? error.message : String(error),
      })
    }
    return handleError(error, "Conversation")
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess(request)
    const { id } = await params
    const existing = await db.conversation.findFirst({ where: { id, workspaceId } })
    if (!existing) return errorResponse("NOT_FOUND", "Conversation not found", 404)

    // Delete ALL related records explicitly to avoid FK constraint errors
    await db.$transaction(async (tx) => {
      await tx.conversationRead.deleteMany({ where: { conversationId: id } })
      await tx.message.deleteMany({ where: { conversationId: id } })
      await tx.conversationAction.deleteMany({ where: { conversationId: id } })
      await tx.conversationDraft.deleteMany({ where: { conversationId: id } })
      await tx.aIClassification.deleteMany({ where: { conversationId: id } })
      await tx.conversationHandoff.deleteMany({ where: { conversationId: id } })
      await tx.inboxEntry.updateMany({ where: { conversationId: id }, data: { conversationId: null } })
      await tx.conversation.delete({ where: { id } })
    })

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
    if (!existing) return errorResponse("NOT_FOUND", "Conversation not found", 404)

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
