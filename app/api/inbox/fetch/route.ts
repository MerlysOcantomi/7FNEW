import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"
import { syncImapConnection } from "@modules/inbox/imap-sync"

const TAG = "[inbox/fetch]"

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

    console.log(`${TAG} Fetch requested for workspace=${workspaceId}`)

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
