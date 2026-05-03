import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireAdminInWorkspace } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"
import { syncImapConnection } from "@modules/inbox/imap-sync"

type Params = { params: Promise<{ id: string; connId: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { id, connId } = await params
    await requireAdminInWorkspace(id)

    const connection = await db.channelConnection.findFirst({
      where: { id: connId, workspaceId: id, provider: "imap_smtp" },
      select: { id: true, status: true },
    })

    if (!connection) return errorResponse("NOT_FOUND", "Conexión IMAP/SMTP no encontrada", 404)

    const result = await syncImapConnection(connId)

    return successResponse({
      ok: result.errors.length === 0,
      fetched: result.fetched,
      ingested: result.ingested,
      skipped: result.skipped,
      errors: result.errors,
    })
  } catch (error) {
    return handleError(error, "ConnectionSync")
  }
}
