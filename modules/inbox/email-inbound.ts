import { db } from "@core/db"
import { addMessage } from "./service"
import { runConversationIntelligence } from "./intelligence"
import { notifyInboundMessage } from "@core/notifications/inbox"
import { logActivity } from "@core/activity"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReceivedEmailAttachment {
  id: string
  filename: string
  content_type: string
  size?: number
  content_disposition?: string
  content_id?: string | null
}

interface ReceivedEmail {
  id: string
  from: string
  to: string[]
  cc?: string[]
  subject: string | null
  text: string | null
  html: string | null
  headers: Record<string, string>
  message_id: string
  created_at: string
  attachments?: ReceivedEmailAttachment[]
}

interface StoredAttachment {
  filename: string
  url: string
  contentType: string
  size?: number
  source: "inbound"
}

interface InboundEmailResult {
  conversationId: string
  messageId: string
  contactId: string
  isNewConversation: boolean
  matchedBy: MatchMethod
  alreadyProcessed?: boolean
}

type MatchMethod = "in-reply-to" | "references" | "contact-active" | "contact-reopen" | "new"

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

/**
 * Normalize an RFC 2822 Message-ID: strip angle brackets, trim, lowercase.
 * "<abc@example.com>" → "abc@example.com"
 */
function normalizeMessageId(raw: string): string {
  return raw.replace(/^</, "").replace(/>$/, "").trim().toLowerCase()
}

/**
 * Parse the References header into individual Message-IDs (newest last per RFC).
 * Returns them in **reverse** order so the most recent reference is tried first.
 */
function parseReferencesHeader(refs: string | null | undefined): string[] {
  if (!refs) return []
  const matches = refs.match(/<[^>]+>/g)
  if (!matches) {
    const single = refs.trim()
    return single ? [normalizeMessageId(single)] : []
  }
  return matches.map(normalizeMessageId).filter(Boolean).reverse()
}

// ---------------------------------------------------------------------------
// Timeout helper
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 20_000
const ATTACHMENT_TIMEOUT_MS = 30_000

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  return fetch(url, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer))
}

// ---------------------------------------------------------------------------
// Resend API — fetch full received email
// ---------------------------------------------------------------------------

async function fetchReceivedEmail(resendEmailId: string): Promise<ReceivedEmail> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) throw new Error("RESEND_API_KEY not configured")

  const res = await fetchWithTimeout(
    `https://api.resend.com/emails/receiving/${resendEmailId}`,
    { headers: { Authorization: `Bearer ${apiKey}` } },
    FETCH_TIMEOUT_MS,
  )

  if (!res.ok) {
    const text = await res.text().catch(() => "(no body)")
    throw new Error(`Resend API ${res.status}: ${text}`)
  }

  return res.json() as Promise<ReceivedEmail>
}

// ---------------------------------------------------------------------------
// Inbound attachment processing
// ---------------------------------------------------------------------------

async function processInboundAttachments(
  resendEmailId: string,
  rawAttachments: ReceivedEmailAttachment[],
): Promise<StoredAttachment[]> {
  if (!rawAttachments.length) return []

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return []

  const stored: StoredAttachment[] = []

  for (const att of rawAttachments) {
    const failEntry: StoredAttachment = { filename: att.filename || "unknown", url: "", contentType: att.content_type || "application/octet-stream", size: att.size, source: "inbound" }

    try {
      const res = await fetchWithTimeout(
        `https://api.resend.com/emails/receiving/${resendEmailId}/attachments/${att.id}`,
        { headers: { Authorization: `Bearer ${apiKey}` } },
        ATTACHMENT_TIMEOUT_MS,
      )

      if (!res.ok) {
        console.warn(`[email-inbound] Attachment metadata fetch failed email=${resendEmailId} att=${att.id} status=${res.status}`)
        stored.push(failEntry)
        continue
      }

      const data = (await res.json()) as { download_url?: string; expires_at?: string }

      if (data.download_url) {
        const fileRes = await fetchWithTimeout(data.download_url, {}, ATTACHMENT_TIMEOUT_MS)
        if (fileRes.ok) {
          const buffer = Buffer.from(await fileRes.arrayBuffer())
          const { uploadToStorage, getStoragePath } = await import("@/lib/storage")
          const path = getStoragePath("inbox-attachments-inbound", att.filename || "file")
          const url = await uploadToStorage(buffer, path, att.content_type || "application/octet-stream")
          stored.push({ filename: att.filename || "file", url, contentType: att.content_type || "application/octet-stream", size: att.size ?? buffer.length, source: "inbound" })
          console.log(`[email-inbound] Attachment stored email=${resendEmailId} att=${att.id} file=${att.filename}`)
        } else {
          console.warn(`[email-inbound] Attachment download failed email=${resendEmailId} att=${att.id} status=${fileRes.status}`)
          stored.push(failEntry)
        }
      } else {
        console.warn(`[email-inbound] No download_url for attachment email=${resendEmailId} att=${att.id}`)
        stored.push(failEntry)
      }
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      console.error(`[email-inbound] Attachment processing error email=${resendEmailId} att=${att.id}: ${errMsg}`)
      stored.push(failEntry)
    }
  }

  return stored
}

// ---------------------------------------------------------------------------
// Thread matching — search by email metadata
// ---------------------------------------------------------------------------

/**
 * Try to find the conversation an inbound email belongs to by checking
 * In-Reply-To and References headers against metadata already stored in
 * existing messages (both inbound `emailMessageId` and outbound `resendId`).
 *
 * Scoped to a workspace to prevent cross-tenant leaks.
 */
