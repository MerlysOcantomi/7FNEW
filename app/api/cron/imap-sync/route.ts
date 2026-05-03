import { NextRequest, NextResponse } from "next/server"
import { db } from "@core/db"
import { syncImapConnection } from "@modules/inbox/imap-sync"

/**
 * Scheduled IMAP sync — automatic ingestion for active email connections.
 *
 * Runs on a Vercel Cron schedule (see `vercel.json`). Both `GET` and `POST`
 * are supported because:
 *  - Vercel Cron invokes the endpoint via `GET` and adds an
 *    `Authorization: Bearer ${CRON_SECRET}` header automatically when
 *    `CRON_SECRET` is configured in the project's env vars.
 *  - External schedulers / manual debug curls may prefer `POST`. The handler
 *    is identical for both verbs — no second ingestion path is created.
 *
 * Single source of truth: this route reuses `syncImapConnection` (the same
 * function the manual `POST /api/inbox/fetch` button calls), so no
 * duplicate ingestion code, no risk of duplicate messages, and any future
 * sync logic improvements automatically propagate to both surfaces.
 *
 * Overlap protection (MVP):
 *  - We refuse to re-sync a connection whose `lastSyncAt` is within
 *    `RECENT_SYNC_THRESHOLD_MS` of `now`. Manual Fetch bypasses this check
 *    because it goes through `/api/inbox/fetch` directly — operators can
 *    always force a sync.
 *  - We don't yet hold a per-connection lock for *concurrent* invocations.
 *    Vercel Cron does not overlap a single schedule with itself, and our
 *    loop is sequential (for-of), so cross-connection concurrency within a
 *    single tick is not an issue. If/when we add a second trigger (manual
 *    Fetch + Cron firing within the same second) the worst case today is a
 *    single duplicate IMAP fetch — `findWorkspaceScopedDuplicate` and the
 *    UID cursor in `syncImapConnection` make message-level duplication
 *    impossible. Distributed-lock work is tracked under the IDLE/push phase
 *    described below.
 *
 * Authorization:
 *  - When `CRON_SECRET` is set, requests must carry
 *    `Authorization: Bearer ${CRON_SECRET}` (Vercel Cron does this for you).
 *  - In production we **fail closed** if `CRON_SECRET` is missing — the
 *    endpoint must never be publicly executable without a secret.
 *  - In dev (`NODE_ENV !== "production"`) we allow unauthenticated calls so
 *    a developer can curl the endpoint without setting up env vars.
 *
 * Workspace isolation:
 *  - The query filters by `provider`, `channelType`, `status` (no
 *    `workspaceId` — the cron is workspace-agnostic by design). Each
 *    connection's `workspaceId` is honored downstream by
 *    `syncImapConnection`/`ingestInboundEmail`.
 *
 * Future near-real-time options (intentionally NOT implemented in this
 * phase — would require persistent-worker / queue infra we don't have yet):
 *  - IMAP IDLE worker for IMAP/Titan/Hostinger (long-lived connection,
 *    server pushes new mail).
 *  - Gmail push notifications via Cloud Pub/Sub.
 *  - Microsoft Graph webhooks for Outlook/Office 365.
 *  - WhatsApp / Instagram / TikTok / Messenger webhooks for those channels.
 * Until then, 5-minute polling is the operational MVP.
 */

const TAG = "[cron:imap-sync]"

/**
 * Skip a connection if it was synced less than this many ms ago. 2 min was
 * chosen to be slightly less than the schedule cadence (5 min) so a brief
 * cron retry never bypasses the cooldown, but well above the time it takes
 * a normal sync to complete (~1-3s). Manual Fetch bypasses this entirely.
 */
const RECENT_SYNC_THRESHOLD_MS = 2 * 60 * 1000

interface ConnectionResultRow {
  connectionId: string
  fetched: number
  ingested: number
  /** Per-message duplicates skipped during this sync (existing UID etc.). */
  messageSkipped: number
  errors: string[]
}

