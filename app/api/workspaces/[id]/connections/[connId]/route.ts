import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireAdminAccess } from "@/lib/auth/workspace-auth"
import { checkMembership } from "@/lib/workspace"
import { db } from "@/lib/db"

type Params = { params: Promise<{ id: string; connId: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { session } = await requireAdminAccess()
    const { id, connId } = await params

    const member = await checkMembership(session.userId, id)
    if (!member) return errorResponse("FORBIDDEN", "No tienes acceso a este workspace", 403)

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
    const { session } = await requireAdminAccess()
    const { id, connId } = await params

    const member = await checkMembership(session.userId, id)
    if (!member) return errorResponse("FORBIDDEN", "No tienes acceso a este workspace", 403)

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

    const updated = await db.channelConnection.update({
      where: { id: connId },
      data: patch,
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
    const { session } = await requireAdminAccess()
    const { id, connId } = await params

    const member = await checkMembership(session.userId, id)
    if (!member) return errorResponse("FORBIDDEN", "No tienes acceso a este workspace", 403)

    const existing = await db.channelConnection.findFirst({
      where: { id: connId, workspaceId: id },
    })
    if (!existing) return errorResponse("NOT_FOUND", "Conexión no encontrada", 404)

    await db.channelConnection.delete({ where: { id: connId } })
    return successResponse({ deleted: true })
  } catch (error) {
    return handleError(error, "ConnectionDelete")
  }
}
