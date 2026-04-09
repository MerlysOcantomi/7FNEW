/**
 * DEBUG / TEST ONLY — temporary endpoint to seed a test conversation.
 * Disabled in production via NODE_ENV check.
 */

import { NextRequest } from "next/server"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { successResponse, errorResponse } from "@/lib/api"
import { db } from "@core/db"
import { addMessage } from "@modules/inbox/service"
import { runConversationIntelligence } from "@modules/inbox/intelligence"

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return errorResponse("NOT_FOUND", "Not available", 404)
  }

  try {
    const { workspaceId } = await requireWriteAccess(request)

    const body = await request.json()
    const content =
      typeof body.content === "string" && body.content.trim()
        ? body.content.trim()
        : "Hola, me interesa saber más sobre sus servicios. ¿Podrían enviarme información?"

    const visitorName = typeof body.name === "string" && body.name.trim() ? body.name.trim() : "Test Visitor"
    const visitorEmail = typeof body.email === "string" && body.email.trim() ? body.email.trim() : "test@debug.local"

    const contact = await db.contact.create({
      data: {
        workspaceId,
        nombre: visitorName,
        email: visitorEmail,
        canal: "web_chat",
        tipo: "visitante",
        source: `debug_${Date.now()}`,
      },
    })

    const subject = content.length <= 72 ? content : `${content.slice(0, 69)}...`

    const conversation = await db.conversation.create({
      data: {
        workspaceId,
        contactId: contact.id,
        channel: "web_chat",
        source: "debug",
        status: "new",
        subject,
        isPublic: false,
        lastMessageAt: new Date(),
        messageCount: 0,
      },
    })

    const message = await addMessage({
      workspaceId,
      conversationId: conversation.id,
      role: "visitor",
      content,
      direction: "inbound",
      contentType: "text",
      isInternal: false,
    })

    if (!message) {
      return errorResponse("Could not create test message", "INTERNAL_ERROR", 500)
    }

    runConversationIntelligence({
      workspaceId,
      conversationId: conversation.id,
      trigger: "message_post",
    }).catch(() => null)

    return successResponse({
      conversationId: conversation.id,
      contactId: contact.id,
      messageId: message.id,
      note: "DEBUG — test conversation created. Fanny intelligence running in background.",
    })
  } catch (error) {
    console.error("[7F] Debug create error:", error)
    return errorResponse("Internal error", "INTERNAL_ERROR", 500)
  }
}