interface SyncSummary {
  ok: boolean
  /** Total active IMAP/SMTP email connections inspected. */
  checked: number
  /** Connections actually synced (passed the cooldown gate). */
  synced: number
  /** Connections skipped because of the cooldown gate. */
  skipped: number
  /** Sum of `fetched` across synced connections (raw IMAP messages pulled). */
  fetched: number
  /** Sum of `ingested` (new messages persisted). */
  ingested: number
  /** Connections that errored during sync (one entry each). */
  errors: Array<{ connectionId: string; messages: string[] }>
  results: ConnectionResultRow[]
  scheduledAt: string
  /**
   * Echo of the cron metadata Vercel attaches when invoking the endpoint, so
   * we have a paper trail in the logs for which schedule actually fired.
   */
  triggeredBy: "vercel-cron" | "manual" | "unknown"
}

function isAuthorized(request: NextRequest): { ok: boolean; reason?: string; status?: number } {
  const authHeader = request.headers.get("authorization") ?? ""
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    if (process.env.NODE_ENV === "production") {
      return { ok: false, reason: "CRON_SECRET not configured", status: 500 }
    }
    return { ok: true }
  }

  const token = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length) : authHeader
  if (token !== cronSecret) {
    return { ok: false, reason: "Unauthorized", status: 401 }
  }
  return { ok: true }
}

async function runScheduledSync(triggeredBy: SyncSummary["triggeredBy"]): Promise<SyncSummary> {
  const startedAt = new Date()
  const now = Date.now()

  /**
   * Workspace isolation: we deliberately do NOT filter by workspaceId here —
   * the cron sweeps every active connection and `syncImapConnection` reads
   * each connection's own `workspaceId` for downstream ingestion. We only
   * select the columns we need; credentials never leave the DB layer
   * (decryption happens inside `syncImapConnection`).
   */
  const connections = await db.channelConnection.findMany({
    where: { provider: "imap_smtp", channelType: "email", status: "active" },
    select: { id: true, externalAccountId: true, lastSyncAt: true, workspaceId: true },
    orderBy: { lastSyncAt: "asc" },
  })

  const summary: SyncSummary = {
    ok: true,
    checked: connections.length,
    synced: 0,
    skipped: 0,
    fetched: 0,
    ingested: 0,
    errors: [],
    results: [],
    scheduledAt: startedAt.toISOString(),
    triggeredBy,
  }

  for (const conn of connections) {
    /**
     * Cooldown gate — protects IMAP servers from being hammered when:
     *  - the cron schedule overlaps a recent manual Fetch
     *  - a previous tick is still propagating its `lastSyncAt` write
     *  - a future tighter schedule (e.g. every 3 minutes) ever lands
     */
    if (conn.lastSyncAt && now - conn.lastSyncAt.getTime() < RECENT_SYNC_THRESHOLD_MS) {
      summary.skipped++
      summary.results.push({
        connectionId: conn.id,
        fetched: 0,
        ingested: 0,
        messageSkipped: 0,
        errors: [],
      })
      continue
    }

    try {
      const result = await syncImapConnection(conn.id)
      summary.synced++
      summary.fetched += result.fetched
      summary.ingested += result.ingested
      summary.results.push({
        connectionId: conn.id,
        fetched: result.fetched,
        ingested: result.ingested,
        messageSkipped: result.skipped,
        errors: result.errors,
      })
      if (result.errors.length > 0) {
        summary.errors.push({ connectionId: conn.id, messages: result.errors })
      }
    } catch (err) {
      // Per-connection error isolation: one bad mailbox never stops the others.
      const message = err instanceof Error ? err.message : String(err)
      summary.errors.push({ connectionId: conn.id, messages: [message] })
      summary.results.push({
        connectionId: conn.id,
        fetched: 0,
        ingested: 0,
        messageSkipped: 0,
        errors: [message],
      })
      console.error(`${TAG} connection=${conn.id} email=${conn.externalAccountId} error="${message}"`)
    }
  }

  if (summary.errors.length > 0) {
    summary.ok = false
  }

  console.log(
    `${TAG} done triggeredBy=${triggeredBy} checked=${summary.checked} synced=${summary.synced} skipped=${summary.skipped} ingested=${summary.ingested} errors=${summary.errors.length}`,
  )

  return summary
}

async function handle(request: NextRequest) {
  const auth = isAuthorized(request)
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.reason }, { status: auth.status ?? 401 })
  }

  const triggeredBy: SyncSummary["triggeredBy"] = request.headers.get("x-vercel-cron")
    ? "vercel-cron"
    : request.headers.get("authorization")
      ? "manual"
      : "unknown"

  try {
    const summary = await runScheduledSync(triggeredBy)
    return NextResponse.json(summary)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`${TAG} fatal error: ${message}`)
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}
