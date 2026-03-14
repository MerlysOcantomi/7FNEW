import { NextRequest } from "next/server"
import { db } from "@/lib/db"
import { successResponse, errorResponse, handleError, getPaginationParams } from "@/lib/api"
import { requireReadAccess, requireWriteAccess } from "@/lib/auth/workspace-auth"
import { createConversationFromInboxEntry } from "@/lib/modules/inbox/service"
import { runConversationIntelligence } from "@/lib/modules/inbox/intelligence"

export async function GET(request: NextRequest) {
  try {
    const { workspaceId } = await requireReadAccess()
    const { searchParams } = request.nextUrl
    const { page, pageSize, skip } = getPaginationParams(searchParams)

    const estado = searchParams.get("estado")
    const tipo = searchParams.get("tipo")
    const urgencia = searchParams.get("urgencia")
    const fuente = searchParams.get("fuente")
    const q = searchParams.get("q")

    const where: Record<string, unknown> = { workspaceId }

    if (estado && estado !== "todos") {
      where.estado = estado
    }
    if (tipo && tipo !== "todos") {
      where.tipo = tipo
    }
    if (urgencia && urgencia !== "todos") {
      where.urgencia = urgencia
    }
    if (fuente && fuente !== "todos") {
      where.fuente = fuente
    }
    if (q) {
      where.OR = [
        { nombre: { contains: q } },
        { email: { contains: q } },
        { mensaje: { contains: q } },
        { resumen: { contains: q } },
      ]
    }

    const [entries, total] = await Promise.all([
      db.inboxEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
      }),
      db.inboxEntry.count({ where }),
    ])

    return successResponse(entries, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    })
  } catch (error) {
    return handleError(error, "InboxEntry")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { workspaceId } = await requireWriteAccess()
    const body = await request.json()
    const { nombre, email, telefono, mensaje, fuente = "manual" } = body

    if (!mensaje || typeof mensaje !== "string" || mensaje.trim().length === 0) {
      return errorResponse("VALIDATION_ERROR", "El mensaje es requerido")
    }

    const entry = await db.inboxEntry.create({
      data: {
        nombre: nombre || null,
        email: email || null,
        telefono: telefono || null,
        mensaje: mensaje.trim(),
        fuente,
        estado: "nuevo",
        workspaceId,
      },
    })

    const conversationResult = await createConversationFromInboxEntry({
      inboxEntryId: entry.id,
      workspaceId,
      nombre,
      email,
      telefono,
      mensaje: mensaje.trim(),
      fuente,
    })
    const { conversation, contact } = conversationResult

    try {
      await runConversationIntelligence({
        workspaceId,
        conversationId: conversation.id,
        trigger: "inbox_post",
        sourceInboxEntryId: entry.id,
      })

      return successResponse({
        ...entry,
        estado: "clasificado",
        contactId: contact.id,
        conversationId: conversation.id,
        reusedConversation: conversationResult.reused,
        reopenedConversation: conversationResult.reopened,
      })
    } catch (err) {
      await db.inboxEntry.update({
        where: { id: entry.id },
        data: {
          estado: "error",
          notas: `Error de clasificacion: ${err instanceof Error ? err.message : "desconocido"}`,
        },
      })

      return successResponse({
        ...entry,
        estado: "error",
        contactId: contact.id,
        conversationId: conversation.id,
        reusedConversation: conversationResult.reused,
        reopenedConversation: conversationResult.reopened,
      })
    }
  } catch (error) {
    return handleError(error, "InboxEntry")
  }
}
