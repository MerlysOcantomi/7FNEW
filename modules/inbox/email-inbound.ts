import { db } from "@core/db"
import { addMessage } from "./service"
import { runConversationIntelligence } from "./intelligence"
import { notifyInboundMessage } from "@core/notifications/inbox"
import { logActivity } from "@core/activity"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReceivedEmail {
  id: string
  from: string
  to: string[]
  subject: string | null
  text: string | null
  html: string | null
  headers: Record<string, string>
  message_id: string
  created_at: string
}

interface InboundEmailResult {
  conversationId: string
  messageId: string
  contactId: string
  isNewConversation: boolean
  alreadyProcessed?: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/)
  return (match ? match[1] : raw).trim().toLowerCase()
}

function extractDisplayName(raw: string): string | null {
  const match = raw.match(/^(.+?)\s*</)
  return match ? match[1].replace(/^"|"$/g, "").trim() || null : null
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim()
}

// ---------------------------------------------------------------------------
// Resend API — fetch full received email
// ---------------------------------------------------------------------------

async function fetchReceivedEmail(resendEmailId: string): Promise<ReceivedEmail> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error("RESEND_API_KEY not configured")

  const res = await fetch(`https://api.resend.com/emails/receiving/${resendEmailId}`, {
    headers: { Authorization: `Bearer ${apiKey}` },
  })

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)")
    throw new Error(`Resend API ${res.status}: ${text}`)
  }

  return res.json() as Promise<ReceivedEmail>
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

export async function processInboundEmail(resendEmailId: string): Promise<InboundEmailResult> {
  // ---- dedup: check if this email was already ingested ----
  const duplicate = await db.message.findFirst({
    where: { direction: "inbound", metadata: { contains: resendEmailId } },
    select: { id: true, conversationId: true },
  })

  if (duplicate) {
    return {
      conversationId: duplicate.conversationId,
      messageId: duplicate.id,
      contactId: "",
      isNewConversation: false,
      alreadyProcessed: true,
    }
  }

  // ---- 1. Fetch full email ----
  const email = await fetchReceivedEmail(resendEmailId)

  const senderEmail = extractEmailAddress(email.from)
  const senderName = extractDisplayName(email.from)
  const subject = email.subject || "(No subject)"
  const content = email.text || stripHtml(email.html || "") || "(empty email)"

  // ---- 2. Resolve contact & workspace ----
  const existingContact = await db.contact.findFirst({
    where: { email: senderEmail },
    orderBy: { lastSeenAt: "desc" },
  })

  let workspaceId: string
  let contactId: string

  if (existingContact) {
    workspaceId = existingContact.workspaceId
    contactId = existingContact.id
    await db.contact.update({
      where: { id: contactId },
      data: { lastSeenAt: new Date() },
    })
  } else {
    const defaultWsId = process.env.DEFAULT_WORKSPACE_ID
    const workspace = defaultWsId
      ? await db.workspace.findUnique({ where: { id: defaultWsId } })
      : await db.workspace.findFirst({ orderBy: { createdAt: "asc" } })

    if (!workspace) throw new Error("No workspace available for inbound email")
    workspaceId = workspace.id

    const contact = await db.contact.create({
      data: {
        workspaceId,
        email: senderEmail,
        nombre: senderName,
        canal: "email",
        tipo: "visitante",
      },
    })
    contactId = contact.id
  }

  // ---- 3. Match conversation ----
  const REOPEN_WINDOW_MS = 1000 * 60 * 60 * 48

  const activeConv = await db.conversation.findFirst({
    where: {
      workspaceId,
      contactId,
      channel: "email",
      status: { notIn: ["closed", "archived"] },
    },
    orderBy: { lastMessageAt: "desc" },
  })

  const closedConv = !activeConv
    ? await db.conversation.findFirst({
        where: {
          workspaceId,
          contactId,
          channel: "email",
          status: { in: ["closed", "archived"] },
          lastMessageAt: { gte: new Date(Date.now() - REOPEN_WINDOW_MS) },
        },
        orderBy: { lastMessageAt: "desc" },
      })
    : null

  let conversationId: string
  let isNewConversation = false

  if (activeConv) {
    conversationId = activeConv.id
  } else if (closedConv) {
    conversationId = closedConv.id
    await db.conversation.update({
      where: { id: conversationId },
      data: { status: "new", closedAt: null },
    })
  } else {
    const conv = await db.conversation.create({
      data: {
        workspaceId,
        contactId,
        channel: "email",
        source: "email",
        status: "new",
        subject,
        isPublic: true,
        lastMessageAt: new Date(),
        messageCount: 0,
      },
    })
    conversationId = conv.id
    isNewConversation = true
  }

  // ---- 4. Create inbound message ----
  const message = await addMessage({
    workspaceId,
    conversationId,
    role: "visitor",
    direction: "inbound",
    content,
    contentType: "text",
    metadata: {
      resendEmailId: email.id,
      emailMessageId: email.message_id,
      emailFrom: email.from,
      emailSubject: subject,
      inReplyTo: email.headers?.["in-reply-to"] ?? null,
      references: email.headers?.["references"] ?? null,
    },
  })

  if (!message) throw new Error("Failed to create inbound message")

  // ---- 5. Post-processing (fire-and-forget) ----
  db.conversation
    .findFirst({
      where: { id: conversationId, workspaceId },
      select: { assignedTo: true, subject: true, channel: true, contact: { select: { nombre: true } } },
    })
    .then((conv) => {
      if (!conv) return
      return notifyInboundMessage({
        workspaceId,
        conversationId,
        subject: conv.subject,
        contactName: conv.contact?.nombre,
        channel: conv.channel,
        assignedTo: conv.assignedTo,
      })
    })
    .catch(() => null)

  runConversationIntelligence({
    workspaceId,
    conversationId,
    trigger: "message_post",
  }).catch(() => null)

  logActivity({
    module: "email",
    recordId: conversationId,
    type: "email_received",
    data: {
      resendEmailId: email.id,
      from: senderEmail,
      subject,
      isNew: isNewConversation,
    },
    workspaceId,
  }).catch(() => null)

  return { conversationId, messageId: message.id, contactId, isNewConversation }
}
