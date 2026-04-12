import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireAdminAccess } from "@/lib/auth/workspace-auth"
import { checkMembership } from "@/lib/workspace"
import { db } from "@/lib/db"
import { syncImapConnection } from "@modules/inbox/imap-sync"

type Params = { params: Promise<{ id: string; connId: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { session } = await requireAdminAccess()
    const { id, connId } = await params

    const member = await checkMembership(session.userId, id)
    if (!member) return errorResponse("FORBIDDEN", "No tienes acceso a este workspace", 403)

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
