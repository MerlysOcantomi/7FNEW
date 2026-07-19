import { NextRequest, NextResponse } from "next/server"
import { db } from "@core/db"
import { addMessage } from "@modules/inbox/service"
import { runConversationIntelligence } from "@modules/inbox/intelligence"
import { sendAcknowledgmentEmail } from "@modules/inbox/email-outbound"
import { notifyNewConversation, notifyInboundMessage } from "@core/notifications/inbox"
import { buildIdentityDescriptor } from "@modules/inbox/identity-resolution"
import { recordInboundIdentity } from "@modules/inbox/identity-service"

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
}

function corsJson(body: unknown, init?: { status?: number }) {
  return NextResponse.json(body, { status: init?.status ?? 200, headers: CORS_HEADERS })
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { siteKey, visitorId, conversationId, content, visitorName, visitorEmail } = body

    if (!siteKey || typeof siteKey !== "string") {
      return corsJson({ success: false, error: { code: "VALIDATION_ERROR", message: "siteKey is required" } }, { status: 400 })
    }
    if (!visitorId || typeof visitorId !== "string") {
      return corsJson({ success: false, error: { code: "VALIDATION_ERROR", message: "visitorId is required" } }, { status: 400 })
    }
    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return corsJson({ success: false, error: { code: "VALIDATION_ERROR", message: "content is required" } }, { status: 400 })
    }

    const workspace = await db.workspace.findUnique({ where: { slug: siteKey } })
    if (!workspace) {
      return corsJson({ success: false, error: { code: "NOT_FOUND", message: "Invalid site key" } }, { status: 404 })
    }

    let targetConversationId = typeof conversationId === "string" ? conversationId : null
    let isNewConversation = false
    let ackEmail: string | null = null
    let ackName: string | null = null
    let ackSubject: string | null = null

    if (targetConversationId) {
      const existing = await db.conversation.findFirst({
        where: {
          id: targetConversationId,
          workspaceId: workspace.id,
          channel: "web_chat",
          contact: { source: visitorId },
        },
      })
      if (!existing) {
        targetConversationId = null
      }
    }

    if (!targetConversationId) {
      let contact = await db.contact.findFirst({
        where: { workspaceId: workspace.id, source: visitorId, canal: "web_chat" },
      })

      if (!contact) {
        contact = await db.contact.create({
          data: {
            workspaceId: workspace.id,
            source: visitorId,
            canal: "web_chat",
            tipo: "visitante",
            nombre: typeof visitorName === "string" && visitorName.trim() ? visitorName.trim() : null,
            email: typeof visitorEmail === "string" && visitorEmail.trim() ? visitorEmail.trim().toLowerCase() : null,
          },
        })
      } else {
        const updates: Record<string, unknown> = { lastSeenAt: new Date() }
        if (typeof visitorName === "string" && visitorName.trim() && !contact.nombre) {
          updates.nombre = visitorName.trim()
        }
        if (typeof visitorEmail === "string" && visitorEmail.trim() && !contact.email) {
          updates.email = visitorEmail.trim().toLowerCase()
        }
        contact = await db.contact.update({ where: { id: contact.id }, data: updates })
      }

      const activeConversation = await db.conversation.findFirst({
        where: {
          workspaceId: workspace.id,
          contactId: contact.id,
          channel: "web_chat",
          status: { notIn: ["archived"] },
        },
        orderBy: { lastMessageAt: "desc" },
      })

      if (activeConversation) {
        targetConversationId = activeConversation.id
      } else {
        const trimmed = content.trim()
        const subject = trimmed.length <= 72 ? trimmed : `${trimmed.slice(0, 69)}...`

        const conversation = await db.conversation.create({
          data: {
            workspaceId: workspace.id,
            contactId: contact.id,
            channel: "web_chat",
            source: "web",
            status: "new",
            subject,
            isPublic: true,
            lastMessageAt: new Date(),
            messageCount: 0,
          },
        })
        targetConversationId = conversation.id
        isNewConversation = true
        ackEmail = contact.email ?? null
        ackName = contact.nombre ?? null
        ackSubject = subject
      }
    }

    const message = await addMessage({
      workspaceId: workspace.id,
      conversationId: targetConversationId,
      role: "visitor",
      content: content.trim(),
      direction: "inbound",
      contentType: "text",
      isInternal: false,
    })

    if (!message) {
      return corsJson({ success: false, error: { code: "INTERNAL_ERROR", message: "Could not create message" } }, { status: 500 })
    }

    /**
     * Dual-write (INBOX-DATA-04B): web-chat visitor identity + association
     * evidence for the conversation's contact. Best-effort — never blocks
     * the public send path.
     *
     * INBOX-TRANSPORT-05B note: this route intentionally KEEPS its own flow
     * instead of converting to `ingestInboundEnvelope` in this phase. The
     * blocker is behavioural, not structural: the widget contract couples
     * conversation reuse to `conversationId` round-tripping + CORS + the ack
     * email, and converting it risks the public embed for zero user-visible
     * gain. The exact future adapter: envelope { channel: "web_chat",
     * provider: "web", externalMessageId: <generated per POST>,
     * senderIdentity: { kind: "visitor", rawValue: visitorId } } with a
     * resolveContact hook wrapping the visitor-contact reuse below and an
     * afterPersist hook for the ack email. Identity resolution is ALREADY
     * shared (recordInboundIdentity below) — nothing is duplicated.
     */
    void (async () => {
      const descriptor = buildIdentityDescriptor({
        channel: "web_chat",
        kind: "visitor",
        rawValue: visitorId,
      })
      if (!descriptor) return
      const conv = await db.conversation.findFirst({
        where: { id: targetConversationId as string, workspaceId: workspace.id },
        select: { contactId: true },
      })
      await recordInboundIdentity({
        workspaceId: workspace.id,
        descriptor,
        displayValue:
          typeof visitorName === "string" && visitorName.trim() ? visitorName.trim() : null,
        contactId: conv?.contactId ?? null,
      })
    })().catch((err) => console.error("[public-send] identity dual-write failed:", err))

    if (isNewConversation) {
      void notifyNewConversation({
        workspaceId: workspace.id,
        conversationId: targetConversationId,
        subject: ackSubject,
        contactName: ackName,
        channel: "web_chat",
      }).catch(() => null)

      if (ackEmail) {
        void sendAcknowledgmentEmail({
          workspaceName: workspace.nombre,
          contactEmail: ackEmail,
          contactName: ackName,
          conversationSubject: ackSubject ?? "",
          workspaceConfig: workspace.config,
          workspaceId: workspace.id,
          conversationId: targetConversationId,
        }).catch(() => null)
      }
    } else {
      void db.conversation
        .findFirst({
          where: { id: targetConversationId, workspaceId: workspace.id },
          select: { assignedTo: true, subject: true, contact: { select: { nombre: true } } },
        })
        .then((conv) => {
          if (!conv) return
          return notifyInboundMessage({
            workspaceId: workspace.id,
            conversationId: targetConversationId,
            subject: conv.subject,
            contactName: conv.contact?.nombre,
            channel: "web_chat",
            assignedTo: conv.assignedTo,
          })
        })
        .catch(() => null)
    }

    runConversationIntelligence({
      workspaceId: workspace.id,
      conversationId: targetConversationId,
      trigger: "message_post",
    }).catch((err) => {
      console.error(`[public-chat] Intelligence failed conv=${targetConversationId}:`, err)
    })

    return corsJson({
      success: true,
      data: { conversationId: targetConversationId, messageId: message.id },
    })
  } catch (error) {
    console.error("[7F] Public chat send error:", error)
    return corsJson({ success: false, error: { code: "INTERNAL_ERROR", message: "Internal error" } }, { status: 500 })
  }
}
