import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireAdminAccess } from "@/lib/auth/workspace-auth"
import { checkMembership } from "@/lib/workspace"
import { db } from "@/lib/db"
import { decryptJson } from "@core/crypto"
import { validateImapSmtp, resolveConfig } from "@modules/inbox/connection-validator"

type Params = { params: Promise<{ id: string; connId: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { session } = await requireAdminAccess()
    const { id, connId } = await params

    const member = await checkMembership(session.userId, id)
    if (!member) return errorResponse("FORBIDDEN", "No tienes acceso a este workspace", 403)

    const connection = await db.channelConnection.findFirst({
      where: { id: connId, workspaceId: id },
      select: { id: true, provider: true, config: true, credentials: true, externalAccountId: true },
    })

    if (!connection) return errorResponse("NOT_FOUND", "Conexión no encontrada", 404)

    if (connection.provider !== "imap_smtp") {
      return errorResponse("VALIDATION_ERROR", "Solo conexiones IMAP/SMTP pueden ser testeadas con este endpoint")
    }

    if (!connection.credentials) {
      return errorResponse("VALIDATION_ERROR", "La conexión no tiene credenciales configuradas")
    }

    const cfg = connection.config ? JSON.parse(connection.config) as Record<string, string> : {}
    let creds: { email: string; password: string }
    try {
      creds = decryptJson(connection.credentials)
    } catch {
      await db.channelConnection.update({
        where: { id: connId },
        data: { status: "error", lastError: "Failed to decrypt credentials" },
      })
      return errorResponse("INTERNAL_ERROR", "No se pudieron descifrar las credenciales", 500)
    }

    const resolved = resolveConfig({
      email: creds.email,
      password: creds.password,
      imapHost: cfg.imapHost,
      imapPort: cfg.imapPort ? Number(cfg.imapPort) : undefined,
      imapSecure: cfg.imapSecure !== "false",
      smtpHost: cfg.smtpHost,
      smtpPort: cfg.smtpPort ? Number(cfg.smtpPort) : undefined,
      smtpSecure: cfg.smtpSecure !== "false",
    })

    const validation = await validateImapSmtp({ ...resolved, password: creds.password })

    const newStatus = validation.ok ? "active" : "error"
    const lastError = validation.ok
      ? null
      : [
          !validation.imap.ok ? `IMAP: ${validation.imap.error}` : null,
          !validation.smtp.ok ? `SMTP: ${validation.smtp.error}` : null,
        ].filter(Boolean).join("; ")

    await db.channelConnection.update({
      where: { id: connId },
      data: { status: newStatus, lastError, lastSyncAt: validation.ok ? new Date() : undefined },
    })

    return successResponse({
      ok: validation.ok,
      status: newStatus,
      imap: { ok: validation.imap.ok, error: validation.imap.error },
      smtp: { ok: validation.smtp.ok, error: validation.smtp.error },
    })
  } catch (error) {
    return handleError(error, "ConnectionTest")
  }
}
