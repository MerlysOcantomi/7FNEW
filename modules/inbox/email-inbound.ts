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

export interface StoredAttachment {
  filename: string
  url: string
  contentType: string
  size?: number
  source: "inbound"
}

export interface InboundEmailResult {
  conversationId: string
  messageId: string
  contactId: string
  isNewConversation: boolean
  matchedBy: MatchMethod
  alreadyProcessed?: boolean
}

export type MatchMethod = "in-reply-to" | "references" | "contact-active" | "contact-reopen" | "new"

/**
 * Normalized inbound email — the common format that all sources
 * (Resend webhook, IMAP sync, future Gmail/Microsoft) convert into
 * before passing to `ingestInboundEmail`.
 */
export interface IngestInboundEmailInput {
  source: string
  sourceId: string
  from: string
  to: string[]
  cc?: string[]
  subject: string | null
  text: string | null
  html: string | null
  headers: Record<string, string>
  messageId: string
  receivedAt?: Date
  attachments?: StoredAttachment[]
  connectionId?: string | null
  workspaceId?: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function extractEmailAddress(raw: string): string {
  const match = raw.match(/<([^>]+)>/)
  return (match ? match[1] : raw).trim().toLowerCase()
}

export function extractDisplayName(raw: string): string | null {
  const match = raw.match(/^(.+?)\s*</)
  return match ? match[1].replace(/^"|"$/g, "").trim() || null : null
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ").replace(/\s+/g, " ").trim()
}

function normalizeMessageId(raw: string): string {
  return raw.replace(/^</, "").replace(/>$/, "").trim().toLowerCase()
}

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
// Resend attachment processing
// ---------------------------------------------------------------------------

async function processResendAttachments(
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

async function matchConversationByThread(
  inReplyTo: string | null | undefined,
  references: string | null | undefined,
  workspaceId: string,
): Promise<{ conversationId: string; matchedBy: "in-reply-to" | "references" } | null> {
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
// Contact-based fallback matching
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
// Backfill connectionId helper
// ---------------------------------------------------------------------------

async function backfillConnectionId(conversationId: string, connectionId: string) {
  const existing = await db.conversation.findFirst({
    where: { id: conversationId },
    select: { connectionId: true },
  })
  if (existing && !existing.connectionId) {
    await db.conversation.update({
      where: { id: conversationId },
      data: { connectionId },
    })
  }
}

// ---------------------------------------------------------------------------
// Unified inbound ingestion — used by all sources (Resend, IMAP, future)
// ---------------------------------------------------------------------------

export async function ingestInboundEmail(input: IngestInboundEmailInput): Promise<InboundEmailResult> {
  const tag = `[inbound:${input.source}]`

  // ---- Dedup by sourceId (e.g. resendEmailId, IMAP UID key) ----
  if (input.sourceId) {
    const duplicate = await db.message.findFirst({
      where: { direction: "inbound", metadata: { contains: input.sourceId } },
      select: { id: true, conversationId: true },
    })
    if (duplicate) {
      console.log(`${tag} Dedup hit sourceId=${input.sourceId} existing_msg=${duplicate.id}`)
      return {
        conversationId: duplicate.conversationId,
        messageId: duplicate.id,
        contactId: "",
        isNewConversation: false,
        matchedBy: "in-reply-to",
        alreadyProcessed: true,
      }
    }
  }

  // ---- Dedup by RFC Message-ID ----
  if (input.messageId) {
    const normalizedMsgId = normalizeMessageId(input.messageId)
    if (normalizedMsgId) {
      const duplicate = await db.message.findFirst({
        where: { direction: "inbound", metadata: { contains: normalizedMsgId } },
        select: { id: true, conversationId: true },
      })
      if (duplicate) {
        console.log(`${tag} Dedup hit messageId=${normalizedMsgId} existing_msg=${duplicate.id}`)
        return {
          conversationId: duplicate.conversationId,
          messageId: duplicate.id,
          contactId: "",
          isNewConversation: false,
          matchedBy: "in-reply-to",
          alreadyProcessed: true,
        }
      }
    }
  }

  if (!input.from) throw new Error(`Inbound email from ${input.source} has no 'from' field`)

  const senderEmail = extractEmailAddress(input.from)
  const senderName = extractDisplayName(input.from)
  const subject = input.subject || "(No subject)"
  const content = input.text || stripHtml(input.html || "") || "(empty email)"
  const headers = input.headers ?? {}
  const inReplyTo = headers["in-reply-to"] ?? null
  const references = headers["references"] ?? null

  console.log(`${tag} from=${senderEmail} subject="${subject}"`)

  // ---- Resolve workspace & connection ----
  let connectionId = input.connectionId ?? null
  let workspaceId = input.workspaceId

  if (!workspaceId) {
    const recipientAddresses = (input.to ?? []).map(extractEmailAddress)
    if (recipientAddresses.length > 0) {
      const connection = await db.channelConnection.findFirst({
        where: {
          channelType: "email",
          status: "active",
          externalAccountId: { in: recipientAddresses },
        },
        select: { id: true, workspaceId: true },
      })
      if (connection) {
        workspaceId = connection.workspaceId
        connectionId = connectionId ?? connection.id
        console.log(`${tag} Routed by connection=${connection.id} workspace=${workspaceId}`)
      }
    }
  }

  // ---- Resolve contact ----
  let contactId: string

  if (workspaceId) {
    const existingContact = await db.contact.findFirst({
      where: { email: senderEmail, workspaceId },
      orderBy: { lastSeenAt: "desc" },
    })
    if (existingContact) {
      contactId = existingContact.id
      await db.contact.update({ where: { id: contactId }, data: { lastSeenAt: new Date() } })
    } else {
      const contact = await db.contact.create({
        data: { workspaceId, email: senderEmail, nombre: senderName, canal: "email", tipo: "visitante" },
      })
      contactId = contact.id
    }
  } else {
    const existingContact = await db.contact.findFirst({
      where: { email: senderEmail },
      orderBy: { lastSeenAt: "desc" },
    })
    if (existingContact) {
      workspaceId = existingContact.workspaceId
      contactId = existingContact.id
      await db.contact.update({ where: { id: contactId }, data: { lastSeenAt: new Date() } })
    } else {
      const fallbackWsId = process.env.INBOUND_EMAIL_FALLBACK_WORKSPACE_ID
      if (!fallbackWsId) {
        console.error("[email-inbound] No workspace resolved and INBOUND_EMAIL_FALLBACK_WORKSPACE_ID not set. Dropping email from:", senderEmail)
        throw new Error("No workspace available for inbound email — set INBOUND_EMAIL_FALLBACK_WORKSPACE_ID or configure a channel connection")
      }
      const workspace = await db.workspace.findUnique({ where: { id: fallbackWsId } })
      if (!workspace) throw new Error(`Fallback workspace ${fallbackWsId} not found`)
      workspaceId = workspace.id
      const contact = await db.contact.create({
        data: { workspaceId, email: senderEmail, nombre: senderName, canal: "email", tipo: "visitante" },
      })
      contactId = contact.id
    }
  }

  // ---- Match conversation ----
  let conversationId: string
  let isNewConversation = false
  let matchedBy: MatchMethod

  const threadMatch = await matchConversationByThread(inReplyTo, references, workspaceId)

  if (threadMatch) {
    conversationId = threadMatch.conversationId
    matchedBy = threadMatch.matchedBy
    if (connectionId) await backfillConnectionId(conversationId, connectionId)
  } else {
    const contactMatch = await matchConversationByContact(workspaceId, contactId)
    if (contactMatch) {
      conversationId = contactMatch.conversationId
      matchedBy = contactMatch.matchedBy
      if (connectionId) await backfillConnectionId(conversationId, connectionId)
    } else {
      const conv = await db.conversation.create({
        data: {
          workspaceId,
          contactId,
          connectionId,
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

  console.log(`${tag} matched_by=${matchedBy} conv=${conversationId} new=${isNewConversation} conn=${connectionId ?? "none"}`)

  // ---- Create inbound message ----
  const message = await addMessage({
    workspaceId,
    conversationId,
    role: "visitor",
    direction: "inbound",
    content,
    contentType: "text",
    connectionId,
    metadata: {
      source: input.source,
      sourceId: input.sourceId,
      emailMessageId: input.messageId,
      emailFrom: input.from,
      emailTo: input.to,
      emailCc: input.cc ?? [],
      emailSubject: subject,
      inReplyTo,
      references,
      ...(connectionId ? { connectionId } : {}),
      ...(input.attachments && input.attachments.length > 0 ? { attachments: input.attachments } : {}),
    },
  })

  if (!message) throw new Error("Failed to create inbound message")

  // ---- Post-processing (fire-and-forget) ----
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
      source: input.source,
      sourceId: input.sourceId,
      from: senderEmail,
      to: input.to,
      subject,
      isNew: isNewConversation,
      matchedBy,
      ...(connectionId ? { connectionId } : {}),
    },
    workspaceId,
  }).catch(() => null)

  return { conversationId, messageId: message.id, contactId, isNewConversation, matchedBy }
}

// ---------------------------------------------------------------------------
// Resend adapter — thin wrapper that fetches from Resend API, then calls
// the unified ingestInboundEmail pipeline.
// ---------------------------------------------------------------------------

export async function processInboundEmail(resendEmailId: string): Promise<InboundEmailResult> {
  console.log(`[email-inbound] Fetching email=${resendEmailId}`)
  const email = await fetchReceivedEmail(resendEmailId)

  const headers = email.headers && typeof email.headers === "object" ? email.headers : {}
  const attachments = await processResendAttachments(resendEmailId, email.attachments ?? [])

  return ingestInboundEmail({
    source: "resend",
    sourceId: resendEmailId,
    from: email.from,
    to: email.to ?? [],
    cc: email.cc,
    subject: email.subject,
    text: email.text,
    html: email.html,
    headers,
    messageId: email.message_id,
    receivedAt: email.created_at ? new Date(email.created_at) : undefined,
    attachments,
  })
}
