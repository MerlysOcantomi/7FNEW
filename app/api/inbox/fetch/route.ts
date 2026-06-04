import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"
import { syncImapConnection } from "@modules/inbox/imap-sync"

const TAG = "[inbox/fetch]"

/**
 * Cooldown for AUTOMATIC syncs (mount / visibility / interval triggers that pass
 * `auto: true`). Mirrors the cron's `RECENT_SYNC_THRESHOLD_MS` (2 min) so the
 * open-Inbox auto-sync can't overlap-fetch a connection that the cron — or
 * another tab — synced moments ago. Manual "Sync now" (no `auto` flag) bypasses
 * this entirely: an explicit click is intentional user intent.
 *
 * This is the concurrency guard that makes adding client-side auto-sync safe
 * without a DB unique constraint / distributed lock: every automatic trigger
 * funnels through this gate, so the find-then-create dedupe never has to race a
 * second concurrent sync of the same mailbox within the cooldown window.
 */
const AUTO_SYNC_COOLDOWN_MS = 2 * 60 * 1000

/**
 * Resolve whether this request is an AUTOMATIC sync. Accepts either `?auto=1`
 * or a JSON body `{ auto: true }`. Manual "Sync now" sends neither, so it stays
 * a full (cooldown-bypassing) sync exactly as before. Body parsing is defensive
 * — a missing/!JSON body simply means "not auto".
 */
async function resolveAutoFlag(request: NextRequest): Promise<boolean> {
  if (request.nextUrl.searchParams.get("auto") === "1") return true
  const body = (await request.json().catch(() => null)) as { auto?: unknown } | null
  return body?.auto === true
}

