import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"
import { addMessage } from "@modules/inbox/service"
import { sendConversationMessage } from "@modules/inbox/outbound-service"

const TAG = "[inbox/compose]"

/**
 * POST /api/inbox/compose
 *
 * Creates a new outbound conversation and sends the email via Resend.
 * Response returns immediately after persisting; email send is fire-and-forget.
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireWriteAccess(request)
    const body = await request.json()
    const { to, subject, content } = body as {
      to?: string
      subject?: string
      content?: string
    }

    if (!to || typeof to !== "string" || !to.includes("@")) {
      return errorResponse("VALIDATION_ERROR", "Destinatario (to) es requerido y debe ser un email válido")
    }
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "El contenido del mensaje es requerido")
    }

    const toEmail = to.trim().toLowerCase()
    const emailSubject = subject?.trim() || "(Sin asunto)"

    console.log(`${TAG} New compose to=${toEmail} subject="${emailSubject}" workspace=${workspaceId}`)

    const contact = await resolveOrCreateContact(workspaceId, toEmail)

    /** Default email connection; sender resolution lives in the EmailTransport now. */
    const defaultConn = await db.channelConnection.findFirst({
      where: { workspaceId, channelType: "email", status: "active" },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true },
    })

    const conversation = await db.conversation.create({
      data: {
        workspaceId,
        contactId: contact.id,
        channel: "email",
        source: "outbound",
        status: "active",
        subject: emailSubject,
        lastMessageAt: new Date(),
        messageCount: 0,
        connectionId: defaultConn?.id ?? null,
      },
    })

    const message = await addMessage({
      workspaceId,
      conversationId: conversation.id,
      role: "operator",
      content: content.trim(),
      direction: "outbound",
      contentType: "text",
      metadata: { emailStatus: "pending", subject: emailSubject },
      connectionId: defaultConn?.id ?? null,
    })

    if (!message) {
      return errorResponse("INTERNAL_ERROR", "No se pudo crear el mensaje", 500)
    }

    console.log(`${TAG} Created conv=${conversation.id} msg=${message.id} contact=${contact.id}`)

    /**
     * INBOX-TRANSPORT-05C: sends now flow through the common outbound
     * service (transport resolution + delivery projection + metadata
     * dual-write). Fire-and-forget, same as before.
     */
    void sendConversationMessage({
      workspaceId,
      conversationId: conversation.id,
      messageId: message.id,
      content: content.trim(),
      mode: "reply",
    }).catch((err) => {
      console.error(`${TAG} Background send failed conv=${conversation.id}:`, err)
    })

    return successResponse({
      conversationId: conversation.id,
      messageId: message.id,
      contactId: contact.id,
      emailStatus: "pending",
    })
  } catch (error) {
    return handleError(error, "InboxCompose")
  }
}

async function resolveOrCreateContact(workspaceId: string, email: string) {
  const existing = await db.contact.findFirst({
    where: { workspaceId, email },
    orderBy: { updatedAt: "desc" },
  })

  if (existing) {
    return db.contact.update({
      where: { id: existing.id },
      data: { lastSeenAt: new Date() },
    })
  }

  return db.contact.create({
    data: {
      workspaceId,
      email,
      canal: "email",
      tipo: "visitante",
    },
  })
}
