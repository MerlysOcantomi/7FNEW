/**
 * CLEANUP TEMPORAL - Eliminar datos de prueba hardcodeados
 * Solo development - eliminar después de usar
 */

import { NextRequest } from "next/server"
import { successResponse, errorResponse } from "@/lib/api"
import { db } from "@core/db"

export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return errorResponse("NOT_FOUND", "Not available", 404)
  }

  try {
    console.log("[CLEANUP] Iniciando limpieza de datos de prueba...")

    // 1. Encontrar conversaciones de debug
    const debugConversations = await db.conversation.findMany({
      where: {
        OR: [
          { source: 'debug' },
          { contact: { email: { contains: '@debug.local' } } },
          { contact: { nombre: 'Test Visitor' } }
        ]
      },
      select: { id: true, subject: true }
    })

    console.log(`[CLEANUP] Encontradas ${debugConversations.length} conversaciones de debug`)

    // 2. Eliminar mensajes de estas conversaciones
    const deletedMessages = await db.message.deleteMany({
      where: {
        conversationId: {
          in: debugConversations.map(c => c.id)
        }
      }
    })

    console.log(`[CLEANUP] Eliminados ${deletedMessages.count} mensajes`)

    // 3. Eliminar las conversaciones
    const deletedConversations = await db.conversation.deleteMany({
      where: {
        OR: [
          { source: 'debug' },
          { contact: { email: { contains: '@debug.local' } } },
          { contact: { nombre: 'Test Visitor' } }
        ]
      }
    })

    console.log(`[CLEANUP] Eliminadas ${deletedConversations.count} conversaciones`)

    // 4. Eliminar contactos de debug
    const deletedContacts = await db.contact.deleteMany({
      where: {
        OR: [
          { email: { contains: '@debug.local' } },
          { nombre: 'Test Visitor' },
          { source: { startsWith: 'debug_' } }
        ]
      }
    })

    console.log(`[CLEANUP] Eliminados ${deletedContacts.count} contactos de debug`)

    // 5. Verificar limpieza
    const remaining = await db.conversation.count({
      where: {
        OR: [
          { source: 'debug' },
          { contact: { email: { contains: '@debug.local' } } }
        ]
      }
    })

    return successResponse({
      success: true,
      deleted: {
        messages: deletedMessages.count,
        conversations: deletedConversations.count,
        contacts: deletedContacts.count
      },
      remainingDebugConversations: remaining,
      note: remaining === 0 ? "✅ Limpieza completa - todos los datos de debug eliminados" : "⚠️ Aún quedan algunos datos de debug"
    })

  } catch (error) {
    console.error("[CLEANUP] Error:", error)
    return errorResponse("Error en limpieza", "INTERNAL_ERROR", 500)
  }
}