/**
 * POST /api/inbox/fetch
 *
 * Manual fetch trigger from the Inbox UI. Auto-detects the workspace's email connection,
 * runs an IMAP sync, and returns a structured diagnostic so the UI can surface a useful
 * status to the operator instead of a silent no-op.
 *
 * Diagnostic contract:
 *  - 200 OK + `{ ok: true, ... }` → IMAP sync ran. Always includes `fetched`, `ingested`,
 *    `skipped`, `errors[]`, `connectionId`, `email`, `mailboxUidNext` so the UI can render
 *    "0 new" vs "5 new" vs "5 errors" without ambiguity.
 *  - 404 NO_CONNECTION → no `email` connection rows for this workspace at all. Operator must
 *    create one in Administración → Canales.
 *  - 400 CONNECTION_INACTIVE → an `email` connection exists but its `status` is not `active`.
 *    Returns the connection's `lastError` so the operator sees credential / IMAP errors.
 *  - 400 PROVIDER_NOT_FETCHABLE → the connection exists and is active, but its provider does
 *    not support manual IMAP fetch (e.g. resend webhook-only, gmail OAuth). The operator
 *    sees a clear message instead of a fake "synced" toast.
 *
 * We deliberately use a single endpoint for all four states: each branch returns enough
 * structured data for the UI to render the right banner (success / warning / error).
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireWriteAccess(request)

    const auto = await resolveAutoFlag(request)

    console.log(`${TAG} Fetch requested for workspace=${workspaceId} auto=${auto}`)

    /**
     * Look up *any* email connection first (regardless of status) so we can distinguish
     * "no connection exists" from "connection exists but is inactive / error". The previous
     * implementation only matched `status=active`, which made every inactive case collapse
     * into NO_CONNECTION and hid the real reason from the operator.
     */
    const connection = await db.channelConnection.findFirst({
      where: {
        workspaceId,
        channelType: "email",
      },
      orderBy: [{ isDefault: "desc" }, { status: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        name: true,
        provider: true,
        status: true,
        externalAccountId: true,
        lastError: true,
        lastSyncAt: true,
        syncState: true,
      },
    })

    if (!connection) {
      console.warn(`${TAG} NO_CONNECTION workspace=${workspaceId}`)
      return errorResponse(
        "NO_CONNECTION",
        "No hay conexión de email configurada para este workspace. Configura una en Administración → Canales.",
        404,
      )
    }

    /**
     * Compact connection summary echoed in every response for diagnostics. Excludes
     * credentials and full syncState — only the cursor headline (`lastUid`) is exposed
     * because it's useful when the operator is debugging "I sent an email and it didn't
     * appear".
     */
    let lastUid: number | null = null
    try {
      const parsed = connection.syncState ? JSON.parse(connection.syncState) : null
      if (parsed && typeof parsed.lastUid === "number") lastUid = parsed.lastUid
    } catch {
      /* malformed syncState is reported via the /diagnose script, not here */
    }

    const connectionSummary = {
      connectionId: connection.id,
      provider: connection.provider,
      status: connection.status,
      email: connection.externalAccountId,
      lastSyncAt: connection.lastSyncAt?.toISOString() ?? null,
      lastUid,
    }

    if (connection.status !== "active") {
      console.warn(
        `${TAG} CONNECTION_INACTIVE workspace=${workspaceId} conn=${connection.id} status=${connection.status} lastError="${connection.lastError ?? ""}"`,
      )
      return errorResponse(
        "CONNECTION_INACTIVE",
        connection.lastError
          ? `La conexión "${connection.name}" está inactiva: ${connection.lastError}`
          : `La conexión "${connection.name}" está inactiva (status=${connection.status}). Revísala en Administración → Canales.`,
        400,
      )
    }

    /**
     * Manual fetch is wired to IMAP today. Other providers (resend webhook-only, future
     * Gmail OAuth) ingest via push channels and don't need a "Fetch" button — but if the
     * operator clicks Fetch with such a connection, return a clear message so they know
     * nothing is broken: it's just that the channel is push-based.
     */
    if (connection.provider !== "imap_smtp") {
      console.warn(
        `${TAG} PROVIDER_NOT_FETCHABLE workspace=${workspaceId} conn=${connection.id} provider=${connection.provider}`,
      )
      return errorResponse(
        "PROVIDER_NOT_FETCHABLE",
        `La conexión "${connection.name}" usa ${connection.provider} (push-based). No requiere fetch manual: los emails llegan automáticamente vía webhook.`,
        400,
      )
    }

    /**
     * Cooldown gate for AUTOMATIC syncs only. If the connection was synced within
     * the cooldown window, we skip the IMAP round-trip and return a structured
     * "cooldown" response (NOT an error). Keeps the result shape compatible
     * (count/fetched/ingested = 0) so the client treats it as a quiet no-op.
     * Manual "Sync now" (`auto === false`) never reaches this branch.
     */
    if (
      auto &&
      connection.lastSyncAt &&
      Date.now() - connection.lastSyncAt.getTime() < AUTO_SYNC_COOLDOWN_MS
    ) {
      console.log(
        `${TAG} cooldown skip conn=${connection.id} lastSyncAt=${connection.lastSyncAt.toISOString()} (auto)`,
      )
      return successResponse({
        ok: true,
        success: true,
        cooldown: true,
        count: 0,
        fetched: 0,
        ingested: 0,
        skipped: 0,
        errors: [],
        cursorReset: false,
        connection: connectionSummary,
      })
    }

    console.log(
      `${TAG} Syncing conn=${connection.id} email=${connection.externalAccountId} lastUid=${lastUid ?? "null"} lastSyncAt=${connection.lastSyncAt?.toISOString() ?? "null"}`,
    )

    const result = await syncImapConnection(connection.id)

    console.log(
      `${TAG} Done workspace=${workspaceId} conn=${connection.id} fetched=${result.fetched} ingested=${result.ingested} skipped=${result.skipped} errors=${result.errors.length} cursorReset=${result.cursorReset === true}`,
    )

    /**
     * `ok` is the structured success flag. We keep `success: true` too for backward
     * compatibility with the previous shape (the legacy UI handler reads `json.data.count`).
     * `count` mirrors `ingested` for the same reason.
     */
    return successResponse({
      ok: true,
      success: true,
      count: result.ingested,
      fetched: result.fetched,
      ingested: result.ingested,
      skipped: result.skipped,
      errors: result.errors,
      cursorReset: result.cursorReset === true,
      connection: connectionSummary,
    })
  } catch (error) {
    return handleError(error, "InboxFetch")
  }
}
