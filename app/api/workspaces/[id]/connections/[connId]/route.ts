import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireAdminInWorkspace } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string; connId: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { id, connId } = await params
    await requireAdminInWorkspace(id)

    const connection = await db.channelConnection.findFirst({
      where: { id: connId, workspaceId: id },
      select: {
        id: true,
        channelType: true,
        provider: true,
        name: true,
        config: true,
        status: true,
        externalAccountId: true,
        isDefault: true,
        lastSyncAt: true,
        lastError: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!connection) return errorResponse("NOT_FOUND", "Conexión no encontrada", 404)
    return successResponse(connection)
  } catch (error) {
    return handleError(error, "Connection")
  }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id, connId } = await params
    await requireAdminInWorkspace(id)

    const existing = await db.channelConnection.findFirst({
      where: { id: connId, workspaceId: id },
    })
    if (!existing) return errorResponse("NOT_FOUND", "Conexión no encontrada", 404)

    const body = await request.json()
    const { name, status, setAsDefault } = body as {
      name?: string
      status?: string
      setAsDefault?: boolean
    }

    const patch: Record<string, unknown> = {}
    if (name) patch.name = name
    if (status && ["active", "paused", "error"].includes(status)) patch.status = status

    if (setAsDefault === true) {
      await db.channelConnection.updateMany({
        where: { workspaceId: id, channelType: "email", isDefault: true, id: { not: connId } },
        data: { isDefault: false },
      })
      patch.isDefault = true
    } else if (setAsDefault === false) {
      patch.isDefault = false
    }

    /**
     * Re-scope the update by `{ id, workspaceId }` instead of `{ id }` alone. The previous
     * `findFirst` already proves the connection belongs to this tenant, but the unscoped
     * `update({ where: { id } })` would still flip a row from another workspace if a race
     * deleted-then-recreated the row under a different workspace between the two calls.
     * `updateMany` accepts compound filters and returns 0 instead of throwing on miss,
     * which is the correct semantics here — the existence guard already returned 404.
     */
    await db.channelConnection.updateMany({
      where: { id: connId, workspaceId: id },
      data: patch,
    })
    const updated = await db.channelConnection.findFirst({
      where: { id: connId, workspaceId: id },
      select: {
        id: true,
        channelType: true,
        provider: true,
        name: true,
        status: true,
        externalAccountId: true,
        isDefault: true,
        lastError: true,
        updatedAt: true,
      },
    })

    return successResponse(updated)
  } catch (error) {
    return handleError(error, "ConnectionUpdate")
  }
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  try {
    const { id, connId } = await params
    await requireAdminInWorkspace(id)

    /**
     * Use a workspace-scoped `deleteMany` instead of `delete({ where: { id } })` so the
     * delete cannot affect a same-id row in another tenant under a race. `count === 0`
     * means the connection was either never in this workspace or was already removed,
     * both of which surface as 404 to the caller.
     */
    const result = await db.channelConnection.deleteMany({
      where: { id: connId, workspaceId: id },
    })
    if (result.count === 0) return errorResponse("NOT_FOUND", "Conexión no encontrada", 404)

    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "ConnectionDelete")
  }
}
