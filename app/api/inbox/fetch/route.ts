import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireWriteAccess } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"
import { syncImapConnection } from "@modules/inbox/imap-sync"

const TAG = "[inbox/fetch]"

/**
 * POST /api/inbox/fetch
 *
 * Auto-detects the current workspace, finds the default (or first active)
 * IMAP/SMTP connection, and syncs emails into the inbox.
 */
export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireWriteAccess(request)

    console.log(`${TAG} Fetch requested for workspace=${workspaceId}`)

    const connection = await db.channelConnection.findFirst({
      where: {
        workspaceId,
        provider: "imap_smtp",
        status: "active",
        channelType: "email",
      },
      orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
      select: { id: true, name: true, externalAccountId: true },
    })

    if (!connection) {
      console.log(`${TAG} No active IMAP connection found for workspace=${workspaceId}`)
      return errorResponse(
        "NO_CONNECTION",
        "No hay conexión email IMAP activa. Configura una en Administración → Canales.",
        404,
      )
    }

    console.log(`${TAG} Syncing connection=${connection.id} (${connection.externalAccountId})`)

    const result = await syncImapConnection(connection.id)

    console.log(
      `${TAG} Done: fetched=${result.fetched} ingested=${result.ingested} skipped=${result.skipped} errors=${result.errors.length}`,
    )

    return successResponse({
      success: true,
      connectionId: connection.id,
      email: connection.externalAccountId,
      count: result.ingested,
      fetched: result.fetched,
      skipped: result.skipped,
      errors: result.errors,
    })
  } catch (error) {
    return handleError(error, "InboxFetch")
  }
}