async function matchConversationByThread(
  inReplyTo: string | null | undefined,
  references: string | null | undefined,
  workspaceId: string,
): Promise<{ conversationId: string; matchedBy: "in-reply-to" | "references" } | null> {
  // --- 1. In-Reply-To (direct parent) ---
  if (inReplyTo) {
    const normalizedId = normalizeMessageId(inReplyTo)
    if (normalizedId) {
      const hit = await db.message.findFirst({
        where: { workspaceId, metadata: { contains: normalizedId } },
        select: { conversationId: true },
        orderBy: { createdAt: "desc" },
      })
      if (hit) return { conversationId: hit.conversationId, matchedBy: "in-reply-to" }
    }
  }

  // --- 2. References (thread chain, newest first) ---
  const refIds = parseReferencesHeader(references)
  for (const refId of refIds) {
    const hit = await db.message.findFirst({
      where: { workspaceId, metadata: { contains: refId } },
      select: { conversationId: true },
      orderBy: { createdAt: "desc" },
    })
    if (hit) return { conversationId: hit.conversationId, matchedBy: "references" }
  }

  return null
}

// ---------------------------------------------------------------------------
// Contact-based fallback matching (v1 logic preserved)
// ---------------------------------------------------------------------------

async function matchConversationByContact(
  workspaceId: string,
  contactId: string,
): Promise<{ conversationId: string; matchedBy: "contact-active" | "contact-reopen" } | null> {
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

  if (activeConv) {
    return { conversationId: activeConv.id, matchedBy: "contact-active" }
  }

  const closedConv = await db.conversation.findFirst({
    where: {
      workspaceId,
      contactId,
      channel: "email",
      status: { in: ["closed", "archived"] },
      lastMessageAt: { gte: new Date(Date.now() - REOPEN_WINDOW_MS) },
    },
    orderBy: { lastMessageAt: "desc" },
  })

  if (closedConv) {
    await db.conversation.update({
      where: { id: closedConv.id },
      data: { status: "new", closedAt: null },
    })
    return { conversationId: closedConv.id, matchedBy: "contact-reopen" }
  }

  return null
}

// ---------------------------------------------------------------------------
// Core processing
// ---------------------------------------------------------------------------

export async function processInboundEmail(resendEmailId: string): Promise<InboundEmailResult> {
  // ---- dedup: check if this email was already ingested ----
  // Search by resendEmailId in metadata across all inbound messages.
  // resendEmailId is globally unique from Resend, so cross-workspace dedup is safe.
  const duplicate = await db.message.findFirst({
    where: { direction: "inbound", metadata: { contains: resendEmailId } },
    select: { id: true, conversationId: true },
  })

  if (duplicate) {
    console.log(`[email-inbound] Dedup hit email=${resendEmailId} existing_msg=${duplicate.id}`)
    return {
      conversationId: duplicate.conversationId,
      messageId: duplicate.id,
      contactId: "",
      isNewConversation: false,
      matchedBy: "in-reply-to",
      alreadyProcessed: true,
    }
  }

  // ---- 1. Fetch full email ----
  console.log(`[email-inbound] Fetching email=${resendEmailId}`)
  const email = await fetchReceivedEmail(resendEmailId)

  if (!email.from) throw new Error(`Email ${resendEmailId} has no 'from' field`)

  const senderEmail = extractEmailAddress(email.from)
  const senderName = extractDisplayName(email.from)
  const subject = email.subject || "(No subject)"
  const content = email.text || stripHtml(email.html || "") || "(empty email)"
  const headers = email.headers && typeof email.headers === "object" ? email.headers : {}
  const inReplyTo = headers["in-reply-to"] ?? null
  const references = headers["references"] ?? null

  console.log(`[email-inbound] Parsed email=${resendEmailId} from=${senderEmail} subject="${subject}" attachments=${email.attachments?.length ?? 0}`)

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

  // ---- 3. Match conversation (thread-first, contact-fallback, new) ----
  let conversationId: string
  let isNewConversation = false
  let matchedBy: MatchMethod

  const threadMatch = await matchConversationByThread(inReplyTo, references, workspaceId)

  if (threadMatch) {
    conversationId = threadMatch.conversationId
    matchedBy = threadMatch.matchedBy
  } else {
    const contactMatch = await matchConversationByContact(workspaceId, contactId)

    if (contactMatch) {
      conversationId = contactMatch.conversationId
      matchedBy = contactMatch.matchedBy
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
      matchedBy = "new"
    }
  }

  console.log(
    `[email-inbound] ${resendEmailId} from=${senderEmail} matched_by=${matchedBy} conv=${conversationId} new=${isNewConversation}`,
  )

  // ---- 4. Process attachments if present ----
  const storedAttachments = await processInboundAttachments(
    resendEmailId,
    email.attachments ?? [],
  )

  // ---- 5. Create inbound message ----
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
      emailTo: email.to,
      emailCc: email.cc ?? [],
      emailSubject: subject,
      inReplyTo,
      references,
      ...(storedAttachments.length > 0 ? { attachments: storedAttachments } : {}),
    },
  })

  if (!message) throw new Error("Failed to create inbound message")

  // ---- 6. Post-processing (fire-and-forget) ----
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
      matchedBy,
    },
    workspaceId,
  }).catch(() => null)

  return { conversationId, messageId: message.id, contactId, isNewConversation, matchedBy }
}
