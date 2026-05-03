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
  /**
   * Threading match — RFC `In-Reply-To` / `References` headers point at a previous
   * Message-ID we've stored. We deliberately exclude conversations in `trashed` state:
   * if the operator moved a thread to the trash, an incoming reply must NOT silently
   * resurrect it inside the trashed shell (the message would land but the operator
   * would never see it because the conversation is hidden by the Trash filter, and
   * trash semantics say "I'm done with this thread"). Falling through to contact
   * matching — and ultimately to creating a fresh conversation — is the right
   * behaviour. Closed/archived threads are still reusable here because those states
   * are routinely reopened on follow-ups (mirrors the contact-fallback policy below).
   *
   * The exclusion is enforced via the `conversation.status` relation filter on the
   * Message query, so we never select a candidate whose container is trashed in the
   * first place — no extra round-trip needed.
   */
  if (inReplyTo) {
    const normalizedId = normalizeMessageId(inReplyTo)
    if (normalizedId) {
      const hit = await db.message.findFirst({
        where: {
          workspaceId,
          metadata: { contains: normalizedId },
          conversation: { status: { not: "trashed" } },
        },
        select: { conversationId: true },
        orderBy: { createdAt: "desc" },
      })
      if (hit) return { conversationId: hit.conversationId, matchedBy: "in-reply-to" }
    }
  }

  const refIds = parseReferencesHeader(references)
  for (const refId of refIds) {
    const hit = await db.message.findFirst({
      where: {
        workspaceId,
        metadata: { contains: refId },
        conversation: { status: { not: "trashed" } },
      },
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

  /**
   * Contact-active match — the thread headers didn't help (no In-Reply-To/References,
   * or those pointed at messages we don't have). Fall back to "any non-terminal email
   * conversation with this contact". `trashed` MUST be excluded alongside `closed`/
   * `archived` here: once an operator trashes a thread, follow-up emails from the same
   * contact must open a fresh conversation, never silently re-attach to the trashed
   * shell where they'd be invisible behind the Trash filter. Closed/archived threads
   * are reopened (see the second query below) because that's a common workflow; trash
   * is intentionally NOT reopened — if you wanted it back, you would Restore it
   * manually from the Trash view.
   */
  const activeConv = await db.conversation.findFirst({
    where: {
      workspaceId,
      contactId,
      channel: "email",
      status: { notIn: ["closed", "archived", "trashed"] },
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
// Workspace-scoped duplicate detection
// ---------------------------------------------------------------------------

/**
 * Look up an existing inbound message in the *same workspace* whose `metadata` JSON
 * contains either the source-specific id (`sourceId`, e.g. `imap:<connId>:<uid>` or the
 * Resend email id) or the RFC `Message-ID` header. Workspace scoping is critical: without
 * it, two tenants receiving the same email (CC'd customer mail, identical Cron-style
 * notifications routed to multiple support inboxes, the same operator running two
 * separate workspaces with overlapping providers) would dedup against each other and the
 * second tenant would silently lose the message — and the early return would also expose
 * a `conversationId` from another tenant, breaking isolation.
 *
 * Returns null when no duplicate exists in this workspace OR when neither identifier was
 * provided (callers fall through to normal ingestion in that case).
 *
 * Both lookups use `metadata: { contains: ... }` because the persisted `metadata` is a
 * JSON string and the values we're matching are unique enough (UIDs, RFC ids) that
 * collisions on substring inside the JSON would be astronomically rare. Adding
 * `workspaceId` to the where clause also lets the query planner use the workspace index
 * before scanning metadata blobs — a side benefit.
 */
async function findWorkspaceScopedDuplicate(args: {
  workspaceId: string
  sourceId?: string | null
  messageId?: string | null
}): Promise<{ id: string; conversationId: string; matchedBy: "sourceId" | "messageId" } | null> {
  const { workspaceId, sourceId, messageId } = args

  if (sourceId) {
    const hit = await db.message.findFirst({
      where: { workspaceId, direction: "inbound", metadata: { contains: sourceId } },
      select: { id: true, conversationId: true },
    })
    if (hit) return { id: hit.id, conversationId: hit.conversationId, matchedBy: "sourceId" }
  }

  if (messageId) {
    const normalizedMsgId = normalizeMessageId(messageId)
    if (normalizedMsgId) {
      const hit = await db.message.findFirst({
        where: { workspaceId, direction: "inbound", metadata: { contains: normalizedMsgId } },
        select: { id: true, conversationId: true },
      })
      if (hit) return { id: hit.id, conversationId: hit.conversationId, matchedBy: "messageId" }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Backfill connectionId helper
// ---------------------------------------------------------------------------

async function backfillConnectionId(
  conversationId: string,
  connectionId: string,
  workspaceId: string,
) {
  /**
   * Workspace-scoped backfill: never resolve a Conversation by id alone. If the conversation
   * happens to live in another tenant (data anomaly, race), updating it would persist a
   * cross-tenant `connectionId` reference. The caller already resolved `workspaceId` from
   * the inbound resolution chain, so we trust it as the tenancy oracle here.
   */
  const existing = await db.conversation.findFirst({
    where: { id: conversationId, workspaceId },
    select: { connectionId: true },
  })
  if (existing && !existing.connectionId) {
    await db.conversation.updateMany({
      where: { id: conversationId, workspaceId },
      data: { connectionId },
    })
  }
}

// ---------------------------------------------------------------------------
// Unified inbound ingestion — used by all sources (Resend, IMAP, future)
// ---------------------------------------------------------------------------

export async function ingestInboundEmail(input: IngestInboundEmailInput): Promise<InboundEmailResult> {
  const tag = `[inbound:${input.source}]`

  if (!input.from) throw new Error(`Inbound email from ${input.source} has no 'from' field`)

  /**
   * Dedup is intentionally deferred until *after* workspace + contact resolution. The
   * legacy implementation ran two global `metadata: { contains: ... }` queries up here,
   * which created a multi-tenant safety hole: two workspaces receiving the same email
   * (e.g. a customer CC'ing two of your support inboxes) would dedup against each other,
   * silently dropping the second copy and — worse — leaking the first workspace's
   * `conversationId` back to the second through the alreadyProcessed return value.
   *
   * Moving the check below the resolution chain has two consequences:
   *  - Workspace id is guaranteed defined when we dedup (we never short-circuit on a
   *    nullable filter that Prisma would treat as "unscoped").
   *  - For a true duplicate we now do an extra contact upsert before returning. That
   *    contact upsert is semantically correct (we genuinely *did* see the contact again,
   *    so bumping `lastSeenAt` reflects reality) and the cost — one row update — is
   *    negligible compared to the correctness gain.
   */

  const senderEmail = extractEmailAddress(input.from)
  const senderName = extractDisplayName(input.from)
  const subject = input.subject || "(No subject)"
  const content = input.text || stripHtml(input.html || "") || "(empty email)"
  const headers = input.headers ?? {}
  const inReplyTo = headers["in-reply-to"] ?? null
  const references = headers["references"] ?? null

  console.log(`${tag} from=${senderEmail} subject="${subject}"`)

  // ---- Resolve workspace & connection ----
  /**
   * Tenant routing must be deterministic. The previous implementation had three escape
   * hatches that could deliver an email to the WRONG workspace:
   *   1. `findFirst` over `ChannelConnection` with `externalAccountId IN (recipients)`
   *      silently picked the first match if two workspaces had the same email account
   *      (recovery after a re-connect, support@ collisions across tenants).
   *   2. If no connection matched, it queried `Contact` GLOBALLY by sender email — so
   *      a stranger emailing two tenants who happened to have a contact row in tenant A
   *      would always land in tenant A.
   *   3. As a last resort it fell back to `INBOUND_EMAIL_FALLBACK_WORKSPACE_ID`, which
   *      meant any unroutable email ended up in whichever tenant the env var pointed at.
   *
   * The new policy: if we cannot resolve to a UNIQUE active ChannelConnection from the
   * `to`/`cc` recipients, OR if the caller passed a `workspaceId` and we can verify it,
   * we refuse to ingest the email and surface a clear error. The webhook caller is
   * responsible for retrying or alerting; we never guess. This trades graceful degradation
   * for tenant safety, which is the right trade for a SaaS multi-tenant product.
   */
  let connectionId = input.connectionId ?? null
  let workspaceId = input.workspaceId

  if (workspaceId && connectionId) {
    /** Caller knows the tenant and connection — verify they actually match before trusting them. */
    const conn = await db.channelConnection.findFirst({
      where: { id: connectionId, workspaceId },
      select: { id: true },
    })
    if (!conn) {
      console.error(`${tag} Provided connection=${connectionId} does not belong to workspace=${workspaceId}; refusing.`)
      throw new Error("Inbound email: connectionId does not belong to provided workspaceId")
    }
  }

  if (!workspaceId) {
    const recipientAddresses = (input.to ?? []).map(extractEmailAddress)
    const ccAddresses = (input.cc ?? []).map(extractEmailAddress)
    const allRecipients = Array.from(new Set([...recipientAddresses, ...ccAddresses])).filter(Boolean)

    if (allRecipients.length === 0) {
      console.error(`${tag} No recipients on inbound email; cannot resolve tenant. Dropping.`)
      throw new Error("Inbound email has no recipient addresses; cannot resolve workspace")
    }

    /**
     * Find ALL active email connections that match any recipient. We require a UNIQUE
     * workspace match across the candidate set; multiple workspaces sharing the same
     * `externalAccountId` is a misconfiguration we must not paper over by routing to one
     * of them. The DB has `@@unique([workspaceId, externalAccountId])` per workspace, so
     * collisions are only possible across workspaces.
     */
    const candidates = await db.channelConnection.findMany({
      where: {
        channelType: "email",
        status: "active",
        externalAccountId: { in: allRecipients },
      },
      select: { id: true, workspaceId: true, externalAccountId: true },
    })

    const uniqueWorkspaces = new Set(candidates.map((c) => c.workspaceId))
    if (uniqueWorkspaces.size === 0) {
      console.error(
        `${tag} No active email connection matches recipients=[${allRecipients.join(",")}]. Dropping.`,
      )
      throw new Error("Inbound email: no active ChannelConnection matches any recipient address")
    }
    if (uniqueWorkspaces.size > 1) {
      console.error(
        `${tag} Recipients=[${allRecipients.join(",")}] map to multiple workspaces=[${Array.from(uniqueWorkspaces).join(",")}]; refusing ambiguous routing.`,
      )
      throw new Error("Inbound email: recipients match connections in multiple workspaces; routing is ambiguous")
    }

    /**
     * Single workspace match. If there are multiple connections within that workspace
     * (e.g. a primary + alias), we prefer the one whose `externalAccountId` is in the
     * primary `to` list to maximise correctness; otherwise we take the first stable one.
     * `connectionId` is allowed to be `null` only if the caller explicitly passes none
     * and there is no recipient-driven match — but we just established there is one.
     *
     * `externalAccountId` is `String?` in Prisma, so we narrow it before calling `includes`
     * to keep TypeScript happy under `strictNullChecks` and to avoid matching a connection
     * with a null account against a recipient list.
     */
    const chosen = candidates.find(
      (c) => c.externalAccountId !== null && recipientAddresses.includes(c.externalAccountId),
    ) ?? candidates[0]
    workspaceId = chosen.workspaceId
    connectionId = connectionId ?? chosen.id
    console.log(
      `${tag} Routed by connection=${chosen.id} workspace=${workspaceId} (${candidates.length} candidate(s))`,
    )
  }

  if (!workspaceId) {
    /** Defensive — the branches above should have set or thrown. */
    console.error(`${tag} Workspace still unresolved after deterministic routing; dropping.`)
    throw new Error("Inbound email: workspace could not be resolved")
  }

  // ---- Resolve contact (workspace-scoped only) ----
  let contactId: string
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

  /**
   * Workspace-scoped dedup. At this point `workspaceId` is guaranteed defined (the
   * resolution chain above either set it or threw). Returning the *real* `contactId` —
   * not the empty-string placeholder the legacy implementation used — keeps the contract
   * of `InboundEmailResult` honest for downstream consumers (logActivity, audit trails).
   */
  const existingDuplicate = await findWorkspaceScopedDuplicate({
    workspaceId,
    sourceId: input.sourceId,
    messageId: input.messageId,
  })
  if (existingDuplicate) {
    console.log(
      `${tag} Dedup hit workspace=${workspaceId} matched_by=${existingDuplicate.matchedBy} existing_msg=${existingDuplicate.id} sourceId=${input.sourceId ?? "(none)"} messageId=${input.messageId ?? "(none)"}`,
    )
    return {
      conversationId: existingDuplicate.conversationId,
      messageId: existingDuplicate.id,
      contactId,
      isNewConversation: false,
      matchedBy: "in-reply-to",
      alreadyProcessed: true,
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
    if (connectionId) await backfillConnectionId(conversationId, connectionId, workspaceId)
  } else {
    const contactMatch = await matchConversationByContact(workspaceId, contactId)
    if (contactMatch) {
      conversationId = contactMatch.conversationId
      matchedBy = contactMatch.matchedBy
      if (connectionId) await backfillConnectionId(conversationId, connectionId, workspaceId)
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
  }).catch((err) => {
    console.error(`[email-inbound] Intelligence failed conv=${conversationId}:`, err)
  })

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
