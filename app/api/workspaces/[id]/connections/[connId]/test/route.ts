import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireAdminInWorkspace } from "@/lib/auth/workspace-auth"
import { db } from "@/lib/db"
import { decryptJson } from "@core/crypto"
import { validateImapSmtp, resolveConfig } from "@modules/inbox/connection-validator"

type Params = { params: Promise<{ id: string; connId: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  try {
    const { id, connId } = await params
    await requireAdminInWorkspace(id)

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
      await db.channelConnection.updateMany({
        where: { id: connId, workspaceId: id },
        data: { status: "error", lastError: "Failed to decrypt credentials" },
      })
      return errorResponse("INTERNAL_ERROR", "No se pudieron descifrar las credenciales", 500)
    }

    const resolved = await resolveConfig({
      email: creds.email,
      password: creds.password,
      imapHost: cfg.imapHost || undefined,
      imapPort: cfg.imapPort ? Number(cfg.imapPort) : undefined,
      imapSecure: cfg.imapSecure !== "false",
      smtpHost: cfg.smtpHost || undefined,
      smtpPort: cfg.smtpPort ? Number(cfg.smtpPort) : undefined,
      smtpSecure: cfg.smtpSecure !== "false",
    })

    const validation = await validateImapSmtp(resolved)

    const newStatus = validation.ok ? "active" : "error"
    const lastError = validation.ok
      ? null
      : [
          !validation.imap.ok ? `IMAP: ${validation.imap.error}` : null,
          !validation.smtp.ok ? `SMTP: ${validation.smtp.error}` : null,
        ].filter(Boolean).join("; ")

    await db.channelConnection.updateMany({
      where: { id: connId, workspaceId: id },
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
