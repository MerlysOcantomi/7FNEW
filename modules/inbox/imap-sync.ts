import { db } from "@core/db"
import { decryptJson } from "@core/crypto"
import { ingestInboundEmail, extractEmailAddress, stripHtml } from "./email-inbound"
import type { StoredAttachment } from "./email-inbound"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ImapSyncState {
  lastUid?: number
  uidValidity?: number
}

interface SmtpCredentials {
  email: string
  password: string
}

export interface SyncResult {
  connectionId: string
  fetched: number
  ingested: number
  skipped: number
  errors: string[]
}

// ---------------------------------------------------------------------------
// IMAP sync runner for a single connection
// ---------------------------------------------------------------------------

const IMAP_CONNECT_TIMEOUT_MS = 20_000
const MAX_MESSAGES_PER_SYNC = 50

export async function syncImapConnection(connectionId: string): Promise<SyncResult> {
  const result: SyncResult = { connectionId, fetched: 0, ingested: 0, skipped: 0, errors: [] }

  const connection = await db.channelConnection.findUnique({
    where: { id: connectionId },
    select: {
      id: true,
      workspaceId: true,
      provider: true,
      config: true,
      credentials: true,
      syncState: true,
      externalAccountId: true,
    },
  })

  if (!connection) {
    result.errors.push("Connection not found")
    return result
  }

  if (connection.provider !== "imap_smtp") {
    result.errors.push("Not an IMAP/SMTP connection")
    return result
  }

  if (!connection.credentials) {
    result.errors.push("No credentials configured")
    return result
  }

  const cfg = connection.config ? JSON.parse(connection.config) as Record<string, string> : {}
  let creds: SmtpCredentials
  try {
    creds = decryptJson(connection.credentials)
  } catch {
    await db.channelConnection.update({
      where: { id: connectionId },
      data: { status: "error", lastError: "Failed to decrypt credentials" },
    })
    result.errors.push("Failed to decrypt credentials")
    return result
  }

  const syncState: ImapSyncState = connection.syncState
    ? JSON.parse(connection.syncState)
    : {}

  const { ImapFlow } = await import("imapflow")
  const client = new ImapFlow({
    host: cfg.imapHost || "",
    port: Number(cfg.imapPort) || 993,
    secure: cfg.imapSecure !== "false",
    auth: { user: creds.email, pass: creds.password },
    logger: false,
    emitLogs: false,
    tls: { rejectUnauthorized: false },
  })

  const connectTimeout = setTimeout(() => {
    try { client.close() } catch {}
  }, IMAP_CONNECT_TIMEOUT_MS)

  try {
    await client.connect()
    clearTimeout(connectTimeout)

    const lock = await client.getMailboxLock("INBOX")
    try {
      const mailbox = client.mailbox
      if (!mailbox) {
        result.errors.push("Could not open INBOX")
        return result
      }

      const currentUidValidity = Number(mailbox.uidValidity)
      const uidValidityChanged = syncState.uidValidity !== undefined &&
        syncState.uidValidity !== currentUidValidity

      if (uidValidityChanged) {
        console.log(`[imap-sync] UID validity changed for ${connectionId}, resetting cursor`)
        syncState.lastUid = undefined
      }

      let searchQuery: string
      if (syncState.lastUid) {
        searchQuery = `${syncState.lastUid + 1}:*`
      } else {
        searchQuery = "*"
      }

      let highestUid = syncState.lastUid ?? 0
      let count = 0

      for await (const msg of client.fetch(
        { uid: searchQuery },
        {
          uid: true,
          envelope: true,
          source: true,
          bodyStructure: true,
        },
      )) {
        if (count >= MAX_MESSAGES_PER_SYNC) break
        count++
        result.fetched++

        if (syncState.lastUid && msg.uid <= syncState.lastUid) {
          result.skipped++
          continue
        }

        try {
          const envelope = msg.envelope
          if (!envelope?.from?.[0]) {
            result.skipped++
            continue
          }

          const fromAddr = envelope.from[0]
          const from = fromAddr.name
            ? `${fromAddr.name} <${fromAddr.address}>`
            : fromAddr.address || ""

          const to = (envelope.to ?? []).map(
            (a: { name?: string; address?: string }) => a.address || "",
          ).filter(Boolean)

          const cc = (envelope.cc ?? []).map(
            (a: { name?: string; address?: string }) => a.address || "",
          ).filter(Boolean)

          const messageId = envelope.messageId || `imap-${connectionId}-${msg.uid}`
          const subject = envelope.subject ?? null
          const receivedAt = envelope.date ? new Date(envelope.date) : new Date()

          // Skip emails sent FROM this account (outbound we sent ourselves)
          const selfEmail = extractEmailAddress(connection.externalAccountId || creds.email)
          const senderEmail = extractEmailAddress(from)
          if (senderEmail === selfEmail) {
            result.skipped++
            const numericUid = Number(msg.uid)
        if (numericUid > highestUid) highestUid = numericUid
            continue
          }

          let text: string | null = null
          let html: string | null = null
          const headers: Record<string, string> = {}

          if (msg.source) {
            const rawSource = msg.source.toString("utf-8")
            const { simpleParser } = await import("mailparser")
            const parsed = await simpleParser(rawSource)
            text = parsed.text || null
            html = parsed.html || null
            if (parsed.headers) {
              for (const [key, value] of parsed.headers) {
                if (typeof value === "string") headers[key] = value
                else if (value && typeof value === "object" && "text" in value) {
                  headers[key] = String((value as { text: string }).text)
                }
              }
            }
          }

          if (!text && !html) {
            text = "(empty email)"
          }

          const sourceId = `imap:${connectionId}:${msg.uid}`

          const ingested = await ingestInboundEmail({
            source: "imap",
            sourceId,
            from,
            to,
            cc,
            subject,
            text,
            html,
            headers,
            messageId,
            receivedAt,
            connectionId: connection.id,
            workspaceId: connection.workspaceId,
          })

          if (ingested.alreadyProcessed) {
            result.skipped++
          } else {
            result.ingested++
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          result.errors.push(`UID ${msg.uid}: ${errMsg}`)
          console.error(`[imap-sync] Error processing UID ${msg.uid} for ${connectionId}: ${errMsg}`)
        }

        const numericUid = Number(msg.uid)
        if (numericUid > highestUid) highestUid = numericUid
      }

      const newSyncState: ImapSyncState = {
        lastUid: highestUid || syncState.lastUid,
        uidValidity: currentUidValidity,
      }

      await db.channelConnection.update({
        where: { id: connectionId },
        data: {
          syncState: JSON.stringify(newSyncState),
          lastSyncAt: new Date(),
          lastError: result.errors.length > 0 ? result.errors.join("; ") : null,
          status: "active",
        },
      })
    } finally {
      lock.release()
    }

    await client.logout()
  } catch (err) {
    clearTimeout(connectTimeout)
    const errMsg = err instanceof Error ? err.message : String(err)
    result.errors.push(errMsg)
    console.error(`[imap-sync] Connection error for ${connectionId}: ${errMsg}`)

    await db.channelConnection.update({
      where: { id: connectionId },
      data: {
        lastError: errMsg,
        status: result.fetched > 0 ? "active" : "error",
      },
    }).catch(() => null)

    try { await client.logout() } catch {}
  }

  console.log(
    `[imap-sync] Done conn=${connectionId} fetched=${result.fetched} ingested=${result.ingested} skipped=${result.skipped} errors=${result.errors.length}`,
  )

  return result
}

// ---------------------------------------------------------------------------
// Batch runner — sync all active imap_smtp connections
// ---------------------------------------------------------------------------

export async function syncAllImapConnections(): Promise<SyncResult[]> {
  const connections = await db.channelConnection.findMany({
    where: { provider: "imap_smtp", status: "active", channelType: "email" },
    select: { id: true },
  })

  const results: SyncResult[] = []

  for (const conn of connections) {
    try {
      const result = await syncImapConnection(conn.id)
      results.push(result)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      results.push({ connectionId: conn.id, fetched: 0, ingested: 0, skipped: 0, errors: [errMsg] })
    }
  }

  return results
}
