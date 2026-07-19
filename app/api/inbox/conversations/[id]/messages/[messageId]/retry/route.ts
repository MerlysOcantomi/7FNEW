import { NextRequest } from "next/server"
import { errorResponse, handleError, successResponse } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"
import { sendConversationMessage } from "@modules/inbox/outbound-service"

type Params = { params: Promise<{ id: string; messageId: string }> }

/**
 * Retry a failed outbound message (INBOX-TRANSPORT-05C: same transport and
 * contract as the original send — no duplicated send logic). The common
 * outbound service resolves channel capability + connection + transport,
 * projects the result monotonically (a successful re-send supersedes the
 * previous failure; a repeat failure stays failed), records the NEW external
 * message id when the provider assigns one, and stamps the legacy
 * `emailRetryAt` attempt metadata.
 */
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

    /**
     * Retry gate: the normalized projection wins when present (04B read
     * path), with the legacy metadata key as historical fallback. Permanent
     * failure codes are not retryable — surface that instead of re-sending.
     */
    const failedByColumn = ["failed", "undeliverable", "cancelled"].includes(message.deliveryStatus)
    const failedByMeta = meta.emailStatus === "failed"
    if (!failedByColumn && !failedByMeta) {
      return errorResponse("VALIDATION_ERROR", `Cannot retry: emailStatus is "${meta.emailStatus ?? message.deliveryStatus ?? "none"}"`)
    }
    if (message.deliveryStatus === "undeliverable" || message.deliveryStatus === "cancelled") {
      return errorResponse("VALIDATION_ERROR", `Cannot retry a ${message.deliveryStatus} message`)
    }

    const mode = (meta.mode as "reply" | "reply_all" | "forward") ?? "reply"
    const cc = Array.isArray(meta.cc) ? (meta.cc as string[]) : []
    const bcc = Array.isArray(meta.bcc) ? (meta.bcc as string[]) : []
    const to = Array.isArray(meta.to) ? (meta.to as string[]) : []
    const attachments = Array.isArray(meta.attachments)
      ? (meta.attachments as Array<{ filename: string; url: string; contentType: string }>)
      : []

    console.log(`[email-retry] Retrying msg=${messageId} conv=${id} via outbound service`)

    const outcome = await sendConversationMessage({
      workspaceId,
      conversationId: id,
      messageId,
      content: message.content,
      mode,
      cc,
      bcc,
      to,
      attachments,
      isRetry: true,
    })

    if (outcome.status === "skipped") {
      // Channel/transport/recipient preconditions failed — actionable error,
      // mirrors the legacy VALIDATION_ERROR responses.
      const detail =
        outcome.errorCode === "missing_recipient"
          ? "No contact address available"
          : outcome.errorCode === "channel_not_outbound"
            ? "This conversation's channel does not support outbound messages"
            : outcome.errorCode === "transport_not_registered"
              ? "No transport is integrated for this channel yet"
              : "Conversation is not sendable"
      return errorResponse("VALIDATION_ERROR", detail)
    }

    return successResponse({
      emailStatus: outcome.status,
      emailSent: outcome.status === "sent",
      emailError: outcome.errorMessage ?? null,
      resendId: outcome.externalMessageId ?? null,
    })
  } catch (error) {
    return handleError(error, "EmailRetry")
  }
}
