import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"
import { addMessage } from "@modules/inbox/service"
import { sendOutboundEmail, type ConnectionSender } from "@modules/inbox/email-outbound"
import { recordOutboundSendResult } from "@modules/inbox/delivery-service"

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

    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
      select: { nombre: true, config: true },
    })

    const defaultConn = await db.channelConnection.findFirst({
      where: { workspaceId, channelType: "email", status: "active" },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, provider: true, config: true, credentials: true, externalAccountId: true },
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

    void sendComposeEmail({
      workspaceId,
      conversationId: conversation.id,
      messageId: message.id,
      toEmail,
      subject: emailSubject,
      messageContent: content.trim(),
      workspaceName: workspace?.nombre ?? "Business",
      workspaceConfig: workspace?.config ?? null,
      connection: defaultConn,
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

interface SendComposeInput {
  workspaceId: string
  conversationId: string
  messageId: string
  toEmail: string
  subject: string
  messageContent: string
  workspaceName: string
  workspaceConfig: string | null
  connection: {
    id: string
    provider: string
    config: string | null
    credentials: string | null
    externalAccountId: string | null
  } | null
}

async function sendComposeEmail(input: SendComposeInput) {
  let connectionSender: ConnectionSender | null = null

  if (input.connection) {
    const conn = input.connection
    const cfg = conn.config ? JSON.parse(conn.config) as Record<string, string> : null
    const fromEmail = cfg?.fromEmail || conn.externalAccountId || ""
    if (fromEmail) {
      connectionSender = {
        fromEmail,
        fromName: cfg?.fromName || null,
        provider: conn.provider as "resend" | "imap_smtp",
      }
    }
  }

  const fromAddress = connectionSender?.fromEmail
    || process.env.INBOX_FROM_EMAIL
    || process.env.RESEND_FROM_EMAIL
    || undefined

  let emailStatus = "pending"
  let emailError: string | undefined
  let resendId: string | undefined

  try {
    const result = await sendOutboundEmail({
      workspaceName: input.workspaceName,
      contactEmail: input.toEmail,
      subject: input.subject,
      messageContent: input.messageContent,
      workspaceConfig: input.workspaceConfig,
      mode: "reply",
      connectionSender,
    })

    if (result.ok) {
      emailStatus = "sent"
      resendId = result.id
      console.log(`${TAG} OK conv=${input.conversationId} msg=${input.messageId} to=${input.toEmail} resendId=${result.id}`)
    } else {
      emailStatus = "failed"
      emailError = result.error || "Email delivery failed"
      console.error(`${TAG} FAILED conv=${input.conversationId} msg=${input.messageId}: ${emailError}`)
    }
  } catch (err) {
    emailStatus = "failed"
    emailError = err instanceof Error ? err.message : "Email service unavailable"
    console.error(`${TAG} EXCEPTION conv=${input.conversationId} msg=${input.messageId}: ${emailError}`)
  }

  try {
    await db.message.update({
      where: { id: input.messageId },
      data: {
        metadata: JSON.stringify({
          emailStatus,
          subject: input.subject,
          ...(resendId ? { resendId } : {}),
          ...(emailError ? { emailError } : {}),
          ...(fromAddress ? { fromAddress } : {}),
          emailAttemptedAt: new Date().toISOString(),
        }),
      },
    })
  } catch (metaErr) {
    console.error(`${TAG} Could not update metadata msg=${input.messageId}:`, metaErr)
  }

  /** Dual-write (INBOX-DATA-04B): normalized delivery projection + provider id. */
  try {
    await recordOutboundSendResult({
      messageId: input.messageId,
      ok: emailStatus === "sent",
      providerMessageId: resendId,
      failureCode: "email_send_failed",
    })
  } catch (projErr) {
    console.error(`${TAG} Could not project delivery msg=${input.messageId}:`, projErr)
  }
}
