import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"
import { sendOutboundEmail, type ConnectionSender } from "@modules/inbox/email-outbound"

type Params = { params: Promise<{ id: string; messageId: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { workspaceId } = await requireWriteAccess(request)
    const { id, messageId } = await params

    const message = await db.message.findFirst({
      where: { id: messageId, conversationId: id, workspaceId },
    })

    if (!message) {
      return errorResponse("NOT_FOUND", "Message not found", 404)
    }

    let meta: Record<string, unknown> = {}
    try {
      meta = message.metadata ? JSON.parse(message.metadata) : {}
    } catch { /* use empty */ }

    if (meta.emailStatus !== "failed") {
      return errorResponse("VALIDATION_ERROR", `Cannot retry: emailStatus is "${meta.emailStatus ?? "none"}"`)
    }

    const conv = await db.conversation.findFirst({
      where: { id, workspaceId },
      select: {
        channel: true,
        subject: true,
        connectionId: true,
        contact: { select: { email: true } },
        workspace: { select: { nombre: true, config: true } },
      },
    })

    if (!conv || conv.channel !== "email") {
      return errorResponse("VALIDATION_ERROR", "Conversation is not an email channel")
    }

    const contactEmail = conv.contact?.email?.trim()
    if (!contactEmail) {
      return errorResponse("VALIDATION_ERROR", "No contact email available")
    }

    let connectionSender: ConnectionSender | null = null
    if (conv.connectionId) {
      /**
       * Workspace-scoped lookup — same defense-in-depth as the initial send path. Retry
       * runs out of band of the original send and may fire long after a connection has
       * been re-keyed, deleted, or migrated. A `findUnique({ id })` could resurrect a
       * stale or foreign credentials row; the compound `{ id, workspaceId }` filter
       * guarantees we only ever resend through this tenant's own connection.
       */
      const conn = await db.channelConnection.findFirst({
        where: { id: conv.connectionId, workspaceId },
        select: { provider: true, config: true, credentials: true, externalAccountId: true },
      })
      if (conn) {
        const cfg = conn.config ? JSON.parse(conn.config) as Record<string, string> : null
        const fromEmail = cfg?.fromEmail || conn.externalAccountId || ""
        if (fromEmail) {
          connectionSender = {
            fromEmail,
            fromName: cfg?.fromName || null,
            provider: conn.provider as "resend" | "imap_smtp",
          }
          if (conn.provider === "imap_smtp" && conn.credentials && cfg) {
            connectionSender.smtpConfig = {
              smtpHost: cfg.smtpHost || "",
              smtpPort: Number(cfg.smtpPort) || 465,
              smtpSecure: cfg.smtpSecure !== "false",
              fromEmail,
              fromName: cfg.fromName || null,
            }
            connectionSender.encryptedCredentials = conn.credentials
          }
        }
      }
    }

    const fromAddress = connectionSender?.fromEmail
      || process.env.INBOX_FROM_EMAIL
      || process.env.RESEND_FROM_EMAIL
      || undefined

    const mode = (meta.mode as "reply" | "reply_all" | "forward") ?? "reply"
    const cc = Array.isArray(meta.cc) ? meta.cc as string[] : []
    const bcc = Array.isArray(meta.bcc) ? meta.bcc as string[] : []
    const to = Array.isArray(meta.to) ? meta.to as string[] : []
    const attachments = Array.isArray(meta.attachments) ? meta.attachments as Array<{ filename: string; url: string; contentType: string }> : []

    console.log(`[email-retry] Retrying msg=${messageId} conv=${id} to=${contactEmail} from=${fromAddress}`)

    const result = await sendOutboundEmail({
      workspaceName: conv.workspace.nombre,
      contactEmail,
      subject: conv.subject ?? "",
      messageContent: message.content,
      workspaceConfig: conv.workspace.config,
      mode,
      connectionSender,
      ...(cc.length > 0 ? { cc } : {}),
      ...(bcc.length > 0 ? { bcc } : {}),
      ...(to.length > 0 ? { to } : {}),
      ...(attachments.length > 0 ? { attachments } : {}),
    })

    const newStatus = result.ok ? "sent" : "failed"

    await db.message.update({
      where: { id: messageId },
      data: {
        metadata: JSON.stringify({
          ...meta,
          emailStatus: newStatus,
          ...(result.id ? { resendId: result.id } : {}),
          ...(result.ok ? { emailError: undefined } : { emailError: result.error }),
          ...(fromAddress ? { fromAddress } : {}),
          emailRetryAt: new Date().toISOString(),
        }),
      },
    })

    if (result.ok) {
      console.log(`[email-retry] OK msg=${messageId} resendId=${result.id}`)
    } else {
      console.error(`[email-retry] FAILED msg=${messageId}: ${result.error}`)
    }

    return successResponse({
      emailStatus: newStatus,
      emailSent: result.ok,
      emailError: result.error ?? null,
      resendId: result.id ?? null,
    })
  } catch (error) {
    return handleError(error, "EmailRetry")
  }
}
