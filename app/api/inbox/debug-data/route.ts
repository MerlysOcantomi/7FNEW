/**
 * DIAGNÓSTICO TEMPORAL - Ver exactamente qué datos hay en el inbox
 */

import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { requireReadAccess } from "@/lib/auth/workspace-auth"
import { listConversations } from "@modules/inbox/service"

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return errorResponse("NOT_FOUND", "Not available", 404)
  }

  try {
    const { workspaceId } = await requireReadAccess(request)
    
    // Obtener todas las conversaciones como lo hace la UI
    const { data: conversations } = await listConversations({
      workspaceId,
      skip: 0,
      take: 50,
    })

    // Mapear exactamente como en la UI actual
    const allMessages = conversations.flatMap((conversation) => 
      (conversation.messages || [])
        .filter(message => message.content && message.content.trim().length > 0)
        .map((message) => ({
          conversationId: conversation.id,
          messageId: message.id,
          messageContent: message.content,
          messageDirection: message.direction,
          messageIsInternal: message.isInternal,
          conversationSummary: conversation.summary,
          classificationSummary: conversation.classification?.summary,
          contactName: conversation.contact.nombre,
          contactEmail: conversation.contact.email,
          conversationSource: conversation.source,
        }))
    )

    // También obtener conversaciones con posibles summaries problemáticos
    const conversationsWithSummaries = conversations.map(conv => ({
      id: conv.id,
      summary: conv.summary,
      classificationSummary: conv.classification?.summary,
      source: conv.source,
      contactEmail: conv.contact.email,
      contactName: conv.contact.nombre,
      messagesCount: conv.messages?.length || 0,
      firstMessagePreview: conv.messages?.[0]?.content?.slice(0, 100),
    }))

    return successResponse({
      totalConversations: conversations.length,
      totalMessages: allMessages.length,
      allMessages,
      conversationsWithSummaries,
      debugNote: "Revisa 'allMessages' para ver exactamente qué texto se está mostrando"
    })

  } catch (error) {
    console.error("[DEBUG-DATA] Error:", error)
    return errorResponse("Error en diagnóstico", "INTERNAL_ERROR", 500)
  }
}