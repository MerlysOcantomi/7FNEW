import { NextRequest } from "next/server"
import { successResponse, errorResponse, handleError } from "@/lib/api"
import { requireAdminAccess } from "@/lib/auth/workspace-auth"
import { checkMembership } from "@/lib/workspace"
import { db } from "@/lib/db"
import { encryptJson } from "@core/crypto"
import { validateImapSmtp, resolveConfig } from "@modules/inbox/connection-validator"

type Params = { params: Promise<{ id: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { session } = await requireAdminAccess()
    const { id } = await params

    const member = await checkMembership(session.userId, id)
    if (!member) return errorResponse("FORBIDDEN", "No tienes acceso a este workspace", 403)

    const connections = await db.channelConnection.findMany({
      where: { workspaceId: id },
      orderBy: { createdAt: "desc" },
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

    return successResponse(connections)
  } catch (error) {
    return handleError(error, "Connections")
  }
}

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { session } = await requireAdminAccess()
    const { id } = await params

    const member = await checkMembership(session.userId, id)
    if (!member) return errorResponse("FORBIDDEN", "No tienes acceso a este workspace", 403)

    const body = await request.json()
    const {
      name,
      email,
      password,
      imapHost,
      imapPort,
      imapSecure,
      smtpHost,
      smtpPort,
      smtpSecure,
      fromName,
      setAsDefault = false,
      skipValidation = false,
    } = body as {
      name?: string
      email?: string
      password?: string
      imapHost?: string
      imapPort?: number
      imapSecure?: boolean
      smtpHost?: string
      smtpPort?: number
      smtpSecure?: boolean
      fromName?: string
      setAsDefault?: boolean
      skipValidation?: boolean
    }

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return errorResponse("VALIDATION_ERROR", "email es requerido y debe ser válido")
    }
    if (!password || typeof password !== "string") {
      return errorResponse("VALIDATION_ERROR", "password es requerido")
    }

    const existing = await db.channelConnection.findFirst({
      where: { workspaceId: id, externalAccountId: email.toLowerCase() },
    })
    if (existing) {
      return errorResponse("CONFLICT", "Ya existe una conexión con ese email en este workspace", 409)
    }

    const resolved = resolveConfig({
      email,
      password,
      imapHost,
      imapPort,
      imapSecure,
      smtpHost,
      smtpPort,
      smtpSecure,
    })

    if (!skipValidation) {
      const validation = await validateImapSmtp({ email, password, ...resolved })
      if (!validation.ok) {
        return successResponse({
          connected: false,
          validation,
          resolvedSettings: {
            imapHost: resolved.imapHost,
            imapPort: resolved.imapPort,
            smtpHost: resolved.smtpHost,
            smtpPort: resolved.smtpPort,
          },
        }, undefined, 200)
      }
    }

    const encryptedCredentials = encryptJson({ email: resolved.email, password })

    const config = JSON.stringify({
      fromEmail: resolved.email,
      fromName: fromName || name || null,
      imapHost: resolved.imapHost,
      imapPort: resolved.imapPort,
      imapSecure: resolved.imapSecure,
      smtpHost: resolved.smtpHost,
      smtpPort: resolved.smtpPort,
      smtpSecure: resolved.smtpSecure,
    })

    if (setAsDefault) {
      await db.channelConnection.updateMany({
        where: { workspaceId: id, channelType: "email", isDefault: true },
        data: { isDefault: false },
      })
    }

    const connection = await db.channelConnection.create({
      data: {
        workspaceId: id,
        channelType: "email",
        provider: "imap_smtp",
        name: name || email,
        config,
        credentials: encryptedCredentials,
        status: "active",
        externalAccountId: email.toLowerCase(),
        isDefault: setAsDefault,
      },
      select: {
        id: true,
        channelType: true,
        provider: true,
        name: true,
        status: true,
        externalAccountId: true,
        isDefault: true,
        createdAt: true,
      },
    })

    return successResponse({ connected: true, connection })
  } catch (error) {
    return handleError(error, "ConnectionCreate")
  }
}
