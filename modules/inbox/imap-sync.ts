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
  /**
   * True when the sync had to reset the local UID cursor. Two triggers:
   *  - mailbox `uidValidity` changed (server moved/recreated the INBOX) → standard reset.
   *  - persisted `lastUid` is greater than the mailbox's current `uidNext - 1` (cursor is
   *    ahead of reality, can happen if INBOX shrinks dramatically or after a bad migration).
   * Either way we log it and the API surface exposes the flag so the operator knows why
   * a "fetch" returned older messages.
   */
  cursorReset?: boolean
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
        console.warn(
          `[imap-sync] uidValidity changed conn=${connectionId} prev=${syncState.uidValidity} now=${currentUidValidity} — resetting cursor`,
        )
        syncState.lastUid = undefined
        result.cursorReset = true
      }

      /**
       * Safety net for "cursor ahead of mailbox": if the persisted `lastUid` is greater than
       * the mailbox's `uidNext - 1` (i.e. greater than the highest possible UID the server
       * will issue), the search query `${lastUid + 1}:*` will return nothing and the inbox
       * stays silent forever. This can happen if the INBOX is recreated on the server side
       * without uidValidity changing, or after a bad migration. We detect it explicitly,
       * log a warning, and reset the cursor so the next sync can recover.
       */
      const mailboxUidNext = typeof mailbox.uidNext === "number" ? mailbox.uidNext : null
      if (
        typeof syncState.lastUid === "number" &&
        mailboxUidNext !== null &&
        syncState.lastUid >= mailboxUidNext
      ) {
        console.warn(
          `[imap-sync] cursor ahead of mailbox conn=${connectionId} lastUid=${syncState.lastUid} uidNext=${mailboxUidNext} — resetting cursor for safe recovery`,
        )
        syncState.lastUid = undefined
        result.cursorReset = true
      }

      let searchQuery: string
      if (syncState.lastUid) {
        searchQuery = `${syncState.lastUid + 1}:*`
      } else {
        searchQuery = "*"
      }

      console.log(
        `[imap-sync] mailbox open conn=${connectionId} uidValidity=${currentUidValidity} uidNext=${mailboxUidNext ?? "?"} exists=${mailbox.exists ?? "?"} cursor=${syncState.lastUid ?? "(none)"} query=${searchQuery}`,
      )

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

        /**
         * IMAP `${lastUid + 1}:*` returns at minimum one message even if no message matches
         * (the spec returns the highest-UID message in that case). Defensive guard: if the
         * server hands us a UID at or below our cursor, we drop it so we don't re-ingest
         * what we already saw.
         */
        if (syncState.lastUid && msg.uid <= syncState.lastUid) {
          result.skipped++
          console.log(
            `[imap-sync] msg uid=${msg.uid} outcome=skipped reason=cursor-overlap cursor=${syncState.lastUid}`,
          )
          continue
        }

        try {
          const envelope = msg.envelope
          if (!envelope?.from?.[0]) {
            result.skipped++
            console.log(
              `[imap-sync] msg uid=${msg.uid} outcome=skipped reason=missing-envelope-from`,
            )
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

          /**
           * Skip emails sent FROM this account (outbound we sent ourselves bouncing back via
           * INBOX). We still advance the cursor so they don't keep getting refetched on every
           * subsequent sync.
           */
          const selfEmail = extractEmailAddress(connection.externalAccountId || creds.email)
          const senderEmail = extractEmailAddress(from)
          if (senderEmail === selfEmail) {
            result.skipped++
            console.log(
              `[imap-sync] msg uid=${msg.uid} from=${senderEmail} subject="${(subject ?? "").slice(0, 60)}" outcome=skipped reason=self-sent`,
            )
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
            console.log(
              `[imap-sync] msg uid=${msg.uid} from=${senderEmail} subject="${(subject ?? "").slice(0, 60)}" outcome=skipped reason=duplicate sourceId=${sourceId}`,
            )
          } else {
            result.ingested++
            console.log(
              `[imap-sync] msg uid=${msg.uid} from=${senderEmail} subject="${(subject ?? "").slice(0, 60)}" outcome=ingested conv=${ingested.conversationId} matched_by=${ingested.matchedBy} new=${ingested.isNewConversation}`,
            )
          }
        } catch (err) {
          const errMsg = err instanceof Error ? err.message : String(err)
          result.errors.push(`UID ${msg.uid}: ${errMsg}`)
          console.error(
            `[imap-sync] msg uid=${msg.uid} outcome=error conn=${connectionId} reason="${errMsg}"`,
          )
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
